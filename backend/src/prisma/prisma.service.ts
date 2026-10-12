import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/veyro?schema=public';
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
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
