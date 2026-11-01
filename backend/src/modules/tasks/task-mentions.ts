/**
 * Mentions in comments (CS-16). A mention is stored in the text as `<@userId>`, so it survives a change of name and the
 * page can show the person's current name. Who is actually told is decided by the service (people who can see the task).
 */
const MENTION = /<@([a-z0-9]{1,40})>/g;

/** At most this many different people are mentioned per comment; the rest stay as text. */
export const MAX_MENTIONS = 20;

/** The distinct user ids a text mentions, in order of first appearance. */
export function mentionIds(text: string): string[] {
  return [...new Set([...text.matchAll(MENTION)].map((m) => m[1]))].slice(0, MAX_MENTIONS);
}
