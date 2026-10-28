import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UserLocale } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiGateway } from './ai.gateway';
import { chunkMarkdown } from './knowledge.chunker';

export interface KnowledgeHit {
  source: string;
  heading: string;
  content: string;
  score: number;
}

export interface KnowledgeDoc {
  locale: UserLocale;
  /** File name without extension, e.g. "roles". Stored with each chunk so a citation can point at the document. */
  source: string;
  markdown: string;
}

const TOP_K = 4;
/**
 * Cosine similarity below this means "nothing in the help documents is about this". Measured on real questions with
 * gemini-embedding-001 (768 dims): the best passage for a real question scored 0.66 to 0.81, off-topic questions 0.49 to 0.54,
 * questions about things Veyro does not have 0.60 to 0.66. The last group overlaps with real questions, so the cut-off only removes
 * the clearly unrelated; the prompt rule "answer only from the sources" handles the rest. Re-measure if the model changes.
 */
export const MIN_SIMILARITY = 0.62;

/** The shared, public help-document index (BR-AI-06). No tenant data lives here, so no tenant filter is needed. */
@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGateway,
  ) {}

  /** The best passages for a question in one language, most similar first, only those above the cut-off. */
  async search(question: string, locale: UserLocale): Promise<KnowledgeHit[]> {
    const [vector] = await this.gateway.embed([question], 'query');
    const literal = toVectorLiteral(vector);
    const rows = await this.prisma.$queryRaw<KnowledgeHit[]>`
      SELECT source, heading, content, 1 - (embedding <=> ${literal}::vector) AS score
      FROM knowledge_base_embeddings
      WHERE locale = ${locale}::"UserLocale"
      ORDER BY embedding <=> ${literal}::vector
      LIMIT ${TOP_K}`;
    return rows.map((r) => ({ ...r, score: Number(r.score) })).filter((r) => r.score >= MIN_SIMILARITY);
  }

  /**
   * Replaces the stored chunks of the given documents. Everything is embedded first, so a provider failure leaves the old
   * chunks untouched. With pruneOthers, chunks of documents that are no longer given (a deleted file) are removed too.
   */
  async ingest(docs: KnowledgeDoc[], pruneOthers = false): Promise<number> {
    const chunks = docs.flatMap((d) => chunkMarkdown(d.markdown).map((c, position) => ({ ...c, locale: d.locale, source: d.source, position })));
    const vectors = await this.gateway.embed(
      chunks.map((c) => `${c.heading}\n${c.content}`),
      'document',
    );
    await this.prisma.$transaction(
      async (tx) => {
        for (const d of docs) await tx.$executeRaw`DELETE FROM knowledge_base_embeddings WHERE locale = ${d.locale}::"UserLocale" AND source = ${d.source}`;
        if (pruneOthers) {
          const keep = docs.map((d) => `${d.locale}:${d.source}`);
          await tx.$executeRaw`DELETE FROM knowledge_base_embeddings WHERE NOT (locale::text || ':' || source = ANY(${keep}))`;
        }
        for (const [i, c] of chunks.entries()) {
          await tx.$executeRaw`
            INSERT INTO knowledge_base_embeddings (id, locale, source, heading, position, content, embedding)
            VALUES (${randomUUID()}, ${c.locale}::"UserLocale", ${c.source}, ${c.heading}, ${c.position}, ${c.content}, ${toVectorLiteral(vectors[i])}::vector)`;
        }
      },
      { timeout: 60_000 },
    );
    return chunks.length;
  }
}

/** pgvector reads '[0.1,0.2,...]'. Passed as a bound parameter and cast in SQL, never concatenated into the query. */
const toVectorLiteral = (v: number[]) => `[${v.join(',')}]`;
