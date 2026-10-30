// Demo data for the portfolio deployment (step 6.1): one account, one workspace, three people, two projects and a dozen tasks.
// Everything is created through the real API of an in-process app (real guards, real business rules), so the audit trail, the
// notifications and the dashboard numbers are the ones the product itself produces.
//
//   npm run demo:seed                         seed the development database (the Neon branch)
//   npm run demo:seed -- --reset              remove the demo, then seed it again (puts the demo back as it was)
//   npm run demo:seed -- --remove             remove the demo only
//   npm run demo:seed -- --production --yes   the same against the production database (DATABASE_URL). Both flags are required.
//
// The demo password is public on purpose (it is shown on the login page of the demo). Change it with DEMO_PASSWORD.
import 'dotenv/config';
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

const args = new Set(process.argv.slice(2));
const production = args.has('--production');
if (production) {
  if (!args.has('--yes')) throw new Error('--production changes the production database: add --yes to confirm.');
  // The development branch variables win outside NODE_ENV=production, so blank them to point this run at DATABASE_URL.
  process.env.DATABASE_URL_Branch = '';
  process.env.DATABASE_URL_BRANCH = '';
}

// Imported after the flags, because the Prisma service reads the database variables when it is constructed.
/* eslint-disable @typescript-eslint/no-require-imports */
const { AppModule } = require('../src/app.module');
const { TransformInterceptor } = require('../src/common/interceptors/transform.interceptor');
const { AllExceptionsFilter } = require('../src/common/filters/http-exception.filter');
const { PrismaService } = require('../src/prisma/prisma.service');
const { databaseUrl } = require('../src/prisma/database-url');
const { AccountPurgeService } = require('../src/modules/tenancy/account-purge.service');
/* eslint-enable @typescript-eslint/no-require-imports */

const PASSWORD = process.env.DEMO_PASSWORD || 'VeyroDemo2026!';
const ACCOUNT_SLUG = 'veyro-demo';
const WORKSPACE_SLUG = 'acme-studio';
const PEOPLE = {
  owner: { email: 'layla.demo@example.com', name: 'Layla Hassan' },
  admin: { email: 'omar.demo@example.com', name: 'Omar Nasser' },
  member: { email: 'mona.demo@example.com', name: 'Mona Adel' },
} as const;
type Who = keyof typeof PEOPLE;

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

