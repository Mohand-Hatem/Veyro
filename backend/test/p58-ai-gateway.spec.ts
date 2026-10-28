import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { AiGateway, AiChatMessage, AiGenerateResult, EMBEDDING_DIMS } from '../src/modules/ai/ai.gateway';
import { validateEnv } from '../src/config/env.validation';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/**
 * Step 5.8a: the real assistant. The model provider is faked (no network, no quota used); what the app does around it runs for real:
 * the scope refusal, the short-term memory, the quota refund on failure, idempotency. The Gemini client itself is tested with a stubbed fetch.
 */
class FakeGateway extends AiGateway {
  calls: { system: string; messages: AiChatMessage[]; tools?: unknown }[] = [];
  next: AiGenerateResult = { inScope: true, answer: 'Tasks live on the project board.', sourcesUsed: [] };
  fail = false;
  isConfigured() {
    return true;
  }
  // One fixed vector for everything: these tests are about the answer flow, not about which help passage matches (p59).
  async embed(texts: string[]) {
    return texts.map(() => [1, ...new Array<number>(EMBEDDING_DIMS - 1).fill(0)]);
  }
  async generate(system: string, messages: AiChatMessage[], tools?: unknown) {
    this.calls.push({ system, messages, tools });
    if (this.fail) throw new Error('provider down');
    return this.next;
  }
}

