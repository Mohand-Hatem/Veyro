import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { databaseUrl } from './database-url';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString =
      databaseUrl() ||
      'postgresql://postgres:postgres@localhost:5432/veyro?schema=public';
    // Without a limit a connection attempt can hang until the OS gives up; fail in 10s so the filter can answer 503.
    const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 10_000 });
    // Query events are only delivered to whoever subscribes with $on('query') (scripts/perf-baseline.ts); nobody does in normal runs.
    super({ adapter, log: [{ emit: 'event', level: 'query' }] });
  }

  async onModuleInit() {
    this.logger.log('Connecting to PostgreSQL database via Prisma 7 (pg adapter)...');
    try {
      await this.$connect();
      this.logger.log('Prisma 7 connected to PostgreSQL successfully.');
    } catch (error) {
      this.logger.warn(
        `Database connection deferred (PostgreSQL offline or unreachable): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting Prisma from PostgreSQL...');
    await this.$disconnect();
  }
}
