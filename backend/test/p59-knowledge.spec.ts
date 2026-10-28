import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { AiGateway, AiChatMessage, AiGenerateResult, EMBEDDING_DIMS } from '../src/modules/ai/ai.gateway';
import { KnowledgeService } from '../src/modules/ai/knowledge.service';
import { chunkMarkdown } from '../src/modules/ai/knowledge.chunker';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/**
 * Step 5.8b: help-document RAG. The provider is faked with a word-hashing "embedder" (same words, similar vector), so the
 * chunking, the pgvector search, the language split, the cut-off, the prompt and the citations are the app's own and run for real.
 * The quality of the real embeddings was measured separately (see MIN_SIMILARITY).
 */
class FakeGateway extends AiGateway {
  prompts: string[] = [];
  next: AiGenerateResult = { inScope: true, answer: 'From the docs.', sourcesUsed: [1] };
  failEmbed = false;
  isConfigured() {
    return true;
  }
  async embed(texts: string[]) {
    if (this.failEmbed) throw new Error('embedding provider down');
    return texts.map((t) => {
      const v = new Array<number>(EMBEDDING_DIMS).fill(0);
      for (const w of t.toLowerCase().match(/\p{L}{3,}/gu) ?? []) {
        let h = 2166136261;
        for (const ch of w) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
        v[h % EMBEDDING_DIMS] += 1;
      }
      const norm = Math.hypot(...v) || 1;
      return v.map((n) => n / norm || 0).map((n, i) => (n === 0 && norm === 1 && i === 0 ? 1e-6 : n)); // never a zero vector: cosine is undefined for it
    });
  }
  async generate(system: string, _messages: AiChatMessage[]) {
    this.prompts.push(system);
    return this.next;
  }
}

describe('5.8b: chunking', () => {
  it('makes one chunk per section, headed "Title > Section", and ignores text before the first section', () => {
    const chunks = chunkMarkdown('# Roles\nintro line\n\n## Admin\nCan invite.\nCan remove.\n\n## Member\nCan comment.\n');
    assert.deepEqual(chunks, [
      { heading: 'Roles > Admin', content: 'Can invite.\nCan remove.' },
      { heading: 'Roles > Member', content: 'Can comment.' },
    ]);
  });

  it('cuts a long section at line breaks and repeats the tail of each piece at the start of the next', () => {
    const lines = Array.from({ length: 12 }, (_, i) => `Line ${i} ${'x'.repeat(80)}`);
    const chunks = chunkMarkdown(`# T\n## S\n${lines.join('\n')}`, 400, 100);
    assert.ok(chunks.length >= 3, `got ${chunks.length}`);
    for (const c of chunks) assert.ok(c.content.length <= 400, `chunk of ${c.content.length}`);
    for (let i = 1; i < chunks.length; i++) {
      const lastLineBefore = chunks[i - 1].content.split('\n').at(-1)!;
      assert.ok(chunks[i].content.startsWith(lastLineBefore), 'next piece starts with the last line of the previous one');
    }
    assert.ok(lines.every((l) => chunks.some((c) => c.content.includes(l))), 'no line is lost');
  });

  it('turns every real help document into sized chunks, and every English document has an Arabic twin', () => {
    const root = join(__dirname, '..', 'knowledge');
    const names = (loc: string) => readdirSync(join(root, loc)).filter((f) => f.endsWith('.md')).sort();
    assert.deepEqual(names('ar'), names('en'));
    for (const loc of ['en', 'ar']) {
      for (const file of names(loc)) {
        const chunks = chunkMarkdown(readFileSync(join(root, loc, file), 'utf8'));
        assert.ok(chunks.length > 0, `${loc}/${file} has no chunks`);
        for (const c of chunks) assert.ok(c.content.length <= 1600 && c.heading.includes(' > '), `${loc}/${file}: ${c.heading}`);
      }
    }
  });
});

