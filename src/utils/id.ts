// Lowercase letters and digits: reads well in a URL and is case-safe.
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** A short random id, e.g. "k3x9q2ab7d": 10 characters (~52 bits), plenty to
 *  never collide within one person's stories. */
export const shortId = (length = 10): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => ALPHABET[b % ALPHABET.length]).join('');

/** An id for something inside a story: "node-k3x9q2ab7d". */
export const createId = (prefix: string): string => `${prefix}-${shortId()}`;
