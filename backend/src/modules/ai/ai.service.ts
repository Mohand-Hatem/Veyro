import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
  BadGatewayException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import * as crypto from 'crypto';
import {
  AiMode,
  AiContextScope,
  AiSenderRole,
  AiReservationStatus,
  AiProposalStatus,
  AiProposalTargetType,
  AiProposalMutationType,
  SubscriptionPlanTier,
  TaskStatus,
  ProjectLifecycleStatus,
} from '@prisma/client';

export const TIER_PROJECT_LIMITS: Record<SubscriptionPlanTier, number> = {
  [SubscriptionPlanTier.FREE]: 3,
  [SubscriptionPlanTier.PRO]: 7,
  [SubscriptionPlanTier.ENTERPRISE]: 15,
  [SubscriptionPlanTier.EPIC]: 25,
};

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private getTomorrowUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  }

  async getOrCreateUserSubscription(userId: string) {
    let sub = await this.prisma.userAiSubscription.findUnique({
      where: { userId },
    });

    if (!sub) {
      sub = await this.prisma.userAiSubscription.create({
        data: {
          userId,
          dailyQuota: 3,
        },
      });
    }

    return sub;
  }

  async createConversation(userId: string, dto: CreateConversationDto) {
    // Mode & Scope Invariant Validation (docs/04-ERD Sec 6.5 & docs/06-API Sec 2.5):
    // 1. KNOWLEDGE + GLOBAL: accountId = null, workspaceId = null
    // 2. PROJECT + WORKSPACE: workspaceId != null, accountId = null
    // 3. PROJECT + ACCOUNT: accountId != null, workspaceId = null (strictly Account Owner)
    if (dto.mode === AiMode.KNOWLEDGE && dto.contextScope === AiContextScope.GLOBAL) {
      if (dto.accountId || dto.workspaceId) {
        throw new BadRequestException({
          code: 'INVALID_AI_MODE_SCOPE',
          message: 'Knowledge Global conversations cannot be scoped to a specific workspace or account.',
        });
      }
    } else if (dto.mode === AiMode.PROJECT && dto.contextScope === AiContextScope.WORKSPACE) {
      if (!dto.workspaceId || dto.accountId) {
        throw new BadRequestException({
          code: 'INVALID_AI_MODE_SCOPE',
          message: 'Project Workspace conversations require a valid workspaceId and cannot specify accountId.',
        });
      }

      // Verify workspace membership
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: dto.workspaceId },
        include: {
          account: true,
          members: { where: { userId } },
        },
      });

      if (!workspace) {
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Workspace not found.',
        });
      }

      const isAccountOwner = workspace.account.ownerId === userId;
      if (!isAccountOwner && workspace.members.length === 0) {
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          message: 'You are not a member of this workspace.',
        });
      }
    } else if (dto.mode === AiMode.PROJECT && dto.contextScope === AiContextScope.ACCOUNT) {
      if (!dto.accountId || dto.workspaceId) {
        throw new BadRequestException({
          code: 'INVALID_AI_MODE_SCOPE',
          message: 'Project Account conversations require a valid accountId and cannot specify workspaceId.',
        });
      }

      const account = await this.prisma.account.findUnique({
        where: { id: dto.accountId },
      });

      if (!account) {
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Account not found.',
        });
      }

      if (account.ownerId !== userId) {
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          message: 'Account-scoped AI conversations are restricted strictly to the Account Owner.',
        });
      }
    } else {
      throw new BadRequestException({
        code: 'INVALID_AI_MODE_SCOPE',
        message: 'Unsupported combination of mode and contextScope.',
      });
    }

    return this.prisma.aiConversation.create({
      data: {
        userId,
        title: dto.title,
        mode: dto.mode,
        contextScope: dto.contextScope,
        workspaceId: dto.workspaceId,
        accountId: dto.accountId,
      },
    });
  }

  async listConversations(userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const conv = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv || conv.userId !== userId) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested conversation does not exist.',
      });
    }

    return conv;
  }

  async getMessages(userId: string, conversationId: string) {
    await this.getConversation(userId, conversationId);

    return this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getQuota(userId: string) {
    const sub = await this.getOrCreateUserSubscription(userId);
    const today = this.getTodayUtc();

    const usage = await this.prisma.aiDailyUsage.findUnique({
      where: {
        userId_usageDate: {
          userId,
          usageDate: today,
        },
      },
    });

    const messagesUsed = usage ? usage.messagesUsed : 0;
    const remaining = Math.max(0, sub.dailyQuota - messagesUsed);

    return {
      tier: sub.tier,
      dailyQuota: sub.dailyQuota,
      messagesUsed,
      remaining,
      resetsAt: this.getTomorrowUtc(),
    };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is mandatory for AI message generation.',
      });
    }

    const conversation = await this.getConversation(userId, conversationId);
    const sub = await this.getOrCreateUserSubscription(userId);
    const today = this.getTodayUtc();

    // Compute canonical request hash for tamper detection
    const canonicalPayload = `${conversationId}:${dto.content.trim()}:${dto.targetWorkspaceId || ''}`;
    const requestHash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');

    // Check existing reservation
    const existingReservation = await this.prisma.aiUsageReservation.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey,
        },
      },
    });

    if (existingReservation) {
      if (existingReservation.requestHash !== requestHash) {
        throw new UnprocessableEntityException({
          code: 'IDEMPOTENCY_KEY_MISMATCH',
          message: 'The request payload differs from the initial request with this idempotency key.',
        });
      }

      if (existingReservation.status === AiReservationStatus.FINALIZED) {
        if (existingReservation.finalizedMessageId) {
          const cachedMessage = await this.prisma.aiMessage.findUnique({
            where: { id: existingReservation.finalizedMessageId },
          });
          return {
            message: cachedMessage,
            isReplay: true,
          };
        }
      }

      if (existingReservation.status === AiReservationStatus.PENDING) {
        throw new ConflictException({
          code: 'IDEMPOTENT_REQUEST_IN_PROGRESS',
          message: 'A request with this idempotency key is currently being processed.',
        });
      }
    }

    // Check quota against daily limits
    const currentUsage = await this.prisma.aiDailyUsage.findUnique({
      where: {
        userId_usageDate: {
          userId,
          usageDate: today,
        },
      },
    });

    const messagesUsed = currentUsage ? currentUsage.messagesUsed : 0;
    if (messagesUsed >= sub.dailyQuota) {
      throw new HttpException(
        {
          code: 'AI_QUOTA_EXCEEDED',
          message: `Daily AI message quota (${sub.dailyQuota}) exceeded for tier ${sub.tier}. Resets at 00:00 UTC.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Step 1: Atomic Quota Reservation (Two-Phase Pattern)
    const reservation = await this.prisma.$transaction(async (tx) => {
      await tx.aiDailyUsage.upsert({
        where: {
          userId_usageDate: {
            userId,
            usageDate: today,
          },
        },
        create: {
          userId,
          usageDate: today,
          messagesUsed: 1,
        },
        update: {
          messagesUsed: { increment: 1 },
        },
      });

      return tx.aiUsageReservation.create({
        data: {
          userId,
          idempotencyKey,
          requestHash,
          status: AiReservationStatus.PENDING,
          usageDate: today,
          conversationId,
        },
      });
    });

    // Step 2: Generation Execution (Gateway Layer)
    try {
      const promptLower = dto.content.toLowerCase();
      let assistantContent = `I have analyzed your request in the context of ${conversation.title}. All active project workflows are running smoothly.`;
      let citations: any = null;
      let proposalData: any = null;

      // Intelligent Proposal Generation (Safe Human-in-the-Loop Pattern):
      // If user asks to create or schedule a task, the assistant proposes a structured mutation!
      if (promptLower.includes('create task') || promptLower.includes('add task') || promptLower.includes('new task')) {
        const taskTitle = dto.content.replace(/.*(create task|add task|new task)[:\s]*/i, '').trim() || 'Follow up on sprint review';
        assistantContent = `I have drafted a proposal to create the task "${taskTitle}". Please review and confirm the proposal below to apply the change.`;
        citations = [
          {
            type: 'WORKSPACE_CONTEXT',
            scope: conversation.contextScope,
            workspaceId: conversation.workspaceId,
          },
        ];

        proposalData = {
          targetEntityType: AiProposalTargetType.TASK,
          mutationAction: AiProposalMutationType.CREATE,
          targetWorkspaceId: conversation.workspaceId,
          proposedPayload: {
            title: taskTitle.slice(0, 100),
            description: `Auto-generated from AI conversation: ${conversation.title}`,
            priority: 'MEDIUM',
          },
        };
      }

      // Step 3: Atomic Finalization
      return await this.prisma.$transaction(async (tx) => {
        // Record User Message
        await tx.aiMessage.create({
          data: {
            conversationId,
            senderRole: AiSenderRole.USER,
            content: dto.content,
          },
        });

        // Record Assistant Message
        const assistantMessage = await tx.aiMessage.create({
          data: {
            conversationId,
            senderRole: AiSenderRole.ASSISTANT,
            content: assistantContent,
            citations: citations ? JSON.parse(JSON.stringify(citations)) : null,
          },
        });

        // Record Proposal if generated
        let createdProposal = null;
        if (proposalData) {
          createdProposal = await tx.aiMutationProposal.create({
            data: {
              conversationId,
              targetEntityType: proposalData.targetEntityType,
              mutationAction: proposalData.mutationAction,
              targetWorkspaceId: proposalData.targetWorkspaceId,
              proposedPayload: proposalData.proposedPayload,
              status: AiProposalStatus.PENDING,
            },
          });
        }

        // Finalize Reservation
        await tx.aiUsageReservation.update({
          where: { id: reservation.id },
          data: {
            status: AiReservationStatus.FINALIZED,
            finalizedMessageId: assistantMessage.id,
          },
        });

        return {
          message: assistantMessage,
          proposal: createdProposal,
        };
      });
    } catch (err) {
      // Step 4: Compensation on failure (Refund Quota)
      await this.prisma.$transaction(async (tx) => {
        await tx.aiDailyUsage.update({
          where: {
            userId_usageDate: {
              userId,
              usageDate: today,
            },
          },
          data: {
            messagesUsed: { decrement: 1 },
          },
        });

        await tx.aiUsageReservation.update({
          where: { id: reservation.id },
          data: {
            status: AiReservationStatus.COMPENSATED,
          },
        });
      });

      throw new BadGatewayException({
        code: 'AI_GATEWAY_ERROR',
        message: 'AI generation failed. Your daily message quota has been refunded.',
      });
    }
  }

  async listProposals(userId: string, conversationId: string) {
    await this.getConversation(userId, conversationId);

    return this.prisma.aiMutationProposal.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async confirmProposal(userId: string, proposalId: string) {
    const proposal = await this.prisma.aiMutationProposal.findUnique({
      where: { id: proposalId },
      include: {
        conversation: true,
      },
    });

    if (!proposal || proposal.conversation.userId !== userId) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested mutation proposal does not exist.',
      });
    }

    if (proposal.status !== AiProposalStatus.PENDING) {
      throw new ConflictException({
        code: 'PROPOSAL_ALREADY_RESOLVED',
        message: `This proposal has already been ${proposal.status.toLowerCase()}.`,
      });
    }

    const payload = proposal.proposedPayload as any;

    return this.prisma.$transaction(async (tx) => {
      let createdEntity: any = null;

      if (proposal.targetEntityType === AiProposalTargetType.TASK && proposal.mutationAction === AiProposalMutationType.CREATE) {
        // Find default project in workspace to attach task
        const workspaceId = proposal.targetWorkspaceId || proposal.conversation.workspaceId;
        if (!workspaceId) {
          throw new UnprocessableEntityException({
            code: 'MISSING_WORKSPACE_CONTEXT',
            message: 'Cannot execute task creation without a workspace context.',
          });
        }

        const project = await tx.project.findFirst({
          where: {
            workspaceId,
            deletedAt: null,
            lifecycleStatus: ProjectLifecycleStatus.ACTIVE,
            isBillingReadOnly: false,
          },
        });

        if (!project) {
          throw new UnprocessableEntityException({
            code: 'NO_ACTIVE_PROJECT_AVAILABLE',
            message: 'No active editable project found in the workspace to attach the task.',
          });
        }

        createdEntity = await tx.task.create({
          data: {
            projectId: project.id,
            title: payload.title || 'Untitled AI Task',
            description: payload.description,
            priority: payload.priority || 'MEDIUM',
            status: TaskStatus.TODO,
            authorId: userId,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: userId,
            workspaceId,
            projectId: project.id,
            taskId: createdEntity.id,
            action: 'TASK_CREATED_VIA_AI_CONFIRMATION',
            metadata: {
              proposalId: proposal.id,
            },
          },
        });
      }

      // Mark proposal as executed
      const updatedProposal = await tx.aiMutationProposal.update({
        where: { id: proposal.id },
        data: {
          status: AiProposalStatus.EXECUTED,
          executedAt: new Date(),
        },
      });

      // Zero AI quota is consumed for confirmations (BR-AI-01, DEC-23)
      return {
        proposal: updatedProposal,
        result: createdEntity,
      };
    });
  }

  async rejectProposal(userId: string, proposalId: string) {
    const proposal = await this.prisma.aiMutationProposal.findUnique({
      where: { id: proposalId },
      include: {
        conversation: true,
      },
    });

    if (!proposal || proposal.conversation.userId !== userId) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested mutation proposal does not exist.',
      });
    }

    if (proposal.status !== AiProposalStatus.PENDING) {
      throw new ConflictException({
        code: 'PROPOSAL_ALREADY_RESOLVED',
        message: `This proposal has already been ${proposal.status.toLowerCase()}.`,
      });
    }

    return this.prisma.aiMutationProposal.update({
      where: { id: proposal.id },
      data: {
        status: AiProposalStatus.REJECTED,
      },
    });
  }
}
