import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { ProjectsService } from '../src/modules/projects/projects.service';
import { CreateProjectDto } from '../src/modules/projects/dto/create-project.dto';
import { generateProjectKey, isValidProjectKey } from '../src/modules/projects/project-key';
import { buildFixture, Fixture } from './helpers/fixture';

describe('CS-01 / ADR-003: Project.key', () => {
  describe('generateProjectKey (pure rule)', () => {
    it('uses word initials when there are two or more words', () => {
      assert.strictEqual(generateProjectKey('Auth Revamp', new Set()), 'AR');
      assert.strictEqual(generateProjectKey('Mobile Onboarding App', new Set()), 'MOA');
    });
    it('uses the first three letters for a single word', () => {
      assert.strictEqual(generateProjectKey('Billing', new Set()), 'BIL');
    });
    it('caps the key at five characters', () => {
      assert.strictEqual(generateProjectKey('a b c d e f g', new Set()), 'ABCDE');
    });
    it('always starts with a letter and never produces fewer than two characters', () => {
      assert.strictEqual(generateProjectKey('3D Engine', new Set()), 'P3E');
      assert.strictEqual(generateProjectKey('!!!', new Set()), 'PRJ');
      assert.strictEqual(generateProjectKey('X', new Set()), 'XX');
    });
    it('adds a numeric suffix on collision without exceeding five characters', () => {
      assert.strictEqual(generateProjectKey('Auth Revamp', new Set(['AR'])), 'AR2');
      assert.strictEqual(generateProjectKey('a b c d e', new Set(['ABCDE'])), 'ABCD2');
    });
    it('only emits valid keys', () => {
      for (const n of ['Core Engine Refactor', '日本語', '  spaced   out  ', 'ünïcode Test']) {
        assert.ok(isValidProjectKey(generateProjectKey(n, new Set())), n);
      }
    });
  });

  describe('CreateProjectDto validation', () => {
    const errorsFor = async (body: object) => validate(plainToInstance(CreateProjectDto, body));
    it('accepts an optional well-formed key and normalizes case', async () => {
      const dto = plainToInstance(CreateProjectDto, { name: 'X', key: ' qa1 ' });
      assert.strictEqual(dto.key, 'QA1');
      assert.strictEqual((await validate(dto)).length, 0);
    });
    it('rejects malformed keys', async () => {
      for (const key of ['A', 'ABCDEF', '1AB', 'AB-C', 'AB C']) {
        assert.ok((await errorsFor({ name: 'X', key })).length > 0, key);
      }
    });
    it('accepts a missing key', async () => {
      assert.strictEqual((await errorsFor({ name: 'X' })).length, 0);
    });
  });

  describe('through ProjectsService', () => {
    let prisma: PrismaService;
    let projects: ProjectsService;
    let fx: Fixture;
    before(async () => {
      prisma = new PrismaService(); await prisma.onModuleInit();
      projects = new ProjectsService(prisma, new NotificationsService(prisma));
      fx = await buildFixture(prisma);
    });
    after(async () => { try { await fx.cleanup(); } finally { await prisma.onModuleDestroy(); } });

    const create = (body: object, ws = fx.workspaceA, user = fx.users.owner) =>
      projects.createProject(user, ws, plainToInstance(CreateProjectDto, body) as any);

    it('generates a key from the name when omitted', async () => {
      const p: any = await create({ name: 'Payments Hub' });
      assert.ok(isValidProjectKey(p.key));
      assert.strictEqual(p.key, 'PH');
    });

    it('stores an explicit key and lists it', async () => {
      const p: any = await create({ name: 'Quality', key: 'qa1' });
      assert.strictEqual(p.key, 'QA1');
      const list: any[] = await projects.listWorkspaceProjects(fx.users.owner, fx.workspaceA, true);
      assert.ok(list.some((x) => x.id === p.id && x.key === 'QA1'));
    });

    it('rejects a duplicate key in the same workspace with 409 PROJECT_KEY_TAKEN', async () => {
      await assert.rejects(
        () => create({ name: 'Another QA', key: 'QA1' }),
        (e: any) => { assert.strictEqual(e.status, 409); assert.strictEqual(e.response?.code, 'PROJECT_KEY_TAKEN'); return true; },
      );
    });

    it('allows the same key in a different workspace', async () => {
      const p: any = await create({ name: 'Quality Elsewhere', key: 'QA1' }, fx.workspaceB, fx.users.outsider);
      assert.strictEqual(p.key, 'QA1');
    });

    it('keeps the key of a soft-deleted project reserved', async () => {
      const p: any = await create({ name: 'Temp', key: 'TMP' });
      await projects.softDeleteProject(fx.users.owner, p.id, true);
      await assert.rejects(
        () => create({ name: 'Temp Again', key: 'TMP' }),
        (e: any) => e.status === 409,
      );
    });

    it('never changes a key through update (key is not part of UpdateProjectDto)', async () => {
      const body = { key: 'NEW' };
      const errs = await validate(plainToInstance((await import('../src/modules/projects/dto/update-project.dto')).UpdateProjectDto, body), { forbidNonWhitelisted: true, whitelist: true });
      assert.ok(errs.length > 0, 'unknown property "key" must be rejected');
    });
  });
});
