import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import cookieParser from 'cookie-parser';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { CloudinaryService } from '../src/modules/storage/cloudinary.service';
import { AvatarProcessor, AVATAR_MAX_BYTES } from '../src/modules/storage/avatar-processor';
import { AvatarService } from '../src/modules/users/avatar.service';
import { validateEnv } from '../src/config/env.validation';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

const CLOUD = 'demo-cloud';
const DAY = 86_400_000;

/** A photo-like picture (a gradient disc on a blue ground), optionally carrying camera and owner data. */
const photo = (opts: { exif?: boolean } = {}) => {
  const svg = '<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g"><stop offset="0" stop-color="#fcd34d"/><stop offset="1" stop-color="#ef4444"/></radialGradient></defs><circle cx="600" cy="400" r="300" fill="url(#g)"/></svg>';
  let img = sharp({ create: { width: 1200, height: 800, channels: 3, background: '#3b82f6' } }).composite([{ input: Buffer.from(svg) }]);
  if (opts.exif) img = img.withExif({ IFD0: { Copyright: 'secret-copyright', ImageDescription: 'my home address' } });
  return img.jpeg({ quality: 90 }).toBuffer();
};

/** The real storage service with only the calls that reach Cloudinary replaced by an in-memory shelf. */
class FakeStorage extends CloudinaryService {
  uploads = new Map<string, Buffer>();
  hidden = new Set<string>();
  destroyedPublic: string[] = [];
  destroyedHidden: string[] = [];
  failHide = false;
  failHiddenDestroyFor = new Set<string>();
  async uploadAvatar(userId: string, webp: Buffer) {
    this.uploads.set(userId, webp);
    return `https://res.cloudinary.com/${CLOUD}/image/upload/v1700000000/${this.avatarPublicId(userId)}.webp`;
  }
  async hideAvatar(userId: string) {
    if (this.failHide) throw new Error('cloudinary is down');
    this.hidden.add(userId);
  }
  async destroyAvatar(userId: string) {
    this.destroyedPublic.push(userId);
  }
  async destroyHiddenAvatar(userId: string) {
    this.destroyedHidden.push(userId);
    if (this.failHiddenDestroyFor.has(userId)) throw new Error('cloudinary is down');
    this.hidden.delete(userId);
  }
  reset() {
    this.destroyedPublic.length = 0;
    this.destroyedHidden.length = 0;
    this.failHide = false;
    this.failHiddenDestroyFor.clear();
  }
}

