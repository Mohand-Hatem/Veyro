import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { EmailService, EmailMessage } from '../src/modules/email/email.service';
import { escapeHtml, invitationEmail, contactNotificationEmail, verificationEmail } from '../src/modules/email/email.templates';
import { AuthService } from '../src/modules/auth/auth.service';
import { AccountPurgeService } from '../src/modules/tenancy/account-purge.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';
import { cleanupJourneyUsers } from './helpers/journey-cleanup';

/** Step 5.5: the four emails. The Resend call itself is faked; everything the app puts in the email is checked for real. */
class CapturingEmail extends EmailService {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.sent.push(message);
    return true;
  }
}

describe('5.5: email service', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env.RESEND_API_KEY = '';
    process.env.EMAIL_FROM = '';
  });
  const msg: EmailMessage = { to: 'a@example.test', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi', replyTo: 'b@example.test' };

  it('the test scripts never carry the real key (so no suite can send real mail)', () => {
    assert.equal(process.env.RESEND_API_KEY, '');
  });

  it('does nothing and reports false when the provider is not configured', async () => {
    let called = false;
    globalThis.fetch = (async () => { called = true; return new Response('{}'); }) as typeof fetch;
    assert.equal(await new EmailService().send(msg), false);
    assert.equal(called, false);
  });

  it('posts the message to Resend with the key, sender and reply-to', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'Veyro <onboarding@resend.dev>';
    let seen: { url: string; init: RequestInit } | undefined;
    globalThis.fetch = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response('{"id":"x"}', { status: 200 }); }) as typeof fetch;
    assert.equal(await new EmailService().send(msg), true);
    assert.equal(seen?.url, 'https://api.resend.com/emails');
    assert.equal((seen?.init.headers as Record<string, string>).Authorization, 'Bearer re_test_key');
    const body = JSON.parse(String(seen?.init.body));
    assert.deepEqual(body.to, ['a@example.test']);
    assert.equal(body.from, 'Veyro <onboarding@resend.dev>');
    assert.equal(body.reply_to, 'b@example.test');
  });

  it('never throws: a refusal or an unreachable provider is just false', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'Veyro <onboarding@resend.dev>';
    globalThis.fetch = (async () => new Response('{"message":"nope"}', { status: 403 })) as typeof fetch;
    assert.equal(await new EmailService().send(msg), false);
    globalThis.fetch = (async () => { throw new Error('network down'); }) as typeof fetch;
    assert.equal(await new EmailService().send(msg), false);
  });
});

