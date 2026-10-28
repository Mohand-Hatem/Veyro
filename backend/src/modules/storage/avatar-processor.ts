import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import sharp from 'sharp';

/** Largest picture we accept from a client (the browser already shrinks to roughly 50 to 150 KB, so this only stops direct API abuse). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const SIZE = 256;
const QUALITIES = [80, 70, 60];
const TARGET_BYTES = 30 * 1024;
// A solid-colour image can be tiny on the wire and huge in memory (a decompression bomb), so the decoded size is capped too.
const MAX_PIXELS = 24_000_000;

export const avatarTooLarge = () =>
  new PayloadTooLargeException({ code: 'AVATAR_TOO_LARGE', message: 'The photo is larger than 2 MB. Choose a smaller one.' });
const invalid = (message: string) => new BadRequestException({ code: 'AVATAR_INVALID_IMAGE', message });

/**
 * The server never trusts what a browser sends. Whatever arrives is decoded for real (a text file renamed .jpg fails here),
 * turned upright from its EXIF orientation, cropped to a square, stripped of all metadata (GPS and camera data never leave
 * this server: sharp drops metadata unless asked to keep it) and re-encoded as a small WebP. Only that result goes to storage.
 */
@Injectable()
export class AvatarProcessor {
  async process(input: Buffer): Promise<Buffer> {
    if (input.length === 0) throw invalid('The photo is empty.');
    if (input.length > AVATAR_MAX_BYTES) throw avatarTooLarge();

    try {
      const meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) > 1) {
        throw invalid('Only JPEG, PNG and WebP pictures are accepted, and they cannot be animated.');
      }
      let out = Buffer.alloc(0);
      for (const quality of QUALITIES) {
        out = await sharp(input, { limitInputPixels: MAX_PIXELS })
          .rotate()
          .resize(SIZE, SIZE, { fit: 'cover', position: sharp.strategy.attention })
          .webp({ quality, effort: 4 })
          .toBuffer();
        if (out.length <= TARGET_BYTES) break;
      }
      return out;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw invalid('That file is not a readable picture.');
    }
  }
}
