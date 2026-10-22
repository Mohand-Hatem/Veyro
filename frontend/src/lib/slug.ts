// Slug and invitation helpers for onboarding (same rules as the reference page; the backend also checks the pattern).
export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const okSlug = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 40;

/** Suggested workspace address: "<account address>-<workspace name>". */
export const workspaceSlugFrom = (accountSlug: string, workspaceName: string) => [accountSlug, slugify(workspaceName)].filter(Boolean).join("-");

/** Takes a pasted invitation link or a bare code and returns the token at the end. */
export const inviteToken = (value: string) => (value.trim().match(/[A-Za-z0-9_-]{6,}$/) ?? [value.trim()])[0];

/** "in 5 days" / "in 6 hours" in the user's language. */
export function expiresIn(expiresAt: string | Date, locale: string, now = Date.now()) {
  const hours = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 3_600_000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  return hours >= 24 ? rtf.format(Math.round(hours / 24), "day") : rtf.format(hours, "hour");
}