describe('5.8a: AI assistant gateway (real app, model faked)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  let gw: FakeGateway;
  const cookies: Record<string, string> = {};

  const call = async (who: string, method: string, path: string, body?: object, headers: Record<string, string> = {}) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies[who], 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const conversation = async (who: string) => {
    const r = await call(who, 'POST', '/ai/conversations', { title: 'Questions', mode: 'KNOWLEDGE', contextScope: 'GLOBAL' });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    return r.json.data.id as string;
  };
  const send = (who: string, conv: string, content: string, key = randomUUID()) => call(who, 'POST', `/ai/conversations/${conv}/messages`, { content }, { 'idempotency-key': key });
  const used = async (who: string) => (await call(who, 'GET', '/ai/quota')).json.data.messagesUsed as number;

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
    fx = await buildFixture(prisma);
    const auth = app.get(AuthService);
    cookies.owner = `access_token=${(await auth.login({ email: `owner.${fx.run}@veyro-test.io`, password: 'Password123!' })).accessToken}`;
    // The default daily quota is 3; these tests send more than that.
    await prisma.userAiSubscription.upsert({ where: { userId: fx.users.owner }, create: { userId: fx.users.owner, dailyQuota: 50 }, update: { dailyQuota: 50 } });
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('answers and scope', () => {
    it('stores the model answer and gives the model the rules plus the question', async () => {
      gw.calls = [];
      gw.next = { inScope: true, answer: 'Tasks live on the project board.', sourcesUsed: [] };
      const conv = await conversation('owner');
      const r = await send('owner', conv, 'Where do tasks live?');
      assert.equal(r.status, 201, JSON.stringify(r.json));
      assert.equal(r.json.data.message.content, 'Tasks live on the project board.');
      assert.equal(gw.calls.length, 1);
      assert.match(gw.calls[0].system, /inScope/);
      assert.deepEqual(gw.calls[0].messages, [{ role: 'user', content: 'Where do tasks live?' }]);
    });

    it('replaces an off-topic answer with the fixed refusal, in the language of the question', async () => {
      const conv = await conversation('owner');
      gw.next = { inScope: false, answer: 'It is sunny in Cairo today.', sourcesUsed: [] }; // a model that ignores the rule must not leak through
      const en = await send('owner', conv, 'What is the weather?');
      assert.match(en.json.data.message.content, /^I can only help with Veyro/);
      assert.ok(!en.json.data.message.content.includes('sunny'));
      const ar = await send('owner', conv, 'ما هو الطقس اليوم؟');
      assert.match(ar.json.data.message.content, /^أستطيع المساعدة فقط في Veyro/);
    });

    it('treats an in-scope reply with no text as a refusal, not an empty bubble', async () => {
      const conv = await conversation('owner');
      gw.next = { inScope: true, answer: '', sourcesUsed: [] };
      assert.match((await send('owner', conv, 'Hello?')).json.data.message.content, /^I can only help with Veyro/);
    });

    it('sends a task request to the model like any other message (no keyword matching), and offers no tools outside a workspace', async () => {
      gw.calls = [];
      const conv = await conversation('owner');
      const r = await send('owner', conv, 'Please create task: write the launch notes');
      assert.equal(r.status, 201);
      assert.equal(gw.calls.length, 1);
      assert.equal(gw.calls[0].tools, undefined);
      assert.equal(r.json.data.proposal, null);
    });
  });

  describe('short-term memory', () => {
    it('sends the earlier messages of the same conversation, and nothing from another one', async () => {
      gw.next = { inScope: true, answer: 'Second answer.', sourcesUsed: [] };
      const other = await conversation('owner');
      await send('owner', other, 'Secret from another chat');
      const conv = await conversation('owner');
      gw.next = { inScope: true, answer: 'First answer.', sourcesUsed: [] };
      await send('owner', conv, 'First question');
      gw.calls = [];
      gw.next = { inScope: true, answer: 'Second answer.', sourcesUsed: [] };
      await send('owner', conv, 'Second question');
      assert.deepEqual(gw.calls[0].messages, [
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer.' },
        { role: 'user', content: 'Second question' },
      ]);
    });

    const seed = async (conv: string, contents: string[]) => {
      const start = Date.now() - 100_000;
      await prisma.aiMessage.createMany({
        data: contents.map((content, i) => ({ conversationId: conv, content, senderRole: i % 2 === 0 ? 'USER' : 'ASSISTANT', createdAt: new Date(start + i * 1000) }) as any),
      });
    };

    it('caps the history at the last 10 messages and always starts with a user message', async () => {
      const conv = await conversation('owner');
      await seed(conv, Array.from({ length: 15 }, (_, i) => `m${i}`)); // m0 user, m1 assistant, ... m14 user
      gw.calls = [];
      await send('owner', conv, 'new question');
      const sent = gw.calls[0].messages;
      assert.equal(sent.at(-1)!.content, 'new question');
      assert.equal(sent[0].role, 'user');
      assert.ok(sent.length <= 11, `sent ${sent.length}`);
      assert.ok(!sent.some((m) => m.content === 'm0'), 'old messages are dropped');
    });

    it('drops the oldest messages when the history is too long, but never the new question', async () => {
      const conv = await conversation('owner');
      await seed(conv, ['u'.repeat(4000), 'a'.repeat(4000), 'u2', 'a2']);
      gw.calls = [];
      await send('owner', conv, 'new question');
      const sent = gw.calls[0].messages;
      assert.equal(sent.at(-1)!.content, 'new question');
      assert.ok(sent.reduce((n, m) => n + m.content.length, 0) <= 6000 + 'new question'.length);
      assert.ok(!sent.some((m) => m.content.startsWith('uuuu')));
    });
  });

  describe('failures and retries', () => {
    afterEach(() => {
      gw.fail = false;
    });

    it('answers 502, stores nothing and gives the quota back when the provider fails', async () => {
      const conv = await conversation('owner');
      const before = await used('owner');
      gw.fail = true;
      const r = await send('owner', conv, 'Will this fail?');
      assert.equal(r.status, 502);
      assert.equal(r.json?.error?.code ?? r.json?.code, 'AI_GATEWAY_ERROR');
      assert.equal(await used('owner'), before, 'quota refunded');
      assert.equal((await call('owner', 'GET', `/ai/conversations/${conv}/messages`)).json.data.length, 0, 'no half-written conversation');
    });

    it('does not call the model again for a repeated request (idempotency) and charges once', async () => {
      const conv = await conversation('owner');
      gw.calls = [];
      const key = randomUUID();
      const first = await send('owner', conv, 'Only once please', key);
      const before = await used('owner');
      const again = await send('owner', conv, 'Only once please', key);
      assert.equal(again.json.data.message.id, first.json.data.message.id);
      assert.equal(gw.calls.length, 1);
      assert.equal(await used('owner'), before);
    });
  });
});

