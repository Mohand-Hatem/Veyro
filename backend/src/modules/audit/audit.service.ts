import { Injectable, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

const MAX_ACTION_FILTERS = 40; // the UI sends every action of up to four categories (CS-13)
/**
 * Account-level trail (CS-07): events about the account itself, not about work inside its workspaces. Invitations, tasks
 * and projects also carry the account id, so the scope is an explicit allowlist rather than "everything with accountId".
 */
const ACCOUNT_SCOPE: Prisma.AuditLogWhereInput[] = [
  { action: { startsWith: 'ACCOUNT_' } },
  { action: { startsWith: 'SUBSCRIPTION_' } },
  { action: { in: ['PROJECT_SELECTION_CONFIRMED', 'WORKSPACE_CREATED', 'WORKSPACE_ARCHIVED', 'WORKSPACE_DELETED'] } },
];
/** Metadata keys that point at another user (the "subject" of the action). */
const SUBJECT_KEYS = ['memberUserId', 'assignedUserId', 'removedUserId'] as const;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(userId: string, query: QueryAuditLogsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Multi-tenant security scoping (BR-AUD-01, ADR-005): audit trails are readable only by
    // Workspace Admins of that workspace and by the Account Owner of the owning account.
    const [memberships, ownedAccounts] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { userId, role: WorkspaceRole.ADMIN },
        select: { workspaceId: true },
      }),
      this.prisma.account.findMany({
        where: { ownerId: userId },
        include: {
          workspaces: { select: { id: true } },
        },
      }),
    ]);

    const accessibleWorkspaceIds = new Set<string>();
    memberships.forEach((m) => accessibleWorkspaceIds.add(m.workspaceId));
    ownedAccounts.forEach((acc) => {
      acc.workspaces.forEach((w) => accessibleWorkspaceIds.add(w.id));
    });

    const ownedAccountIds = ownedAccounts.map((a) => a.id);

    // If query specifies a specific workspace, verify access
    if (query.workspaceId && !accessibleWorkspaceIds.has(query.workspaceId)) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'You do not have access to view audit logs for this workspace.',
      });
    }

    const whereClause: any = {};

    // Account-level trail (CS-07, SCR-AUD-02): the Account Owner only, and only that account's own events.
    if (query.accountId && !ownedAccountIds.includes(query.accountId)) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'The account audit trail is restricted to the Account Owner.',
      });
    }

    if (query.accountId) {
      whereClause.accountId = query.accountId;
      whereClause.AND = [{ OR: ACCOUNT_SCOPE }];
    } else if (query.workspaceId) {
      whereClause.workspaceId = query.workspaceId;
    } else {
      // Show logs matching either accessible workspaces or owned accounts
      whereClause.OR = [
        { workspaceId: { in: Array.from(accessibleWorkspaceIds) } },
        { accountId: { in: ownedAccountIds } },
      ];
    }

    if (query.projectId) {
      whereClause.projectId = query.projectId;
    }
    if (query.taskId) {
      whereClause.taskId = query.taskId;
    }
    if (query.action) {
      const actions = Array.from(new Set(query.action.split(',').map((a) => a.trim()).filter(Boolean)));
      if (actions.length > MAX_ACTION_FILTERS) {
        throw new UnprocessableEntityException({
          code: 'TOO_MANY_ACTION_FILTERS',
          message: `At most ${MAX_ACTION_FILTERS} actions can be filtered at once.`,
        });
      }
      if (actions.length === 1) whereClause.action = actions[0];
      else if (actions.length > 1) whereClause.action = { in: actions };
    }
    if (query.actorUserId) {
      whereClause.actorUserId = query.actorUserId;
    }
    if (query.from || query.to) {
      const from = query.from ? new Date(query.from) : undefined;
      // A date-only `to` means "through the end of that UTC day".
      const to = query.to ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(query.to) ? `${query.to}T23:59:59.999Z` : query.to) : undefined;
      if (from && to && from > to) {
        throw new UnprocessableEntityException({
          code: 'INVALID_DATE_RANGE',
          message: '`from` must not be later than `to`.',
        });
      }
      whereClause.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: whereClause,
        // `id` breaks ties so records written in the same millisecond never repeat or vanish across pages.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where: whereClause }),
    ]);

    return {
      logs: await this.withReferences(logs),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Makes records render-ready (CS-03): resolves the actor, the project and the subject user in two
   * batched queries bounded by the page size. Ids come from rows the caller is already allowed to read.
   * Removed members and soft-deleted projects still resolve, so history never turns into "unknown".
   */
  private async withReferences<T extends { actorUserId: string | null; projectId: string | null; metadata: unknown }>(logs: T[]) {
    const subjectOf = (l: T): string | null => {
      const m = l.metadata as Record<string, unknown> | null;
      if (!m || typeof m !== 'object') return null;
      for (const k of SUBJECT_KEYS) if (typeof m[k] === 'string') return m[k] as string;
      return null;
    };
    const userIds = new Set<string>();
    const projectIds = new Set<string>();
    for (const l of logs) {
      if (l.actorUserId) userIds.add(l.actorUserId);
      const sub = subjectOf(l);
      if (sub) userIds.add(sub);
      if (l.projectId) projectIds.add(l.projectId);
    }
    const [users, projects] = await Promise.all([
      userIds.size ? this.prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true, avatarUrl: true } }) : [],
      projectIds.size ? this.prisma.project.findMany({ where: { id: { in: [...projectIds] } }, select: { id: true, key: true, name: true, deletedAt: true } }) : [],
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const projectById = new Map(projects.map((p) => [p.id, p]));
    return logs.map((l) => {
      const actor = l.actorUserId ? userById.get(l.actorUserId) : undefined;
      const sub = subjectOf(l);
      const subject = sub ? userById.get(sub) : undefined;
      const project = l.projectId ? projectById.get(l.projectId) : undefined;
      return {
        ...l,
        actor: actor ? { id: actor.id, name: actor.name, avatarUrl: actor.avatarUrl } : null,
        subjectUser: subject ? { id: subject.id, name: subject.name } : null,
        project: project ? { id: project.id, key: project.key, name: project.name, isDeleted: project.deletedAt !== null } : null,
      };
    });
  }
}
