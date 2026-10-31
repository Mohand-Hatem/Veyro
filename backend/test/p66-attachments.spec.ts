import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { CloudinaryService, signParams, type AttachmentResource } from '../src/modules/storage/cloudinary.service';
import { TaskAttachmentsService } from '../src/modules/tasks/task-attachments.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

const CLOUD = 'demo-cloud';
const KEY = '123456789012345';
const SECRET = 'attachment-test-secret';

describe('task attachments: links and kinds (no network)', () => {
  const saved = { ...process.env };
  before(() => Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: CLOUD, CLOUDINARY_API_KEY: KEY, CLOUDINARY_API_SECRET: SECRET }));
  after(() => { process.env = saved; });

  it('decides how a file is stored from its name, and refuses the rest', () => {
    assert.deepStrictEqual(TaskAttachmentsService.kindOf('Mockup.PNG'), { ext: 'png', resourceType: 'image' });
    assert.deepStrictEqual(TaskAttachmentsService.kindOf('brief.final.pdf'), { ext: 'pdf', resourceType: 'raw' });
    for (const bad of ['script.exe', 'page.html', 'image.svg', 'noextension', 'archive.zip']) assert.strictEqual(TaskAttachmentsService.kindOf(bad), null, bad);
  });

  it('signs an upload for exactly one private public id', () => {
    const { url, fields } = new CloudinaryService().signAttachmentUpload('Veyro/tasks/t1/abc.pdf', 'raw');
    assert.strictEqual(url, `https://api.cloudinary.com/v1_1/${CLOUD}/raw/upload`);
    assert.strictEqual(fields.type, 'private');
    assert.strictEqual(fields.public_id, 'Veyro/tasks/t1/abc.pdf');
    assert.strictEqual(fields.api_key, KEY);
    const { api_key: _k, signature, ...signed } = fields;
    assert.strictEqual(signature, signParams(signed, SECRET), 'the signature covers every field Cloudinary checks');
    assert.ok(new CloudinaryService().signAttachmentUpload('Veyro/tasks/t1/abc', 'image').fields.allowed_formats.includes('png'), 'pictures are limited to picture formats');
  });

  it('builds a signed, expiring private download link the way the Cloudinary SDK does', () => {
    const link = new URL(new CloudinaryService().attachmentUrl('Veyro/tasks/t1/abc', 'image', 'png', { download: true, seconds: 600 }));
    assert.strictEqual(link.origin + link.pathname, `https://api.cloudinary.com/v1_1/${CLOUD}/image/download`);
    const p = Object.fromEntries(link.searchParams);
    assert.strictEqual(p.type, 'private');
    assert.strictEqual(p.format, 'png');
    assert.strictEqual(p.attachment, 'true');
    assert.ok(Number(p.expires_at) - Number(p.timestamp) === 600, 'it expires after ten minutes');
    const { signature, api_key: _k, ...signed } = p;
    assert.strictEqual(signature, signParams(signed, SECRET));
    const raw = Object.fromEntries(new URL(new CloudinaryService().attachmentUrl('Veyro/tasks/t1/abc.pdf', 'raw', 'pdf', { download: false, seconds: 600 })).searchParams);
    assert.strictEqual(raw.format, undefined, "a raw file's format is in its id");
    assert.strictEqual(raw.attachment, undefined);
  });
});

/** The real storage service with only the calls that reach Cloudinary replaced by an in-memory shelf. */
class FakeStorage extends CloudinaryService {
  stored = new Map<string, { bytes: number; format: string }>();
  destroyed: string[] = [];
  failDestroy = false;
  async attachmentInfo(publicId: string) {
    return this.stored.get(publicId) ?? null;
  }
  async destroyAttachment(publicId: string, _type: AttachmentResource) {
    if (this.failDestroy) throw new Error('cloudinary is down');
    this.destroyed.push(publicId);
    this.stored.delete(publicId);
  }
}

