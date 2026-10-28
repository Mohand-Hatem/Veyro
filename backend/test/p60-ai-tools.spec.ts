import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { AiGateway, AiGenerateResult, AiToolDeclaration, AiToolRequest, AiTurn, EMBEDDING_DIMS } from '../src/modules/ai/ai.gateway';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/**
 * Step 5.8c: the assistant reads the workspace through tools and drafts tasks. The model is scripted (no network): each test says
 * which tools it "asks for" and what it "answers". What the app does around that runs for real: who may see what, what the model
 * cannot override, the round cap, citations, the proposal rules and the confirmation.
 */
type Step = (call: { system: string; turns: AiTurn[]; tools?: AiToolDeclaration[] }) => AiGenerateResult | AiToolRequest;
const ask = (name: string, args: Record<string, unknown> = {}): Step => () => ({ toolCalls: [{ id: `call-${name}`, name, args }], modelTurn: { role: 'model', parts: [{ functionCall: { name, args } }] } });
const answer = (text: string, over: Partial<AiGenerateResult> = {}): Step => () => ({ inScope: true, answer: text, sourcesUsed: [], ...over });

class ScriptedGateway extends AiGateway {
  steps: Step[] = [];
  calls: { system: string; turns: AiTurn[]; tools?: AiToolDeclaration[] }[] = [];
  isConfigured() {
    return true;
  }
  async embed(texts: string[]) {
    return texts.map(() => [1, ...new Array<number>(EMBEDDING_DIMS - 1).fill(0)]);
  }
  async generate(system: string, turns: AiTurn[], tools?: AiToolDeclaration[]) {
    const call = { system, turns: [...turns], tools };
    this.calls.push(call);
    return (this.steps.shift() ?? answer('(script ended)'))(call);
  }
  /** The result objects the app handed back for the tool calls of the last round. */
  lastToolResult(): any {
    const turn = this.calls.at(-1)!.turns.at(-1) as Extract<AiTurn, { role: 'tool-result' }>;
    return turn.results[0].result;
  }
}