async function main() {
  const app: INestApplication = await NestFactory.create(AppModule, { logger: false });
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0);
  const base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
  const prisma = app.get(PrismaService);

  const cookies: Partial<Record<Who, string>> = {};
  const ids: Partial<Record<Who, string>> = {};
  const call = async (as: Who | null, method: string, path: string, body?: object, expect?: number) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(as && cookies[as] ? { cookie: cookies[as] } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (expect && res.status !== expect) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 240)}`);
    return { status: res.status, data: json.data, res };
  };
  const login = async (who: Who) => {
    const r = await call(null, 'POST', '/auth/login', { email: PEOPLE[who].email, password: PASSWORD }, 200);
    cookies[who] = r.res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };

  const emails = Object.values(PEOPLE).map((p) => p.email);
  async function remove() {
    const account = await prisma.account.findUnique({ where: { slug: ACCOUNT_SLUG } });
    if (account) {
      await login('owner');
      await call('owner', 'POST', `/accounts/${account.id}/offboard`, { passwordConfirmation: PASSWORD, slugConfirmation: ACCOUNT_SLUG }, 202);
      await app.get(AccountPurgeService).purgeAccount(account.id);
    }
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const uid = users.map((u: { id: string }) => u.id);
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: uid } } });
    await prisma.userSession.deleteMany({ where: { userId: { in: uid } } });
    await prisma.user.deleteMany({ where: { id: { in: uid } } });
    console.log('Demo removed.');
  }

  async function seed() {
    if (await prisma.user.findFirst({ where: { email: { in: emails } } })) {
      const tasks = await prisma.task.count({ where: { project: { workspace: { slug: WORKSPACE_SLUG } } } });
      console.log(`The demo is already there (${tasks} tasks). Use --reset to put it back as it was.`);
      return;
    }
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    for (const who of Object.keys(PEOPLE) as Who[]) {
      const u = await prisma.user.create({ data: { email: PEOPLE[who].email, name: PEOPLE[who].name, passwordHash, isEmailVerified: true, emailVerifiedAt: new Date() } });
      ids[who] = u.id;
    }
    for (const who of Object.keys(PEOPLE) as Who[]) await login(who);

    const onboarding = await call('owner', 'POST', '/onboarding/atomic', { accountName: 'Veyro Demo', accountSlug: ACCOUNT_SLUG, workspaceName: 'Acme Studio', workspaceSlug: WORKSPACE_SLUG }, 201);
    const ws = onboarding.data.workspace.id as string;

    // Two people join the way real people do: an invitation, then accepting it.
    for (const [who, role] of [['admin', 'ADMIN'], ['member', 'MEMBER']] as const) {
      const inv = await call('owner', 'POST', `/workspaces/${ws}/invitations`, { email: PEOPLE[who].email, role }, 201);
      await call(who, 'POST', '/invitations/accept', { token: inv.data.rawToken }, 200);
    }

    const project = async (name: string, key: string) => (await call('owner', 'POST', `/workspaces/${ws}/projects`, { name, key }, 201)).data.id as string;
    const web = await project('Website Relaunch', 'WEB');
    const app_ = await project('Mobile App', 'APP');
    await call('owner', 'POST', `/projects/${web}/members`, { userId: ids.admin, role: 'ADMIN' }, 201);
    await call('owner', 'POST', `/projects/${web}/members`, { userId: ids.member, role: 'MEMBER' }, 201);
    await call('owner', 'POST', `/projects/${app_}/members`, { userId: ids.admin, role: 'MEMBER' }, 201);
    await call('owner', 'POST', `/projects/${app_}/members`, { userId: ids.member, role: 'MEMBER' }, 201);

    type T = { project: string; by: Who; title: string; description?: string; assignee?: Who; priority: string; category: string; due?: number; path?: string[]; comments?: [Who, string][] };
    const tasks: T[] = [
      { project: web, by: 'owner', title: 'Design the new homepage', description: 'Hero, three feature blocks and a clear call to action.', assignee: 'member', priority: 'HIGH', category: 'DESIGN', due: 5, path: ['IN_PROGRESS'], comments: [['member', 'First wireframes are in the shared folder.'], ['owner', 'Looks good. Please add the pricing block.']] },
      { project: web, by: 'owner', title: 'Write the launch announcement', assignee: 'admin', priority: 'MEDIUM', category: 'DOCS', due: 9 },
      { project: web, by: 'admin', title: 'Fix the broken contact form on mobile', description: 'The submit button sits under the keyboard on small phones.', assignee: 'member', priority: 'URGENT', category: 'BUG', due: -2, path: ['IN_PROGRESS', 'IN_REVIEW'], comments: [['member', 'Fixed, ready for review.']] },
      { project: web, by: 'owner', title: 'Set up analytics', assignee: 'admin', priority: 'LOW', category: 'IMPROVEMENT', path: ['IN_PROGRESS', 'IN_REVIEW', 'DONE'] },
      { project: web, by: 'admin', title: 'Migrate the old blog posts', priority: 'MEDIUM', category: 'FEATURE', due: 14 },
      { project: web, by: 'owner', title: 'Collect customer logos', assignee: 'member', priority: 'LOW', category: 'RESEARCH', path: ['IN_PROGRESS', 'IN_REVIEW', 'DONE'] },
      { project: app_, by: 'owner', title: 'Sign-in with a fingerprint', description: 'Use the phone biometrics after the first password sign-in.', assignee: 'admin', priority: 'HIGH', category: 'FEATURE', due: 12, path: ['IN_PROGRESS'] },
      { project: app_, by: 'owner', title: 'Push notification settings screen', assignee: 'member', priority: 'MEDIUM', category: 'DESIGN', due: 7 },
      { project: app_, by: 'admin', title: 'Crash when opening a deleted task', description: 'Reported by two testers on the beta build.', assignee: 'admin', priority: 'URGENT', category: 'BUG', path: ['IN_PROGRESS', 'IN_REVIEW'], comments: [['owner', 'Can you check this first thing tomorrow?']] },
      { project: app_, by: 'owner', title: 'Prepare the store listing', priority: 'MEDIUM', category: 'DOCS', due: 20 },
      { project: app_, by: 'owner', title: 'Dark mode for the task list', assignee: 'member', priority: 'LOW', category: 'IMPROVEMENT', path: ['IN_PROGRESS'] },
      { project: app_, by: 'admin', title: 'Old idea: in-app chat', priority: 'LOW', category: 'FEATURE' },
    ];
    for (const t of tasks) {
      const created = await call(t.by, 'POST', `/projects/${t.project}/tasks`, {
        title: t.title, priority: t.priority, category: t.category,
        ...(t.description ? { description: t.description } : {}), ...(t.assignee ? { assigneeId: ids[t.assignee] } : {}), ...(t.due !== undefined ? { dueDate: day(t.due) } : {}),
      }, 201);
      const id = created.data.id as string;
      for (const status of t.path ?? []) {
        // People move their own work; whoever may not (a member on an unassigned task) never needs to here.
        await call(t.assignee ?? 'owner', 'PATCH', `/tasks/${id}`, { status }, 200);
      }
      for (const [who, content] of t.comments ?? []) await call(who, 'POST', `/tasks/${id}/comments`, { content }, 201);
    }
    await call('owner', 'PATCH', `/tasks/${(await prisma.task.findFirstOrThrow({ where: { title: 'Old idea: in-app chat' }, select: { id: true } })).id}`, { status: 'CANCELLED' }, 200);

    const counts = {
      people: emails.length,
      projects: await prisma.project.count({ where: { workspaceId: ws } }),
      tasks: await prisma.task.count({ where: { project: { workspaceId: ws } } }),
      comments: await prisma.taskComment.count({ where: { task: { project: { workspaceId: ws } } } }),
      audit: await prisma.auditLog.count({ where: { workspaceId: ws } }),
    };
    console.log('Demo seeded:', JSON.stringify(counts));
    console.log(`Sign in as ${emails.join(' / ')} with the demo password.`);
  }

  try {
    // The host only (never the credentials), so it is always clear which database this run is about to change.
    const url = databaseUrl();
    console.log(`Target database: ${url ? new URL(url).host : 'unknown'}${production ? '  (PRODUCTION)' : ''}`);
    if (args.has('--remove')) await remove();
    else {
      if (args.has('--reset')) await remove();
      await seed();
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('FAILED', e instanceof Error ? e.message : e);
  process.exit(1);
});