describe('task attachments (real app, Cloudinary faked)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  let task: string;
  const storage = new FakeStorage();
  const cookies: Record<string, string> = {};
  const saved = { ...process.env };

  const login = async (label: string) => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' }) });
    assert.strictEqual(res.status, 200, `login ${label}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (who: string, method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies[who], 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  /** Signs, "uploads" (puts the file on the fake shelf) and confirms, as the browser would. */
  const upload = async (who: string, fileName: string, stored = { bytes: 2048, format: fileName.split('.').pop()!.toLowerCase() }) => {
    const signed = await call(who, 'POST', `/tasks/${task}/attachments/sign`, { fileName });
    assert.strictEqual(signed.status, 200, JSON.stringify(signed.json));
    storage.stored.set(signed.json.data.publicId, stored);
    return call(who, 'POST', `/tasks/${task}/attachments`, { publicId: signed.json.data.publicId, fileName });
  };

  before(async () => {
    Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: CLOUD, CLOUDINARY_API_KEY: KEY, CLOUDINARY_API_SECRET: SECRET });
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(CloudinaryService).useValue(storage).compile();
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
    for (const l of ['owner', 'admin2', 'membera', 'memberb']) cookies[l] = await login(l);
  });

  beforeEach(async () => {
    task = (await prisma.task.create({ data: { projectId: fx.projectA1, title: `Files ${fx.run}`, authorId: fx.users.owner, assigneeId: fx.users.memberA } })).id;
    storage.failDestroy = false;
  });

  after(async () => {
    process.env = saved;
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  it('the creator adds a file; the creator, the assignee and admins get links, other members only the count', async () => {
    const added = await upload('owner', 'Brief.pdf');
    assert.strictEqual(added.status, 201, JSON.stringify(added.json));
    assert.strictEqual(added.json.data.fileName, 'Brief.pdf');
    assert.match(added.json.data.downloadUrl, /\/raw\/download\?/);

    for (const who of ['owner', 'admin2', 'membera']) {
      const d = (await call(who, 'GET', `/tasks/${task}`)).json.data;
      assert.strictEqual(d.attachmentCount, 1, who);
      assert.strictEqual(d.attachments.length, 1, `${who} can open the file`);
      assert.ok(d.attachments[0].downloadUrl, `${who} gets a link`);
      assert.strictEqual(d.viewer.canOpenFiles, true, who);
    }
    assert.strictEqual((await call('membera', 'GET', `/tasks/${task}`)).json.data.viewer.canUpload, false, 'the assignee does not upload');

    // memberB is in the workspace but not on this task's project at all: the task is hidden (404). A project member who is
    // neither creator nor assignee is the real "count only" case.
    await prisma.projectMember.create({ data: { projectId: fx.projectA1, userId: fx.users.memberB, role: 'MEMBER' } });
    try {
      const d = (await call('memberb', 'GET', `/tasks/${task}`)).json.data;
      assert.strictEqual(d.attachmentCount, 1);
      assert.deepStrictEqual(d.attachments, [], 'no names, no links');
      assert.strictEqual(d.viewer.canOpenFiles, false);
      assert.ok(!JSON.stringify(d).includes('download'), 'not a single link leaks');
    } finally {
      await prisma.projectMember.delete({ where: { projectId_userId: { projectId: fx.projectA1, userId: fx.users.memberB } } });
    }
  });

  it('the assignee cannot add or remove files', async () => {
    const r = await call('membera', 'POST', `/tasks/${task}/attachments/sign`, { fileName: 'notes.pdf' });
    assert.strictEqual(r.status, 403);
    const added = await upload('owner', 'spec.docx');
    assert.strictEqual((await call('membera', 'DELETE', `/tasks/${task}/attachments/${added.json.data.id}`)).status, 403);
  });

  it('refuses kinds of file that are not allowed, before and after the upload', async () => {
    const r = await call('owner', 'POST', `/tasks/${task}/attachments/sign`, { fileName: 'virus.exe' });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.json.error.code, 'FILE_TYPE_NOT_ALLOWED');
    // A picture id whose stored file turned out to be something else is deleted again.
    const signed = (await call('owner', 'POST', `/tasks/${task}/attachments/sign`, { fileName: 'photo.png' })).json.data;
    storage.stored.set(signed.publicId, { bytes: 100, format: 'svg' });
    const c = await call('owner', 'POST', `/tasks/${task}/attachments`, { publicId: signed.publicId, fileName: 'photo.png' });
    assert.strictEqual(c.json.error.code, 'FILE_TYPE_NOT_ALLOWED');
    assert.ok(storage.destroyed.includes(signed.publicId), 'the refused file is removed from storage');
  });

  it('refuses a file over 10 MB and removes it from storage', async () => {
    const big = await upload('owner', 'huge.pdf', { bytes: 10 * 1024 * 1024 + 1, format: 'pdf' });
    assert.strictEqual(big.status, 400);
    assert.strictEqual(big.json.error.code, 'FILE_TOO_LARGE');
    assert.strictEqual(await prisma.taskAttachment.count({ where: { taskId: task } }), 0);
  });

  it('only records files signed for this task that really arrived', async () => {
    const otherTask = (await prisma.task.create({ data: { projectId: fx.projectA1, title: `Other ${fx.run}`, authorId: fx.users.owner } })).id;
    const signedElsewhere = (await call('owner', 'POST', `/tasks/${otherTask}/attachments/sign`, { fileName: 'a.pdf' })).json.data.publicId;
    storage.stored.set(signedElsewhere, { bytes: 10, format: 'pdf' });
    const moved = await call('owner', 'POST', `/tasks/${task}/attachments`, { publicId: signedElsewhere, fileName: 'a.pdf' });
    assert.strictEqual(moved.json.error.code, 'INVALID_ATTACHMENT', "another task's file cannot be claimed");

    const signed = (await call('owner', 'POST', `/tasks/${task}/attachments/sign`, { fileName: 'b.pdf' })).json.data.publicId;
    const ghost = await call('owner', 'POST', `/tasks/${task}/attachments`, { publicId: signed, fileName: 'b.pdf' });
    assert.strictEqual(ghost.json.error.code, 'ATTACHMENT_NOT_UPLOADED', 'nothing was uploaded under that id');

    storage.stored.set(signed, { bytes: 10, format: 'pdf' });
    const first = await call('owner', 'POST', `/tasks/${task}/attachments`, { publicId: signed, fileName: 'b.pdf' });
    const again = await call('owner', 'POST', `/tasks/${task}/attachments`, { publicId: signed, fileName: 'b.pdf' });
    assert.strictEqual(again.json.data.id, first.json.data.id, 'confirming twice records it once');
    assert.strictEqual(await prisma.taskAttachment.count({ where: { taskId: task } }), 1);
  });

  it('holds at most 10 files on a task', async () => {
    for (let i = 0; i < 10; i++) assert.strictEqual((await upload('admin2', `f${i}.txt`)).status, 201);
    const r = await call('admin2', 'POST', `/tasks/${task}/attachments/sign`, { fileName: 'one-more.txt' });
    assert.strictEqual(r.json.error.code, 'ATTACHMENT_LIMIT');
    assert.strictEqual((await call('owner', 'GET', `/tasks/${task}`)).json.data.viewer.canUpload, false);
  });

  it('removing deletes the stored file first, and keeps the row when storage fails', async () => {
    const id = (await upload('owner', 'old.pdf')).json.data.id;
    storage.failDestroy = true;
    assert.strictEqual((await call('owner', 'DELETE', `/tasks/${task}/attachments/${id}`)).status, 500);
    assert.strictEqual(await prisma.taskAttachment.count({ where: { id } }), 1, 'still listed, so it can be removed later');
    storage.failDestroy = false;
    assert.strictEqual((await call('admin2', 'DELETE', `/tasks/${task}/attachments/${id}`)).status, 200);
    assert.strictEqual(await prisma.taskAttachment.count({ where: { id } }), 0);
    const audit = await prisma.auditLog.findMany({ where: { taskId: task }, select: { action: true } });
    assert.deepStrictEqual(audit.map((a) => a.action).sort(), ['ATTACHMENT_ADDED', 'ATTACHMENT_REMOVED']);
  });
});
