import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as bcrypt from 'bcrypt';
import { NestFactory, ModulesContainer } from '@nestjs/core';
import { ValidationPipe, INestApplication, RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { IS_PUBLIC_KEY } from '../src/modules/auth/decorators/public.decorator';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/**
 * Step 5.2: every protected route against every kind of caller, in both tenants.
 *
 * Callers: anon, owner (account owner), admin2 (workspace admin), projAdmin (workspace member who is ADMIN of project A1),
 * memberA (workspace member assigned to A1), memberB (workspace member NOT on A1), outsider (owner of the other tenant, B).
 * The table below is the permission matrix (docs/03 section 2, BR-PRJ-04) written as data. Callers that must be refused are
 * really sent; callers that are allowed are only sent on read routes (a write would change the fixture), the write paths
 * of allowed roles are proven by the CS-0x suites.
 */
type Caller = 'anon' | 'owner' | 'admin2' | 'projAdmin' | 'memberA' | 'memberB' | 'outsider';
const CALLERS: Caller[] = ['anon', 'owner', 'admin2', 'projAdmin', 'memberA', 'memberB', 'outsider'];
type Res = 'ws' | 'project' | 'task' | 'dtask' | 'account' | 'conv';

/** Who may call (in tenant A), which status everybody else gets, and per-caller exceptions. `rest` is the status outside the tenant's circle. */
interface AccessClass { ok: Caller[]; rest: 403 | 404; special?: Partial<Record<Caller, 403 | 404>> }
const CLASSES: Record<string, AccessClass> = {
  wsRead: { ok: ['owner', 'admin2', 'projAdmin', 'memberA', 'memberB'], rest: 403 },
  wsAdmin: { ok: ['owner', 'admin2'], rest: 403 },
  projRead: { ok: ['owner', 'admin2', 'projAdmin', 'memberA'], rest: 404 },
  projAdmin: { ok: ['owner', 'admin2', 'projAdmin'], rest: 404, special: { memberA: 403 } },
  // Restoring a deleted project has no guard on purpose (CS-08): the service answers 404 to everyone but workspace admins.
  wsAdminHidden: { ok: ['owner', 'admin2'], rest: 404 },
  wsAdminOnProject: { ok: ['owner', 'admin2'], rest: 404, special: { projAdmin: 403, memberA: 403 } },
  account: { ok: ['owner'], rest: 403 },
  own: { ok: ['owner'], rest: 404 },
};

interface Row { key: string; res: Res; cls: keyof typeof CLASSES; body?: object; query?: string; headers?: Record<string, string> }
const ROWS: Row[] = [
  // workspace (TenantGuard + service rules)
  { key: 'GET /workspaces/:id', res: 'ws', cls: 'wsRead' },
  { key: 'PATCH /workspaces/:id', res: 'ws', cls: 'wsAdmin', body: { name: 'hijacked' } },
  { key: 'GET /workspaces/:id/members', res: 'ws', cls: 'wsRead' },
  { key: 'PATCH /workspaces/:id/members/:memberId', res: 'ws', cls: 'wsAdmin', body: { role: 'ADMIN' } },
  { key: 'DELETE /workspaces/:id/members/:memberId', res: 'ws', cls: 'wsAdmin' },
  { key: 'GET /workspaces/:id/invitations', res: 'ws', cls: 'wsAdmin' },
  { key: 'POST /workspaces/:id/invitations', res: 'ws', cls: 'wsAdmin', body: { email: 'x@veyro-test.io', role: 'MEMBER' } },
  { key: 'POST /workspaces/:id/invitations/:invitationId/revoke', res: 'ws', cls: 'wsAdmin' },
  { key: 'POST /workspaces/:id/invitations/:invitationId/resend', res: 'ws', cls: 'wsAdmin' },
  { key: 'GET /workspaces/:workspaceId/dashboard', res: 'ws', cls: 'wsRead' },
  { key: 'GET /workspaces/:workspaceId/projects', res: 'ws', cls: 'wsRead' },
  { key: 'POST /workspaces/:workspaceId/projects', res: 'ws', cls: 'wsAdmin', body: { name: 'Leak', key: 'LEK' } },
  { key: 'GET /workspaces/:workspaceId/my-tasks', res: 'ws', cls: 'wsRead' },
  // project (ProjectAccessGuard: outsiders and unassigned members get 404)
  { key: 'GET /projects/:id', res: 'project', cls: 'projRead' },
  { key: 'PATCH /projects/:id', res: 'project', cls: 'projAdmin', body: { name: 'hijacked' } },
  { key: 'DELETE /projects/:id', res: 'project', cls: 'wsAdminOnProject' },
  { key: 'POST /projects/:id/restore', res: 'project', cls: 'wsAdminHidden' },
  { key: 'GET /projects/:id/members', res: 'project', cls: 'projRead' },
  { key: 'POST /projects/:id/members', res: 'project', cls: 'projAdmin', body: { userId: 'x' } },
  { key: 'PATCH /projects/:id/members/:userId', res: 'project', cls: 'projAdmin', body: { role: 'ADMIN' } },
  { key: 'DELETE /projects/:id/members/:userId', res: 'project', cls: 'projAdmin' },
  { key: 'GET /projects/:projectId/tasks', res: 'project', cls: 'projRead' },
  { key: 'POST /projects/:projectId/tasks', res: 'project', cls: 'projAdmin', body: { title: 'Leak' } },
  // task (TaskAccessGuard)
  { key: 'GET /tasks/:id', res: 'task', cls: 'projRead' },
  { key: 'PATCH /tasks/:id', res: 'task', cls: 'projAdmin', body: { title: 'hijacked' } },
  { key: 'DELETE /tasks/:id', res: 'task', cls: 'projAdmin' },
  { key: 'POST /tasks/:id/reopen', res: 'task', cls: 'projAdmin', body: { targetStatus: 'TODO', reason: 'it was reopened by mistake' } },
  { key: 'POST /tasks/:id/restore', res: 'dtask', cls: 'projAdmin' },
  { key: 'GET /tasks/:id/comments', res: 'task', cls: 'projRead' },
  { key: 'POST /tasks/:id/comments', res: 'task', cls: 'projRead', body: { content: 'hello' } },
  // account (AccountOwnerGuard: only the owner, anyone else 403)
  { key: 'GET /accounts/:id/subscription', res: 'account', cls: 'account' },
  { key: 'GET /accounts/:id/billing-events', res: 'account', cls: 'account' },
  { key: 'GET /accounts/:id/projects', res: 'account', cls: 'account' },
  { key: 'POST /accounts/:id/select-active-projects', res: 'account', cls: 'account', body: { activeProjectIds: [] } },
  { key: 'POST /accounts/:id/billing/checkout', res: 'account', cls: 'account', body: { tier: 'PRO' } },
  { key: 'POST /accounts/:id/billing/portal', res: 'account', cls: 'account' },
  { key: 'POST /accounts/:id/billing/change-plan', res: 'account', cls: 'account', body: { tier: 'PRO' } },
  { key: 'POST /accounts/:id/workspaces', res: 'account', cls: 'account', body: { name: 'Leak', slug: 'leak-ws' } },
  { key: 'POST /accounts/:id/offboard', res: 'account', cls: 'account', body: { passwordConfirmation: 'x', slugConfirmation: 'x' } },
  // audit trail (service-level scoping through query filters)
  { key: 'GET /audit-logs', res: 'ws', cls: 'wsAdmin', query: 'workspaceId=:ws' },
  { key: 'GET /audit-logs', res: 'account', cls: 'account', query: 'accountId=:id' },
  // AI conversations are private to their author, even from workspace admins
  { key: 'GET /ai/conversations/:id', res: 'conv', cls: 'own' },
  { key: 'GET /ai/conversations/:id/messages', res: 'conv', cls: 'own' },
  { key: 'GET /ai/conversations/:id/proposals', res: 'conv', cls: 'own' },
  { key: 'POST /ai/conversations/:id/messages', res: 'conv', cls: 'own', body: { content: 'hi' }, headers: { 'idempotency-key': 'p52-matrix-key' } },
];

/** Routes with no tenant resource in the path: they act on the caller's own data, or carry their own proof (a token). */
const USER_SCOPED = new Set([
  'POST /onboarding/atomic', 'GET /workspaces', 'GET /invitations/preview', 'POST /invitations/accept',
  'GET /auth/me', 'POST /auth/logout', 'POST /auth/change-password',
  'GET /users/me/profile', 'PATCH /users/me', 'DELETE /users/me', 'GET /users/me/ai-subscription',
  // Profile photo (5.9a): no id in the path; the storage id is built from the caller's own id on the server (p62 proves it).
  'PUT /users/me/avatar', 'PUT /users/me/avatar/preset', 'DELETE /users/me/avatar',
  // Notifications (5.9c): the caller's own rows; no user id in any path, mark-read matches the recipient too (p63 proves it).
  'GET /notifications', 'GET /notifications/unread-count', 'POST /notifications/read-all', 'POST /notifications/:id/read',
  'GET /ai/conversations', 'POST /ai/conversations', 'GET /ai/quota',
  // Proposals are reached through a conversation of the caller and re-check the caller's rights on confirm (CS-06 suite).
  'POST /ai/proposals/:id/confirm', 'POST /ai/proposals/:id/reject',
]);

function discoverRoutes(app: INestApplication): { key: string; isPublic: boolean }[] {
  const out: { key: string; isPublic: boolean }[] = [];
  for (const mod of app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      const cls = wrapper.metatype as any;
      if (!cls) continue;
      const base = Reflect.getMetadata(PATH_METADATA, cls) ?? '';
      for (const name of Object.getOwnPropertyNames(cls.prototype)) {
        const handler = cls.prototype[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler);
        if (method === undefined) continue;
        const sub = Reflect.getMetadata(PATH_METADATA, handler) ?? '';
        const path = '/' + [base, sub].join('/').split('/').filter(Boolean).join('/');
        const isPublic = !!(Reflect.getMetadata(IS_PUBLIC_KEY, handler) ?? Reflect.getMetadata(IS_PUBLIC_KEY, cls));
        out.push({ key: `${RequestMethod[method]} ${path}`, isPublic });
      }
    }
  }
  return out;
}

