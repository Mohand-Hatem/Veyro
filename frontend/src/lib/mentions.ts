// Mentions in comments (CS-16). The server stores `<@userId>`; people only ever see and type "@Name".

export type Mentionable = { id: string; name: string };

const TOKEN = /<@([a-z0-9]{1,40})>/g;

/** A stored comment as pieces to show: plain text, and the ids of the people it mentions. */
export function splitMentions(text: string): (string | { id: string })[] {
  const out: (string | { id: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ id: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Before sending: each "@Name" of a person picked in this draft becomes their token. Longer names go first, so
 * "@Mona Adel" is not taken for "@Mona"; a name followed by another letter ("@Monaco") is left alone.
 */
export function toTokens(text: string, picked: Mentionable[]): string {
  return [...picked]
    .sort((a, b) => b.name.length - a.name.length)
    .reduce((acc, p) => acc.replace(new RegExp(`@${escape(p.name)}(?![\\p{L}\\p{N}])`, "gu"), `<@${p.id}>`), text);
}

/** The "@query" being typed right before the caret (at the start or after a space), or null when there is none. */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|\s)@([^\s@<>]{0,30})$/u.exec(text.slice(0, caret));
  return m ? { start: caret - m[2].length - 1, query: m[2] } : null;
}

/** Whether a name fits what is typed: any word of it starts with the query, ignoring case. */
export function nameMatches(name: string, query: string): boolean {
  const q = query.toLocaleLowerCase();
  return !q || name.toLocaleLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || name.toLocaleLowerCase().startsWith(q);
}
