export interface KnowledgeChunkText {
  /** "Document title > Section title": shown as the citation and prepended to the text that is embedded. */
  heading: string;
  content: string;
}

// About 400 tokens of English. Arabic packs fewer characters per token, so its chunks come out a little smaller in tokens, which is fine.
const MAX_CHARS = 1600;
const OVERLAP_CHARS = 200;

/**
 * Splits one Markdown help document into chunks: one per "## " section, so a chunk is one idea with its own heading.
 * A section longer than MAX_CHARS is cut at line breaks and each following piece repeats the last ~200 characters of the
 * previous one, so a sentence that straddles the cut is whole in at least one chunk.
 */
export function chunkMarkdown(markdown: string, maxChars = MAX_CHARS, overlap = OVERLAP_CHARS): KnowledgeChunkText[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const title = lines.find((l) => l.startsWith('# '))?.slice(2).trim() ?? '';
  const sections: { heading: string; body: string[] }[] = [];
  for (const line of lines) {
    if (line.startsWith('## ')) sections.push({ heading: line.slice(3).trim(), body: [] });
    else if (sections.length && !line.startsWith('# ')) sections.at(-1)!.body.push(line);
  }

  const chunks: KnowledgeChunkText[] = [];
  for (const { heading, body } of sections) {
    const full = `${title} > ${heading}`;
    let current = '';
    for (const line of body.filter((l) => l.trim())) {
      if (current && current.length + line.length + 1 > maxChars) {
        chunks.push({ heading: full, content: current });
        // Start the next piece with the tail of this one, cut at a line start when possible.
        const tail = current.slice(-overlap);
        current = tail.includes('\n') ? tail.slice(tail.indexOf('\n') + 1) : tail;
      }
      current = current ? `${current}\n${line}` : line;
    }
    if (current.trim()) chunks.push({ heading: full, content: current });
  }
  return chunks;
}
