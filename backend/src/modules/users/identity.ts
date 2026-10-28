import { AvatarType, UserLocale, UserTheme } from '@prisma/client';

/** The fields of a person that profile and avatar responses carry (never the password hash). */
export const IDENTITY = { id: true, email: true, name: true, avatarUrl: true, avatarType: true, avatarPresetKey: true, locale: true, theme: true } as const;

export type IdentityRow = {
  id: string; email: string; name: string; avatarUrl: string | null; avatarType: AvatarType; avatarPresetKey: string | null; locale: UserLocale; theme: UserTheme;
};

export const toIdentity = (u: IdentityRow) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  avatarUrl: u.avatarUrl,
  avatarType: u.avatarType,
  avatarPresetKey: u.avatarPresetKey,
  preferences: { locale: u.locale, theme: u.theme },
});
