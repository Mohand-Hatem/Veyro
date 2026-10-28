import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiGateway } from './ai.gateway';
import { KnowledgeService } from './knowledge.service';
import { AiToolsService } from './ai-tools.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AiGateway, KnowledgeService, AiToolsService],
  exports: [AiService],
})
export class AiModule {}