describe('5.8a: Gemini client (fetch stubbed)', () => {
  const realFetch = globalThis.fetch;
  const ok = (answer: object) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 });
  let requests: { url: string; init: RequestInit }[] = [];
  const stub = (...responses: (Response | Error)[]) => {
    requests = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      const next = responses.shift()!;
      if (next instanceof Error) throw next;
      return next;
    }) as typeof fetch;
  };
  before(() => {
    process.env.GEMINI_API_KEY = 'test-key-not-real';
  });
  after(() => {
    process.env.GEMINI_API_KEY = '';
    globalThis.fetch = realFetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sends the key in a header (never the URL), asks for JSON and maps roles', async () => {
    stub(ok({ inScope: true, answer: ' Hi ' }));
    const out = await new AiGateway().generate('rules', [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }, { role: 'user', content: 'q2' }]);
    assert.deepEqual(out, { inScope: true, answer: 'Hi', sourcesUsed: [] });
    assert.ok(!requests[0].url.includes('test-key-not-real'));
    assert.equal((requests[0].init.headers as Record<string, string>)['x-goog-api-key'], 'test-key-not-real');
    const body = JSON.parse(requests[0].init.body as string);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.contents.map((c: any) => c.role), ['user', 'model', 'user']);
  });

  it('retries once on a 429 or a network error, then succeeds', async () => {
    stub(new Response('{}', { status: 429 }), ok({ inScope: true, answer: 'ok' }));
    assert.equal((await new AiGateway().generate('s', [{ role: 'user', content: 'q' }])).answer, 'ok');
    assert.equal(requests.length, 2);
    stub(new Error('socket hang up'), ok({ inScope: true, answer: 'ok' }));
    assert.equal((await new AiGateway().generate('s', [{ role: 'user', content: 'q' }])).answer, 'ok');
  });

  it('asks for 768-number vectors tuned for documents or questions, and returns them in order', async () => {
    const vec = (n: number) => ({ values: new Array(EMBEDDING_DIMS).fill(n) });
    stub(new Response(JSON.stringify({ embeddings: [vec(1), vec(2)] }), { status: 200 }));
    const out = await new AiGateway().embed(['a', 'b'], 'query');
    assert.deepEqual([out[0][0], out[1][0]], [1, 2]);
    assert.match(requests[0].url, /gemini-embedding-001:batchEmbedContents$/);
    const body = JSON.parse(requests[0].init.body as string);
    assert.deepEqual(body.requests.map((r: any) => [r.taskType, r.outputDimensionality]), [['RETRIEVAL_QUERY', 768], ['RETRIEVAL_QUERY', 768]]);
    stub(new Response(JSON.stringify({ embeddings: [vec(1)] }), { status: 200 }));
    await new AiGateway().embed(['a'], 'document');
    assert.equal(JSON.parse(requests[0].init.body as string).requests[0].taskType, 'RETRIEVAL_DOCUMENT');
  });

  it('splits many texts into batches, and refuses vectors of the wrong count or size', async () => {
    const vec = { values: new Array(EMBEDDING_DIMS).fill(0.5) };
    stub(new Response(JSON.stringify({ embeddings: new Array(50).fill(vec) }), { status: 200 }), new Response(JSON.stringify({ embeddings: new Array(10).fill(vec) }), { status: 200 }));
    assert.equal((await new AiGateway().embed(new Array(60).fill('t'), 'document')).length, 60);
    assert.equal(requests.length, 2);
    stub(new Response(JSON.stringify({ embeddings: [vec, vec] }), { status: 200 }));
    await assert.rejects(new AiGateway().embed(['a'], 'query'), /wrong shape/);
    stub(new Response(JSON.stringify({ embeddings: [{ values: [1, 2, 3] }] }), { status: 200 }));
    await assert.rejects(new AiGateway().embed(['a'], 'query'), /wrong shape/);
  });

  it('declares tools, reads a tool request, and sends the model own turn back unchanged with our results', async () => {
    const modelTurn = { role: 'model', parts: [{ functionCall: { id: 'c1', name: 'list_tasks', args: { overdue: true } }, thoughtSignature: 'sig-abc' }] };
    stub(new Response(JSON.stringify({ candidates: [{ content: modelTurn }] }), { status: 200 }));
    const tools = [{ name: 'list_tasks', description: 'd', parameters: { type: 'OBJECT', properties: {} } }];
    const out: any = await new AiGateway().generate('rules', [{ role: 'user', content: 'what is late?' }], tools);
    assert.deepEqual(out.toolCalls, [{ id: 'c1', name: 'list_tasks', args: { overdue: true } }]);
    assert.deepEqual(out.modelTurn, modelTurn, 'kept whole, thoughtSignature included');
    assert.deepEqual(JSON.parse(requests[0].init.body as string).tools, [{ functionDeclarations: tools }]);

    stub(ok({ inScope: true, answer: 'One task.' }));
    await new AiGateway().generate('rules', [{ role: 'user', content: 'what is late?' }, { role: 'tool-request', modelTurn }, { role: 'tool-result', results: [{ id: 'c1', name: 'list_tasks', result: { total: 1 } }] }], tools);
    const sent = JSON.parse(requests[0].init.body as string).contents;
    assert.deepEqual(sent[1], modelTurn);
    assert.deepEqual(sent[2], { role: 'user', parts: [{ functionResponse: { id: 'c1', name: 'list_tasks', response: { total: 1 } } }] });
  });

  it('sends no tools block when none are offered, and treats odd tool arguments as an empty object', async () => {
    stub(new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'list_projects', args: 'oops' } }] } }] }), { status: 200 }));
    const out: any = await new AiGateway().generate('rules', [{ role: 'user', content: 'q' }]);
    assert.equal(JSON.parse(requests[0].init.body as string).tools, undefined);
    assert.deepEqual(out.toolCalls, [{ id: undefined, name: 'list_projects', args: {} }]);
  });

  it('gives up after the second failure', async () => {
    stub(new Response('{}', { status: 503 }), new Response('{}', { status: 503 }));
    await assert.rejects(new AiGateway().generate('s', [{ role: 'user', content: 'q' }]));
    assert.equal(requests.length, 2);
  });

  it('does not retry a request the provider rejected (400/403) or an answer it cannot trust', async () => {
    stub(new Response(JSON.stringify({ error: { message: 'API key not valid' } }), { status: 400 }));
    await assert.rejects(new AiGateway().generate('s', [{ role: 'user', content: 'q' }]), /rejected/);
    assert.equal(requests.length, 1);
    stub(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }), { status: 200 }));
    await assert.rejects(new AiGateway().generate('s', [{ role: 'user', content: 'q' }]), /valid JSON/);
    stub(ok({ inScope: 'yes', answer: 5 }));
    await assert.rejects(new AiGateway().generate('s', [{ role: 'user', content: 'q' }]), /wrong shape/);
    stub(new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }));
    await assert.rejects(new AiGateway().generate('s', [{ role: 'user', content: 'q' }]), /SAFETY/);
  });
});

describe('5.8a: production configuration', () => {
  const base = { JWT_SECRET: 'x'.repeat(40), NODE_ENV: 'production', RESEND_API_KEY: 're_x', EMAIL_FROM: 'Veyro <noreply@veyro.dev>', STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', STRIPE_PRICE_ID_PRO: 'p', STRIPE_PRICE_ID_ENTERPRISE: 'e', STRIPE_PRICE_ID_EPIC: 'x' };
  it('refuses to start in production without GEMINI_API_KEY, and starts with it', () => {
    assert.throws(() => validateEnv(base), /GEMINI_API_KEY/);
    assert.doesNotThrow(() => validateEnv({ ...base, GEMINI_API_KEY: 'k', CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' }));
  });
});
