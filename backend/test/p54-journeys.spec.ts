import 'dotenv/config';
import 'reflect-metadata';
import * as crypto from 'node:crypto';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountPurgeService } from '../src/modules/tenancy/account-purge.service';
import { cleanupJourneyUsers } from './helpers/journey-cleanup';

/**
 * Step 5.4: whole product journeys over real HTTP, from an empty database. Each journey builds on the data of the one
 * before (the tests inside run in order). Nothing is mocked: the email code is the only thing planted, by writing the
 * hash of a known code into the row the app created, which is exactly what the app would have stored.
 */
const PASSWORD = 'Passw0rd!long';
const OTP = '123456';
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

describe('5.4: end-to-end journeys (real app, real database)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const userIds: string[] = [];
  let retries = 0;

  /** A signed-in person: keeps its own cookies, like a browser. */
  class Person {
    cookie = '';
    id = '';
    constructor(public email: string, public name: string) {}
    async call(method: string, path: string, body?: object, headers: Record<string, string> = {}) {
      // A 503 means "the database could not be reached, try again" (Retry-After). A client is expected to retry it, so the
      // journeys do too, a few times, and report how often (a link to the database that drops often should be visible).
      for (let attempt = 0; ; attempt++) {
        const res = await fetch(`${base}${path}`, {
          method,
          headers: { 'content-type': 'application/json', ...headers, ...(this.cookie ? { cookie: this.cookie } : {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
        // 502 on an assistant message is the quota-refunded rollback; the Idempotency-Key makes sending it again safe.
        if ((res.status === 503 || (res.status === 502 && path.endsWith('/messages'))) && attempt < 3) {
          retries++;
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        const json = (await res.json().catch(() => ({}))) as any;
        return { status: res.status, data: json.data, code: json.error?.code as string | undefined, res };
      }
    }
    saveCookies(res: Response) {
      this.cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    }
    async login() {
      const r = await this.call('POST', '/auth/login', { email: this.email, password: PASSWORD });
      assert.equal(r.status, 200, `login ${this.email}`);
      this.saveCookies(r.res);
    }
  }

  const owner = () => new Person(`p54.owner.${run}@veyro-test.io`, 'Olivia Owner');
  let olivia: Person;
  let mark: Person;
  let workspaceId = '';
  let accountId = '';
  let projectId = '';
  let taskId = '';

  /** Register, confirm the email with a known code, and sign in. */
  const signUp = async (p: Person) => {
    const reg = await p.call('POST', '/auth/register', { email: p.email, password: PASSWORD, name: p.name });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.accessToken, undefined, 'tokens travel in cookies only');
    p.id = reg.data.user.id;
    userIds.push(p.id);
    await prisma.userOtpVerification.updateMany({ where: { userId: p.id }, data: { codeHash: sha(OTP) } });
    const wrong = await p.call('POST', '/auth/otp/verify', { email: p.email, code: '000000' });
    assert.ok(wrong.status >= 400 && wrong.status < 500, 'a wrong code is refused');
    const ok = await p.call('POST', '/auth/otp/verify', { email: p.email, code: OTP });
    assert.equal(ok.status, 200);
    await p.login();
  };

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: process.env.P54_LOG ? ['warn', 'error'] : false });
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    olivia = owner();
    mark = new Person(`p54.mark.${run}@veyro-test.io`, 'Mark Member');
  });

  after(async () => {
    try {
      // Whatever state a failed journey stopped in, the product's own purge removes the account's data child-first.
      await cleanupJourneyUsers(prisma, app.get(AccountPurgeService), userIds);
    } finally {
      if (retries > 0) console.log(`NOTE: ${retries} request(s) were retried after a 503 (database unreachable).`);
      await app.close();
    }
  });

  describe('journey 1: getting started', () => {
    it('registers, confirms the email, signs in and is recognised', async () => {
      await signUp(olivia);
      const me = await olivia.call('GET', '/auth/me');
      assert.equal(me.status, 200);
      assert.equal(me.data.user.email, olivia.email);
    });

    it('confirming an already confirmed email is harmless', async () => {
      const again = await olivia.call('POST', '/auth/otp/verify', { email: olivia.email, code: OTP });
      assert.equal(again.status, 200);
      assert.match(JSON.stringify(again.data), /already verified/i);
    });

    it('onboarding creates the account and the first workspace, and the dashboard loads', async () => {
      const r = await olivia.call('POST', '/onboarding/atomic', {
        accountName: `Acme ${run}`, accountSlug: `acme-${run}`, workspaceName: 'Product', workspaceSlug: `product-${run}`,
      });
      assert.equal(r.status, 201);
      workspaceId = r.data.workspace.id;
      accountId = r.data.account.id;
      const list = await olivia.call('GET', '/workspaces');
      assert.ok(JSON.stringify(list.data).includes(workspaceId), 'the new workspace is listed');
      const dash = await olivia.call('GET', `/workspaces/${workspaceId}/dashboard`);
      assert.equal(dash.status, 200);
      assert.equal(dash.data.counts.projects, 0);
      assert.equal(dash.data.viewer.isAccountOwner, true);
    });
  });

  describe('journey 2: teamwork', () => {
    it('the owner invites a colleague, who signs up and accepts', async () => {
      await signUp(mark);
      const inv = await olivia.call('POST', `/workspaces/${workspaceId}/invitations`, { email: mark.email, role: 'MEMBER' });
      assert.equal(inv.status, 201);
      const preview = await mark.call('GET', `/invitations/preview?token=${inv.data.rawToken}`);
      assert.equal(preview.status, 200);
      const accept = await mark.call('POST', '/invitations/accept', { token: inv.data.rawToken });
      assert.ok([200, 201].includes(accept.status), `accept answered ${accept.status}`);
      const members = await olivia.call('GET', `/workspaces/${workspaceId}/members`);
      assert.equal(members.data.length, 2);
      const again = await mark.call('POST', '/invitations/accept', { token: inv.data.rawToken });
      assert.ok(again.status >= 400, 'an invitation cannot be accepted twice');
    });

    it('the owner creates a project, adds the colleague and assigns a task', async () => {
      const p = await olivia.call('POST', `/workspaces/${workspaceId}/projects`, { name: 'Launch', key: 'LAU' });
      assert.equal(p.status, 201);
      projectId = p.data.id;
      // Before being added, the colleague cannot even see the project.
      assert.equal((await mark.call('GET', `/projects/${projectId}`)).status, 404);
      const add = await olivia.call('POST', `/projects/${projectId}/members`, { userId: mark.id, role: 'MEMBER' });
      assert.equal(add.status, 201);
      assert.equal((await mark.call('GET', `/projects/${projectId}`)).status, 200);
      const t = await olivia.call('POST', `/projects/${projectId}/tasks`, { title: 'Write release notes', assigneeId: mark.id, priority: 'HIGH' });
      assert.equal(t.status, 201);
      taskId = t.data.id;
      assert.equal(t.data.status, 'TODO');
      const dash = await olivia.call('GET', `/workspaces/${workspaceId}/dashboard`);
      assert.equal(dash.data.counts.projects, 1);
    });

    it('the assignee works the task within their rights', async () => {
      const mine = await mark.call('GET', `/workspaces/${workspaceId}/my-tasks`);
      assert.ok(JSON.stringify(mine.data).includes(taskId), 'the task shows up under My tasks');
      assert.equal((await mark.call('PATCH', `/tasks/${taskId}`, { status: 'IN_PROGRESS' })).status, 200);
      assert.equal((await mark.call('POST', `/tasks/${taskId}/comments`, { content: 'Draft is ready' })).status, 201);
      assert.equal((await mark.call('PATCH', `/tasks/${taskId}`, { status: 'CANCELLED' })).status, 403, 'members never cancel');
      assert.equal((await mark.call('PATCH', `/tasks/${taskId}`, { title: 'Renamed by member' })).status, 403, 'members do not edit details');
      assert.equal((await mark.call('PATCH', `/tasks/${taskId}`, { status: 'IN_REVIEW' })).status, 200);
      assert.equal((await mark.call('PATCH', `/tasks/${taskId}`, { status: 'DONE' })).status, 200);
    });

    it('the owner sees the result everywhere, reopens the task with a reason and the record shows it', async () => {
      const detail = await olivia.call('GET', `/tasks/${taskId}`);
      assert.equal(detail.data.status, 'DONE');
      assert.ok(detail.data.completedAt, 'finishing a task stamps completedAt');
      const comments = await olivia.call('GET', `/tasks/${taskId}/comments`);
      assert.equal(comments.data.length, 1);
      const noReason = await olivia.call('POST', `/tasks/${taskId}/reopen`, { targetStatus: 'IN_PROGRESS', reason: 'x' });
      assert.equal(noReason.status, 400, 'a reason is mandatory');
      const reopen = await olivia.call('POST', `/tasks/${taskId}/reopen`, { targetStatus: 'IN_PROGRESS', reason: 'Notes need a legal review' });
      assert.equal(reopen.status, 200);
      assert.equal((await olivia.call('GET', `/tasks/${taskId}`)).data.status, 'IN_PROGRESS');
      const audit = await olivia.call('GET', `/audit-logs?workspaceId=${workspaceId}&limit=50`);
      const actions = JSON.stringify(audit.data);
      for (const a of ['ACCOUNT_ONBOARDED', 'WORKSPACE_INVITATION_ISSUED', 'PROJECT_CREATED', 'TASK_CREATED', 'COMMENT_CREATED']) {
        assert.ok(actions.includes(a), `the audit trail records ${a}`);
      }
      assert.equal((await mark.call('GET', `/audit-logs?workspaceId=${workspaceId}`)).status, 403, 'members cannot read the trail');
    });

    it('deleting a task hides it from members and restoring brings it back', async () => {
      assert.equal((await mark.call('DELETE', `/tasks/${taskId}`)).status, 403);
      assert.equal((await olivia.call('DELETE', `/tasks/${taskId}`)).status, 204);
      assert.equal((await mark.call('GET', `/tasks/${taskId}`)).status, 404, 'a member cannot open a deleted task');
      const board = await olivia.call('GET', `/projects/${projectId}/tasks`);
      assert.ok(!JSON.stringify(board.data).includes(taskId), 'it leaves the board');
      assert.equal((await olivia.call('POST', `/tasks/${taskId}/restore`)).status, 200);
      assert.equal((await mark.call('GET', `/tasks/${taskId}`)).status, 200);
    });
  });

  describe('journey 3: the AI assistant proposes, the person decides', () => {
    let conversationId = '';
    const ask = (content: string, key: string) =>
      olivia.call('POST', `/ai/conversations/${conversationId}/messages`, { content }, { 'idempotency-key': key });
    const tasksNamed = async (title: string) =>
      JSON.stringify((await olivia.call('GET', `/projects/${projectId}/tasks`)).data).split(title).length - 1;

    it('a request to create a task becomes a proposal and writes nothing until confirmed', async () => {
      const c = await olivia.call('POST', '/ai/conversations', { title: 'Planning', mode: 'PROJECT', contextScope: 'WORKSPACE', workspaceId });
      assert.equal(c.status, 201);
      conversationId = c.data.id;
      const r = await ask('create task: Prepare the demo', `p54-${run}-1`);
      assert.equal(r.status, 201);
      assert.equal(r.data.proposal.status, 'PENDING');
      assert.equal(await tasksNamed('Prepare the demo'), 0, 'nothing is written by a proposal');
      const replay = await ask('create task: Prepare the demo', `p54-${run}-1`);
      assert.equal(replay.data.message.id, r.data.message.id, 'the same Idempotency-Key replays the same answer');
      const confirm = await olivia.call('POST', `/ai/proposals/${r.data.proposal.id}/confirm`);
      assert.ok([200, 201].includes(confirm.status), `confirm answered ${confirm.status}`);
      assert.equal(await tasksNamed('Prepare the demo'), 1);
      const twice = await olivia.call('POST', `/ai/proposals/${r.data.proposal.id}/confirm`);
      assert.ok(twice.status >= 400, 'a proposal is applied once');
      assert.equal(await tasksNamed('Prepare the demo'), 1);
    });

    it('a rejected proposal changes nothing', async () => {
      const r = await ask('create task: Book the venue', `p54-${run}-2`);
      const rej = await olivia.call('POST', `/ai/proposals/${r.data.proposal.id}/reject`);
      assert.ok([200, 201].includes(rej.status));
      assert.equal(await tasksNamed('Book the venue'), 0);
      assert.ok((await olivia.call('POST', `/ai/proposals/${r.data.proposal.id}/confirm`)).status >= 400, 'a rejected proposal cannot be confirmed');
    });

    it('a member cannot use the assistant to do what they could not do themselves', async () => {
      const c = await mark.call('POST', '/ai/conversations', { title: 'Mine', mode: 'PROJECT', contextScope: 'WORKSPACE', workspaceId });
      const r = await mark.call('POST', `/ai/conversations/${c.data.id}/messages`, { content: 'create task: Sneaky task' }, { 'idempotency-key': `p54-${run}-3` });
      assert.equal(r.status, 201);
      assert.equal(r.data.proposal, null, 'no proposal for someone who is not a project admin');
      assert.equal(await tasksNamed('Sneaky task'), 0);
    });
  });

  describe('journey 4: plan limits and leaving', () => {
    it('the Free plan stops at its project and workspace caps', async () => {
      assert.equal((await olivia.call('POST', `/workspaces/${workspaceId}/projects`, { name: 'Second', key: 'SEC' })).status, 201);
      assert.equal((await olivia.call('POST', `/workspaces/${workspaceId}/projects`, { name: 'Third', key: 'THI' })).status, 201);
      const fourth = await olivia.call('POST', `/workspaces/${workspaceId}/projects`, { name: 'Fourth', key: 'FOU' });
      assert.equal(fourth.code, 'PROJECT_CAPACITY_EXCEEDED');
      const ws = await olivia.call('POST', `/accounts/${accountId}/workspaces`, { name: 'Second workspace', slug: `second-${run}` });
      assert.equal(ws.status, 403);
      assert.equal(ws.code, 'WORKSPACE_CAPACITY_EXCEEDED');
    });

    it('offboarding locks every write but leaves reading open, then the purge removes the account', async () => {
      assert.equal((await mark.call('POST', `/accounts/${accountId}/offboard`, { passwordConfirmation: PASSWORD, slugConfirmation: `acme-${run}` })).status, 403, 'only the owner can offboard');
      const off = await olivia.call('POST', `/accounts/${accountId}/offboard`, { passwordConfirmation: PASSWORD, slugConfirmation: `acme-${run}` });
      assert.equal(off.status, 202, 'offboarding is accepted now and purged later');
      const write = await olivia.call('POST', `/projects/${projectId}/tasks`, { title: 'Too late' });
      assert.equal(write.status, 403);
      assert.equal(write.code, 'ACCOUNT_OFFBOARDING_LOCKED');
      assert.equal((await mark.call('POST', `/tasks/${taskId}/comments`, { content: 'Too late' })).code, 'ACCOUNT_OFFBOARDING_LOCKED');
      assert.equal((await olivia.call('GET', `/projects/${projectId}`)).status, 200, 'reading stays open');
      await app.get(AccountPurgeService).purgeAccount(accountId);
      const gone = await olivia.call('GET', `/workspaces/${workspaceId}`);
      assert.ok([403, 404].includes(gone.status), `the workspace is gone, got ${gone.status}`);
      assert.equal(await prisma.task.count({ where: { projectId } }), 0, 'its data is gone');
    });
  });
});
