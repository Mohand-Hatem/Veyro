import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async listAuditLogs(
    @CurrentUser('id') userId: string,
    @Query() query: QueryAuditLogsDto,
  ) {
    return this.auditService.listAuditLogs(userId, query);
  }
}
