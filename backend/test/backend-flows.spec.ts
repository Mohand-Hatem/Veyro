import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { TasksService } from '../src/modules/tasks/tasks.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TaskStatus, TaskPriority, ProjectLifecycleStatus } from '@prisma/client';

describe('Veyro Backend Business Flows (OTP, Password Recovery, Task Soft Delete & Restore)', () => {
  let prisma: PrismaService;
  let authService: AuthService;
  let tasksService: TasksService;

  // Test Entities
  let testUserId: string;
  let testUserEmail: string;
  let testAccountId: string;
  let testWorkspaceId: string;
  let testProjectId: string;
  let testTaskId: string;

  before(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();

    const configService = new ConfigService();
    const jwtService = new JwtService({
      secret: process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long!',
      signOptions: { expiresIn: '15m' },
    });

    authService = new AuthService(prisma, jwtService, configService);
    tasksService = new TasksService(prisma);

    // Seed test isolation context
    testUserEmail = `test.user.${Date.now()}@veyro.io`;
    const regResult = await authService.register({
      email: testUserEmail,
      password: 'Password123!',
      name: 'Test Engineer',
    });
    testUserId = regResult.user.id;

    // Create Account, Workspace, Project
    const account = await prisma.account.create({
      data: {
        name: 'Test Flow Account',
        slug: `test-flow-${Date.now()}`,
        ownerId: testUserId,
      },
    });
    testAccountId = account.id;

    const workspace = await prisma.workspace.create({
      data: {
        accountId: testAccountId,
        name: 'Test Flow Workspace',
        slug: `test-wksp-${Date.now()}`,
        members: {
          create: {
            userId: testUserId,
            role: 'ADMIN',
          },
        },
      },
    });
    testWorkspaceId = workspace.id;

    const project = await prisma.project.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Test Flow Project',
      },
    });
    testProjectId = project.id;
  });

  after(async () => {
    // Cleanup created test records
    try {
      if (testProjectId) {
        await prisma.taskComment.deleteMany({ where: { task: { projectId: testProjectId } } });
        await prisma.task.deleteMany({ where: { projectId: testProjectId } });
        await prisma.projectMember.deleteMany({ where: { projectId: testProjectId } });
        await prisma.project.deleteMany({ where: { id: testProjectId } });
      }
      if (testWorkspaceId) {
        await prisma.workspaceMember.deleteMany({ where: { workspaceId: testWorkspaceId } });
        await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } });
      }
      if (testAccountId) {
        await prisma.account.deleteMany({ where: { id: testAccountId } });
      }
      if (testUserId) {
        await prisma.userOtpVerification.deleteMany({ where: { userId: testUserId } });
        await prisma.userPasswordResetToken.deleteMany({ where: { userId: testUserId } });
        await prisma.userSession.deleteMany({ where: { userId: testUserId } });
        await prisma.auditLog.deleteMany({ where: { actorUserId: testUserId } });
        await prisma.user.deleteMany({ where: { id: testUserId } });
      }
    } finally {
      await prisma.onModuleDestroy();
    }
  });

  // ==========================================================================
  // 1. OTP Verification Tests
  // ==========================================================================
  describe('Flow A: OTP Verification', () => {
    it('should create an unconsumed OTP challenge upon registration with unverified email', async () => {
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      assert.strictEqual(user?.isEmailVerified, false);
      assert.strictEqual(user?.emailVerifiedAt, null);

      const verification = await prisma.userOtpVerification.findFirst({
        where: { userId: testUserId, isConsumed: false },
      });
      assert.ok(verification, 'Verification challenge must exist');
      assert.strictEqual(verification.attempts, 0);
      assert.strictEqual(verification.isConsumed, false);
      assert.ok(verification.expiresAt > new Date(), 'OTP must not be expired yet');
    });

    it('should reject invalid verification code and increment attempts counter', async () => {
      await assert.rejects(
        async () => {
          await authService.verifyOtp({
            email: testUserEmail,
            code: '000000',
          });
        },
        (err: any) => {
          assert.strictEqual(err.status, 400);
          assert.strictEqual(err.response?.code, 'INVALID_OTP_CODE');
          return true;
        },
      );

      const verification = await prisma.userOtpVerification.findFirst({
        where: { userId: testUserId, isConsumed: false },
      });
      assert.strictEqual(verification?.attempts, 1);
    });

    it('should enforce resend cooldown if requested within cooldown window', async () => {
      await assert.rejects(
        async () => {
          await authService.resendOtp({ email: testUserEmail });
        },
        (err: any) => {
          assert.strictEqual(err.status, 429);
          assert.strictEqual(err.response?.code, 'RESEND_COOLDOWN_ACTIVE');
          return true;
        },
      );
    });

    it('should successfully verify email when provided correct OTP code', async () => {
      // Create a known code challenge
      const knownCode = '123456';
      const codeHash = crypto.createHash('sha256').update(knownCode).digest('hex');

      await prisma.userOtpVerification.updateMany({
        where: { userId: testUserId, isConsumed: false },
        data: { isConsumed: true },
      });

      await prisma.userOtpVerification.create({
        data: {
          userId: testUserId,
          email: testUserEmail,
          codeHash,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          resendAvailableAt: new Date(Date.now() + 60 * 1000),
        },
      });

      const res = await authService.verifyOtp({
        email: testUserEmail,
        code: knownCode,
      });

      assert.strictEqual(res.success, true);

      const updatedUser = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      assert.strictEqual(updatedUser?.isEmailVerified, true);
      assert.ok(updatedUser?.emailVerifiedAt !== null);

      // Audit log check
      const audit = await prisma.auditLog.findFirst({
        where: { actorUserId: testUserId, action: 'USER_EMAIL_VERIFIED' },
      });
      assert.ok(audit, 'Audit log event must be recorded for verification');
    });

    it('should prevent replay/reuse of already consumed OTP challenge', async () => {
      // Temporarily mark unverified to test consumed challenge rejection
      await prisma.user.update({
        where: { id: testUserId },
        data: { isEmailVerified: false },
      });

      await assert.rejects(
        async () => {
          await authService.verifyOtp({
            email: testUserEmail,
            code: '123456',
          });
        },
        (err: any) => {
          assert.strictEqual(err.status, 400);
          assert.strictEqual(err.response?.code, 'EXPIRED_OR_INVALID_OTP');
          return true;
        },
      );

      // Restore verified status
      await prisma.user.update({
        where: { id: testUserId },
        data: { isEmailVerified: true },
      });
    });
  });

  // ==========================================================================
  // 2. Forgot Password & Reset Password Tests
  // ==========================================================================
  describe('Flow B: Forgot Password & Reset Password', () => {
    let rawResetToken: string;

    it('should return anti-enumeration constant response for existing and non-existing accounts', async () => {
      const res1 = await authService.requestPasswordReset({ email: testUserEmail });
      assert.strictEqual(
        res1.message,
        'If an account with that email exists, password reset instructions have been sent.',
      );

      const res2 = await authService.requestPasswordReset({ email: 'nonexistent@randomdomain.xyz' });
      assert.strictEqual(res2.message, res1.message);
    });

    it('should store hashed token and allow resetting password with valid token', async () => {
      rawResetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');

      await prisma.userPasswordResetToken.create({
        data: {
          userId: testUserId,
          tokenHash,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const resetRes = await authService.resetPassword({
        token: rawResetToken,
        newPassword: 'BrandNewSecurePassword456!',
      });
      assert.strictEqual(resetRes.success, true);

      // Verify new password can be used for login
      const loginRes = await authService.login({
        email: testUserEmail,
        password: 'BrandNewSecurePassword456!',
      });
      assert.ok(loginRes.accessToken);
    });

    it('should revoke all existing user sessions upon successful password reset', async () => {
      const revokedSessions = await prisma.userSession.findMany({
        where: { userId: testUserId, isRevoked: true },
      });
      assert.ok(revokedSessions.length > 0, 'Prior sessions must be marked as revoked');
    });

    it('should reject reused or expired password reset tokens', async () => {
      await assert.rejects(
        async () => {
          await authService.resetPassword({
            token: rawResetToken,
            newPassword: 'AnotherPassword789!',
          });
        },
        (err: any) => {
          assert.strictEqual(err.status, 400);
          assert.strictEqual(err.response?.code, 'INVALID_OR_EXPIRED_RESET_TOKEN');
          return true;
        },
      );
    });
  });

  // ==========================================================================
  // 3. Task Soft Delete & Restore Tests
  // ==========================================================================
  describe('Flow C: Task Soft Delete & Restore', () => {
    before(async () => {
      // Create a task to test lifecycle
      const task = await tasksService.createTask(testUserId, testProjectId, {
        title: 'Task Lifecycle Verification',
        description: 'Verify soft delete and restore',
        priority: TaskPriority.HIGH,
      });
      testTaskId = task.id;
    });

    it('should soft delete a task by marking deletedAt without destroying data', async () => {
      await tasksService.softDeleteTask(testUserId, testTaskId, true, true);

      const task = await prisma.task.findUnique({
        where: { id: testTaskId },
      });
      assert.ok(task !== null, 'Task record must remain in database');
      assert.ok(task.deletedAt !== null, 'deletedAt timestamp must be set');

      // Verify exclusion from normal task list queries
      const list = await tasksService.listProjectTasks(testProjectId, {});
      const foundInList = list.tasks.some((t) => t.id === testTaskId);
      assert.strictEqual(foundInList, false, 'Soft-deleted task must be excluded from listProjectTasks');

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { taskId: testTaskId, action: 'TASK_DELETED' },
      });
      assert.ok(audit, 'TASK_DELETED audit log must be recorded');
    });

    it('should throw 404 when attempting to delete an already deleted task', async () => {
      await assert.rejects(
        async () => {
          await tasksService.softDeleteTask(testUserId, testTaskId, true, true);
        },
        (err: any) => {
          assert.strictEqual(err.status, 404);
          assert.strictEqual(err.response?.code, 'RESOURCE_NOT_FOUND');
          return true;
        },
      );
    });

    it('should restore a soft-deleted task and clear deletedAt', async () => {
      const restored = await tasksService.restoreTask(testUserId, testTaskId, true, true);
      assert.strictEqual(restored.deletedAt, null);

      // Verify it reappears in active task listings
      const list = await tasksService.listProjectTasks(testProjectId, {});
      const foundInList = list.tasks.some((t) => t.id === testTaskId);
      assert.strictEqual(foundInList, true, 'Restored task must reappear in active task queries');

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { taskId: testTaskId, action: 'TASK_RESTORED' },
      });
      assert.ok(audit, 'TASK_RESTORED audit log must be recorded');
    });

    it('should throw 400 when attempting to restore an already active task', async () => {
      await assert.rejects(
        async () => {
          await tasksService.restoreTask(testUserId, testTaskId, true, true);
        },
        (err: any) => {
          assert.strictEqual(err.status, 400);
          assert.strictEqual(err.response?.code, 'TASK_NOT_DELETED');
          return true;
        },
      );
    });

    it('should block task restoration if project is archived or in billing read-only hold', async () => {
      // Soft delete task again
      await tasksService.softDeleteTask(testUserId, testTaskId, true, true);

      // Set project to ARCHIVED
      await prisma.project.update({
        where: { id: testProjectId },
        data: { lifecycleStatus: ProjectLifecycleStatus.ARCHIVED },
      });

      await assert.rejects(
        async () => {
          await tasksService.restoreTask(testUserId, testTaskId, true, true);
        },
        (err: any) => {
          assert.strictEqual(err.status, 400);
          assert.strictEqual(err.response?.code, 'PROJECT_ARCHIVED');
          return true;
        },
      );

      // Revert project status for clean teardown
      await prisma.project.update({
        where: { id: testProjectId },
        data: { lifecycleStatus: ProjectLifecycleStatus.ACTIVE },
      });
    });
  });
});
