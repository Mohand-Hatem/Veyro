import { IsIn } from 'class-validator';
import { AVATAR_PRESETS, AvatarPreset } from '../avatar-presets';

/** `PUT /users/me/avatar/preset`: one of the five illustrated avatars. */
export class SetAvatarPresetDto {
  @IsIn(AVATAR_PRESETS, { message: `key must be one of: ${AVATAR_PRESETS.join(', ')}.` })
  key!: AvatarPreset;
}
