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
import { CONTACT_MAX_PER_EMAIL, CONTACT_MAX_PER_NETWORK } from '../src/modules/contact/contact.service';

/** CS-10 / ADR-017: the public Contact us form (no sign-in), with spam protection. */
describe('CS-10: public contact form', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const mail = (label: string) => `${label}.${run}.cs10@veyro-test.io`;
  const code = (r: { json: any }) => r.json?.error?.code ?? r.json?.code ?? r.json?.data?.code;
  const send = async (body: object) => {
    const res = await fetch(`${base}/contact`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); // deliberately no cookie
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const valid = (label: string, extra: object = {}) => ({ name: 'Mona Younis', email: mail(label), topic: 'QUESTION', message: 'How do I move a project to another workspace?', ...extra });
  const rows = (label: string) => prisma.contactMessage.findMany({ where: { email: mail(label) } });

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
    await prisma.contactMessage.deleteMany({ where: { email: { endsWith: '.cs10@veyro-test.io' } } });
  });

  after(async () => {
    try {
      await prisma.contactMessage.deleteMany({ where: { email: { endsWith: '.cs10@veyro-test.io' } } });
    } finally {
      await app.close();
    }
  });

  it('accepts a message from someone who is not signed in and stores it as NEW', async () => {
    const r = await send(valid('ok', { name: '  Mona Younis  ', email: mail('ok').toUpperCase() }));
    assert.strictEqual(r.status, 201);
    assert.deepEqual(r.json.data, { received: true });
    const [row] = await rows('ok');
    assert.ok(row, 'saved');
    assert.deepEqual([row.name, row.email, row.topic, row.status], ['Mona Younis', mail('ok'), 'QUESTION', 'NEW']);
    assert.ok(/^[0-9a-f]{64}$/.test(row.ipHash), 'only a hash of the network address is kept');
    assert.ok(!row.ipHash.includes('127.0.0.1') && !row.ipHash.includes('::1'));
  });

  it('rejects bad input and unknown fields with 400 and saves nothing', async () => {
    for (const bad of [
      valid('bad', { email: 'not-an-email' }),
      valid('bad', { name: 'A' }),
      valid('bad', { topic: 'SPAM' }),
      valid('bad', { message: 'too short' }),
      valid('bad', { message: 'x'.repeat(2001) }),
      valid('bad', { isAdmin: true }),
    ]) assert.strictEqual((await send(bad)).status, 400, JSON.stringify(bad).slice(0, 60));
    assert.strictEqual((await rows('bad')).length, 0);
  });

  it('strips control characters and keeps the text as plain data', async () => {
    await send(valid('ctl', { message: 'Hello\u0000 there\u0007, <b>bold</b> is just text.' }));
    const [row] = await rows('ctl');
    assert.strictEqual(row.message, 'Hello there, <b>bold</b> is just text.');
  });

  it('answers 201 to a bot that fills the hidden field, without saving anything', async () => {
    const r = await send(valid('bot', { website: 'http://spam.test' }));
    assert.strictEqual(r.status, 201);
    assert.deepEqual(r.json.data, { received: true });
    assert.strictEqual((await rows('bot')).length, 0);
  });

  it(`limits one email to ${CONTACT_MAX_PER_EMAIL} messages an hour and leaves other senders alone`, async () => {
    for (let i = 0; i < CONTACT_MAX_PER_EMAIL; i++) assert.strictEqual((await send(valid('rate'))).status, 201, `message ${i + 1}`);
    const over = await send(valid('rate'));
    assert.strictEqual(over.status, 429);
    assert.strictEqual(code(over), 'CONTACT_RATE_LIMITED');
    assert.strictEqual((await rows('rate')).length, CONTACT_MAX_PER_EMAIL);
    assert.strictEqual((await send(valid('other'))).status, 201);
  });

  it(`limits one network address to ${CONTACT_MAX_PER_NETWORK} messages an hour even with different emails`, async () => {
    let limited: { status: number; json: any } | null = null;
    for (let i = 0; i < CONTACT_MAX_PER_NETWORK + 2 && !limited; i++) {
      const r = await send(valid(`net${i}`));
      if (r.status === 429) limited = r;
    }
    assert.ok(limited, 'the network limit must trigger');
    assert.strictEqual(code(limited!), 'CONTACT_RATE_LIMITED');
    const total = await prisma.contactMessage.count({ where: { email: { endsWith: '.cs10@veyro-test.io' } } });
    assert.ok(total <= CONTACT_MAX_PER_NETWORK, `stored ${total}`);
  });
});
