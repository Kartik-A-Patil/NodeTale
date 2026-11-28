import { Project } from '../models/story';
import { getStorageAdapter } from './storage';
import { compactProject } from './storageService';
import { encodeConnectCode, decodeConnectCode, isLiveInvite, inviteKeyOf } from './connectCode';

// Sharing a story straight from one browser to another, media included, with
// nothing in between: no server, no relay. WebRTC carries the data; the two
// browsers introduce themselves by hand, with an invite (in the share link)
// and a reply code sent back. Public STUN only tells each browser its own
// public address, so the two can reach each other across networks.

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

// A code must hold the ways to reach this browser. Addresses arrive within
// milliseconds, but "gathering complete" can take seconds (a STUN server that
// never answers), so stop shortly after the first public address, or after a
// short wait with local ones only (same network).
const gathered = (pc: RTCPeerConnection) =>
  new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (ms: number) => { clearTimeout(timer); timer = setTimeout(resolve, ms); };
    if (pc.iceGatheringState === 'complete') return resolve();
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') resolve(); });
    pc.addEventListener('icecandidate', (e) => {
      if (!e.candidate) return resolve();
      if (/ typ srflx/.test(e.candidate.candidate)) finish(150);
    });
    finish(1500);
  });

const failedHere = (pc: RTCPeerConnection, onFail: () => void) =>
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed') onFail();
  });

const CONNECT_FAILED =
  'Couldn’t connect. Some office, school or mobile networks block direct connections; try another network (or both on the same Wi-Fi).';

// ---------- the transfer: what goes over the connection ----------

/** The part of a data channel the transfer needs; a fake one stands in for tests. */
export interface Channel {
  send(data: string | ArrayBuffer): void;
  bufferedAmount: number;
  bufferedAmountLowThreshold: number;
  addEventListener(type: 'message', fn: (e: { data: unknown }) => void): void;
  addEventListener(type: 'bufferedamountlow', fn: () => void): void;
  removeEventListener(type: 'bufferedamountlow', fn: () => void): void;
}

export interface Progress {
  /** The story's name, once known. */
  name?: string;
  /** Bytes of media sent or received so far, and in all. */
  done: number;
  total: number;
  /** Files finished, and in all. */
  files: number;
  fileCount: number;
}

type Message =
  | { t: 'story'; project: Project; media: { id: string; size: number; type: string }[] }
  | { t: 'file'; id: string; size: number; type: string }
  | { t: 'done' }
  | { t: 'received' };

const CHUNK = 16 * 1024; // safe message size in every browser
const HIGH_WATER = 4 * 1024 * 1024; // pause when this much is waiting to go out

const drained = (ch: Channel) =>
  ch.bufferedAmount <= HIGH_WATER
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        const go = () => { ch.removeEventListener('bufferedamountlow', go); resolve(); };
        ch.addEventListener('bufferedamountlow', go);
      });

/** A file's bytes in channel-sized pieces, pausing whenever the channel backs up. */
export async function sendBytes(ch: Channel, blob: Blob, onChunk: (bytes: number) => void = () => {}) {
  ch.bufferedAmountLowThreshold = 1024 * 1024;
  const bytes = await blob.arrayBuffer();
  for (let at = 0; at < bytes.byteLength; at += CHUNK) {
    await drained(ch);
    ch.send(bytes.slice(at, at + CHUNK));
    onChunk(Math.min(CHUNK, bytes.byteLength - at));
  }
}

export const fileOf = async (asset: Project['assets'][number]): Promise<Blob | null> => {
  try {
    // Older projects keep media inline as data: URLs.
    if (asset.url?.startsWith('data:')) return await (await fetch(asset.url)).blob();
    return await getStorageAdapter().getAssetData(asset.id);
  } catch {
    return null; // a missing file shouldn't stop the rest
  }
};

/** Send a story and all its media; resolves once the other side has everything. */
export async function sendStory(ch: Channel, project: Project, onProgress: (p: Progress) => void): Promise<void> {
  const files = (await Promise.all(project.assets.map(async (a) => ({ asset: a, blob: await fileOf(a) }))))
    .filter((f): f is { asset: typeof f.asset; blob: Blob } => f.blob !== null);
  const media = files.map(({ asset, blob }) => ({ id: asset.id, size: blob.size, type: blob.type }));
  const total = media.reduce((sum, m) => sum + m.size, 0);
  const received = new Promise<void>((resolve) =>
    ch.addEventListener('message', (e) => { if (typeof e.data === 'string' && (JSON.parse(e.data) as Message).t === 'received') resolve(); }));

  const story = compactProject(project);
  const send = (m: Message) => ch.send(JSON.stringify(m));
  // Media goes as files; urls only made sense on this device.
  send({ t: 'story', project: { ...story, assets: story.assets.map((a) => ({ ...a, url: '' })) }, media });

  let done = 0;
  const name = project.name;
  onProgress({ name, done, total, files: 0, fileCount: files.length });
  for (const [i, { asset, blob }] of files.entries()) {
    send({ t: 'file', id: asset.id, size: blob.size, type: blob.type });
    await sendBytes(ch, blob, (n) => {
      done += n;
      onProgress({ name, done, total, files: i, fileCount: files.length });
    });
    onProgress({ name, done, total, files: i + 1, fileCount: files.length });
  }
  send({ t: 'done' });
  await received;
}

