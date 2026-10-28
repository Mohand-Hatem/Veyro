import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { AVATAR_MAX_BYTES, AVATAR_TYPES, avatarTooLarge } from '../storage/avatar-processor';

/**
 * Reads the picture sent as the raw request body (no multipart, so no upload library). Done here and not in a body-parser
 * middleware so that "too large" and "wrong type" leave through our normal error filter with their own codes. The content type
 * is only a gate: the real check is that the bytes decode as a picture (AvatarProcessor).
 */
export async function readAvatarBody(req: Request): Promise<Buffer> {
  const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (!AVATAR_TYPES.includes(type)) {
    throw new BadRequestException({ code: 'AVATAR_INVALID_IMAGE', message: 'Send the picture as the request body (JPEG, PNG or WebP).' });
  }
  if (Number(req.headers['content-length']) > AVATAR_MAX_BYTES) throw avatarTooLarge();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > AVATAR_MAX_BYTES) throw avatarTooLarge();
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}