describe('5.5: templates', () => {
  it('escapes anything a person typed before it reaches HTML, and keeps subjects on one line', () => {
    assert.equal(escapeHtml(`<script>"x"&'y'</script>`), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
    const inv = invitationEmail({ inviterName: 'Eve\r\nBcc: x@y.z <b>', workspaceName: '<img src=x>', role: 'MEMBER', url: 'https://app.test/i?token=1', days: 7, locale: 'en' });
    assert.ok(!/[\r\n]/.test(inv.subject));
    assert.ok(!inv.html.includes('<img src=x>') && !inv.html.includes('<b>'));
    const contact = contactNotificationEmail({ name: 'N', email: 'e@x.test', topic: 'PROBLEM', message: '<a href="http://evil">click</a>' });
    assert.ok(!contact.html.includes('<a href'));
    assert.equal(contact.replyTo, 'e@x.test');
  });

  it('speaks the recipient language, right to left for Arabic', () => {
    const ar = verificationEmail('123456', 'ar');
    assert.match(ar.html, /dir="rtl"/);
    assert.match(ar.text, /123456/);
    assert.match(verificationEmail('123456', 'en').html, /dir="ltr"/);
  });
});

describe('5.5: emails sent by the real app (the emailed secret must really work)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  let mail: CapturingEmail;
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const regEmail = `p55.reg.${run}@veyro-test.io`;
  const userIds: string[] = [];
  const emailsOf = (to: string) => mail.sent.filter((m) => m.to === to);
  const call = async (method: string, path: string, body?: object, cookie = '') => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  /** Emails are sent without await, so give a just-finished request a moment. */
  const waitFor = async (to: string, count = 1) => {
    for (let i = 0; i < 40 && emailsOf(to).length < count; i++) await new Promise((r) => setTimeout(r, 50));
    return emailsOf(to);
  };

  before(async () => {
    mail = new CapturingEmail();
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(EmailService).useValue(mail).compile();
    app = mod.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    fx = await buildFixture(prisma);
  });

  after(async () => {
    try {
      await prisma.contactMessage.deleteMany({ where: { email: { contains: `.${run}@` } } });
      await fx.cleanup();
      await cleanupJourneyUsers(prisma, app.get(AccountPurgeService), userIds);
    } finally {
      await app.close();
    }
  });

  it('sign-up emails a code that really verifies the address', async () => {
    const reg = await call('POST', '/auth/register', { email: regEmail, password: 'Passw0rd!long', name: 'Reggie Test' });
    assert.equal(reg.status, 201);
    userIds.push(reg.json.data.user.id);
    const [m] = await waitFor(regEmail);
    assert.ok(m, 'a verification email was sent');
    const code = m.text.match(/\b\d{6}\b/)?.[0];
    assert.ok(code, 'it contains the 6-digit code');
    assert.equal((await call('POST', '/auth/otp/verify', { email: regEmail, code })).status, 200);
  });

  it('a failing provider never breaks the request that triggered it', async () => {
    const original = mail.send.bind(mail);
    mail.send = async (m) => { mail.sent.push(m); return false; };
    const email = `p55.fail.${run}@veyro-test.io`;
    const reg = await call('POST', '/auth/register', { email, password: 'Passw0rd!long', name: 'Fay Lure' });
    mail.send = original;
    assert.equal(reg.status, 201);
    userIds.push(reg.json.data.user.id);
  });

  it('forgot-password emails a link that really resets the password, and says nothing about unknown addresses', async () => {
    const before = mail.sent.length;
    const unknown = await call('POST', '/auth/forgot-password', { email: `nobody.${run}@veyro-test.io` });
    assert.equal(unknown.status, 200);
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(mail.sent.length, before, 'no email for an address that is not registered');

    assert.equal((await call('POST', '/auth/forgot-password', { email: regEmail })).status, 200);
    const mails = (await waitFor(regEmail, 2)).filter((m) => m.subject.toLowerCase().includes('reset'));
    assert.equal(mails.length, 1);
    const token = mails[0].text.match(/token=([a-f0-9]+)/)?.[1];
    assert.ok(token, 'the link carries the token');
    assert.match(mails[0].text, /\/en\/reset-password\?token=/);
    assert.equal((await call('POST', '/auth/reset-password', { token, newPassword: 'BrandNew-Passw0rd!' })).status, 200);
    assert.equal((await call('POST', '/auth/login', { email: regEmail, password: 'BrandNew-Passw0rd!' })).status, 200);
  });

  it('an invitation emails a link that really accepts, in the inviter name, and resend sends a fresh one', async () => {
    const ownerSession = await app.get(AuthService).login({ email: `owner.${fx.run}@veyro-test.io`, password: 'Password123!' });
    const cookie = `access_token=${ownerSession.accessToken}`;
    const invitee = `invitee.${run}@veyro-test.io`;
    const inv = await call('POST', `/workspaces/${fx.workspaceA}/invitations`, { email: invitee, role: 'MEMBER' }, cookie);
    assert.equal(inv.status, 201);
    const [first] = await waitFor(invitee);
    assert.ok(first, 'an invitation email was sent');
    assert.ok(first.subject.includes(`owner ${fx.run}`), 'it names who invited');
    const token1 = first.text.match(/token=([A-Za-z0-9]+)/)?.[1];
    assert.equal(token1, inv.json.data.rawToken, 'the emailed link is the same one the admin gets to share');

    const resend = await call('POST', `/workspaces/${fx.workspaceA}/invitations/${inv.json.data.invitationId}/resend`, undefined, cookie);
    assert.equal(resend.status, 200);
    const second = (await waitFor(invitee, 2))[1];
    const token2 = second.text.match(/token=([A-Za-z0-9]+)/)?.[1];
    assert.ok(token2 && token2 !== token1, 'resending issues a fresh secret');
    assert.equal(token2, resend.json.data.rawToken);
  });

  it('the contact form notifies the team inbox with the sender as reply-to, and stays quiet for bots', async () => {
    process.env.CONTACT_INBOX = 'team@example.test';
    try {
      const sender = `visitor.${run}@veyro-test.io`;
      const ok = await call('POST', '/contact', { name: 'Vi Sitor', email: sender, topic: 'QUESTION', message: 'Do you support Arabic?' });
      assert.equal(ok.status, 201);
      const [m] = await waitFor('team@example.test');
      assert.ok(m, 'the team was notified');
      assert.equal(m.replyTo, sender);
      assert.match(m.text, /Do you support Arabic\?/);

      const before = mail.sent.length;
      await call('POST', '/contact', { name: 'Bot', email: `bot.${run}@veyro-test.io`, topic: 'OTHER', message: 'Buy now please', website: 'http://spam.test' });
      await new Promise((r) => setTimeout(r, 400));
      assert.equal(mail.sent.length, before, 'honeypot hits send nothing');
    } finally {
      delete process.env.CONTACT_INBOX;
    }
  });
});
