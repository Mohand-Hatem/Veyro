/** The illustrated avatars a person can pick instead of a photo. Their pictures are static files in the frontend; keys are permanent. */
export const AVATAR_PRESETS = ['amber', 'sage', 'sky', 'sand', 'rose'] as const;
export type AvatarPreset = (typeof AVATAR_PRESETS)[number];
export const presetUrl = (key: AvatarPreset) => `/avatars/presets/${key}.svg`;
