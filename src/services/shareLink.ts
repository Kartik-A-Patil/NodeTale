// Codes that travel between two people by hand: the invite in a share link
// (after the #, which never reaches a server) and the reply code sent back.
// "v2." + base64url(deflate-raw(JSON)): the browser's own compression, no
// library. The prefix lets a later format still recognise old codes.

const PREFIX = 'v2.';

// Response wraps the bytes as a stream in every environment that has one.
const through = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Response(bytes).body!.pipeThrough(stream)).arrayBuffer());

const toBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string) => {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

export class ShareCodeError extends Error {}

export async function packCode(value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  return PREFIX + toBase64Url(await through(json, new CompressionStream('deflate-raw')));
}

export async function unpackCode<T>(code: string): Promise<T> {
  if (!code.startsWith(PREFIX)) throw new ShareCodeError('This doesn’t look like a NodeTale share code.');
  try {
    const bytes = await through(fromBase64Url(code.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new ShareCodeError('This code is incomplete or damaged. Ask for it to be sent again, in full.');
  }
}

/** The code inside whatever was pasted: a full link, "…#v2.…", or the code itself. */
export function codeFromPasted(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, '');
  const hash = trimmed.indexOf('#');
  return hash >= 0 ? trimmed.slice(hash + 1) : trimmed;
}

/** Where share links point: this site on the web; the desktop app has no
 *  public address unless VITE_SHARE_ORIGIN names one, so it shares bare codes. */
export const shareOrigin = (): string | null =>
  import.meta.env.VITE_SHARE_ORIGIN || (import.meta.env.VITE_PLATFORM === 'electron' ? null : window.location.origin);

export const shareUrl = (code: string): string | null => {
  const origin = shareOrigin();
  return origin ? `${origin.replace(/\/$/, '')}/share#${code}` : null;
};
