import { Project, StoryNode } from '../models/story';
import { compactProject } from './storageService';

// Share links carry a whole story inside the URL, after the #. That part is
// never sent to a server, so a link works from the static site and stays
// private to whoever has it. Stories only: images, sound and video are far too
// big for a link (the single HTML export carries those).
//
// Format: "v1." + base64url(deflate-raw(JSON of the compacted story)).
// The prefix lets a later format change still read old links.

const PREFIX = 'v1.';
/** Beyond this many characters some chat apps and email clients cut links off. */
export const LONG_LINK = 8000;

// Pasted images inside scene text, as data: URLs: media too, so not in links.
const INLINE_IMAGE = /<img\b[^>]*\bsrc=["']data:[^"']*["'][^>]*>/gi;

const storyOnlyNode = (node: StoryNode): StoryNode => {
  const data = { ...node.data } as Record<string, unknown>;
  delete data.assets;
  delete data.audioSettings;
  if (typeof data.content === 'string' && data.content.includes('data:')) data.content = data.content.replace(INLINE_IMAGE, '');
  return { ...node, data } as unknown as StoryNode;
};

/** The story as a link carries it: text, logic and variables; no media, no cover. */
export function toSharedStory(project: Project): Project {
  const compact = compactProject(project);
  return {
    ...compact,
    id: '',
    coverImage: undefined,
    modifiedAt: undefined,
    assets: [],
    folders: [],
    boards: compact.boards.map((b) => ({ ...b, nodes: b.nodes.map(storyOnlyNode) })),
  };
}

// The browser's own deflate (CompressionStream): no library. Response wraps
// the bytes as a stream in every environment that has one.
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

/** The code for a story ("v1.…"): what goes after the # in a share link. */
export async function encodeStory(project: Project): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toSharedStory(project)));
  return PREFIX + toBase64Url(await through(json, new CompressionStream('deflate-raw')));
}

export class ShareLinkError extends Error {}

/** The story in a code, or a plain-language error for a damaged or foreign one. */
export async function decodeStory(code: string): Promise<Project> {
  if (!code.startsWith(PREFIX)) throw new ShareLinkError('This doesn’t look like a NodeTale share link.');
  let story: unknown;
  try {
    const bytes = await through(fromBase64Url(code.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
    story = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ShareLinkError('This link is incomplete or damaged. Ask for it to be sent again, in full.');
  }
  const p = story as Partial<Project>;
  if (!p || typeof p.name !== 'string' || !Array.isArray(p.boards) || !Array.isArray(p.variables)) {
    throw new ShareLinkError('This link doesn’t contain a story.');
  }
  return { assets: [], folders: [], activeBoardId: p.boards[0]?.id ?? '', ...p } as Project;
}

/** The code inside whatever was pasted: a full link, "…#v1.…", or the code itself. */
export function codeFromPasted(text: string): string {
  const trimmed = text.trim();
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
