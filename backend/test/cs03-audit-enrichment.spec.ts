import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { QueryAuditLogsDto } from '../src/modules/audit/dto/query-audit-logs.dto';
import { buildFixture, Fixture } from './helpers/fixture';

/** CS-03: the audit trail returns render-ready records and supports actor / date / multi-action filters. */
describe('CS-03: audit trail enrichment and filters', () => {
  let prisma: PrismaService;
  let audit: AuditService;
  let fx: Fixture;

  const q = (body: object) => plainToInstance(QueryAuditLogsDto, body) as QueryAuditLogsDto;
  const list = (userId: string, body: object) => audit.listAuditLogs(userId, q({ workspaceId: fx.workspaceA, limit: 100, ...body }));
  const day = (offset: number, hour = 12) => new Date(Date.UTC(2026, 0, 10 + offset, hour, 0, 0));
  const expectCode = (status: number, code: string) => (e: any) => {
    assert.strictEqual(e.status, status);
    assert.strictEqual(e.response?.code, code);
    return true;
  };

  before(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    audit = new AuditService(prisma);
    fx = await buildFixture(prisma);
    const account = await prisma.workspace.findUniqueOrThrow({ where: { id: fx.workspaceA }, select: { accountId: true } });
    const base = { workspaceId: fx.workspaceA, accountId: account.accountId };
    await prisma.auditLog.createMany({
      data: [
        { ...base, actorUserId: fx.users.owner, projectId: fx.projectA1, action: 'PROJECT_CREATED', metadata: { name: 'Alpha', key: 'ALP' }, createdAt: day(0) },
        { ...base, actorUserId: fx.users.admin2, projectId: fx.projectA1, action: 'MEMBER_ASSIGNED_TO_PROJECT', metadata: { assignedUserId: fx.users.memberA }, createdAt: day(1) },
        { ...base, actorUserId: fx.users.admin2, action: 'MEMBER_ROLE_CHANGED', metadata: { memberUserId: fx.users.memberB, from: 'MEMBER', to: 'ADMIN' }, createdAt: day(2) },
        { ...base, actorUserId: null, action: 'WORKSPACE_UPDATED', metadata: { changes: {} }, createdAt: day(3) },
        { ...base, actorUserId: fx.users.owner, projectId: fx.projectA2, action: 'TASK_CREATED', metadata: { title: 'Ship it' }, createdAt: day(3, 20) },
      ],
    });
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await prisma.onModuleDestroy();
    }
  });

  describe('render-ready references', () => {
    it('resolves actor, project and subject user by name', async () => {
      const { logs } = await list(fx.users.owner, {});
      const assigned = logs.find((l: any) => l.action === 'MEMBER_ASSIGNED_TO_PROJECT') as any;
      assert.ok(assigned.actor.name.startsWith('admin2'));
      assert.strictEqual(assigned.project.key, 'ALP');
      assert.ok(assigned.subjectUser.name.startsWith('membera'));
      const role = logs.find((l: any) => l.action === 'MEMBER_ROLE_CHANGED') as any;
      assert.ok(role.subjectUser.name.startsWith('memberb'), 'memberUserId is a subject key too');
      assert.strictEqual(role.project, null);
    });

    it('keeps system events (no actor) renderable and never leaks credentials', async () => {
      const { logs } = await list(fx.users.owner, {});
      const sys = logs.find((l: any) => l.action === 'WORKSPACE_UPDATED') as any;
      assert.strictEqual(sys.actor, null);
      const raw = JSON.stringify(logs);
      assert.ok(!raw.includes('passwordHash') && !raw.includes('email'), 'only id, name and avatar are exposed');
    });

    it('still resolves a soft-deleted project and a removed member', async () => {
      await prisma.project.update({ where: { id: fx.projectA2 }, data: { deletedAt: new Date() } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: fx.workspaceA, userId: fx.users.memberB } });
      const { logs } = await list(fx.users.owner, {});
      const task = logs.find((l: any) => l.action === 'TASK_CREATED') as any;
      assert.deepEqual([task.project.key, task.project.isDeleted], ['BET', true]);
      const role = logs.find((l: any) => l.action === 'MEMBER_ROLE_CHANGED') as any;
      assert.ok(role.subjectUser, 'history keeps the name after the membership is gone');
    });
  });

  describe('filters', () => {
    it('filters by actor', async () => {
      const { logs, meta } = await list(fx.users.owner, { actorUserId: fx.users.admin2 });
      assert.strictEqual(meta.total, 2);
      assert.ok(logs.every((l) => l.actorUserId === fx.users.admin2));
    });

    it('accepts one action or a comma-separated list', async () => {
      assert.strictEqual((await list(fx.users.owner, { action: 'PROJECT_CREATED' })).meta.total, 1);
      const both = await list(fx.users.owner, { action: 'PROJECT_CREATED, TASK_CREATED,,' });
      assert.deepEqual(both.logs.map((l) => l.action).sort(), ['PROJECT_CREATED', 'TASK_CREATED']);
      const many = Array.from({ length: 41 }, (_, i) => `A${i}`).join(',');
      await assert.rejects(list(fx.users.owner, { action: many }), expectCode(422, 'TOO_MANY_ACTION_FILTERS'));
    });

    it('applies an inclusive date range and expands a date-only `to` to the whole day', async () => {
      const r = await list(fx.users.owner, { from: day(1, 0).toISOString(), to: day(2, 23).toISOString() });
      assert.deepEqual(r.logs.map((l) => l.action).sort(), ['MEMBER_ASSIGNED_TO_PROJECT', 'MEMBER_ROLE_CHANGED']);
      const dayOnly = await list(fx.users.owner, { from: '2026-01-13', to: '2026-01-13' });
      assert.deepEqual(dayOnly.logs.map((l) => l.action).sort(), ['TASK_CREATED', 'WORKSPACE_UPDATED'], 'both events of that UTC day, including the 20:00 one');
      const fromOnly = await list(fx.users.owner, { from: '2026-01-12' });
      assert.strictEqual(fromOnly.meta.total, 3);
    });

    it('rejects a reversed range (422) and malformed dates (DTO)', async () => {
      await assert.rejects(list(fx.users.owner, { from: '2026-02-01', to: '2026-01-01' }), expectCode(422, 'INVALID_DATE_RANGE'));
      assert.ok((await validate(q({ from: 'yesterday' }))).length > 0);
      assert.ok((await validate(q({ to: '2026-13-45' }))).length > 0);
      assert.strictEqual((await validate(q({ from: '2026-01-01', to: '2026-01-31T10:00:00Z', actorUserId: 'x', action: 'A,B' }))).length, 0);
    });

    it('combines filters', async () => {
      const r = await list(fx.users.owner, { actorUserId: fx.users.owner, action: 'PROJECT_CREATED,TASK_CREATED', from: '2026-01-13' });
      assert.deepEqual(r.logs.map((l) => l.action), ['TASK_CREATED']);
    });
  });

  describe('paging and authorization', () => {
    it('pages deterministically even when many records share a timestamp', async () => {
      const account = await prisma.workspace.findUniqueOrThrow({ where: { id: fx.workspaceA }, select: { accountId: true } });
      const same = day(10);
      await prisma.auditLog.createMany({
        data: Array.from({ length: 7 }, () => ({ workspaceId: fx.workspaceA, accountId: account.accountId, actorUserId: fx.users.owner, action: 'TIE_TEST', createdAt: same })),
      });
      const seen: string[] = [];
      for (let page = 1; page <= 4; page++) {
        const r = await list(fx.users.owner, { action: 'TIE_TEST', limit: 2, page });
        seen.push(...r.logs.map((l) => l.id));
      }
      assert.strictEqual(seen.length, 7);
      assert.strictEqual(new Set(seen).size, 7, 'no duplicates and nothing skipped');
    });

    it('is still Admin/Owner only and never crosses tenants', async () => {
      await assert.rejects(list(fx.users.memberA, {}), expectCode(403, 'PERMISSION_DENIED'));
      await assert.rejects(list(fx.users.outsider, {}), expectCode(403, 'PERMISSION_DENIED'));
      const other = await audit.listAuditLogs(fx.users.outsider, q({ workspaceId: fx.workspaceB }));
      assert.ok(other.logs.every((l) => l.workspaceId === fx.workspaceB));
    });
  });
});
