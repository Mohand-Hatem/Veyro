import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AvatarType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AvatarProcessor } from '../storage/avatar-processor';
import { CloudinaryService } from '../storage/cloudinary.service';
import { IDENTITY, toIdentity } from './identity';
import { AvatarPreset, presetUrl } from './avatar-presets';

/** Days a removed photo is kept (private) before it is deleted for good. */
export const AVATAR_RETENTION_DAYS = 30;
const PURGE_BATCH = 200;

/** Profile pictures (step 5.9a). The only code that writes the avatar columns together, so they never disagree. */
@Injectable()
export class AvatarService {
  private readonly log = new Logger(AvatarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CloudinaryService,
    private readonly processor: AvatarProcessor,
  ) {}

  /** A new photo: validated and shrunk by the server, then stored over the person's previous one. */
  async upload(userId: string, body: Buffer) {
    const webp = await this.processor.process(body);
    const url = await this.storage.uploadAvatar(userId, webp);
    const before = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarRemovedAt: true } });
    if (!before) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'User not found.' });
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url, avatarType: AvatarType.UPLOAD, avatarPresetKey: null, avatarRemovedAt: null },
      select: IDENTITY,
    });
    // The new photo replaces the removed one, so the hidden copy has no reason to live on.
    if (before.avatarRemovedAt) await this.storage.destroyHiddenAvatar(userId).catch((e) => this.log.warn(`Could not delete a hidden avatar: ${e?.message}`));
    return toIdentity(updated);
  }

  /** Back to initials. */
  remove(userId: string) {
    return this.switchTo(userId, { avatarUrl: null, avatarType: AvatarType.INITIALS, avatarPresetKey: null });
  }

  /** One of the five illustrated avatars. Nothing is uploaded: the picture is a file of the app itself. */
  setPreset(userId: string, key: AvatarPreset) {
    return this.switchTo(userId, { avatarUrl: presetUrl(key), avatarType: AvatarType.PRESET, avatarPresetKey: key });
  }

  /**
   * Replaces the current picture by initials or a preset. A photo we stored is hidden and kept for the retention period (it is
   * not shown or reachable meanwhile); a Google or GitHub photo, an earlier preset or initials are only unlinked.
   */
  private async switchTo(userId: string, to: { avatarUrl: string | null; avatarType: AvatarType; avatarPresetKey: string | null }) {
    const current = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    if (!current) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'User not found.' });
    const hiddenAt = this.storage.ownsAvatar(current.avatarUrl, userId) ? await this.retireStoredPhoto(userId) : null;
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { ...to, ...(hiddenAt ? { avatarRemovedAt: hiddenAt } : {}) }, select: IDENTITY });
    return toIdentity(updated);
  }

  /**
   * Makes a stored photo private. Returns when it was hidden, or null if nothing is kept: when hiding fails the public copy is
   * deleted instead, because a photo its owner removed must never stay reachable.
   */
  private async retireStoredPhoto(userId: string): Promise<Date | null> {
    try {
      await this.storage.hideAvatar(userId);
      return new Date();
    } catch (e) {
      this.log.warn(`Could not hide an avatar, deleting it instead: ${(e as Error)?.message}`);
      await this.storage.destroyAvatar(userId).catch((e2) => this.log.error(`Could not delete an avatar either: ${e2?.message}`));
      return null;
    }
  }

  /**
   * Retention: deletes hidden photos removed more than `days` ago. Bounded per run; a failure leaves the row to be retried by the
   * next run. Scheduled in Phase 6 (there is no scheduler yet), safe to call any time.
   */
  async purgeRemoved(days = AVATAR_RETENTION_DAYS, now = new Date()) {
    const cutoff = new Date(now.getTime() - days * 86_400_000);
    const due = await this.prisma.user.findMany({ where: { avatarRemovedAt: { lt: cutoff } }, select: { id: true }, take: PURGE_BATCH });
    let purged = 0;
    let failed = 0;
    for (const { id } of due) {
      try {
        await this.storage.destroyHiddenAvatar(id);
        await this.prisma.user.update({ where: { id }, data: { avatarRemovedAt: null } });
        purged++;
      } catch (e) {
        failed++;
        this.log.warn(`Avatar purge failed for one user, will retry: ${(e as Error)?.message}`);
      }
    }
    return { purged, failed };
  }
}