/** Receive a story and its media, saving each file as it completes. Resolves with the story. */
export function receiveStory(ch: Channel, onProgress: (p: Progress) => void): Promise<Project> {
  return new Promise((resolve, reject) => {
    let project: Project | null = null;
    let name: string | undefined;
    let total = 0, done = 0, files = 0, fileCount = 0;
    const report = () => onProgress({ name, done, total, files, fileCount });
    let current: { id: string; size: number; type: string; parts: ArrayBuffer[]; got: number } | null = null;
    const saves: Promise<unknown>[] = [];

    const finishFile = () => {
      if (!current) return;
      const blob = new Blob(current.parts, { type: current.type });
      saves.push(getStorageAdapter().saveAsset(blob, current.id));
      current = null;
      files++;
      report();
    };

    ch.addEventListener('message', (e) => {
      try {
        if (typeof e.data !== 'string') {
          if (!current) return;
          const part = e.data as ArrayBuffer;
          current.parts.push(part);
          current.got += part.byteLength;
          done += part.byteLength;
          report();
          if (current.got >= current.size) finishFile();
          return;
        }
        const m = JSON.parse(e.data) as Message;
        if (m.t === 'story') {
          project = m.project;
          name = m.project.name;
          fileCount = m.media.length;
          total = m.media.reduce((sum, x) => sum + x.size, 0);
          report();
        } else if (m.t === 'file') {
          current = { id: m.id, size: m.size, type: m.type, parts: [], got: 0 };
          if (m.size === 0) finishFile();
        } else if (m.t === 'done') {
          Promise.all(saves).then(() => {
            ch.send(JSON.stringify({ t: 'received' } satisfies Message));
            if (project) resolve(project);
            else reject(new Error('The story didn’t arrive.'));
          }, reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}

// ---------- connecting by hand ----------

// A live session keeps only the channel; tie the connection to it so nothing
// ever collects the connection while the channel is in use.
const keepAlive = (ch: RTCDataChannel, pc: RTCPeerConnection) => Object.assign(ch, { connection: pc });

export interface Invite {
  /** Goes after the # in the share link. */
  code: string;
  /** Names this invite in replies (see replyInviteKey). */
  key: string;
  /** Paste the other person's reply: connects, sends everything, resolves when
   *  they have it. For a live invite, with the still-open channel to edit over. */
  accept: (reply: string, onProgress: (p: Progress) => void) => Promise<RTCDataChannel>;
  close: () => void;
}

/** Your side: an invite for one person to receive this story, or with `live`, to edit it together. */
export async function createInvite(project: Project | (() => Project), opts: { live?: boolean } = {}): Promise<Invite> {
  const current = () => (typeof project === 'function' ? project() : project);
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const channel = pc.createDataChannel('nodetale', { ordered: true });
  channel.binaryType = 'arraybuffer';
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  const code = encodeConnectCode(pc.localDescription!.sdp, 'invite', !!opts.live);

  return {
    code,
    key: inviteKeyOf(pc.localDescription!.sdp),
    close: () => pc.close(),
    accept: async (reply, onProgress) => {
      await pc.setRemoteDescription({ type: 'answer', sdp: decodeConnectCode(reply, 'reply') });
      await new Promise<void>((resolve, reject) => {
        if (channel.readyState === 'open') return resolve();
        channel.addEventListener('open', () => resolve());
        failedHere(pc, () => reject(new Error(CONNECT_FAILED)));
      });
      // The story as it is now, not as it was when the link was made.
      await sendStory(channel, current(), onProgress);
      return keepAlive(channel, pc);
    },
  };
}

export interface Answer {
  /** An invite to edit together (the connection stays open after the copy arrives). */
  live: boolean;
  /** Send this back to the person sharing. */
  reply: string;
  /** Resolves once the story and every file have arrived (files are saved as they come). */
  receive: (onProgress: (p: Progress) => void) => Promise<{ project: Project; channel: RTCDataChannel }>;
  close: () => void;
}

/** Their side: answer an invite from a share link. */
export async function answerInvite(code: string): Promise<Answer> {
  const offer = decodeConnectCode(code, 'invite');
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const channel = new Promise<RTCDataChannel>((resolve) =>
    pc.addEventListener('datachannel', (e) => { e.channel.binaryType = 'arraybuffer'; resolve(e.channel); }));
  await pc.setRemoteDescription({ type: 'offer', sdp: offer });
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  const live = isLiveInvite(code);
  const reply = encodeConnectCode(pc.localDescription!.sdp, 'reply', live, inviteKeyOf(offer));

  return {
    live,
    reply,
    close: () => pc.close(),
    receive: (onProgress) =>
      new Promise((resolve, reject) => {
        failedHere(pc, () => reject(new Error(CONNECT_FAILED)));
        channel.then(async (ch) => ({ project: await receiveStory(ch, onProgress), channel: keepAlive(ch, pc) })).then(resolve, reject);
      }),
  };
}