describe('5.8b: help-document search and answers (real database, provider faked)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let knowledge: KnowledgeService;
  let fx: Fixture;
  let gw: FakeGateway;
  let en: string;
  let ar: string;
  const cookies: Record<string, string> = {};

  const call = async (method: string, path: string, body?: object, headers: Record<string, string> = {}) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies.owner, 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const ask = async (content: string, conv?: string) => {
    const id = conv ?? (await call('POST', '/ai/conversations', { title: 'Help', mode: 'KNOWLEDGE', contextScope: 'GLOBAL' })).json.data.id;
    return { id, ...(await call('POST', `/ai/conversations/${id}/messages`, { content }, { 'idempotency-key': randomUUID() })) };
  };
  const cleanRows = () => prisma.$executeRaw`DELETE FROM knowledge_base_embeddings WHERE source LIKE 'p59-%'`;

  before(async () => {
    gw = new FakeGateway();
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(AiGateway).useValue(gw).compile();
    app = mod.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    knowledge = app.get(KnowledgeService);
    fx = await buildFixture(prisma);
    cookies.owner = `access_token=${(await app.get(AuthService).login({ email: `owner.${fx.run}@veyro-test.io`, password: 'Password123!' })).accessToken}`;
    await prisma.userAiSubscription.upsert({ where: { userId: fx.users.owner }, create: { userId: fx.users.owner, dailyQuota: 50 }, update: { dailyQuota: 50 } });
    en = `p59-${fx.run}-zebra`;
    ar = `p59-${fx.run}-zebra-ar`;
    await knowledge.ingest([
      { locale: 'EN', source: en, markdown: '# P59 Zebras\n\n## Habitat\nZebras graze on savanna grassland near water.\n\n## Diet\nZebras eat grass and bark.\n' },
      { locale: 'AR', source: ar, markdown: '# حيوانات\n\n## الحمار الوحشي\nيعيش الحمار الوحشي في السافانا قرب الماء.\n' },
    ]);
  });

  beforeEach(() => {
    gw.prompts = [];
    gw.failEmbed = false;
    gw.next = { inScope: true, answer: 'From the docs.', sourcesUsed: [1] };
  });

  after(async () => {
    try {
      await cleanRows();
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('search', () => {
    it('finds the passage whose words match, best first, with its heading and source', async () => {
      const hits = await knowledge.search('zebras habitat graze savanna', 'EN');
      const mine = hits.filter((h) => h.source === en);
      assert.equal(mine[0]?.heading, 'P59 Zebras > Habitat');
      assert.ok(mine[0].score >= 0.62 && mine[0].score <= 1.0001);
      assert.ok(hits.length <= 4);
      assert.ok(hits.every((h, i) => i === 0 || hits[i - 1].score >= h.score), 'sorted by similarity');
    });

    it('keeps the languages apart', async () => {
      assert.ok((await knowledge.search('الحمار الوحشي السافانا', 'AR')).some((h) => h.source === ar));
      assert.ok(!(await knowledge.search('الحمار الوحشي السافانا', 'EN')).some((h) => h.source === ar));
      assert.ok(!(await knowledge.search('zebras habitat graze savanna', 'AR')).some((h) => h.source === en));
    });

    it('returns nothing for a question unrelated to every document', async () => {
      assert.deepEqual((await knowledge.search('quantum chromodynamics lecture schedule', 'EN')).filter((h) => h.source.startsWith('p59-')), []);
    });

    it('replaces a document when it is ingested again instead of duplicating it', async () => {
      const count = () => prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM knowledge_base_embeddings WHERE source = ${en}`.then((r) => Number(r[0].n));
      const before = await count();
      await knowledge.ingest([{ locale: 'EN', source: en, markdown: '# P59 Zebras\n\n## Habitat\nZebras graze on savanna grassland near water.\n\n## Diet\nZebras eat grass and bark.\n' }]);
      assert.equal(await count(), before);
      assert.equal(before, 2);
    });

    it('keeps the old chunks when the provider fails during ingest', async () => {
      gw.failEmbed = true;
      await assert.rejects(knowledge.ingest([{ locale: 'EN', source: en, markdown: '# P59\n\n## Changed\nNew text here.\n' }]));
      const rows = await prisma.$queryRaw<{ heading: string }[]>`SELECT heading FROM knowledge_base_embeddings WHERE source = ${en} ORDER BY position`;
      assert.deepEqual(rows.map((r) => r.heading), ['P59 Zebras > Habitat', 'P59 Zebras > Diet']);
    });
  });

  describe('answers', () => {
    it('gives the model the matching passages as quoted sources and cites the ones it used', async () => {
      const r = await ask('zebras habitat graze savanna');
      assert.equal(r.status, 201, JSON.stringify(r.json));
      assert.match(gw.prompts[0], /<source id="1" title="P59 Zebras > Habitat">\nZebras graze on savanna grassland near water\.\n<\/source>/);
      assert.deepEqual(r.json.data.message.citations, [{ type: 'HELP_DOC', source: en, heading: 'P59 Zebras > Habitat' }]);
    });

    it('ignores source numbers the model made up, and cites nothing when it used none', async () => {
      gw.next = { inScope: true, answer: 'x', sourcesUsed: [1, 1, 9, 0, -2] };
      assert.equal((await ask('zebras habitat graze savanna')).json.data.message.citations.length, 1);
      gw.next = { inScope: true, answer: 'x', sourcesUsed: [] };
      assert.equal((await ask('zebras habitat graze savanna')).json.data.message.citations, null);
    });

    it('tells the model when no source matched, so it can say it does not know', async () => {
      const r = await ask('quantum chromodynamics lecture schedule');
      assert.match(gw.prompts[0], /Sources: none were found/);
      assert.ok(!gw.prompts[0].includes('<source '));
      assert.equal(r.status, 201);
    });

    it('searches the Arabic documents for an Arabic question', async () => {
      await ask('الحمار الوحشي السافانا');
      assert.match(gw.prompts[0], /الحمار الوحشي في السافانا/);
    });

    it('uses the previous question for a short follow-up', async () => {
      const first = await ask('zebras habitat graze savanna');
      gw.prompts = [];
      await ask('and savanna?', first.id); // alone these words match nothing: only the previous question finds the passage
      assert.match(gw.prompts[0], /Zebras graze on savanna/);
    });

    it('does not cite anything for an off-topic refusal', async () => {
      gw.next = { inScope: false, answer: '', sourcesUsed: [1] };
      const r = await ask('zebras habitat graze savanna');
      assert.match(r.json.data.message.content, /^I can only help with Veyro/);
      assert.equal(r.json.data.message.citations, null);
    });

    it('answers 502 and refunds the quota when the embedding provider fails', async () => {
      const used = async () => (await call('GET', '/ai/quota')).json.data.messagesUsed as number;
      const before = await used();
      gw.failEmbed = true;
      const r = await ask('zebras habitat graze savanna');
      assert.equal(r.status, 502);
      assert.equal(await used(), before);
    });
  });
});
