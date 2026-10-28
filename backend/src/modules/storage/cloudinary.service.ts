import { createHash } from 'node:crypto';
import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';

const notConfigured = () =>
  new ServiceUnavailableException({ code: 'STORAGE_NOT_CONFIGURED', message: 'Photo upload is not set up yet.' });
const unavailable = (message = 'The photo service did not answer. Try again.') =>
  new BadGatewayException({ code: 'STORAGE_UNAVAILABLE', message });

/**
 * Cloudinary's signature: SHA-1 over the parameters sorted by name and joined as `a=1&b=2`, with the API secret appended.
 * `file`, `api_key`, `cloud_name` and `resource_type` are never part of it.
 */
export function signParams(params: Record<string, string | number>, secret: string): string {
  const joined = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(joined + secret).digest('hex');
}

/** The only place that talks to Cloudinary (plain fetch, no SDK). Everything it needs comes from the environment, so tests swap it out whole. */
@Injectable()
export class CloudinaryService {
  isConfigured(): boolean {
    return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  }

  private config() {
    const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
    if (!cloudName || !apiKey || !apiSecret) throw notConfigured();
    return { cloudName, apiKey, apiSecret };
  }

  /** Every file lives in a folder named after the product, so the Media Library shows `Veyro/avatars/...`. */
  private folder(): string {
    return (process.env.CLOUDINARY_FOLDER || 'Veyro').replace(/^\/+|\/+$/g, '');
  }

  /** One fixed id per person: a new photo overwrites the old one, and nobody can aim an upload at another person's image. */
  avatarPublicId(userId: string): string {
    return `${this.folder()}/avatars/${userId}`;
  }

  /** Where a photo waits, private, after its owner removed it (until the retention purge deletes it). */
  hiddenPublicId(userId: string): string {
    return `${this.folder()}/avatars-removed/${userId}`;
  }

  /** True only for a picture this app stored for that person (a Google or GitHub photo is someone else's URL and is never touched). */
  ownsAvatar(url: string | null, userId: string): boolean {
    if (!url || !process.env.CLOUDINARY_CLOUD_NAME) return false;
    return url.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`) && url.includes(`/${this.avatarPublicId(userId)}.`);
  }

  /** Stores the already-processed picture under this person's own id (replacing the previous one) and returns its public address. */
  async uploadAvatar(userId: string, webp: Buffer): Promise<string> {
    const { cloudName, apiKey, apiSecret } = this.config();
    const publicId = this.avatarPublicId(userId);
    const signed: Record<string, string> = {
      allowed_formats: 'webp',
      asset_folder: `${this.folder()}/avatars`,
      invalidate: 'true',
      overwrite: 'true',
      public_id: publicId,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const form = new FormData();
    for (const [k, v] of Object.entries(signed)) form.append(k, v);
    form.append('api_key', apiKey);
    form.append('signature', signParams(signed, apiSecret));
    form.append('file', new Blob([new Uint8Array(webp)], { type: 'image/webp' }), 'avatar.webp');
    const res = await this.send(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
    if (!res.ok) throw unavailable('The photo could not be stored. Try again.');
    const body = (await res.json()) as { version?: number; format?: string };
    if (!Number.isInteger(body.version) || typeof body.format !== 'string') throw unavailable('The photo service sent an unexpected answer.');
    return `https://res.cloudinary.com/${cloudName}/image/upload/v${body.version}/${publicId}.${body.format}`;
  }

  /** Soft delete: the file is kept but moved to Cloudinary's private delivery type under a different id, so its address stops working. */
  async hideAvatar(userId: string): Promise<void> {
    const { cloudName } = this.config();
    const res = await this.signedPost(`https://api.cloudinary.com/v1_1/${cloudName}/image/rename`, {
      from_public_id: this.avatarPublicId(userId),
      to_public_id: this.hiddenPublicId(userId),
      to_type: 'private',
      overwrite: 'true',
      invalidate: 'true',
    });
    if (!res.ok) throw unavailable('The photo could not be hidden.');
  }

  /** Deletes the public copy (used when hiding failed, so a removed photo never stays public). */
  async destroyAvatar(userId: string): Promise<void> {
    await this.destroy(this.avatarPublicId(userId), 'upload');
  }

  /** Deletes the private copy kept after a removal (retention purge, or the person uploaded a new photo). */
  async destroyHiddenAvatar(userId: string): Promise<void> {
    await this.destroy(this.hiddenPublicId(userId), 'private');
  }

  private async destroy(publicId: string, type: 'upload' | 'private'): Promise<void> {
    const { cloudName } = this.config();
    const res = await this.signedPost(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { public_id: publicId, type, invalidate: 'true' });
    if (!res.ok) throw unavailable('The photo could not be deleted.');
  }

  private signedPost(url: string, params: Record<string, string>): Promise<Response> {
    const { apiKey, apiSecret } = this.config();
    const signed = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
    return this.send(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...signed, api_key: apiKey, signature: signParams(signed, apiSecret) }),
    });
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch {
      throw unavailable();
    }
  }
}
