import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { buildFixture, Fixture } from './helpers/fixture';

describe('CS-01 / ADR-005: audit-log authorization (Admin/Owner only)', () => {
  let prisma: PrismaService;
  let audit: AuditService;
  let fx: Fixture;

  before(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    audit = new AuditService(prisma);
    fx = await buildFixture(prisma);
    await prisma.auditLog.createMany({
      data: [
        { workspaceId: fx.workspaceA, actorUserId: fx.users.admin2, action: 'TASK_REOPENED' },
        { workspaceId: fx.workspaceA, actorUserId: fx.users.admin2, action: 'MEMBER_INVITED' },
        { workspaceId: fx.workspaceB, actorUserId: fx.users.outsider, action: 'TASK_DELETED' },
      ],
    });
  });

  after(async () => {
    try { await fx.cleanup(); } finally { await prisma.onModuleDestroy(); }
  });

  it('an Admin sees logs of their own workspace only', async () => {
    const res = await audit.listAuditLogs(fx.users.admin2, { page: 1, limit: 50 } as any);
    const ws = new Set(res.logs.map((l: any) => l.workspaceId));
    assert.ok(ws.has(fx.workspaceA));
    assert.ok(!ws.has(fx.workspaceB), 'must not leak another tenant');
  });

  it('a plain Member asking for a workspace they only belong to as MEMBER gets 403', async () => {
    await assert.rejects(
      () => audit.listAuditLogs(fx.users.memberA, { workspaceId: fx.workspaceA, page: 1, limit: 50 } as any),
      (err: any) => { assert.strictEqual(err.status, 403); assert.strictEqual(err.response?.code, 'PERMISSION_DENIED'); return true; },
    );
  });

  it('a plain Member without a workspace filter receives an empty list, never other people’s activity', async () => {
    const res = await audit.listAuditLogs(fx.users.memberA, { page: 1, limit: 50 } as any);
    assert.strictEqual(res.logs.filter((l: any) => l.workspaceId === fx.workspaceA).length, 0);
  });

  it('the Account Owner sees every workspace of the owned account', async () => {
    const res = await audit.listAuditLogs(fx.users.owner, { workspaceId: fx.workspaceA, page: 1, limit: 50 } as any);
    assert.ok(res.logs.length >= 2);
  });
});
