// Invite and reply codes: just what one browser needs to reach another,
// packed as bytes. A browser's own connection description (SDP) is ~700
// characters of boilerplate; the parts that matter are an ICE username and
// password, the DTLS certificate fingerprint and a few addresses. These ~90
// bytes become ~120 URL-safe characters, and the full description is rebuilt
// from a standard data-channel template on the other side.

export class ConnectCodeError extends Error {}

export type CodeKind = 'invite' | 'reply';
type Setup = 'actpass' | 'active' | 'passive';
type CandType = 'host' | 'srflx' | 'relay';
interface Candidate { type: CandType; addr: string; port: number }
interface Essentials { kind: CodeKind; live: boolean; setup: Setup; ufrag: string; pwd: string; fingerprint: Uint8Array; candidates: Candidate[] }

const VERSION = 1;
const SETUPS: Setup[] = ['actpass', 'active', 'passive'];
const TYPES: CandType[] = ['host', 'srflx', 'relay'];
const MDNS = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
// Typical priorities per type, so the rebuilt candidates rank as the originals did.
const PRIORITY: Record<CandType, number> = { host: 2113937151, srflx: 1677729535, relay: 41885439 };
const MAX_CANDIDATES = 6;

const hexBytes = (hex: string) => Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16));
const bytesHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

function expandIpv6(addr: string): Uint8Array | null {
  if (addr.includes('.') || !addr.includes(':')) return null;
  const [head, tail = ''] = addr.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = addr.includes('::') ? [...h, ...Array(8 - h.length - t.length).fill('0'), ...t] : h;
  if (groups.length !== 8) return null;
  const out = new Uint8Array(16);
  groups.forEach((g, i) => { const n = parseInt(g || '0', 16); out[i * 2] = n >> 8; out[i * 2 + 1] = n & 255; });
  return out;
}
const ipv6Text = (b: Uint8Array) => Array.from({ length: 8 }, (_, i) => ((b[i * 2] << 8) | b[i * 2 + 1]).toString(16)).join(':');

function parse(sdp: string, kind: CodeKind, live: boolean): Essentials {
  const line = (key: string) => sdp.match(new RegExp(`^a=${key}:(.+)$`, 'm'))?.[1]?.trim();
  const ufrag = line('ice-ufrag'), pwd = line('ice-pwd'), setup = line('setup') as Setup | undefined;
  const fp = line('fingerprint');
  if (!ufrag || !pwd || !setup || !fp?.toLowerCase().startsWith('sha-256 ')) throw new ConnectCodeError('This browser’s connection details couldn’t be read.');
  const candidates: Candidate[] = [];
  for (const m of sdp.matchAll(/^a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ (host|srflx|relay)/gim)) {
    const [, addr, port, type] = m;
    if (!(IPV4.test(addr) || MDNS.test(addr) || expandIpv6(addr))) continue;
    if (!candidates.some((c) => c.addr === addr && c.port === +port)) candidates.push({ type: type as CandType, addr, port: +port });
  }
  return { kind, live, setup, ufrag, pwd, fingerprint: hexBytes(fp.slice(8).replace(/:/g, '')), candidates: candidates.slice(0, MAX_CANDIDATES) };
}

function toBytes(e: Essentials): Uint8Array {
  // Header: version (4 bits) · live session (1) · DTLS setup (2) · reply (1).
  const out: number[] = [(VERSION << 4) | (e.live ? 8 : 0) | (SETUPS.indexOf(e.setup) << 1) | (e.kind === 'reply' ? 1 : 0)];
  const text = (s: string) => out.push(s.length, ...Array.from(s, (c) => c.charCodeAt(0)));
  text(e.ufrag);
  text(e.pwd);
  out.push(...e.fingerprint);
  out.push(e.candidates.length);
  for (const c of e.candidates) {
    const mdns = c.addr.match(MDNS);
    const v6 = !mdns && !IPV4.test(c.addr) ? expandIpv6(c.addr) : null;
    const addrKind = mdns ? 2 : v6 ? 1 : 0;
    out.push(TYPES.indexOf(c.type) | (addrKind << 2));
    if (mdns) out.push(...hexBytes(mdns.slice(1).join('')));
    else if (v6) out.push(...v6);
    else out.push(...c.addr.split('.').map(Number));
    out.push(c.port >> 8, c.port & 255);
  }
  return Uint8Array.from(out);
}

function fromBytes(b: Uint8Array): Essentials {
  let i = 0;
  const take = (n: number) => { if (i + n > b.length) throw new Error('short'); const s = b.subarray(i, i + n); i += n; return s; };
  const head = take(1)[0];
  if (head >> 4 !== VERSION) throw new ConnectCodeError('This code is from a different version of NodeTale.');
  const text = () => String.fromCharCode(...take(take(1)[0]));
  const e: Essentials = {
    kind: head & 1 ? 'reply' : 'invite',
    live: !!(head & 8),
    setup: SETUPS[(head >> 1) & 3] ?? 'actpass',
    ufrag: text(),
    pwd: text(),
    fingerprint: take(32),
    candidates: [],
  };
  const count = take(1)[0];
  for (let n = 0; n < count; n++) {
    const flags = take(1)[0];
    const addrKind = flags >> 2;
    let addr: string;
    if (addrKind === 2) {
      const h = bytesHex(take(16));
      addr = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}.local`;
    } else if (addrKind === 1) addr = ipv6Text(take(16));
    else addr = Array.from(take(4)).join('.');
    const p = take(2);
    e.candidates.push({ type: TYPES[flags & 3] ?? 'host', addr, port: (p[0] << 8) | p[1] });
  }
  return e;
}

const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** A connection description as a short code. `live`: an invite to edit together, not just receive a copy. */
export function encodeConnectCode(sdp: string, kind: CodeKind, live = false): string {
  return toBase64Url(toBytes(parse(sdp, kind, live)));
}

/** Whether an invite code asks to edit together. */
export const isLiveInvite = (code: string): boolean => {
  try { return !!(fromBase64Url(code)[0] & 8); } catch { return false; }
};

/** The full connection description in a code, ready for setRemoteDescription. */
export function decodeConnectCode(code: string, expected: CodeKind): string {
  let e: Essentials;
  try {
    e = fromBytes(fromBase64Url(code));
  } catch (err) {
    if (err instanceof ConnectCodeError) throw err;
    throw new ConnectCodeError('This code is incomplete or damaged. Ask for it to be sent again, in full.');
  }
  if (e.kind !== expected) {
    throw new ConnectCodeError(expected === 'reply'
      ? 'That’s the share link, not their reply. Paste the code their page shows.'
      : 'This is a reply code, meant for the person sharing. Open the share link instead.');
  }
  const fingerprint = bytesHex(e.fingerprint).toUpperCase().match(/../g)!.join(':');
  return [
    'v=0', `o=- ${Date.now()} 2 IN IP4 127.0.0.1`, 's=-', 't=0 0',
    'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
    ...e.candidates.map((c, n) => `a=candidate:${n + 1} 1 udp ${PRIORITY[c.type] - n} ${c.addr} ${c.port} typ ${c.type}${c.type === 'host' ? '' : ' raddr 0.0.0.0 rport 0'}`),
    'a=end-of-candidates',
    `a=ice-ufrag:${e.ufrag}`, `a=ice-pwd:${e.pwd}`,
    `a=fingerprint:sha-256 ${fingerprint}`, `a=setup:${e.setup}`,
    'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144', '',
  ].join('\r\n');
}
