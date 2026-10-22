import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ProjectRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/**
 * CS-06 / ADR-013: AI task proposals name their target project, are linked to their message,
 * are only drafted for people who can create tasks, and are re-checked at confirmation time.
 */
describe('CS-06: AI proposals (target project, rights, message link, quota)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  const cookies: Record<string, string> = {};
  const code = (r: { json: any }) => r.json?.error?.code ?? r.json?.code ?? r.json?.data?.code;

  const login = async (label: string) => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' }) });
    assert.strictEqual(res.status, 200, `login ${label}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (who: string, method: string, path: string, body?: object, headers: Record<string, string> = {}) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies[who], 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const conversation = async (who: string, workspaceId?: string) => {
    const r = await call(who, 'POST', '/ai/conversations', workspaceId ? { title: 'Planning', mode: 'PROJECT', contextScope: 'WORKSPACE', workspaceId } : { title: 'Questions', mode: 'KNOWLEDGE', contextScope: 'GLOBAL' });
    assert.strictEqual(r.status, 201, JSON.stringify(r.json));
    return r.json.data.id as string;
  };
  const send = (who: string, conv: string, content: string, key = randomUUID()) => call(who, 'POST', `/ai/conversations/${conv}/messages`, { content }, { 'idempotency-key': key });
  const setProjectRole = (userId: string, role: ProjectRole) => prisma.projectMember.update({ where: { projectId_userId: { projectId: fx.projectA1, userId } }, data: { role } });

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    fx = await buildFixture(prisma);
    for (const l of ['owner', 'admin2', 'membera', 'memberb', 'outsider']) cookies[l] = await login(l);
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('drafting', () => {
    it('names the target project for a workspace admin and links the proposal to its message', async () => {
      const conv = await conversation('admin2', fx.workspaceA);
      const r = await send('admin2', conv, 'Create task: Write the release notes');
      assert.strictEqual(r.status, 201);
      const proposal = r.json.data.proposal;
      assert.ok(proposal, 'a proposal is drafted');
      assert.ok([fx.projectA1, fx.projectA2].includes(proposal.targetProjectId));
      assert.ok(['ALP', 'BET'].includes(proposal.project.key));
      assert.ok(r.json.data.message.content.includes(proposal.project.key), 'the reply names the project');
      assert.strictEqual(proposal.messageId, r.json.data.message.id);
      const msgs = await call('admin2', 'GET', `/ai/conversations/${conv}/messages`);
      const assistant = msgs.json.data.find((m: any) => m.senderRole === 'ASSISTANT');
      assert.strictEqual(assistant.proposal.id, proposal.id, 'messages carry their proposal');
      assert.strictEqual(assistant.proposal.project.key, proposal.project.key);
      assert.strictEqual(msgs.json.data.find((m: any) => m.senderRole === 'USER').proposal, null);
      const list = await call('admin2', 'GET', `/ai/conversations/${conv}/proposals`);
      assert.strictEqual(list.json.data[0].project.key, proposal.project.key);
    });

    it('does not draft a task for someone who cannot create tasks', async () => {
      const conv = await conversation('memberb', fx.workspaceA);
      const r = await send('memberb', conv, 'Create task: Sneak a task in');
      assert.strictEqual(r.status, 201);
      assert.strictEqual(r.json.data.proposal, null);
      assert.ok(/project admin/i.test(r.json.data.message.content));
      assert.strictEqual(await prisma.aiMutationProposal.count({ where: { conversation: { userId: fx.users.memberB } } }), 0);
    });

    it('does not draft a task in a conversation without a workspace', async () => {
      const conv = await conversation('owner');
      const r = await send('owner', conv, 'create task: something');
      assert.strictEqual(r.json.data.proposal, null);
      assert.ok(/workspace/i.test(r.json.data.message.content));
    });
  });

  describe('confirmation', () => {
    let proposalId: string;
    let conv: string;

    it('targets only the projects where a project admin can create tasks', async () => {
      await setProjectRole(fx.users.memberA, ProjectRole.ADMIN);
      conv = await conversation('membera', fx.workspaceA);
      const r = await send('membera', conv, 'Add task: Review the invite copy');
      assert.strictEqual(r.json.data.proposal.targetProjectId, fx.projectA1, 'the only project memberA administers');
      proposalId = r.json.data.proposal.id;
    });

    it('re-checks the confirming user rights at confirmation time (demoted since the draft)', async () => {
      await setProjectRole(fx.users.memberA, ProjectRole.MEMBER);
      const r = await call('membera', 'POST', `/ai/proposals/${proposalId}/confirm`);
      assert.strictEqual(r.status, 403);
      assert.strictEqual(code(r), 'PERMISSION_DENIED');
      assert.strictEqual((await prisma.aiMutationProposal.findUniqueOrThrow({ where: { id: proposalId } })).status, 'PENDING');
      assert.strictEqual(await prisma.task.count({ where: { projectId: fx.projectA1, title: 'Review the invite copy' } }), 0);
    });

    it('creates the task in the named project once rights are back, costs no quota, and cannot be applied twice', async () => {
      await setProjectRole(fx.users.memberA, ProjectRole.ADMIN);
      const before = (await call('membera', 'GET', '/ai/quota')).json.data.messagesUsed;
      const r = await call('membera', 'POST', `/ai/proposals/${proposalId}/confirm`);
      assert.strictEqual(r.status, 200);
      const task = await prisma.task.findFirstOrThrow({ where: { title: 'Review the invite copy' } });
      assert.strictEqual(task.projectId, fx.projectA1);
      assert.strictEqual(task.authorId, fx.users.memberA);
      const log = await prisma.auditLog.findFirst({ where: { action: 'TASK_CREATED_VIA_AI_CONFIRMATION', taskId: task.id } });
      assert.strictEqual(log?.projectId, fx.projectA1);
      assert.strictEqual((await call('membera', 'GET', '/ai/quota')).json.data.messagesUsed, before, 'confirmations are free');
      const again = await call('membera', 'POST', `/ai/proposals/${proposalId}/confirm`);
      assert.strictEqual(again.status, 409);
      assert.strictEqual(code(again), 'PROPOSAL_ALREADY_RESOLVED');
    });

    it('lets the owner of a proposal reject it, and hides it from other users', async () => {
      const c = await conversation('admin2', fx.workspaceA);
      const p = (await send('admin2', c, 'new task: Rejected idea')).json.data.proposal;
      assert.strictEqual((await call('memberb', 'POST', `/ai/proposals/${p.id}/confirm`)).status, 404);
      assert.strictEqual((await call('memberb', 'POST', `/ai/proposals/${p.id}/reject`)).status, 404);
      const rej = await call('admin2', 'POST', `/ai/proposals/${p.id}/reject`);
      assert.strictEqual(rej.status, 200);
      assert.strictEqual(rej.json.data.status, 'REJECTED');
      assert.strictEqual((await call('admin2', 'POST', `/ai/proposals/${p.id}/confirm`)).status, 409);
      assert.strictEqual(await prisma.task.count({ where: { title: 'Rejected idea' } }), 0);
    });

    it('refuses to apply a proposal whose target project is no longer editable', async () => {
      const c = await conversation('owner', fx.workspaceA);
      const p = (await send('owner', c, 'create task: Into a locked project')).json.data.proposal;
      await prisma.project.update({ where: { id: p.targetProjectId }, data: { isBillingReadOnly: true } });
      const r = await call('owner', 'POST', `/ai/proposals/${p.id}/confirm`);
      assert.strictEqual(r.status, 422);
      assert.strictEqual(code(r), 'NO_ACTIVE_PROJECT_AVAILABLE');
      await prisma.project.update({ where: { id: p.targetProjectId }, data: { isBillingReadOnly: false } });
    });
  });

  describe('quota and idempotency', () => {
    it('replays a repeated request, rejects a changed payload and exhausts the daily quota', async () => {
      const conv = await conversation('outsider', fx.workspaceB);
      const key = randomUUID();
      const first = await send('outsider', conv, 'What is blocking us?', key);
      assert.strictEqual(first.status, 201);
      const replay = await send('outsider', conv, 'What is blocking us?', key);
      assert.strictEqual(replay.json.data.isReplay, true);
      assert.strictEqual(replay.json.data.message.id, first.json.data.message.id);
      assert.strictEqual((await call('outsider', 'GET', '/ai/quota')).json.data.messagesUsed, 1, 'a replay is free');
      const changed = await send('outsider', conv, 'A different question', key);
      assert.strictEqual(changed.status, 422);
      assert.strictEqual(code(changed), 'IDEMPOTENCY_KEY_MISMATCH');
      const missing = await call('outsider', 'POST', `/ai/conversations/${conv}/messages`, { content: 'No key' });
      assert.strictEqual(missing.status, 400);
      assert.strictEqual(code(missing), 'IDEMPOTENCY_KEY_REQUIRED');

      assert.strictEqual((await send('outsider', conv, 'Second question')).status, 201);
      assert.strictEqual((await send('outsider', conv, 'Third question')).status, 201);
      const over = await send('outsider', conv, 'Fourth question');
      assert.strictEqual(over.status, 429);
      assert.strictEqual(code(over), 'AI_QUOTA_EXCEEDED');
      const q = (await call('outsider', 'GET', '/ai/quota')).json.data;
      assert.deepEqual([q.dailyQuota, q.messagesUsed, q.remaining], [3, 3, 0]);
      assert.ok(new Date(q.resetsAt).getTime() > Date.now(), 'a countdown target is returned');
    });
  });
});
