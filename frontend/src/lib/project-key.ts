// Project key rules, mirrored from backend/src/modules/projects/project-key.ts (CS-01, ADR-003).
// The dialog uses this to show the key while the name is typed; the server still generates and validates it.
export const PROJECT_KEY_REGEX = /^[A-Z][A-Z0-9]{1,4}$/;
export const PROJECT_KEY_MAX = 5;

const alnum = (s: string) => s.replace(/[^A-Za-z0-9]/g, "");

/** Initials of the words (two or more words), else the first three letters; a numeric suffix while the key is taken. */
export function suggestProjectKey(name: string, taken: ReadonlySet<string>): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const initials = words.map((w) => w[0]).join("").toUpperCase().slice(0, PROJECT_KEY_MAX);

  let base = initials.length >= 2 ? initials : alnum(name).toUpperCase().slice(0, 3);
  if (base.length === 0) base = "PRJ";
  if (/^[0-9]/.test(base)) base = ("P" + base).slice(0, PROJECT_KEY_MAX);
  if (base.length < 2) base += "X";

  let candidate = base;
  for (let n = 2; taken.has(candidate) && n <= 9999; n++) {
    const suffix = String(n);
    candidate = base.slice(0, PROJECT_KEY_MAX - suffix.length) + suffix;
  }
  return candidate;
}
