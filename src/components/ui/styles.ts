// Shared control styles so every button/input on the dashboard (and later the
// editor) uses one vocabulary. Heights: 36px controls, 32px compact.
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-focus';

export const buttonPrimary = `inline-flex h-9 items-center gap-2 rounded-md bg-nt-accent px-3.5 text-sm font-semibold text-nt-accent-ink transition-[filter] duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;
export const buttonSecondary = `inline-flex h-9 items-center gap-2 rounded-md border border-nt-line bg-nt-surface px-3 text-sm font-medium text-nt-ink-2 transition-colors duration-150 hover:bg-nt-raised hover:text-nt-ink disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;
export const buttonDanger = `inline-flex h-9 items-center gap-2 rounded-md bg-nt-danger px-3.5 text-sm font-semibold text-nt-bg transition-[filter] duration-150 hover:brightness-110 ${focus}`;
export const buttonGhostIcon = `inline-flex h-8 w-8 items-center justify-center rounded-md text-nt-ink-3 transition-colors duration-150 hover:bg-nt-raised hover:text-nt-ink ${focus}`;
export const input = `h-9 w-full rounded-md border border-nt-line-strong bg-nt-bg px-3 text-sm text-nt-ink placeholder:text-nt-ink-3 transition-colors duration-150 hover:border-nt-ink-3 ${focus} focus-visible:outline-offset-0`;
export const focusRing = focus;
