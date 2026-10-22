/**
 * Project key rules (CS-01, ADR-003): a short, immutable, per-workspace label such as "AUT".
 * Pure functions only, so the format and the generator are unit-testable without a database.
 */
export const PROJECT_KEY_REGEX = /^[A-Z][A-Z0-9]{1,4}$/;
export const PROJECT_KEY_MAX = 5;

export function isValidProjectKey(key: string): boolean {
  return PROJECT_KEY_REGEX.test(key);
}

const alnum = (s: string) => s.replace(/[^A-Za-z0-9]/g, '');

/**
 * Derives a key from a project name:
 *  1. initials of the words (two or more words), else the first three letters;
 *  2. forced to start with a letter, at least two characters, at most five;
 *  3. a numeric suffix is appended while the key is already taken.
 */
export function generateProjectKey(name: string, taken: ReadonlySet<string>): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const initials = words.map((w) => w[0]).join('').toUpperCase().slice(0, PROJECT_KEY_MAX);

  let base = initials.length >= 2 ? initials : alnum(name).toUpperCase().slice(0, 3);
  if (base.length === 0) base = 'PRJ';
  if (/^[0-9]/.test(base)) base = ('P' + base).slice(0, PROJECT_KEY_MAX);
  if (base.length < 2) base = base + 'X';

  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) {
    if (n > 9999) throw new Error('Unable to generate a unique project key.');
    const suffix = String(n);
    candidate = base.slice(0, PROJECT_KEY_MAX - suffix.length) + suffix;
  }
  return candidate;
}
