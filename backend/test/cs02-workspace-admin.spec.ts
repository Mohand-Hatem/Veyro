import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { InvitationStatus, WorkspaceRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/**
 * CS-02: workspace administration (settings, member roles, member removal, pending invitations).
 * Runs against the real HTTP stack (guards, validation pipe, envelopes, exception filter).
 */
describe('CS-02: workspace administration', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  const cookies: Record<string, string> = {};
  const memberRow: Record<string, string> = {};

  const login = async (label: string) => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' }),
    });
    assert.strictEqual(res.status, 200, `login ${label}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (who: string, method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { cookie: cookies[who], 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const code = (r: { json: any }) => r.json?.error?.code ?? r.json?.code ?? r.json?.data?.code;
  const ws = () => `/workspaces/${fx.workspaceA}`;
  const audits = (action: string) => prisma.auditLog.findMany({ where: { workspaceId: fx.workspaceA, action } });

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
    const rows = await prisma.workspaceMember.findMany({ where: { workspaceId: { in: [fx.workspaceA, fx.workspaceB] } } });
    const byUser = (id: string) => rows.find((r) => r.userId === id)!.id;
    memberRow.owner = byUser(fx.users.owner);
    memberRow.admin2 = byUser(fx.users.admin2);
    memberRow.membera = byUser(fx.users.memberA);
    memberRow.memberb = byUser(fx.users.memberB);
    memberRow.outsider = byUser(fx.users.outsider);
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('PATCH /workspaces/:id (settings)', () => {
    it('lets an admin rename the workspace and writes an audit record with before/after', async () => {
      const r = await call('admin2', 'PATCH', ws(), { name: `Renamed ${fx.run}` });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.data.name, `Renamed ${fx.run}`);
      assert.ok(r.json.data._count.members >= 4);
      const log = (await audits('WORKSPACE_UPDATED'))[0];
      assert.ok(log);
      assert.deepEqual((log.metadata as any).changes.name.to, `Renamed ${fx.run}`);
    });

    it('changes the slug, and refuses a slug owned by another workspace with 409', async () => {
      const ok = await call('owner', 'PATCH', ws(), { slug: `Renamed-${fx.run}`.toLowerCase() });
      assert.strictEqual(ok.status, 200);
      assert.strictEqual(ok.json.data.slug, `renamed-${fx.run}`.toLowerCase());
      const other = await prisma.workspace.findUniqueOrThrow({ where: { id: fx.workspaceB } });
      const taken = await call('owner', 'PATCH', ws(), { slug: other.slug });
      assert.strictEqual(taken.status, 409);
      assert.strictEqual(code(taken), 'WORKSPACE_SLUG_TAKEN');
    });

    it('is a no-op (no audit record) when nothing actually changes', async () => {
      const before = (await audits('WORKSPACE_UPDATED')).length;
      const current = await prisma.workspace.findUniqueOrThrow({ where: { id: fx.workspaceA } });
      const r = await call('admin2', 'PATCH', ws(), { name: current.name, slug: current.slug });
      assert.strictEqual(r.status, 200);
      assert.strictEqual((await audits('WORKSPACE_UPDATED')).length, before);
    });

    it('rejects an empty body (422) and malformed values (400)', async () => {
      const empty = await call('admin2', 'PATCH', ws(), {});
      assert.strictEqual(empty.status, 422);
      assert.strictEqual(code(empty), 'EMPTY_UPDATE');
      for (const slug of ['ab', 'Bad Slug', '-lead', 'trail-', 'dou--ble', 'x'.repeat(51)]) {
        const r = await call('admin2', 'PATCH', ws(), { slug });
        assert.strictEqual(r.status, 400, `slug ${slug}`);
      }
      assert.strictEqual((await call('admin2', 'PATCH', ws(), { name: 'x' })).status, 400);
      assert.strictEqual((await call('admin2', 'PATCH', ws(), { name: 'y'.repeat(101) })).status, 400);
      assert.strictEqual((await call('admin2', 'PATCH', ws(), { name: 'Valid', role: 'ADMIN' })).status, 400, 'unknown fields are forbidden');
    });

    it('denies members (403) and outsiders (403 from the tenant guard)', async () => {
      const m = await call('membera', 'PATCH', ws(), { name: 'Nope Nope' });
      assert.strictEqual(m.status, 403);
      assert.strictEqual(code(m), 'PERMISSION_DENIED');
      assert.strictEqual((await call('outsider', 'PATCH', ws(), { name: 'Nope Nope' })).status, 403);
    });
  });

  describe('members: list, change role, remove', () => {
    it('GET /members flags the account owner and nobody else', async () => {
      const r = await call('membera', 'GET', `${ws()}/members`);
      assert.strictEqual(r.status, 200);
      const owners = r.json.data.filter((m: any) => m.isAccountOwner).map((m: any) => m.userId);
      assert.deepEqual(owners, [fx.users.owner]);
    });

    it('promotes and demotes a member, with audit records', async () => {
      const up = await call('admin2', 'PATCH', `${ws()}/members/${memberRow.memberb}`, { role: 'ADMIN' });
      assert.strictEqual(up.status, 200);
      assert.strictEqual(up.json.data.role, 'ADMIN');
      const down = await call('owner', 'PATCH', `${ws()}/members/${memberRow.memberb}`, { role: 'MEMBER' });
      assert.strictEqual(down.json.data.role, 'MEMBER');
      const logs = await audits('MEMBER_ROLE_CHANGED');
      assert.strictEqual(logs.length, 2);
      assert.deepEqual((logs.find((l) => (l.metadata as any).to === 'ADMIN')!.metadata as any).from, 'MEMBER');
    });

    it('is idempotent when the role is already set (no audit record)', async () => {
      const before = (await audits('MEMBER_ROLE_CHANGED')).length;
      const r = await call('admin2', 'PATCH', `${ws()}/members/${memberRow.memberb}`, { role: 'MEMBER' });
      assert.strictEqual(r.status, 200);
      assert.strictEqual((await audits('MEMBER_ROLE_CHANGED')).length, before);
    });

    it('protects the account owner and the caller themself', async () => {
      const owner = await call('admin2', 'PATCH', `${ws()}/members/${memberRow.owner}`, { role: 'MEMBER' });
      assert.strictEqual(owner.status, 403);
      assert.strictEqual(code(owner), 'OWNER_ROLE_IMMUTABLE');
      const self = await call('admin2', 'PATCH', `${ws()}/members/${memberRow.admin2}`, { role: 'MEMBER' });
      assert.strictEqual(self.status, 422);
      assert.strictEqual(code(self), 'CANNOT_CHANGE_OWN_ROLE');
      assert.strictEqual((await call('admin2', 'PATCH', `${ws()}/members/${memberRow.memberb}`, { role: 'OWNER' })).status, 400);
    });

    it('denies members and answers 404 for a member id from another workspace', async () => {
      assert.strictEqual((await call('membera', 'PATCH', `${ws()}/members/${memberRow.memberb}`, { role: 'ADMIN' })).status, 403);
      const idor = await call('owner', 'PATCH', `${ws()}/members/${memberRow.outsider}`, { role: 'MEMBER' });
      assert.strictEqual(idor.status, 404);
      const idorDelete = await call('owner', 'DELETE', `${ws()}/members/${memberRow.outsider}`);
      assert.strictEqual(idorDelete.status, 404);
      assert.ok(await prisma.workspaceMember.findUnique({ where: { id: memberRow.outsider } }), 'other tenant untouched');
    });

    it('removes a member: unassigns their tasks, drops project access, logs everything', async () => {
      const task = await prisma.task.create({
        data: { projectId: fx.projectA1, authorId: fx.users.owner, assigneeId: fx.users.memberA, title: `Assigned ${fx.run}` },
      });
      const r = await call('admin2', 'DELETE', `${ws()}/members/${memberRow.membera}`);
      assert.strictEqual(r.status, 200);
      assert.deepEqual(r.json.data, { removedMemberId: memberRow.membera, unassignedTasks: 1, removedProjectAssignments: 1 });
      assert.strictEqual(await prisma.workspaceMember.count({ where: { id: memberRow.membera } }), 0);
      assert.strictEqual(await prisma.projectMember.count({ where: { userId: fx.users.memberA, projectId: fx.projectA1 } }), 0);
      const after = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
      assert.strictEqual(after.assigneeId, null);
      assert.strictEqual((await audits('MEMBER_REMOVED')).length, 1);
      const un = await audits('TASK_UNASSIGNED');
      assert.strictEqual(un.length, 1);
      assert.strictEqual(un[0].taskId, task.id);
      // The removed user lost access immediately.
      const gone = await call('membera', 'GET', `${ws()}/members`);
      assert.strictEqual(gone.status, 403);
    });

    it('never removes the account owner or the caller, and members cannot remove anyone', async () => {
      const owner = await call('admin2', 'DELETE', `${ws()}/members/${memberRow.owner}`);
      assert.strictEqual(owner.status, 403);
      assert.strictEqual(code(owner), 'OWNER_NOT_REMOVABLE');
      const self = await call('admin2', 'DELETE', `${ws()}/members/${memberRow.admin2}`);
      assert.strictEqual(self.status, 422);
      assert.strictEqual(code(self), 'CANNOT_REMOVE_SELF');
      assert.strictEqual((await call('memberb', 'DELETE', `${ws()}/members/${memberRow.admin2}`)).status, 403);
    });
  });

  describe('invitations: list, duplicate guard, resend, revoke', () => {
    let invitationId: string;
    let firstToken: string;
    const email = () => `invitee.${fx.run}@veyro-test.io`;

    it('blocks a second live invitation for the same email (409) but not after expiry', async () => {
      const first = await call('admin2', 'POST', `${ws()}/invitations`, { email: email(), role: 'MEMBER', projectIds: [fx.projectA1] });
      assert.strictEqual(first.status, 201);
      invitationId = first.json.data.invitationId;
      firstToken = first.json.data.rawToken;
      const dup = await call('owner', 'POST', `${ws()}/invitations`, { email: email(), role: 'ADMIN' });
      assert.strictEqual(dup.status, 409);
      assert.strictEqual(code(dup), 'INVITATION_ALREADY_PENDING');

      await prisma.workspaceInvitation.update({ where: { id: invitationId }, data: { expiresAt: new Date(Date.now() - 1000) } });
      const again = await call('owner', 'POST', `${ws()}/invitations`, { email: email(), role: 'MEMBER' });
      assert.strictEqual(again.status, 201, 'an expired invitation does not block a new one');
      await prisma.workspaceInvitation.update({ where: { id: again.json.data.invitationId }, data: { status: InvitationStatus.REVOKED } });
    });

    it('lists pending invitations with expiry flag and projects, never exposing secrets', async () => {
      const r = await call('admin2', 'GET', `${ws()}/invitations`);
      assert.strictEqual(r.status, 200);
      const inv = r.json.data.find((i: any) => i.id === invitationId);
      assert.ok(inv);
      assert.strictEqual(inv.isExpired, true);
      assert.strictEqual(inv.role, 'MEMBER');
      assert.deepEqual(inv.projects.map((p: any) => p.key), ['ALP']);
      assert.ok(inv.inviter.name);
      const raw = JSON.stringify(r.json);
      assert.ok(!raw.includes('hashedToken') && !raw.includes('rawToken') && !raw.includes(firstToken));
      assert.strictEqual(r.json.data.filter((i: any) => i.status !== 'PENDING').length, 0);
    });

    it('denies members and outsiders', async () => {
      assert.strictEqual((await call('memberb', 'GET', `${ws()}/invitations`)).status, 403);
      assert.strictEqual((await call('outsider', 'GET', `${ws()}/invitations`)).status, 403);
    });

    it('resends an expired invitation with a fresh secret and a new 7-day window', async () => {
      const before = await prisma.workspaceInvitation.findUniqueOrThrow({ where: { id: invitationId } });
      const r = await call('admin2', 'POST', `${ws()}/invitations/${invitationId}/resend`);
      assert.strictEqual(r.status, 200);
      assert.ok(r.json.data.rawToken && r.json.data.rawToken !== firstToken);
      assert.deepEqual(r.json.data.projectIds, [fx.projectA1]);
      const after = await prisma.workspaceInvitation.findUniqueOrThrow({ where: { id: invitationId } });
      assert.notStrictEqual(after.hashedToken, before.hashedToken, 'old link is invalid');
      assert.strictEqual(after.status, InvitationStatus.PENDING);
      assert.ok(after.expiresAt.getTime() > Date.now() + 6 * 24 * 3600 * 1000);
      assert.strictEqual((await audits('WORKSPACE_INVITATION_RESENT')).length, 1);
    });

    it('revokes once, then refuses to revoke or resend it again', async () => {
      const r = await call('owner', 'POST', `${ws()}/invitations/${invitationId}/revoke`);
      assert.strictEqual(r.status, 200);
      assert.deepEqual(r.json.data, { id: invitationId, status: 'REVOKED' });
      const twice = await call('owner', 'POST', `${ws()}/invitations/${invitationId}/revoke`);
      assert.strictEqual(twice.status, 409);
      assert.strictEqual(code(twice), 'INVITATION_NOT_PENDING');
      const resend = await call('owner', 'POST', `${ws()}/invitations/${invitationId}/resend`);
      assert.strictEqual(resend.status, 409);
      assert.strictEqual(code(resend), 'INVITATION_NOT_RESENDABLE');
      const list = await call('owner', 'GET', `${ws()}/invitations`);
      assert.ok(!list.json.data.some((i: any) => i.id === invitationId));
    });

    it('answers 404 for an invitation of another workspace and 403 for members', async () => {
      const foreign = await prisma.workspaceInvitation.create({
        data: { workspaceId: fx.workspaceB, inviterId: fx.users.outsider, email: `x.${fx.run}@veyro-test.io`, hashedToken: `h-${fx.run}`, expiresAt: new Date(Date.now() + 1e6) },
      });
      assert.strictEqual((await call('owner', 'POST', `${ws()}/invitations/${foreign.id}/revoke`)).status, 404);
      assert.strictEqual((await call('owner', 'POST', `${ws()}/invitations/${foreign.id}/resend`)).status, 404);
      assert.strictEqual((await prisma.workspaceInvitation.findUniqueOrThrow({ where: { id: foreign.id } })).status, InvitationStatus.PENDING);
      assert.strictEqual((await call('memberb', 'POST', `${ws()}/invitations/${invitationId}/revoke`)).status, 403);
    });

    it('refuses to resend to someone who has meanwhile become a member', async () => {
      const inv = await prisma.workspaceInvitation.create({
        data: { workspaceId: fx.workspaceA, inviterId: fx.users.owner, email: `memberb.${fx.run}@veyro-test.io`, hashedToken: `h2-${fx.run}`, expiresAt: new Date(Date.now() + 1e6) },
      });
      const r = await call('owner', 'POST', `${ws()}/invitations/${inv.id}/resend`);
      assert.strictEqual(r.status, 409);
      assert.strictEqual(code(r), 'USER_ALREADY_MEMBER');
    });
  });

  it('keeps WorkspaceRole values the API relies on', () => {
    assert.deepEqual(Object.values(WorkspaceRole).sort(), ['ADMIN', 'MEMBER']);
  });
});
