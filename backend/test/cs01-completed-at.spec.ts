import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { TasksService } from '../src/modules/tasks/tasks.service';
import { completedAtPatch } from '../src/modules/tasks/task-completion';
import { buildFixture, Fixture } from './helpers/fixture';

describe('CS-01 / ADR-002: Task.completedAt invariant', () => {
  describe('completedAtPatch (pure rule)', () => {
    const now = new Date('2026-10-17T10:00:00Z');
    it('sets the time when a task enters DONE', () => {
      assert.deepEqual(completedAtPatch(TaskStatus.IN_REVIEW, TaskStatus.DONE, now), { completedAt: now });
    });
    it('clears the time when a DONE task leaves DONE', () => {
      assert.deepEqual(completedAtPatch(TaskStatus.DONE, TaskStatus.IN_PROGRESS, now), { completedAt: null });
    });
    it('never touches completedAt for CANCELLED or unrelated moves', () => {
      assert.deepEqual(completedAtPatch(TaskStatus.TODO, TaskStatus.CANCELLED, now), {});
      assert.deepEqual(completedAtPatch(TaskStatus.TODO, TaskStatus.IN_PROGRESS, now), {});
      assert.deepEqual(completedAtPatch(TaskStatus.DONE, TaskStatus.DONE, now), {});
    });
  });

  describe('through TasksService', () => {
    let prisma: PrismaService;
    let tasks: TasksService;
    let fx: Fixture;
    let taskId: string;

    before(async () => {
      prisma = new PrismaService();
      await prisma.onModuleInit();
      tasks = new TasksService(prisma);
      fx = await buildFixture(prisma);
      const t = await tasks.createTask(fx.users.owner, fx.projectA1, { title: 'Ship the thing' } as any, true);
      taskId = t.id;
    });
    after(async () => { try { await fx.cleanup(); } finally { await prisma.onModuleDestroy(); } });

    const read = () => prisma.task.findUniqueOrThrow({ where: { id: taskId } });

    it('a new task has no completion time', async () => {
      assert.strictEqual((await read()).completedAt, null);
    });

    it('moving through the workflow sets completedAt only on DONE', async () => {
      await tasks.updateTask(fx.users.owner, taskId, { status: TaskStatus.IN_PROGRESS } as any, true);
      await tasks.updateTask(fx.users.owner, taskId, { status: TaskStatus.IN_REVIEW } as any, true);
      assert.strictEqual((await read()).completedAt, null);
      const before = Date.now();
      const done = await tasks.updateTask(fx.users.owner, taskId, { status: TaskStatus.DONE } as any, true);
      const row = await read();
      assert.ok(row.completedAt, 'completedAt must be set');
      assert.ok(row.completedAt!.getTime() >= before - 1000);
      assert.ok((done as any).completedAt, 'API response exposes completedAt');
    });

    it('reopening clears completedAt', async () => {
      await tasks.reopenTask(fx.users.owner, taskId, { targetStatus: TaskStatus.IN_PROGRESS, reason: 'Found a regression' } as any, true);
      assert.strictEqual((await read()).completedAt, null);
    });

    it('cancelling never sets completedAt', async () => {
      const t = await tasks.createTask(fx.users.owner, fx.projectA1, { title: 'Drop me' } as any, true);
      await tasks.updateTask(fx.users.owner, t.id, { status: TaskStatus.CANCELLED } as any, true);
      const row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } });
      assert.strictEqual(row.completedAt, null);
    });
  });
});
