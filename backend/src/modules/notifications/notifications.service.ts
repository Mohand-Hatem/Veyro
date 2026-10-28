import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type NotifyInput = {
  type: NotificationType;
  recipientId: string;
  /** Who caused it. A person is never notified about their own action. */
  actorId: string;
  workspaceId: string;
  projectId?: string;
  taskId?: string;
  /** What the sentence needs (task title, project name and key, workspace name and slug, role): copied now, so history does not change later. */
  data: Record<string, string>;
};

const PAGE_DEFAULT = 20;
const CURSOR = /^(\d{4}-\d\d-\d\dT[\d:.]+Z)\|([a-z0-9]+)$/;

/**
 * In-app notifications. The one write path is `notify(tx, ...)`: services call it inside the transaction of the event that causes
 * it (beside the audit row), so the event and its notification exist together or not at all. Everything else is read-side and
 * scoped to the caller: there is no way to name another person's id.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(tx: Prisma.TransactionClient, n: NotifyInput): Promise<void> {
    if (n.recipientId === n.actorId) return;
    // Only people who are still in the workspace hear about it (an invitation inviter may have left, a member may have been removed).
    const [member, actor] = await Promise.all([
      tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: n.workspaceId, userId: n.recipientId } }, select: { id: true } }),
      tx.user.findUnique({ where: { id: n.actorId }, select: { name: true } }),
    ]);
    if (!member) return;
    await tx.notification.create({
      data: {
        type: n.type,
        recipientId: n.recipientId,
        actorId: n.actorId,
        workspaceId: n.workspaceId,
        projectId: n.projectId,
        taskId: n.taskId,
        data: { ...n.data, actorName: actor?.name ?? '' },
      },
    });
  }

  /** What the person may see: their own rows, from workspaces they still belong to. */
  private visible(userId: string): Prisma.NotificationWhereInput {
    return { recipientId: userId, workspace: { members: { some: { userId } } } };
  }

  /** Newest first, in pages. The cursor is the last row's time and id (stable even while new rows arrive). */
  async list(userId: string, cursor?: string, limit = PAGE_DEFAULT) {
    const at = cursor ? CURSOR.exec(cursor) : null;
    const where: Prisma.NotificationWhereInput = at
      ? { ...this.visible(userId), OR: [{ createdAt: { lt: new Date(at[1]) } }, { createdAt: new Date(at[1]), id: { lt: at[2] } }] }
      : this.visible(userId);
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
    });
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((r) => ({
        id: r.id,
        type: r.type,
        actor: r.actor ?? null,
        workspaceId: r.workspaceId,
        projectId: r.projectId,
        taskId: r.taskId,
        data: r.data,
        readAt: r.readAt,
        createdAt: r.createdAt,
      })),
      nextCursor: rows.length > limit && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
    };
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { ...this.visible(userId), readAt: null } });
  }

  /** Marks one read. Another person's id, or an unknown one, is the same 404; reading twice is fine. */
  async markRead(userId: string, id: string) {
    const done = await this.prisma.notification.updateMany({ where: { id, recipientId: userId, readAt: null }, data: { readAt: new Date() } });
    if (done.count === 0 && (await this.prisma.notification.count({ where: { id, recipientId: userId } })) === 0) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'The notification does not exist.' });
    }
    return { unreadCount: await this.unreadCount(userId) };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { recipientId: userId, readAt: null }, data: { readAt: new Date() } });
    return { unreadCount: 0 };
  }
}
