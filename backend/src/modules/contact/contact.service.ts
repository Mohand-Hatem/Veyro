import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

/** Abuse limits for an endpoint that works without signing in. Windows are rolling, measured on stored rows. */
export const CONTACT_WINDOW_MS = 60 * 60 * 1000;
export const CONTACT_MAX_PER_EMAIL = 3;
export const CONTACT_MAX_PER_NETWORK = 8; // an office can share one address, so this is looser than the per-email limit

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stores a message from the public form. The sender gets the same `{ received: true }` whether the message was saved or
   * silently dropped as a honeypot hit, so a bot learns nothing. Limits are enforced before the write. The network address is
   * kept only as a salted hash (enough to rate-limit, not to identify a person). Email notification to the team arrives with
   * the email provider (Phase 5, AGENTS.md section 6); until then messages are read from the table.
   */
  async create(dto: CreateContactMessageDto, ip: string | undefined) {
    if (dto.website && dto.website.trim() !== '') {
      this.logger.warn('Contact honeypot filled: message dropped.');
      return { received: true };
    }

    const ipHash = crypto.createHash('sha256').update(`veyro-contact:${ip ?? 'unknown'}`).digest('hex');
    const since = new Date(Date.now() - CONTACT_WINDOW_MS);
    const [byEmail, byNetwork] = await Promise.all([
      this.prisma.contactMessage.count({ where: { email: dto.email, createdAt: { gte: since } } }),
      this.prisma.contactMessage.count({ where: { ipHash, createdAt: { gte: since } } }),
    ]);
    if (byEmail >= CONTACT_MAX_PER_EMAIL || byNetwork >= CONTACT_MAX_PER_NETWORK) {
      throw new HttpException(
        { code: 'CONTACT_RATE_LIMITED', message: 'Too many messages in a short time. Please try again in an hour.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Plain text only: control characters are removed, nothing is ever rendered as markup from this table.
    // eslint-disable-next-line no-control-regex
    const message = dto.message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    await this.prisma.contactMessage.create({
      data: { name: dto.name, email: dto.email, topic: dto.topic, message, ipHash },
    });
    return { received: true };
  }
}
