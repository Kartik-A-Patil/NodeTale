// Share links: the invite code goes after the #, which never reaches a server.

/** The code inside whatever was pasted: a full link, "…#code", or the code itself. */
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
