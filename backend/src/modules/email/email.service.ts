import { Injectable, Logger } from '@nestjs/common';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /**
   * Sends one email through Resend's REST API. It never throws, and callers do not await it on the request path: the data is
   * already saved and the person can ask again, and waiting would make "forgot password" slower for real accounts than for
   * unknown ones (a way to learn which emails are registered). Returns whether Resend accepted it.
   */
  async send(message: EmailMessage): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      this.logger.warn(`Email "${message.subject}" was not sent: RESEND_API_KEY and EMAIL_FROM are not set.`);
      return false;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        this.logger.error(`Resend refused an email (${res.status}): ${(await res.text()).slice(0, 300)}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.error(`Resend could not be reached: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }
}
