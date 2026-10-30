// Seed for the Profile parity check (frontend/scripts/parity/profile.js): the reference page's own three people and footprint.
// DEV database only. Usage: npm run parity:seed-profile -- create | cleanup
//   mohand@acme.io (account owner: Acme Engineering 3 projects, Acme Labs 1)  3 open tasks
//   sarah@acme.io  (admin of Acme Engineering 3, member of Acme Design 1)     5 open tasks
//   leo@acme.io    (member of Acme Engineering, 2 projects)                    3 open tasks
// Everyone signs in with Passw0rd!long and has been a member for 120 days, as in the reference.
import 'dotenv/config';
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/prisma/prisma.service';

const EMAILS = { mohand: 'mohand@acme.io', sarah: 'sarah@acme.io', leo: 'leo@acme.io', maya: 'maya@acme.io' };
const DAY = 86_400_000;

async function cleanup(prisma: PrismaService) {
  const users = await prisma.user.findMany({ where: { email: { in: Object.values(EMAILS) } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const accounts = (await prisma.account.findMany({ where: { ownerId: { in: ids } }, select: { id: true } })).map((a) => a.id);
  const wsIds = (await prisma.workspace.findMany({ where: { accountId: { in: accounts } }, select: { id: true } })).map((w) => w.id);
  const pIds = (await prisma.project.findMany({ where: { workspaceId: { in: wsIds } }, select: { id: true } })).map((p) => p.id);
  await prisma.aiMutationProposal.deleteMany({ where: { conversation: { userId: { in: ids } } } });
  await prisma.aiConversation.deleteMany({ where: { userId: { in: ids } } });
  await prisma.aiUsageReservation.deleteMany({ where: { userId: { in: ids } } });
  await prisma.aiDailyUsage.deleteMany({ where: { userId: { in: ids } } });
  await prisma.userAiSubscription.deleteMany({ where: { userId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { OR: [{ recipientId: { in: ids } }, { workspaceId: { in: wsIds } }] } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: { in: ids } }, { workspaceId: { in: wsIds } }] } });
  await prisma.workspaceInvitationProject.deleteMany({ where: { invitation: { workspaceId: { in: wsIds } } } });
  await prisma.workspaceInvitation.deleteMany({ where: { workspaceId: { in: wsIds } } });
  await prisma.taskComment.deleteMany({ where: { task: { projectId: { in: pIds } } } });
  await prisma.task.deleteMany({ where: { projectId: { in: pIds } } });
  await prisma.projectMember.deleteMany({ where: { OR: [{ projectId: { in: pIds } }, { userId: { in: ids } }] } });
  await prisma.project.deleteMany({ where: { id: { in: pIds } } });
  await prisma.workspaceMember.deleteMany({ where: { OR: [{ workspaceId: { in: wsIds } }, { userId: { in: ids } }] } });
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.accountSubscription.deleteMany({ where: { accountId: { in: accounts } } });
  await prisma.account.deleteMany({ where: { id: { in: accounts } } });
  await prisma.userSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  // A person who deleted their account during a check stays behind as an anonymized row once nothing points at it any more.
  const ghosts = await prisma.user.findMany({
    where: { email: { endsWith: '@deleted.invalid' }, authoredTasks: { none: {} }, taskComments: { none: {} }, createdProjects: { none: {} }, sentWorkspaceInvitations: { none: {} } },
    select: { id: true },
  });
  const ghostIds = ghosts.map((g) => g.id);
  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ghostIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ghostIds } } });
}

(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('refusing to run on production');
  const mode = process.argv[2];
  if (mode !== 'create' && mode !== 'cleanup') throw new Error('usage: parity-seed-profile.ts create | cleanup');
  const prisma = new PrismaService();
  await prisma.$connect();
  if (mode === 'cleanup') {
    await cleanup(prisma);
    console.log('CLEANED');
    return prisma.$disconnect();
  }
  if (await prisma.user.findFirst({ where: { email: { in: Object.values(EMAILS) } } })) throw new Error('the acme.io people already exist: run cleanup first');

  const passwordHash = await bcrypt.hash('Passw0rd!long', 4);
  const createdAt = new Date(Date.now() - 120 * DAY);
  const person = (name: string, email: string) => prisma.user.create({ data: { name, email, passwordHash, isEmailVerified: true, createdAt } });
  const [mohand, sarah, leo, maya] = await Promise.all([
    person('Mohand Hatem', EMAILS.mohand), person('Sarah Ahmed', EMAILS.sarah), person('Leo Karam', EMAILS.leo), person('Maya Younis', EMAILS.maya),
  ]);

  // The owner's account is on Pro like the reference (its plan line reads "Pro · Acme Corp"); the AI tile follows the plan, so it reads Pro · 15/day where the reference still shows Free · 3/day.
  const corp = await prisma.account.create({ data: { name: 'Acme Corp', slug: 'pf-acme-corp', ownerId: mohand.id, subscription: { create: { tier: 'PRO' } } } });
  const design = await prisma.account.create({ data: { name: 'Acme Design Co', slug: 'pf-acme-design', ownerId: maya.id, subscription: { create: { tier: 'FREE' } } } });
  const workspace = (accountId: string, name: string, slug: string, members: { userId: string; role: 'ADMIN' | 'MEMBER' }[]) =>
    prisma.workspace.create({ data: { accountId, name, slug, members: { create: members } } });
  const eng = await workspace(corp.id, 'Acme Engineering', 'pf-acme-eng', [{ userId: mohand.id, role: 'ADMIN' }, { userId: sarah.id, role: 'ADMIN' }, { userId: leo.id, role: 'MEMBER' }]);
  const labs = await workspace(corp.id, 'Acme Labs', 'pf-acme-labs', [{ userId: mohand.id, role: 'ADMIN' }]);
  const dsn = await workspace(design.id, 'Acme Design', 'pf-acme-design', [{ userId: maya.id, role: 'ADMIN' }, { userId: sarah.id, role: 'MEMBER' }]);

  const project = (workspaceId: string, key: string, name: string, createdById: string, members: string[]) =>
    prisma.project.create({ data: { workspaceId, key, name, createdById, members: { create: members.map((userId) => ({ userId, role: userId === createdById ? 'ADMIN' : 'MEMBER' })) } } });
  const aut = await project(eng.id, 'AUT', 'Auth Revamp', mohand.id, [mohand.id, sarah.id, leo.id]);
  const web = await project(eng.id, 'WEB', 'Web App', mohand.id, [mohand.id, sarah.id, leo.id]);
  const api = await project(eng.id, 'API', 'Public API', mohand.id, [mohand.id, sarah.id]);
  const lab = await project(labs.id, 'LAB', 'Prototypes', mohand.id, [mohand.id]);
  const dsp = await project(dsn.id, 'DSN', 'Design System', maya.id, [maya.id, sarah.id]);
  void lab; void dsp;

  const open = [
    ...[aut, web, api].map((p, i) => ({ p, userId: mohand.id, i })),
    ...[aut, aut, web, web, api].map((p, i) => ({ p, userId: sarah.id, i })),
    ...[aut, web, web].map((p, i) => ({ p, userId: leo.id, i })),
  ];
  await prisma.task.createMany({
    data: open.map(({ p, userId }, n) => ({ projectId: p.id, title: `Open task ${n + 1}`, authorId: mohand.id, assigneeId: userId, status: (['TODO', 'IN_PROGRESS', 'IN_REVIEW'] as const)[n % 3] })),
  });
  console.log('SEEDED mohand/sarah/leo @acme.io (password Passw0rd!long)');
  await prisma.$disconnect();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
