/**
 * Short, prefixed, collision-resistant ids.
 *
 * Projects are edited offline and merged, so ids must be generated on the
 * client without a round trip. 10 random base-36 characters is ~51 bits —
 * plenty for the few thousand objects a project will ever hold.
 */

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomChars(n: number): string {
  const bytes = new Uint8Array(n);
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) cryptoObj.getRandomValues(bytes);
  else for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export const rid = (prefix: string): string => `${prefix}-${randomChars(10)}`;

/** A URL-safe share token. */
export const shareToken = (): string => randomChars(24);

/** `Q-2026-0147` style quote numbers. */
export function nextQuoteNumber(year = new Date().getFullYear(), sequence?: number): string {
  const n = sequence ?? Math.floor(100 + Math.random() * 900);
  return `Q-${year}-${String(n).padStart(4, "0")}`;
}

/** Filename-safe slug. */
export const slug = (s: string, max = 48): string =>
  (s || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max) || "project";
