import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AiPlanTier, TaskStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const OPEN_STATUSES = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW];

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The signed-in person's profile page in one read (CS-09, ADR-016): identity, preferences, where they belong and what
   * they carry. The account plan is part of the billing surface, so it is returned only for accounts the caller owns;
   * everyone else only learns their own personal AI plan.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true, isEmailVerified: true, createdAt: true, locale: true, theme: true },
    });
    if (!user) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'User not found.' });

    const [memberships, projectLinks, openTasks, ai] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { userId },
        orderBy: { joinedAt: 'asc' },
        select: {
          role: true,
          joinedAt: true,
          workspace: {
            select: {
              id: true, name: true, slug: true, lifecycleStatus: true,
              account: { select: { id: true, name: true, ownerId: true, subscription: { select: { tier: true, status: true } } } },
            },
          },
        },
      }),
      this.prisma.projectMember.findMany({
        where: { userId, project: { deletedAt: null } },
        select: { project: { select: { workspaceId: true } } },
      }),
      this.prisma.task.count({
        where: { assigneeId: userId, deletedAt: null, status: { in: OPEN_STATUSES }, project: { deletedAt: null } },
      }),
      this.prisma.userAiSubscription.findUnique({ where: { userId }, select: { tier: true, dailyQuota: true, status: true } }),
    ]);

    const projectsByWorkspace = new Map<string, number>();
    for (const l of projectLinks) projectsByWorkspace.set(l.project.workspaceId, (projectsByWorkspace.get(l.project.workspaceId) ?? 0) + 1);

    const workspaces = memberships.map((m) => {
      const isAccountOwner = m.workspace.account.ownerId === userId;
      return {
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        lifecycleStatus: m.workspace.lifecycleStatus,
        role: m.role,
        isAccountOwner,
        joinedAt: m.joinedAt,
        projectCount: projectsByWorkspace.get(m.workspace.id) ?? 0,
        account: {
          id: m.workspace.account.id,
          name: m.workspace.account.name,
          plan: isAccountOwner ? m.workspace.account.subscription : null,
        },
      };
    });
    const owned = new Map(workspaces.filter((w) => w.isAccountOwner).map((w) => [w.account.id, w.account]));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      preferences: { locale: user.locale, theme: user.theme },
      stats: { workspaces: workspaces.length, projects: projectLinks.length, openTasks, ownedAccounts: owned.size },
      workspaces,
      aiSubscription: ai ?? { tier: AiPlanTier.FREE, dailyQuota: 3, status: 'ACTIVE' },
    };
  }

  /** Name and preferences. At least one field is required; the response is the updated identity block. */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.locale !== undefined) data.locale = dto.locale;
    if (dto.theme !== undefined) data.theme = dto.theme;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({ code: 'NO_PROFILE_CHANGES', message: 'Send at least one of name, locale or theme.' });
    }
    const u = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, avatarUrl: true, locale: true, theme: true },
    });
    return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl, preferences: { locale: u.locale, theme: u.theme } };
  }
}