describe('5.9a: AvatarProcessor (real sharp, real pictures)', () => {
  const processor = new AvatarProcessor();
  const rejects = (input: Buffer, code: string, status: number) =>
    assert.rejects(processor.process(input), (e: any) => e.getStatus() === status && e.getResponse().code === code);

  it('turns a photo into a 256px square WebP of 30 KB or less, with no metadata left', async () => {
    const input = await photo({ exif: true });
    assert.ok((await sharp(input).metadata()).exif, 'the test picture really carries EXIF data');
    const out = await processor.process(input);
    const meta = await sharp(out).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 256, 256]);
    assert.strictEqual(meta.exif, undefined);
    assert.ok(out.length <= 30 * 1024, `size ${out.length}`);
    assert.ok(!out.toString('latin1').includes('secret-copyright') && !out.toString('latin1').includes('home address'));
  });

  it('turns a picture upright from its EXIF orientation before cropping', async () => {
    const w = 400;
    const h = 200;
    const raw = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(x < w / 2 ? [230, 20, 20] : [20, 20, 230], (y * w + x) * 3); // left half red, right half blue
    const input = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).withMetadata({ orientation: 6 }).toBuffer();
    const { data } = await sharp(await processor.process(input)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => [data[(y * 256 + x) * 3], data[(y * 256 + x) * 3 + 2]]; // [red, blue]
    const [topR, topB] = px(128, 8);
    const [botR, botB] = px(128, 247);
    assert.ok(topR > topB, 'orientation 6 puts the left (red) half on top');
    assert.ok(botB > botR, 'and the right (blue) half at the bottom');
  });

  it('lowers the quality for a picture that is hard to compress, so it comes out smaller than the first attempt', async () => {
    const n = 300; // close to the final size, so the noise survives the shrink instead of averaging out
    const input = await sharp(randomBytes(n * n * 3), { raw: { width: n, height: n, channels: 3 } }).jpeg({ quality: 60 }).toBuffer();
    assert.ok(input.length < AVATAR_MAX_BYTES);
    const first = await sharp(input).rotate().resize(256, 256, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 80, effort: 4 }).toBuffer();
    assert.ok(first.length > 30 * 1024, `the first attempt is over the target (${first.length} bytes), so the ladder has work to do`);
    const out = await processor.process(input);
    assert.ok(out.length < first.length, `${out.length} vs ${first.length}`);
    const meta = await sharp(out).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 256, 256]);
  });

  it('accepts PNG and WebP inputs too', async () => {
    const base = sharp({ create: { width: 300, height: 300, channels: 3, background: '#22c55e' } });
    for (const input of [await base.clone().png().toBuffer(), await base.clone().webp().toBuffer()]) {
      assert.strictEqual((await sharp(await processor.process(input)).metadata()).format, 'webp');
    }
  });

  it('refuses what is not a readable JPEG, PNG or WebP', async () => {
    await rejects(Buffer.from('this is plain text renamed to .jpg'), 'AVATAR_INVALID_IMAGE', 400);
    await rejects(Buffer.alloc(0), 'AVATAR_INVALID_IMAGE', 400);
    const jpeg = await photo();
    await rejects(jpeg.subarray(0, Math.floor(jpeg.length / 2)), 'AVATAR_INVALID_IMAGE', 400); // cut off
    await rejects(await sharp({ create: { width: 50, height: 50, channels: 3, background: '#000' } }).gif().toBuffer(), 'AVATAR_INVALID_IMAGE', 400);
  });

  it('refuses a small file that would unpack into a huge picture, and anything over 2 MB', async () => {
    const bomb = await sharp({ create: { width: 6000, height: 6000, channels: 3, background: '#fff' } }).png().toBuffer();
    assert.ok(bomb.length < AVATAR_MAX_BYTES, `the bomb is only ${bomb.length} bytes on the wire`);
    await rejects(bomb, 'AVATAR_INVALID_IMAGE', 400);
    await rejects(Buffer.alloc(AVATAR_MAX_BYTES + 1), 'AVATAR_TOO_LARGE', 413);
  });
});

