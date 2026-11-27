import { useCallback, useState } from 'react';

// Per-device conveniences (dashboard view/sort, recently opened). Storage can be
// unavailable (private mode, blocked site data), so every access is guarded and
// callers always get a usable default.

export const readPref = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

export const writePref = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* not persisted; the in-memory value still works */
  }
};

export function useLocalPref<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readPref(key, fallback));
  const update = useCallback((next: T) => {
    setValue(next);
    writePref(key, next);
  }, [key]);
  return [value, update];
}

const OPENED_KEY = 'nodetale:lastOpened';

export const getLastOpened = (): Record<string, number> => readPref(OPENED_KEY, {});

export const markProjectOpened = (id: string) => writePref(OPENED_KEY, { ...getLastOpened(), [id]: Date.now() });

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600e3], ['month', 30 * 24 * 3600e3], ['week', 7 * 24 * 3600e3],
  ['day', 24 * 3600e3], ['hour', 3600e3], ['minute', 60e3],
];

/** "2 hours ago", "yesterday", "just now". */
export const formatRelativeTime = (timestamp: number, now = Date.now()): string => {
  const diff = timestamp - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return 'just now';
};
