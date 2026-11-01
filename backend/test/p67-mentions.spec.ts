import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { MAX_MENTIONS, mentionIds } from '../src/modules/tasks/task-mentions';
import { buildFixture, Fixture } from './helpers/fixture';

describe('CS-16: mentions in comments', () => {
  describe('reading mentions from the text', () => {
    it('finds each person once, in order, and ignores anything that is not a mention', () => {
      assert.deepEqual(mentionIds('Hi <@abc123> and <@xyz9>, <@abc123> again'), ['abc123', 'xyz9']);
      assert.deepEqual(mentionIds('@Mona <@> <@ABC> <@a b> <abc> email@x.io'), []);
    });
    it('keeps at most a fixed number of people per comment', () => {
      const text = Array.from({ length: MAX_MENTIONS + 5 }, (_, i) => `<@u${i}>`).join(' ');
      assert.strictEqual(mentionIds(text).length, MAX_MENTIONS);
    });
  });

  describe('who is told (real app, real guards)', () => {
    let app: INestApplication;
    let base: string;
    let prisma: PrismaService;
    let fx: Fixture;
    const cookies: Record<string, string> = {};
    const who = ['owner', 'admin2', 'membera', 'memberb', 'outsider'];

    const login = async (label: string) => {
      const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' }) });
      assert.strictEqual(res.status, 200, `login ${label}`);
      return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    };
    const call = async (as: string, method: string, path: string, body?: object) => {
      const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies[as], 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
    };
    const inbox = async (as: string) => (await call(as, 'GET', '/notifications?limit=50')).json.data.items as any[];
    const about = async (as: string, taskId: string) => (await inbox(as)).filter((n) => n.taskId === taskId).map((n) => n.type).sort();
    const newTask = async (extra: object = {}) => {
      const r = await call('owner', 'POST', `/projects/${fx.projectA1}/tasks`, { title: `Mention ${Math.random().toString(36).slice(2, 7)}`, priority: 'MEDIUM', ...extra });
      assert.strictEqual(r.status, 201, JSON.stringify(r.json));
      return r.json.data as { id: string };
    };
    const comment = async (as: string, taskId: string, content: string) => {
      const r = await call(as, 'POST', `/tasks/${taskId}/comments`, { content });
      assert.strictEqual(r.status, 201, JSON.stringify(r.json));
    };

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
      for (const l of who) cookies[l] = await login(l);
    });

    after(async () => {
      try {
        await fx.cleanup();
      } finally {
        await app.close();
      }
    });

    it('tells a project member and a workspace admin they were mentioned, with what the sentence needs', async () => {
      const task = await newTask();
      await comment('owner', task.id, `Can <@${fx.users.memberA}> and <@${fx.users.admin2}> look at this?`);
      assert.deepEqual(await about('membera', task.id), ['TASK_MENTIONED']);
      assert.deepEqual(await about('admin2', task.id), ['TASK_MENTIONED']);
      const [n] = (await inbox('membera')).filter((x) => x.taskId === task.id);
      assert.deepEqual([n.actor.id, n.projectId, n.data.projectKey, n.data.actorName], [fx.users.owner, fx.projectA1, 'ALP', `owner ${fx.run}`]);
    });

    it('never tells someone who cannot see the task, and keeps their name out of the task details', async () => {
      const task = await newTask();
      const text = `FYI <@${fx.users.memberB}> <@${fx.users.outsider}> <@nosuchuser> <@${fx.users.memberA}>`;
      await comment('owner', task.id, text);
      assert.deepEqual(await about('memberb', task.id), [], 'a workspace member outside the project is not told');
      assert.deepEqual(await about('outsider', task.id), [], 'someone from another account is not told');
      const details = (await call('membera', 'GET', `/tasks/${task.id}`)).json.data;
      assert.strictEqual(details.comments.at(-1).content, text, 'the comment is stored as written');
      assert.deepEqual(details.mentioned.map((u: any) => u.id), [fx.users.memberA]);
      assert.deepEqual(Object.keys(details.mentioned[0]).sort(), ['avatarUrl', 'id', 'name'], 'only what the page shows, no email');
    });

    it('does not tell the writer about their own mention', async () => {
      const task = await newTask();
      await comment('membera', task.id, `Note to self <@${fx.users.memberA}>`);
      assert.deepEqual(await about('membera', task.id), []);
    });

    it('tells the assignee once when they are mentioned, and still tells an unmentioned creator about the comment', async () => {
      const task = await newTask({ assigneeId: fx.users.memberA });
      const before = await about('membera', task.id); // TASK_ASSIGNED from the creation
      await comment('admin2', task.id, `<@${fx.users.memberA}> please start`);
      assert.deepEqual(await about('membera', task.id), [...before, 'TASK_MENTIONED'].sort());
      assert.deepEqual(await about('owner', task.id), ['TASK_COMMENTED'], 'the creator hears about the comment as usual');
    });

    it('works in the note a member leaves when moving their task', async () => {
      const task = await newTask({ assigneeId: fx.users.memberA });
      const r = await call('membera', 'PATCH', `/tasks/${task.id}`, { status: 'IN_PROGRESS', note: `Started, <@${fx.users.owner}> I need the copy` });
      assert.strictEqual(r.status, 200, JSON.stringify(r.json));
      assert.deepEqual(await about('owner', task.id), ['TASK_MENTIONED'], 'one notification for the mentioned creator, not two');
    });

    it('stops telling someone who has been removed from the project', async () => {
      const task = await newTask();
      await prisma.projectMember.delete({ where: { projectId_userId: { projectId: fx.projectA1, userId: fx.users.memberA } } });
      try {
        await comment('owner', task.id, `<@${fx.users.memberA}> are you there?`);
        assert.deepEqual(await about('membera', task.id), []);
        assert.deepEqual((await call('owner', 'GET', `/tasks/${task.id}`)).json.data.mentioned, []);
      } finally {
        await prisma.projectMember.create({ data: { projectId: fx.projectA1, userId: fx.users.memberA } });
      }
    });
  });
});
