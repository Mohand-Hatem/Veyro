"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Preset } from "./avatar";
import type { Me } from "./queries";

// Shapes of the profile endpoints (docs/06, CS-09 / ADR-016).
export type Locale = "EN" | "AR";
export type ThemePref = "LIGHT" | "DARK" | "SYSTEM";
export type AvatarType = "INITIALS" | "PRESET" | "UPLOAD";
export type Tier = "FREE" | "PRO" | "ENTERPRISE" | "EPIC";
export type ProfileWorkspace = {
  id: string; name: string; slug: string; lifecycleStatus: string; role: "ADMIN" | "MEMBER"; isAccountOwner: boolean; joinedAt: string; projectCount: number;
  account: { id: string; name: string; plan: { tier: Tier; status: string } | null };
};
export type Profile = {
  id: string; email: string; name: string; avatarUrl: string | null; avatarType: AvatarType; avatarPresetKey: string | null; isEmailVerified: boolean; createdAt: string;
  preferences: { locale: Locale; theme: ThemePref };
  stats: { workspaces: number; projects: number; openTasks: number; ownedAccounts: number };
  workspaces: ProfileWorkspace[];
  aiSubscription: { tier: Tier; dailyQuota: number; status: string };
};

export const useProfile = () => useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/users/me/profile") });

/** Name and preferences. The cached profile and header user change at once (the server said yes), then both refresh in the background for the truth. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; locale?: Locale; theme?: ThemePref }) => api("/users/me", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (_data, v) => {
      const name = v.name?.trim();
      qc.setQueryData<Profile>(["profile"], (p) => p && { ...p, ...(name ? { name } : {}), preferences: { locale: v.locale ?? p.preferences.locale, theme: v.theme ?? p.preferences.theme } });
      if (name) qc.setQueryData<Me>(["me"], (m) => m && { ...m, name });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

type AvatarResult = { avatarUrl: string | null; avatarType: AvatarType; avatarPresetKey: string | null };

/** The picture shows everywhere (header, board, member lists), so after a change every cached screen refreshes. */
function avatarChanged(qc: ReturnType<typeof useQueryClient>, r: AvatarResult) {
  qc.setQueryData<Profile>(["profile"], (p) => p && { ...p, avatarUrl: r.avatarUrl, avatarType: r.avatarType, avatarPresetKey: r.avatarPresetKey });
  qc.setQueryData<Me>(["me"], (m) => m && { ...m, avatarUrl: r.avatarUrl });
  void qc.invalidateQueries();
}

/**
 * Sends the cropped picture as the request body. The server checks it really is a picture, shrinks it to a small WebP, strips its
 * metadata and stores only that (nothing the browser says about the file is trusted).
 */
export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (image: Blob) => api<AvatarResult>("/users/me/avatar", { method: "PUT", headers: { "Content-Type": image.type }, body: image }),
    onSuccess: (r) => avatarChanged(qc, r),
  });
}

export function useSetPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: Preset) => api<AvatarResult>("/users/me/avatar/preset", { method: "PUT", body: JSON.stringify({ key }) }),
    onSuccess: (r) => avatarChanged(qc, r),
  });
}

/** Back to initials. */
export function useRemoveAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<AvatarResult>("/users/me/avatar", { method: "DELETE" }),
    onSuccess: (r) => avatarChanged(qc, r),
  });
}

export const useChangePassword = () =>
  useMutation({ mutationFn: (b: { currentPassword: string; newPassword: string }) => api<{ success: boolean; otherSessionsRevoked: number }>("/auth/change-password", { method: "POST", body: JSON.stringify(b) }) });

export const nameOk = (name: string) => name.trim().length >= 2 && name.trim().length <= 100;

/** Four bars: 8+ characters, both cases, a digit or symbol, 12+ characters (the reference meter). */
export const passwordScore = (p: string) => (p ? [p.length >= 8, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d|\W/.test(p), p.length >= 12].filter(Boolean).length : 0);
/** The same rule as the backend DTO (ChangePasswordDto) and the sign-up form. */
export const passwordOk = (p: string) => p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && (/\d/.test(p) || /\W/.test(p));

/** The role line under the name: the highest role the person holds anywhere. */
export const highestRole = (p: Pick<Profile, "stats" | "workspaces">): "owner" | "admin" | "member" =>
  p.stats.ownedAccounts > 0 ? "owner" : p.workspaces.some((w) => w.role === "ADMIN") ? "admin" : "member";

/** The account plan tile belongs to owners only (the server returns the plan only for accounts the person owns). */
export const ownedPlan = (p: Pick<Profile, "stats" | "workspaces">) => (p.stats.ownedAccounts > 0 ? p.workspaces.find((w) => w.account.plan) ?? null : null);

export const themeToNext = (t: ThemePref) => t.toLowerCase() as "light" | "dark" | "system";
