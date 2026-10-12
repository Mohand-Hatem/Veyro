import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(userId: string, query: QueryAuditLogsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Multi-tenant security scoping: Find all workspaces where user is member or account owner
    const [memberships, ownedAccounts] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { userId },
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

    if (query.workspaceId) {
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
      whereClause.action = query.action;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where: whereClause }),
    ]);

    return {
      logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
