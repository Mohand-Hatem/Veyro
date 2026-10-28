/**
 * Loads backend/knowledge/<en|ar>/*.md into the knowledge_base_embeddings table (embeddings from Gemini).
 *   npm run knowledge:ingest                       -> the dev branch (or DATABASE_URL when there is no dev branch)
 *   NODE_ENV=production npm run knowledge:ingest   -> the production database (DATABASE_URL)
 * Safe to run again: it replaces the chunks of every document it reads and removes chunks of documents that no longer exist.
 */
import 'reflect-metadata';
import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { UserLocale } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { databaseUrl } from '../src/prisma/database-url';
import { AiGateway } from '../src/modules/ai/ai.gateway';
import { KnowledgeDoc, KnowledgeService } from '../src/modules/ai/knowledge.service';

async function main() {
  const gateway = new AiGateway();
  if (!gateway.isConfigured()) throw new Error('GEMINI_API_KEY is not set in backend/.env.');

  const root = join(__dirname, '..', 'knowledge');
  const docs: KnowledgeDoc[] = [];
  for (const locale of [UserLocale.EN, UserLocale.AR]) {
    const dir = join(root, locale.toLowerCase());
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      docs.push({ locale, source: file.replace(/\.md$/, ''), markdown: readFileSync(join(dir, file), 'utf8') });
    }
  }

  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    console.log(`Database host: ${new URL(databaseUrl()!).hostname}`);
    const count = await new KnowledgeService(prisma, gateway).ingest(docs, true);
    console.log(`Ingested ${docs.length} documents as ${count} chunks.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`Ingest failed: ${(err as Error).message}`);
  process.exit(1);
});