describe('5.9a: profile photo (real app, Cloudinary faked)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let avatars: AvatarService;
  let fx: Fixture;
  const storage = new FakeStorage();
  const cookies: Record<string, string> = {};
  const saved = { ...process.env };

  const login = async (label: string) => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' }) });
    assert.strictEqual(res.status, 200, `login ${label}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (who: string | null, method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, { method, headers: { ...(who ? { cookie: cookies[who] } : {}), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const put = async (who: string | null, bytes: Buffer | string, type = 'image/jpeg') => {
    const res = await fetch(`${base}/users/me/avatar`, { method: 'PUT', headers: { ...(who ? { cookie: cookies[who] } : {}), 'content-type': type }, body: bytes as any });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const code = (r: { json: any }) => r.json?.error?.code ?? r.json?.code;
  const row = (userId: string) => prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const urlOf = (userId: string) => `https://res.cloudinary.com/${CLOUD}/image/upload/v1700000000/Veyro/avatars/${userId}.webp`;

  before(async () => {
    Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: CLOUD, CLOUDINARY_API_KEY: '123456789012345', CLOUDINARY_API_SECRET: 'secret' });
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
    avatars = app.get(AvatarService);
    fx = await buildFixture(prisma);
    for (const l of ['owner', 'membera', 'memberb']) cookies[l] = await login(l);
  });

  after(async () => {
    process.env = saved;
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('PUT /users/me/avatar', () => {
    it('processes the picture on the server and stores only the small WebP', async () => {
      const r = await put('membera', await photo({ exif: true }));
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.data.avatarUrl, urlOf(fx.users.memberA));
      assert.deepEqual([r.json.data.avatarType, r.json.data.avatarPresetKey], ['UPLOAD', null]);
      const sent = storage.uploads.get(fx.users.memberA)!;
      const meta = await sharp(sent).metadata();
      assert.deepEqual([meta.format, meta.width, meta.height, meta.exif], ['webp', 256, 256, undefined]);
      const u = await row(fx.users.memberA);
      assert.deepEqual([u.avatarUrl, u.avatarType, u.avatarPresetKey, u.avatarRemovedAt], [urlOf(fx.users.memberA), 'UPLOAD', null, null]);
      assert.strictEqual((await call('membera', 'GET', '/users/me/profile')).json.data.avatarUrl, urlOf(fx.users.memberA));
      assert.strictEqual((await call('membera', 'GET', '/auth/me')).json.data.user.avatarUrl, urlOf(fx.users.memberA));
    });

    it('refuses a wrong content type, an empty body, a text file and a file over 2 MB, with clear codes', async () => {
      const json = await call('memberb', 'PUT', '/users/me/avatar', { avatarUrl: 'https://evil.test/x.png' });
      assert.deepEqual([json.status, code(json)], [400, 'AVATAR_INVALID_IMAGE']);
      const empty = await put('memberb', '');
      assert.deepEqual([empty.status, code(empty)], [400, 'AVATAR_INVALID_IMAGE']);
      const text = await put('memberb', 'this is not a picture');
      assert.deepEqual([text.status, code(text)], [400, 'AVATAR_INVALID_IMAGE']);
      const big = await put('memberb', Buffer.alloc(AVATAR_MAX_BYTES + 1));
      assert.deepEqual([big.status, code(big)], [413, 'AVATAR_TOO_LARGE']);
      assert.strictEqual((await row(fx.users.memberB)).avatarUrl, null);
      assert.ok(!storage.uploads.has(fx.users.memberB), 'nothing reached storage');
    });

    it('needs a signed-in person, and only ever touches the caller', async () => {
      assert.strictEqual((await put(null, await photo())).status, 401);
      assert.strictEqual((await row(fx.users.memberB)).avatarUrl, null);
    });

    it('replaces the previous photo under the same id', async () => {
      assert.strictEqual((await put('membera', await photo())).status, 200);
      assert.strictEqual((await row(fx.users.memberA)).avatarUrl, urlOf(fx.users.memberA));
    });
  });

  describe('DELETE /users/me/avatar (soft delete)', () => {
    it('goes back to initials, keeps the file hidden and records when', async () => {
      storage.reset();
      const r = await call('membera', 'DELETE', '/users/me/avatar');
      assert.strictEqual(r.status, 200);
      assert.deepEqual([r.json.data.avatarUrl, r.json.data.avatarType], [null, 'INITIALS']);
      assert.ok(storage.hidden.has(fx.users.memberA), 'the file was hidden, not deleted');
      assert.deepEqual(storage.destroyedPublic, []);
      const u = await row(fx.users.memberA);
      assert.deepEqual([u.avatarUrl, u.avatarType, u.avatarPresetKey], [null, 'INITIALS', null]);
      assert.ok(u.avatarRemovedAt && Date.now() - u.avatarRemovedAt.getTime() < 60_000);
    });

    it('deletes the hidden copy when a new photo replaces it', async () => {
      storage.reset();
      assert.strictEqual((await put('membera', await photo())).status, 200);
      assert.deepEqual(storage.destroyedHidden, [fx.users.memberA]);
      assert.strictEqual((await row(fx.users.memberA)).avatarRemovedAt, null);
    });

    it('only unlinks a Google or GitHub photo, never touching our storage', async () => {
      await prisma.user.update({ where: { id: fx.users.memberB }, data: { avatarUrl: 'https://lh3.googleusercontent.com/a/photo', avatarType: 'UPLOAD' } });
      storage.reset();
      assert.strictEqual((await call('memberb', 'DELETE', '/users/me/avatar')).status, 200);
      const u = await row(fx.users.memberB);
      assert.deepEqual([u.avatarUrl, u.avatarType, u.avatarRemovedAt], [null, 'INITIALS', null]);
      assert.deepEqual([storage.hidden.has(fx.users.memberB), storage.destroyedPublic, storage.destroyedHidden], [false, [], []]);
    });

    it('deletes the public copy when hiding it fails, so a removed photo never stays reachable', async () => {
      storage.reset();
      await put('owner', await photo());
      storage.failHide = true;
      const r = await call('owner', 'DELETE', '/users/me/avatar');
      assert.strictEqual(r.status, 200);
      assert.deepEqual(storage.destroyedPublic, [fx.users.owner]);
      const u = await row(fx.users.owner);
      assert.deepEqual([u.avatarUrl, u.avatarRemovedAt], [null, null], 'nothing is kept, so there is nothing to purge later');
    });

    it('does not accept a link to someone else\'s image as ours (ownership needs our cloud and the person\'s own id)', () => {
      const real = new CloudinaryService();
      const mine = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/Veyro/avatars/u1.webp`;
      assert.ok(real.ownsAvatar(mine, 'u1'));
      assert.ok(!real.ownsAvatar(mine, 'u2'));
      assert.ok(!real.ownsAvatar(`https://res.cloudinary.com/other-cloud/image/upload/v1/Veyro/avatars/u1.webp`, 'u1'));
      assert.ok(!real.ownsAvatar('https://evil.test/Veyro/avatars/u1.webp', 'u1'));
      assert.ok(!real.ownsAvatar(null, 'u1'));
    });
  });

  describe('PUT /users/me/avatar/preset (illustrated avatars)', () => {
    const putPreset = (who: string | null, body: object) => call(who, 'PUT', '/users/me/avatar/preset', body);

    it('picks one of the five avatars without touching storage, and the profile reports it', async () => {
      storage.reset();
      const r = await putPreset('memberb', { key: 'sage' });
      assert.strictEqual(r.status, 200);
      assert.deepEqual([r.json.data.avatarUrl, r.json.data.avatarType, r.json.data.avatarPresetKey], ['/avatars/presets/sage.svg', 'PRESET', 'sage']);
      const u = await row(fx.users.memberB);
      assert.deepEqual([u.avatarUrl, u.avatarType, u.avatarPresetKey, u.avatarRemovedAt], ['/avatars/presets/sage.svg', 'PRESET', 'sage', null]);
      const profile = (await call('memberb', 'GET', '/users/me/profile')).json.data;
      assert.deepEqual([profile.avatarUrl, profile.avatarType, profile.avatarPresetKey], ['/avatars/presets/sage.svg', 'PRESET', 'sage']);
      assert.deepEqual([storage.destroyedPublic, storage.destroyedHidden, storage.hidden.has(fx.users.memberB)], [[], [], false]);
    });

    it('refuses an unknown key, a missing key and a signed-out caller', async () => {
      assert.strictEqual((await putPreset('memberb', { key: 'purple-dragon' })).status, 400);
      assert.strictEqual((await putPreset('memberb', {})).status, 400);
      assert.strictEqual((await putPreset('memberb', { key: 'sage', avatarUrl: 'https://evil.test/x.png' })).status, 400);
      assert.strictEqual((await putPreset(null, { key: 'sage' })).status, 401);
      assert.strictEqual((await row(fx.users.memberB)).avatarPresetKey, 'sage', 'nothing changed');
    });

    it('hides a stored photo when an avatar replaces it, and a later upload removes that hidden copy', async () => {
      storage.reset();
      assert.strictEqual((await put('membera', await photo())).status, 200);
      storage.reset();
      const r = await putPreset('membera', { key: 'sky' });
      assert.strictEqual(r.status, 200);
      assert.ok(storage.hidden.has(fx.users.memberA), 'the photo was hidden, not deleted');
      assert.deepEqual(storage.destroyedPublic, []);
      let u = await row(fx.users.memberA);
      assert.deepEqual([u.avatarUrl, u.avatarType, u.avatarPresetKey], ['/avatars/presets/sky.svg', 'PRESET', 'sky']);
      assert.ok(u.avatarRemovedAt);
      storage.reset();
      assert.strictEqual((await put('membera', await photo())).status, 200);
      assert.deepEqual(storage.destroyedHidden, [fx.users.memberA]);
      u = await row(fx.users.memberA);
      assert.deepEqual([u.avatarType, u.avatarPresetKey, u.avatarRemovedAt], ['UPLOAD', null, null]);
    });

    it('leaves a Google or GitHub photo alone in storage, and going from an avatar to initials touches nothing there either', async () => {
      await prisma.user.update({ where: { id: fx.users.owner }, data: { avatarUrl: 'https://lh3.googleusercontent.com/a/photo', avatarType: 'UPLOAD', avatarPresetKey: null, avatarRemovedAt: null } });
      storage.reset();
      assert.strictEqual((await putPreset('owner', { key: 'rose' })).status, 200);
      assert.strictEqual((await call('owner', 'DELETE', '/users/me/avatar')).status, 200);
      const u = await row(fx.users.owner);
      assert.deepEqual([u.avatarUrl, u.avatarType, u.avatarPresetKey, u.avatarRemovedAt], [null, 'INITIALS', null, null]);
      assert.deepEqual([storage.hidden.has(fx.users.owner), storage.destroyedPublic, storage.destroyedHidden], [false, [], []]);
    });
  });

  describe('retention purge', () => {
    it('deletes hidden photos removed more than 30 days ago, keeps newer ones, and retries failures', async () => {
      storage.reset();
      const set = (id: string, days: number | null) => prisma.user.update({ where: { id }, data: { avatarRemovedAt: days === null ? null : new Date(Date.now() - days * DAY) } });
      await set(fx.users.memberA, 31); // due
      await set(fx.users.memberB, 10); // too recent
      await set(fx.users.owner, 40); // due, but storage fails
      storage.failHiddenDestroyFor.add(fx.users.owner);
      const result = await avatars.purgeRemoved();
      assert.deepEqual(result, { purged: 1, failed: 1 });
      assert.deepEqual([...storage.destroyedHidden].sort(), [fx.users.memberA, fx.users.owner].sort());
      assert.strictEqual((await row(fx.users.memberA)).avatarRemovedAt, null, 'purged');
      assert.ok((await row(fx.users.memberB)).avatarRemovedAt, 'kept: removed only 10 days ago');
      assert.ok((await row(fx.users.owner)).avatarRemovedAt, 'kept for the next run to retry');
      storage.reset();
      assert.deepEqual(await avatars.purgeRemoved(), { purged: 1, failed: 0 }, 'the retry works once storage is back');
    });
  });

  it('PATCH /users/me still refuses an avatarUrl: a photo only arrives through the upload', async () => {
    assert.strictEqual((await call('membera', 'PATCH', '/users/me', { avatarUrl: 'https://evil.test/a.png' })).status, 400);
  });

  it('limits photo uploads to 10 a minute', async () => {
    let last = 0;
    for (let i = 0; i < 14; i++) last = (await put('owner', 'x', 'text/plain')).status;
    assert.strictEqual(last, 429);
  });
});

describe('5.9a: production configuration', () => {
  const base = { JWT_SECRET: 'x'.repeat(40), NODE_ENV: 'production', RESEND_API_KEY: 're_x', EMAIL_FROM: 'Veyro <noreply@veyro.dev>', STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', STRIPE_PRICE_ID_PRO: 'p', STRIPE_PRICE_ID_ENTERPRISE: 'e', STRIPE_PRICE_ID_EPIC: 'x', GEMINI_API_KEY: 'k' };
  it('refuses to start in production without each Cloudinary setting, and starts with all three', () => {
    for (const missing of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      const cfg: Record<string, string> = { ...base, CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' };
      delete cfg[missing];
      assert.throws(() => validateEnv(cfg), new RegExp(missing));
    }
    assert.doesNotThrow(() => validateEnv({ ...base, CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' }));
  });
});
