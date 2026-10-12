import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  async createConversation(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.aiService.createConversation(userId, dto);
  }

  @Get('conversations')
  async listConversations(@CurrentUser('id') userId: string) {
    return this.aiService.listConversations(userId);
  }

  @Get('conversations/:id')
  async getConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.aiService.getConversation(userId, conversationId);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.aiService.getMessages(userId, conversationId);
  }

  @Get('quota')
  async getQuota(@CurrentUser('id') userId: string) {
    return this.aiService.getQuota(userId);
  }

  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.aiService.sendMessage(
      userId,
      conversationId,
      dto,
      idempotencyKey,
    );
  }

  @Get('conversations/:id/proposals')
  async listProposals(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.aiService.listProposals(userId, conversationId);
  }

  @Post('proposals/:id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmProposal(
    @CurrentUser('id') userId: string,
    @Param('id') proposalId: string,
  ) {
    return this.aiService.confirmProposal(userId, proposalId);
  }

  @Post('proposals/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectProposal(
    @CurrentUser('id') userId: string,
    @Param('id') proposalId: string,
  ) {
    return this.aiService.rejectProposal(userId, proposalId);
  }
}
