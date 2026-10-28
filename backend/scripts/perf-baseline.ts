import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture } from '../test/helpers/fixture';

/**
 * Step 5.3: per-endpoint cost. Boots the real app, seeds a realistic board, then calls each endpoint sequentially and reports
 * time (p50/p95) and database queries per request. Run: npm run perf:baseline
 * Timings include the network round trip from this machine to the database; `db round trip` shows how much of each request
 * that alone explains (queries x round trip).
 */
const WARMUP = 2;
const RUNS = 15;
const TASKS_PER_PROJECT = 40;

const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0);
  const base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
  const prisma = app.get(PrismaService);
  let queries = 0;
  let capture: string[] | null = null;
  (prisma as any).$on('query', (e: { query: string; duration: number }) => {
    queries++;
    capture?.push(`${e.duration}ms ${e.query.replace(/\s+/g, ' ').replace(/"public"\./g, '').slice(0, 170)}`);
  });

  const fx = await buildFixture(prisma);
  try {
    // Realistic volume: a populated board, with assignees, comments and a mix of statuses.
    const statuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as const;
    const assignees = [fx.users.owner, fx.users.memberA, fx.users.admin2];
    let firstTask = '';
    for (const projectId of [fx.projectA1, fx.projectA2]) {
      const data = Array.from({ length: TASKS_PER_PROJECT }, (_, i) => ({
        projectId, title: `Task ${i} ${fx.run}`, authorId: fx.users.owner, assigneeId: assignees[i % 3],
        status: statuses[i % statuses.length], priority: (['LOW', 'MEDIUM', 'HIGH'] as const)[i % 3],
      }));
      await prisma.task.createMany({ data: data as any });
    }
    const first = await prisma.task.findFirstOrThrow({ where: { projectId: fx.projectA1 } });
    firstTask = first.id;
    await prisma.taskComment.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({ taskId: firstTask, authorId: assignees[i % 3], content: `Comment ${i}` })),
    });

    const auth = app.get(AuthService, { strict: false });
    const session = await auth.login({ email: `owner.${fx.run}@veyro-test.io`, password: 'Password123!' });
    const cookie = `access_token=${session.accessToken}`;
    const get = (path: string) => fetch(`${base}${path}`, { headers: { cookie } });

    // Baseline: what one trivial query costs from here.
    const rt: number[] = [];
    for (let i = 0; i < 10; i++) { const t = performance.now(); await prisma.$queryRaw`select 1`; rt.push(performance.now() - t); }
    rt.sort((a, b) => a - b);
    const roundTrip = pct(rt, 50);

    const endpoints: [string, string][] = [
      ['auth/me', '/auth/me'],
      ['users/me/profile', '/users/me/profile'],
      ['workspaces (list)', '/workspaces'],
      ['dashboard', `/workspaces/${fx.workspaceA}/dashboard`],
      ['projects list', `/workspaces/${fx.workspaceA}/projects`],
      ['my tasks', `/workspaces/${fx.workspaceA}/my-tasks`],
      ['project detail', `/projects/${fx.projectA1}`],
      ['board: project tasks', `/projects/${fx.projectA1}/tasks`],
      ['project members', `/projects/${fx.projectA1}/members`],
      ['task detail', `/tasks/${firstTask}`],
      ['task comments', `/tasks/${firstTask}/comments`],
      ['workspace members', `/workspaces/${fx.workspaceA}/members`],
      ['audit trail', `/audit-logs?workspaceId=${fx.workspaceA}`],
      ['billing: subscription', `/accounts/${fx.accountA}/subscription`],
      ['billing: projects', `/accounts/${fx.accountA}/projects`],
      ['ai: conversations', '/ai/conversations'],
    ];

    const rows: string[] = [];
    for (const [name, path] of endpoints) {
      for (let i = 0; i < WARMUP; i++) await (await get(path)).arrayBuffer();
      const times: number[] = [];
      const counts: number[] = [];
      let status = 0;
      let bytes = 0;
      for (let i = 0; i < RUNS; i++) {
        const before = queries;
        const t = performance.now();
        const res = await get(path);
        bytes = (await res.arrayBuffer()).byteLength;
        times.push(performance.now() - t);
        counts.push(queries - before);
        status = res.status;
      }
      if (process.env.PERF_TRACE) {
        capture = [];
        await (await get(path)).arrayBuffer();
        console.log(['', `### ${name} (${capture.length} queries)`, ...capture.map((q, i) => `${i + 1}. ${q}`)].join('\n'));
        capture = null;
      }
      times.sort((a, b) => a - b);
      counts.sort((a, b) => a - b);
      rows.push(`| ${name} | ${status} | ${Math.round(pct(times, 50))} | ${Math.round(pct(times, 95))} | ${counts[Math.floor(counts.length / 2)]} | ${(bytes / 1024).toFixed(1)} |`);
    }

    console.log(`\nDB round trip (select 1, p50): ${roundTrip.toFixed(0)} ms. Seeded ${TASKS_PER_PROJECT} tasks x 2 projects, 12 comments. ${RUNS} runs per endpoint.\n`);
    console.log('| endpoint | status | p50 ms | p95 ms | queries | KB |');
    console.log('| --- | --- | --- | --- | --- | --- |');
    rows.forEach((r) => console.log(r));
  } finally {
    await fx.cleanup();
    await app.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
