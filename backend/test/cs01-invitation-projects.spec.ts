import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InvitationStatus, ProjectLifecycleStatus, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { TenancyService } from '../src/modules/tenancy/tenancy.service';
import { EmailService } from '../src/modules/email/email.service';
import { InviteMemberDto } from '../src/modules/tenancy/dto/invite-member.dto';
import { buildFixture, Fixture } from './helpers/fixture';

describe('CS-01 / ADR-004: invitations with project assignment', () => {
  let prisma: PrismaService;
  let tenancy: TenancyService;
  let fx: Fixture;
  const extraUsers: string[] = [];

  const dto = (body: object) => plainToInstance(InviteMemberDto, body) as InviteMemberDto;

  const newUser = async (email: string) => {
    const u = await prisma.user.create({
      data: { email, name: 'Newcomer', passwordHash: await bcrypt.hash('Password123!', 4), isEmailVerified: true },
    });
    extraUsers.push(u.id);
    return u;
  };

  const expectCode = (status: number, code: string) => (e: any) => {
    assert.strictEqual(e.status, status);
    assert.strictEqual(e.response?.code, code);
    return true;
  };

  before(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    tenancy = new TenancyService(prisma, new EmailService(), new NotificationsService(prisma));
    fx = await buildFixture(prisma);
  });

  after(async () => {
    try {
      await fx.cleanup();
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: extraUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: extraUsers } } });
    } finally {
      await prisma.onModuleDestroy();
    }
  });

  describe('DTO', () => {
    it('accepts optional unique project ids, up to 25', async () => {
      assert.strictEqual((await validate(dto({ email: 'a@b.co', role: 'MEMBER', projectIds: ['p1', 'p2'] }))).length, 0);
      assert.strictEqual((await validate(dto({ email: 'a@b.co', role: 'MEMBER' }))).length, 0);
    });
    it('rejects duplicates, empty ids and more than 25 ids', async () => {
      assert.ok((await validate(dto({ email: 'a@b.co', role: 'MEMBER', projectIds: ['p1', 'p1'] }))).length > 0);
      assert.ok((await validate(dto({ email: 'a@b.co', role: 'MEMBER', projectIds: [''] }))).length > 0);
      const many = Array.from({ length: 26 }, (_, i) => `p${i}`);
      assert.ok((await validate(dto({ email: 'a@b.co', role: 'MEMBER', projectIds: many }))).length > 0);
    });
  });

  describe('issuing invitations', () => {
    it('only Admins or the Account Owner may invite (a Member gets 403, even for ADMIN role)', async () => {
      await assert.rejects(
        () => tenancy.inviteMember(fx.users.memberA, fx.workspaceA, dto({ email: `x1.${fx.run}@veyro-test.io`, role: 'ADMIN' })),
        expectCode(403, 'PERMISSION_DENIED'),
      );
    });

    it('an Admin can invite a Member with projects; the join rows are stored', async () => {
      const res: any = await tenancy.inviteMember(
        fx.users.admin2,
        fx.workspaceA,
        dto({ email: `ok1.${fx.run}@veyro-test.io`, role: 'MEMBER', projectIds: [fx.projectA1, fx.projectA2] }),
      );
      assert.deepEqual([...res.projectIds].sort(), [fx.projectA1, fx.projectA2].sort());
      const rows = await prisma.workspaceInvitationProject.findMany({ where: { invitationId: res.invitationId } });
      assert.strictEqual(rows.length, 2);
    });

    it('rejects project ids for an ADMIN invitation (422)', async () => {
      await assert.rejects(
        () => tenancy.inviteMember(fx.users.owner, fx.workspaceA, dto({ email: `ad.${fx.run}@veyro-test.io`, role: 'ADMIN', projectIds: [fx.projectA1] })),
        expectCode(422, 'PROJECT_IDS_REQUIRE_MEMBER_ROLE'),
      );
    });

    it('rejects projects of another workspace without revealing they exist (422)', async () => {
      await assert.rejects(
        () => tenancy.inviteMember(fx.users.owner, fx.workspaceA, dto({ email: `fw.${fx.run}@veyro-test.io`, role: 'MEMBER', projectIds: [fx.projectB1] })),
        expectCode(422, 'INVALID_PROJECT_SELECTION'),
      );
    });

    it('rejects archived, deleted and billing-read-only projects (422)', async () => {
      await prisma.project.update({ where: { id: fx.projectA2 }, data: { lifecycleStatus: ProjectLifecycleStatus.ARCHIVED } });
      await assert.rejects(
        () => tenancy.inviteMember(fx.users.owner, fx.workspaceA, dto({ email: `ar.${fx.run}@veyro-test.io`, role: 'MEMBER', projectIds: [fx.projectA2] })),
        expectCode(422, 'INVALID_PROJECT_SELECTION'),
      );
      await prisma.project.update({ where: { id: fx.projectA2 }, data: { lifecycleStatus: ProjectLifecycleStatus.ACTIVE, isBillingReadOnly: true } });
      await assert.rejects(
        () => tenancy.inviteMember(fx.users.owner, fx.workspaceA, dto({ email: `ro.${fx.run}@veyro-test.io`, role: 'MEMBER', projectIds: [fx.projectA2] })),
        expectCode(422, 'INVALID_PROJECT_SELECTION'),
      );
      await prisma.project.update({ where: { id: fx.projectA2 }, data: { isBillingReadOnly: false, deletedAt: new Date() } });
      await assert.rejects(
        () => tenancy.inviteMember(fx.users.owner, fx.workspaceA, dto({ email: `de.${fx.run}@veyro-test.io`, role: 'MEMBER', projectIds: [fx.projectA2] })),
        expectCode(422, 'INVALID_PROJECT_SELECTION'),
      );
      await prisma.project.update({ where: { id: fx.projectA2 }, data: { deletedAt: null } });
    });
  });

  describe('accepting invitations', () => {
    const invite = async (email: string, projectIds?: string[]) =>
      (await tenancy.inviteMember(fx.users.owner, fx.workspaceA, dto({ email, role: 'MEMBER', ...(projectIds ? { projectIds } : {}) }))) as any;

    it('creates the workspace membership and the project memberships in one go', async () => {
      const email = `acc1.${fx.run}@veyro-test.io`;
      const u = await newUser(email);
      const inv = await invite(email, [fx.projectA1, fx.projectA2]);
      const res: any = await tenancy.acceptInvitation(u.id, email, { token: inv.rawToken } as any);
      assert.strictEqual(res.role, WorkspaceRole.MEMBER);
      assert.deepEqual([...res.assignedProjectIds].sort(), [fx.projectA1, fx.projectA2].sort());
      assert.deepEqual(res.skippedProjectIds, []);
      const pm = await prisma.projectMember.findMany({ where: { userId: u.id } });
      assert.strictEqual(pm.length, 2);
      const row = await prisma.workspaceInvitation.findUniqueOrThrow({ where: { id: inv.invitationId } });
      assert.strictEqual(row.status, InvitationStatus.ACCEPTED);
    });

    it('skips and reports projects that were archived or deleted after the invitation was issued', async () => {
      const email = `acc2.${fx.run}@veyro-test.io`;
      const u = await newUser(email);
      const inv = await invite(email, [fx.projectA1, fx.projectA2]);
      await prisma.project.update({ where: { id: fx.projectA2 }, data: { lifecycleStatus: ProjectLifecycleStatus.ARCHIVED } });
      const res: any = await tenancy.acceptInvitation(u.id, email, { token: inv.rawToken } as any);
      assert.deepEqual(res.assignedProjectIds, [fx.projectA1]);
      assert.deepEqual(res.skippedProjectIds, [fx.projectA2]);
      await prisma.project.update({ where: { id: fx.projectA2 }, data: { lifecycleStatus: ProjectLifecycleStatus.ACTIVE } });
    });

    it('an invitation without projects behaves as before', async () => {
      const email = `acc3.${fx.run}@veyro-test.io`;
      const u = await newUser(email);
      const inv = await invite(email);
      const res: any = await tenancy.acceptInvitation(u.id, email, { token: inv.rawToken } as any);
      assert.deepEqual(res.assignedProjectIds, []);
      assert.strictEqual(await prisma.projectMember.count({ where: { userId: u.id } }), 0);
    });

    it('the strict email lock still applies and creates nothing on failure', async () => {
      const email = `acc4.${fx.run}@veyro-test.io`;
      const intruder = await newUser(`intruder.${fx.run}@veyro-test.io`);
      const inv = await invite(email, [fx.projectA1]);
      await assert.rejects(
        () => tenancy.acceptInvitation(intruder.id, intruder.email, { token: inv.rawToken } as any),
        expectCode(403, 'INVITATION_EMAIL_MISMATCH'),
      );
      assert.strictEqual(await prisma.projectMember.count({ where: { userId: intruder.id } }), 0);
      assert.strictEqual(await prisma.workspaceMember.count({ where: { userId: intruder.id } }), 0);
    });
  });
});
