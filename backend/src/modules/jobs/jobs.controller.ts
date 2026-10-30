import { Controller, Get, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CronSecretGuard } from './cron-secret.guard';
import { JobsService } from './jobs.service';

/** Called by Vercel Cron (a GET), never by a person: public for the session guard, closed by the cron secret instead. */
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Public()
  @UseGuards(CronSecretGuard)
  @Get('daily')
  runDaily() {
    return this.jobs.runDaily();
  }
}