describe('5.2: tenant isolation and role matrix (real app, real guards)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  let projAdminUserId: string;
  const cookies: Record<Caller, string> = { anon: '', owner: '', admin2: '', projAdmin: '', memberA: '', memberB: '', outsider: '' };
  type Ids = Record<Res, string> & { project: string };
  let A: Ids;
  let B: Ids;

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

    // A workspace member who is ADMIN of project A1 only (the fixture's project admin is the owner, who is also a workspace admin).
    const pa = await prisma.user.create({
      data: { email: `projadmin.${fx.run}@veyro-test.io`, name: `projadmin ${fx.run}`, passwordHash: await bcrypt.hash('Password123!', 4), isEmailVerified: true },
    });
    projAdminUserId = pa.id;
    await prisma.workspaceMember.create({ data: { workspaceId: fx.workspaceA, userId: pa.id, role: 'MEMBER' } });
    await prisma.projectMember.create({ data: { projectId: fx.projectA1, userId: pa.id, role: 'ADMIN' } });

    const wsB = await prisma.workspace.findUniqueOrThrow({ where: { id: fx.workspaceB } });
    const task = (projectId: string, authorId: string, assigneeId?: string) =>
      prisma.task.create({ data: { projectId, title: `Seed ${fx.run}`, authorId, ...(assigneeId ? { assigneeId } : {}) } as any });
    const taskA = await task(fx.projectA1, fx.users.owner, fx.users.memberA);
    const taskB = await task(fx.projectB1, fx.users.outsider);
    const gone = (projectId: string, authorId: string) =>
      prisma.task.create({ data: { projectId, title: `Deleted ${fx.run}`, authorId, deletedAt: new Date() } as any });
    const dtaskA = await gone(fx.projectA1, fx.users.owner);
    const dtaskB = await gone(fx.projectB1, fx.users.outsider);
    // The fixture only gives account A a subscription; the owner of B must be able to read their own.
    await prisma.accountSubscription.create({ data: { accountId: wsB.accountId, tier: 'FREE' } });
    const conv = (userId: string, workspaceId: string) => prisma.aiConversation.create({ data: { userId, workspaceId, title: `Conv ${fx.run}` } });
    const convA = await conv(fx.users.owner, fx.workspaceA);
    const convB = await conv(fx.users.outsider, fx.workspaceB);
    A = { ws: fx.workspaceA, project: fx.projectA1, task: taskA.id, dtask: dtaskA.id, account: fx.accountA, conv: convA.id };
    B = { ws: fx.workspaceB, project: fx.projectB1, task: taskB.id, dtask: dtaskB.id, account: wsB.accountId, conv: convB.id };

    const auth = app.get(AuthService, { strict: false });
    const emails: Record<Exclude<Caller, 'anon'>, string> = {
      owner: 'owner', admin2: 'admin2', projAdmin: 'projadmin', memberA: 'membera', memberB: 'memberb', outsider: 'outsider',
    };
    for (const [who, label] of Object.entries(emails)) {
      const s = await auth.login({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' });
      cookies[who as Caller] = `access_token=${s.accessToken}`;
    }
  });

  after(async () => {
    try {
      await fx.cleanup();
      if (projAdminUserId) {
        await prisma.userSession.deleteMany({ where: { userId: projAdminUserId } });
        await prisma.user.deleteMany({ where: { id: projAdminUserId } });
      }
    } finally {
      await app.close();
    }
  });

  const send = async (who: Caller, method: string, path: string, body?: object, headers: Record<string, string> = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers, ...(cookies[who] ? { cookie: cookies[who] } : {}) },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    return res.status;
  };

  const urlFor = (row: Row, ids: Ids) => {
    const [, tpl] = row.key.split(' ');
    const path = tpl
      .replace(':workspaceId', ids.ws).replace(':projectId', ids.project)
      .replace(':id', ids[row.res]).replace(/:(memberId|userId|invitationId)/, 'zzzzzzzzzzzzzzzzzzzzzzzzz');
    const q = row.query?.replace(':ws', ids.ws).replace(':id', ids.account);
    return q ? `${path}?${q}` : path;
  };

  /** Runs every row in one tenant. `mine` = the callers that belong to this tenant's circle. */
  const runMatrix = async (ids: Ids, tenant: 'A' | 'B') => {
    const failures: string[] = [];
    for (const row of ROWS) {
      const cls = CLASSES[row.cls];
      const method = row.key.split(' ')[0];
      for (const who of CALLERS) {
        let expected: number | 'ok';
        if (who === 'anon') expected = 401;
        else if (tenant === 'A') expected = cls.ok.includes(who) ? 'ok' : cls.special?.[who] ?? cls.rest;
        else expected = who === 'outsider' ? 'ok' : cls.rest;
        // Never send a write that is supposed to succeed: it would change the fixture other rows depend on.
        if (expected === 'ok' && method !== 'GET') continue;
        const status = await send(who, method, urlFor(row, ids), row.body, row.headers);
        const good = expected === 'ok' ? status === 200 : status === expected;
        if (!good) failures.push(`${tenant} ${who} ${row.key}${row.query ? '?' + row.query : ''} [${row.cls}] expected ${expected} got ${status}`);
      }
    }
    return failures;
  };

  it('tenant A: each role gets exactly what the permission matrix says', async () => {
    assert.deepStrictEqual(await runMatrix(A, 'A'), []);
  });

  it('tenant B: nobody from tenant A can reach tenant B through the same routes', async () => {
    assert.deepStrictEqual(await runMatrix(B, 'B'), []);
  });

  it('every protected route answers 401 without a session', async () => {
    const failures: string[] = [];
    for (const r of discoverRoutes(app).filter((x) => !x.isPublic)) {
      const [method, tpl] = r.key.split(' ');
      const status = await send('anon', method, tpl.replace(/:\w+/g, 'zzzzzzzzzzzzzzzzzzzzzzzzz'));
      if (status !== 401) failures.push(`${r.key} answered ${status}`);
    }
    assert.deepStrictEqual(failures, []);
  });

  it('no route can ship without a rule: every protected route is in the matrix or listed as user-scoped', () => {
    const covered = new Set([...ROWS.map((r) => r.key), ...USER_SCOPED]);
    const protectedRoutes = discoverRoutes(app).filter((x) => !x.isPublic).map((x) => x.key);
    assert.deepStrictEqual(protectedRoutes.filter((k) => !covered.has(k)), [], 'routes missing from the matrix');
    const known = new Set(protectedRoutes);
    assert.deepStrictEqual([...covered].filter((k) => !known.has(k)), [], 'matrix rows for routes that no longer exist');
  });
});
