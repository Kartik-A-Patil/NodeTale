import { Project } from '../models/story';
import { getStorageAdapter } from './storage';
import { compactProject } from './storageService';
import { packCode, unpackCode, ShareCodeError } from './shareLink';

// Sharing a story straight from one browser to another, media included, with
// nothing in between: no server, no relay. WebRTC carries the data; the two
// browsers introduce themselves by hand, with an invite (in the share link)
// and a reply code sent back. Public STUN only tells each browser its own
// public address, so the two can reach each other across networks.

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
/** Candidates found within this time go in the code; waiting longer rarely finds more. */
const GATHER_MS = 4000;

interface InviteCode { kind: 'invite'; name: string; sdp: string }
interface ReplyCode { kind: 'reply'; sdp: string }

// A code has to hold every way to reach this browser, so wait for candidate gathering to finish.
const gathered = (pc: RTCPeerConnection) =>
  new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => { if (pc.iceGatheringState === 'complete') resolve(); };
    pc.addEventListener('icegatheringstatechange', done);
    setTimeout(resolve, GATHER_MS);
  });

const failedHere = (pc: RTCPeerConnection, onFail: () => void) =>
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed') onFail();
  });

export const CONNECT_FAILED =
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

const fileOf = async (asset: Project['assets'][number]): Promise<Blob | null> => {
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
  ch.bufferedAmountLowThreshold = 1024 * 1024;
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
  onProgress({ done, total, files: 0, fileCount: files.length });
  for (const [i, { asset, blob }] of files.entries()) {
    send({ t: 'file', id: asset.id, size: blob.size, type: blob.type });
    const bytes = await blob.arrayBuffer();
    for (let at = 0; at < bytes.byteLength; at += CHUNK) {
      await drained(ch);
      ch.send(bytes.slice(at, at + CHUNK));
      done += Math.min(CHUNK, bytes.byteLength - at);
      onProgress({ done, total, files: i, fileCount: files.length });
    }
    onProgress({ done, total, files: i + 1, fileCount: files.length });
  }
  send({ t: 'done' });
  await received;
}

/** Receive a story and its media, saving each file as it completes. Resolves with the story. */
export function receiveStory(ch: Channel, onProgress: (p: Progress) => void): Promise<Project> {
  return new Promise((resolve, reject) => {
    let project: Project | null = null;
    let total = 0, done = 0, files = 0, fileCount = 0;
    let current: { id: string; size: number; type: string; parts: ArrayBuffer[]; got: number } | null = null;
    const saves: Promise<unknown>[] = [];

    const finishFile = () => {
      if (!current) return;
      const blob = new Blob(current.parts, { type: current.type });
      saves.push(getStorageAdapter().saveAsset(blob, current.id));
      current = null;
      files++;
      onProgress({ done, total, files, fileCount });
    };

    ch.addEventListener('message', (e) => {
      try {
        if (typeof e.data !== 'string') {
          if (!current) return;
          const part = e.data as ArrayBuffer;
          current.parts.push(part);
          current.got += part.byteLength;
          done += part.byteLength;
          onProgress({ done, total, files, fileCount });
          if (current.got >= current.size) finishFile();
          return;
        }
        const m = JSON.parse(e.data) as Message;
        if (m.t === 'story') {
          project = m.project;
          fileCount = m.media.length;
          total = m.media.reduce((sum, x) => sum + x.size, 0);
          onProgress({ done, total, files, fileCount });
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

export interface Invite {
  /** Goes after the # in the share link. */
  code: string;
  /** Paste the other person's reply: connects, sends everything, resolves when they have it. */
  accept: (reply: string, onProgress: (p: Progress) => void) => Promise<void>;
  close: () => void;
}

/** Your side: an invite for one person to receive this story. */
export async function createInvite(project: Project): Promise<Invite> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const channel = pc.createDataChannel('nodetale', { ordered: true });
  channel.binaryType = 'arraybuffer';
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  const code = await packCode({ kind: 'invite', name: project.name, sdp: pc.localDescription!.sdp } satisfies InviteCode);

  return {
    code,
    close: () => pc.close(),
    accept: async (reply, onProgress) => {
      const answer = await unpackCode<ReplyCode>(reply);
      if (answer.kind !== 'reply') throw new ShareCodeError('That’s not a reply code. Ask them for the code their page shows.');
      await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
      await new Promise<void>((resolve, reject) => {
        if (channel.readyState === 'open') return resolve();
        channel.addEventListener('open', () => resolve());
        failedHere(pc, () => reject(new Error(CONNECT_FAILED)));
      });
      await sendStory(channel, project, onProgress);
    },
  };
}

export interface Answer {
  /** The story's name, from the invite. */
  name: string;
  /** Send this back to the person sharing. */
  reply: string;
  /** Resolves with the story once it and every file have arrived (files are saved as they come). */
  receive: (onProgress: (p: Progress) => void) => Promise<Project>;
  close: () => void;
}

/** Their side: answer an invite from a share link. */
export async function answerInvite(code: string): Promise<Answer> {
  const invite = await unpackCode<InviteCode>(code);
  if (invite.kind !== 'invite') throw new ShareCodeError('This isn’t a share link. It may be a reply code meant for the person sharing.');
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const channel = new Promise<RTCDataChannel>((resolve) =>
    pc.addEventListener('datachannel', (e) => { e.channel.binaryType = 'arraybuffer'; resolve(e.channel); }));
  await pc.setRemoteDescription({ type: 'offer', sdp: invite.sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  const reply = await packCode({ kind: 'reply', sdp: pc.localDescription!.sdp } satisfies ReplyCode);

  return {
    name: invite.name,
    reply,
    close: () => pc.close(),
    receive: (onProgress) =>
      new Promise<Project>((resolve, reject) => {
        failedHere(pc, () => reject(new Error(CONNECT_FAILED)));
        channel.then((ch) => receiveStory(ch, onProgress)).then(resolve, reject);
      }),
  };
}