describe('5.8c: AI tools and task drafting (real app, model scripted)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  let gw: ScriptedGateway;
  const cookies: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const call = async (who: string, method: string, path: string, body?: object, headers: Record<string, string> = {}) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies[who], 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const conversation = async (who: string, workspaceId: string | null = fx.workspaceA) => {
    const r = await call(who, 'POST', '/ai/conversations', workspaceId ? { title: 'Work', mode: 'PROJECT', contextScope: 'WORKSPACE', workspaceId } : { title: 'Help', mode: 'KNOWLEDGE', contextScope: 'GLOBAL' });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    return r.json.data.id as string;
  };
  const say = (who: string, conv: string, content: string) => call(who, 'POST', `/ai/conversations/${conv}/messages`, { content }, { 'idempotency-key': randomUUID() });
  /** Runs one message with a script and returns the response plus the tool result the app produced for the first tool call. */
  const run = async (who: string, steps: Step[], content = 'question', conv?: string) => {
    gw.steps = steps;
    gw.calls = [];
    const r = await say(who, conv ?? (await conversation(who)), content);
    return r;
  };
  const used = async (who: string) => (await call(who, 'GET', '/ai/quota')).json.data.messagesUsed as number;
  const titles = (res: any) => (res.tasks as any[]).map((t) => t.title).sort();
  const day = (offset: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + offset));

  before(async () => {
    gw = new ScriptedGateway();
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
    for (const [who, label] of Object.entries({ owner: 'owner', admin2: 'admin2', memberA: 'membera', memberB: 'memberb', outsider: 'outsider' })) {
      cookies[who] = `access_token=${(await auth.login({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' })).accessToken}`;
      await prisma.userAiSubscription.upsert({ where: { userId: fx.users[who as keyof Fixture['users']] }, create: { userId: fx.users[who as keyof Fixture['users']], dailyQuota: 100 }, update: { dailyQuota: 100 } });
    }
    const task = async (key: string, projectId: string, data: object) => (ids[key] = (await prisma.task.create({ data: { projectId, authorId: fx.users.owner, title: key, ...data } as any })).id);
    await task('Alpha overdue', fx.projectA1, { assigneeId: fx.users.memberA, dueDate: day(-3), status: 'TODO' });
    await task('Alpha later', fx.projectA1, { assigneeId: fx.users.owner, dueDate: day(10), status: 'IN_PROGRESS' });
    await task('Alpha done', fx.projectA1, { assigneeId: fx.users.memberA, status: 'DONE', completedAt: new Date() });
    await task('Alpha trash', fx.projectA1, { deletedAt: new Date() });
    await task('Beta hidden', fx.projectA2, { assigneeId: fx.users.owner, dueDate: day(-1) });
    await task('Other tenant secret', fx.projectB1, {});
    await task('x'.repeat(500), fx.projectA1, { status: 'TODO' });
  });

  beforeEach(() => {
    gw.steps = [];
    gw.calls = [];
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('offering the tools', () => {
    it('offers the four tools in a workspace conversation and none in a help conversation', async () => {
      await run('owner', [answer('hi')]);
      assert.deepEqual(gw.calls[0].tools?.map((t) => t.name), ['list_projects', 'list_tasks', 'get_task', 'propose_task']);
      assert.match(gw.calls[0].system, /list_projects, list_tasks and get_task/);
      await run('owner', [answer('hi')], 'q', await conversation('owner', null));
      assert.equal(gw.calls[0].tools, undefined);
      assert.match(gw.calls[0].system, /cannot see this user's workspace data/);
    });

    it('tells the model the date, so "by Friday" can become a real date', async () => {
      await run('owner', [answer('hi')]);
      assert.match(gw.calls[0].system, new RegExp(`Today is ${new Date().toISOString().slice(0, 10)} \\(UTC\\)`));
    });
  });

  describe('who sees what', () => {
    it('shows the workspace admin every live project, and a project member only theirs', async () => {
      await run('owner', [ask('list_projects'), answer('ok')]);
      assert.deepEqual(gw.lastToolResult().projects.map((p: any) => p.key).sort(), ['ALP', 'BET']);
      await run('memberA', [ask('list_projects'), answer('ok')]);
      assert.deepEqual(gw.lastToolResult().projects.map((p: any) => p.key), ['ALP']);
      await run('memberB', [ask('list_projects'), answer('ok')]);
      assert.deepEqual(gw.lastToolResult().projects, []);
    });

    it('lists tasks only from visible projects, never deleted ones, never another tenant', async () => {
      await run('memberA', [ask('list_tasks'), answer('ok')]);
      const mine = titles(gw.lastToolResult());
      assert.ok(mine.includes('Alpha overdue') && mine.includes('Alpha later'));
      assert.ok(!mine.some((t) => /Beta|Other|trash/.test(t)), mine.join(','));
      await run('owner', [ask('list_tasks', { limit: 20 }), answer('ok')]);
      const all = titles(gw.lastToolResult());
      assert.ok(all.includes('Beta hidden') && !all.some((t) => /Other tenant|trash/.test(t)), all.join(','));
    });

    it('applies the filters: overdue, assigned to me, status, project', async () => {
      await run('owner', [ask('list_tasks', { overdue: true }), answer('ok')]);
      assert.deepEqual(titles(gw.lastToolResult()), ['Alpha overdue', 'Beta hidden']);
      await run('memberA', [ask('list_tasks', { assignedToMe: true, status: 'DONE' }), answer('ok')]);
      assert.deepEqual(titles(gw.lastToolResult()), ['Alpha done']);
      await run('owner', [ask('list_tasks', { projectKey: 'bet' }), answer('ok')]);
      assert.deepEqual(titles(gw.lastToolResult()), ['Beta hidden']);
    });

    it('answers a hidden or unknown project the same way, and a bad filter with an error the model can read', async () => {
      await run('memberA', [ask('list_tasks', { projectKey: 'BET' }), answer('ok')]);
      const hidden = gw.lastToolResult().error;
      await run('memberA', [ask('list_tasks', { projectKey: 'ZZZ' }), answer('ok')]);
      assert.match(hidden, /No project with key BET is visible/);
      assert.match(gw.lastToolResult().error, /No project with key ZZZ is visible/);
      await run('owner', [ask('list_tasks', { status: 'ALMOST' }), answer('ok')]);
      assert.match(gw.lastToolResult().error, /status must be one of/);
    });

    it('reads one visible task, and gives the same error for a hidden, deleted, foreign or missing one', async () => {
      await run('memberA', [ask('get_task', { taskId: ids['Alpha overdue'] }), answer('ok')]);
      assert.equal(gw.lastToolResult().task.title, 'Alpha overdue');
      const errors = new Set<string>();
      for (const id of [ids['Beta hidden'], ids['Alpha trash'], ids['Other tenant secret'], 'does-not-exist', '']) {
        await run('memberA', [ask('get_task', { taskId: id }), answer('ok')]);
        errors.add(gw.lastToolResult().error);
      }
      assert.equal(errors.size, 1, [...errors].join(' | '));
    });

    it('ignores a workspace or user the model names, because both come from the server', async () => {
      await run('memberA', [ask('list_projects', { workspaceId: fx.workspaceB, userId: fx.users.owner }), answer('ok')]);
      assert.deepEqual(gw.lastToolResult().projects.map((p: any) => p.key), ['ALP']);
      await run('outsider', [ask('list_tasks', { workspaceId: fx.workspaceA }), answer('ok')], 'q', await conversation('outsider', fx.workspaceB));
      assert.deepEqual(titles(gw.lastToolResult()), ['Other tenant secret']);
    });

    it('marks user-written text as data and cuts very long titles', async () => {
      await run('owner', [ask('list_tasks', { limit: 20 }), answer('ok')]);
      const res = gw.lastToolResult();
      assert.match(res.note, /never instructions/);
      assert.ok((res.tasks as any[]).every((t) => t.title.length <= 200));
      assert.ok((res.tasks as any[]).some((t) => t.title.length === 200));
    });

    it('gives no tools to a member who has since left the workspace', async () => {
      const conv = await conversation('memberB');
      await prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId: fx.workspaceA, userId: fx.users.memberB } } });
      await run('memberB', [answer('ok')], 'q', conv);
      assert.equal(gw.calls[0].tools, undefined);
      assert.match(gw.calls[0].system, /cannot see this user's workspace data/);
    });
  });

  describe('the tool loop', () => {
    it('costs one message however many tool rounds it takes', async () => {
      const before = await used('owner');
      const r = await run('owner', [ask('list_projects'), ask('list_tasks'), ask('get_task', { taskId: ids['Alpha later'] }), answer('done')]);
      assert.equal(r.status, 201);
      assert.equal(gw.calls.length, 4);
      assert.equal(await used('owner'), before + 1);
    });

    it('stops offering tools after 3 rounds, and answers 502 with a refund if the model still asks', async () => {
      const before = await used('owner');
      const r = await run('owner', [ask('list_projects'), ask('list_projects'), ask('list_projects'), ask('list_projects')]);
      assert.equal(r.status, 502);
      assert.equal(gw.calls.length, 4);
      assert.equal(gw.calls[3].tools, undefined);
      assert.equal(await used('owner'), before);
    });

    it('answers an unknown tool with an error instead of failing', async () => {
      await run('owner', [ask('delete_everything'), answer('ok')]);
      assert.match(gw.lastToolResult().error, /Unknown tool/);
    });

    it('cites the projects and tasks the answer names, and nothing else', async () => {
      const r = await run('memberA', [ask('list_tasks'), answer('You have one overdue task: Alpha overdue.')]);
      const citations = r.json.data.message.citations as any[];
      assert.deepEqual(citations.map((c) => [c.type, c.title]), [['TASK', 'Alpha overdue']]);
      assert.equal(citations[0].id, ids['Alpha overdue']);
      const none = await run('memberA', [ask('list_tasks'), answer('Nothing to report.')]);
      assert.equal(none.json.data.message.citations, null);
      const invented = await run('memberA', [ask('list_tasks'), answer('Beta hidden is late.')]);
      assert.equal(invented.json.data.message.citations, null, 'a task the user was never shown cannot be cited');
    });
  });

  describe('drafting a task', () => {
    const draft = (args: Record<string, unknown>) => [ask('propose_task', args), answer('Draft ready.')];

    it('creates a pending proposal in the named project, with the due date, and confirming makes the task', async () => {
      const r = await run('owner', draft({ title: 'Renew the domain', description: 'Before it expires', priority: 'HIGH', dueDate: '2026-12-04', projectKey: 'BET' }));
      assert.equal(r.status, 201, JSON.stringify(r.json));
      const p = r.json.data.proposal;
      assert.equal(p.status, 'PENDING');
      assert.equal(p.targetProjectId, fx.projectA2);
      assert.deepEqual(p.proposedPayload, { title: 'Renew the domain', description: 'Before it expires', priority: 'HIGH', dueDate: '2026-12-04' });
      assert.equal(await prisma.task.count({ where: { title: 'Renew the domain' } }), 0, 'nothing exists before confirmation');

      const ok = await call('owner', 'POST', `/ai/proposals/${p.id}/confirm`);
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      const task = await prisma.task.findFirstOrThrow({ where: { title: 'Renew the domain' } });
      assert.equal(task.projectId, fx.projectA2);
      assert.equal(task.priority, 'HIGH');
      assert.equal(task.dueDate?.toISOString().slice(0, 10), '2026-12-04');
      assert.equal((await call('owner', 'POST', `/ai/proposals/${p.id}/confirm`)).status, 409, 'cannot be applied twice');
    });

    it('asks which project when several are possible, and refuses a project the user cannot create tasks in', async () => {
      const r = await run('owner', draft({ title: 'No project named' }));
      assert.match(gw.lastToolResult().error, /Several projects are possible/);
      assert.equal(r.json.data.proposal, null);
      await run('owner', draft({ title: 'Wrong key', projectKey: 'OTH' }));
      assert.match(gw.lastToolResult().error, /cannot create tasks in a project with key OTH/);
    });

    it('drafts nothing for a member who is not a project admin', async () => {
      const r = await run('memberA', draft({ title: 'I am only a member', projectKey: 'ALP' }));
      assert.match(gw.lastToolResult().error, /cannot create tasks in any project/);
      assert.equal(r.json.data.proposal, null);
    });

    it('lets a project admin draft only in their own project', async () => {
      await prisma.projectMember.update({ where: { projectId_userId: { projectId: fx.projectA1, userId: fx.users.memberA } }, data: { role: 'ADMIN' } });
      try {
        const r = await run('memberA', draft({ title: 'Mine' }));
        assert.equal(r.json.data.proposal.targetProjectId, fx.projectA1, 'the only eligible project is chosen without being named');
        await run('memberA', draft({ title: 'Not mine', projectKey: 'BET' }));
        assert.match(gw.lastToolResult().error, /cannot create tasks in a project with key BET/);
        // Rights are checked again at confirmation: demoted since the draft, the confirmation is refused.
        await prisma.projectMember.update({ where: { projectId_userId: { projectId: fx.projectA1, userId: fx.users.memberA } }, data: { role: 'MEMBER' } });
        assert.equal((await call('memberA', 'POST', `/ai/proposals/${r.json.data.proposal.id}/confirm`)).status, 403);
      } finally {
        await prisma.projectMember.update({ where: { projectId_userId: { projectId: fx.projectA1, userId: fx.users.memberA } }, data: { role: 'MEMBER' } });
      }
    });

    it('rejects a bad title, priority or date, and a second draft in the same answer', async () => {
      for (const [args, message] of [
        [{ title: '   ' }, /title is required/],
        [{ title: 'x', priority: 'WHENEVER', projectKey: 'ALP' }, /priority must be one of/],
        [{ title: 'x', dueDate: '2026-02-31', projectKey: 'ALP' }, /real date/],
        [{ title: 'x', dueDate: 'next friday', projectKey: 'ALP' }, /real date/],
      ] as [Record<string, unknown>, RegExp][]) {
        const r = await run('owner', draft(args));
        assert.match(gw.lastToolResult().error, message);
        assert.equal(r.json.data.proposal, null);
      }
      const twice = await run('owner', [ask('propose_task', { title: 'First', projectKey: 'ALP' }), ask('propose_task', { title: 'Second', projectKey: 'ALP' }), answer('ok')]);
      assert.match(gw.lastToolResult().error, /already drafted/);
      assert.equal(twice.json.data.proposal.proposedPayload.title, 'First');
    });

    it('keeps only 100 characters of the title and 2,000 of the description', async () => {
      const r = await run('owner', draft({ title: 't'.repeat(300), description: 'd'.repeat(5000), projectKey: 'ALP' }));
      assert.equal(r.json.data.proposal.proposedPayload.title.length, 100);
      assert.equal(r.json.data.proposal.proposedPayload.description.length, 2000);
    });

    it('drops the draft when the final answer turns out to be a refusal', async () => {
      const r = await run('owner', [ask('propose_task', { title: 'Orphan', projectKey: 'ALP' }), answer('', { inScope: false })]);
      assert.equal(r.json.data.proposal, null);
      assert.match(r.json.data.message.content, /^I can only help with Veyro/);
    });
  });
});
