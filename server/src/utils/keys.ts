import { customAlphabet } from 'nanoid';

// Alphabet sans caractères ambigus (pas de 0/O/1/I) pour des clés lisibles.
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const segment = customAlphabet(alphabet, 4);

/** Génère une clé au format XXXX-XXXX-XXXX-XXXX. */
export function generateKey(): string {
  return [segment(), segment(), segment(), segment()].join('-');
}

const KEY_RE = /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

/** Normalise une clé saisie (majuscules, tirets) sans valider. */
export function normalizeKey(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, '');
  return cleaned.replace(/(.{4})(?=.)/g, '$1-').slice(0, 19);
}

export function isValidKeyFormat(key: string): boolean {
  return KEY_RE.test(key.toUpperCase());
}
