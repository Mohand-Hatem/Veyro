"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// Shapes of the workspace administration endpoints (docs/06, CS-02 / ADR-009).
export type WorkspaceDetails = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  account: { id: string; name: string; slug: string; ownerId: string };
  _count: { members: number; projects: number };
};
export type WsRole = "ADMIN" | "MEMBER";
export type WsMember = { id: string; userId: string; name: string; email: string; avatarUrl: string | null; role: WsRole; isAccountOwner: boolean; joinedAt: string };
export type Invitation = {
  id: string;
  email: string;
  role: WsRole;
  status: string;
  isExpired: boolean;
  expiresAt: string;
  createdAt: string;
  inviter: { id: string; name: string };
  projects: { id: string; key: string; name: string }[];
};
export type InviteLink = { invitationId: string; email: string; expiresAt: string; inviteLink: string };

export type InviteResult = { invitationId: string; email: string; role: WsRole; projectIds: string[]; expiresAt: string; inviteLink: string };

export const useWorkspaceDetails = (id: string | undefined, enabled: boolean) =>
  useQuery({ queryKey: ["ws", id], enabled: enabled && !!id, queryFn: () => api<WorkspaceDetails>(`/workspaces/${id}`) });

// Same endpoint as the project members dialog's pool, so one cache entry serves both.
export const useMembers = (id: string | undefined, enabled: boolean) =>
  useQuery({ queryKey: ["ws-members", id], enabled: enabled && !!id, queryFn: () => api<WsMember[]>(`/workspaces/${id}/members`) });

export const useInvitations = (id: string | undefined, enabled: boolean) =>
  useQuery({ queryKey: ["ws-invitations", id], enabled: enabled && !!id, queryFn: () => api<Invitation[]>(`/workspaces/${id}/invitations`) });

/** Everything these actions change: the page's own data plus what other screens show (workspace list, member counts, dashboard). */
function useSettle(id: string | undefined) {
  const qc = useQueryClient();
  return {
    members: () => Promise.all([qc.invalidateQueries({ queryKey: ["ws-members", id] }), qc.invalidateQueries({ queryKey: ["ws", id] })]),
    invitations: () => qc.invalidateQueries({ queryKey: ["ws-invitations", id] }),
    others: () => {
      for (const k of ["projects", "dashboard", "my-tasks"]) void qc.invalidateQueries({ queryKey: [k, id] });
    },
  };
}

/** PATCH /workspaces/:id. The workspace list is refetched before resolving, because the shell finds the current workspace by its slug. */
export function useUpdateWorkspace(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; slug?: string }) => api<WorkspaceDetails>(`/workspaces/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.setQueryData(["ws", id], data);
      return qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

export function useChangeRole(id: string | undefined) {
  const settle = useSettle(id);
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: WsRole }) => api<WsMember>(`/workspaces/${id}/members/${memberId}`, { method: "PATCH", body: JSON.stringify({ role }) }),
    onSuccess: () => settle.members(),
  });
}

export function useRemoveMember(id: string | undefined) {
  const settle = useSettle(id);
  return useMutation({
    mutationFn: (memberId: string) => api<{ removedMemberId: string; unassignedTasks: number; removedProjectAssignments: number }>(`/workspaces/${id}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => {
      settle.others();
      return settle.members();
    },
  });
}

export function useRevokeInvitation(id: string | undefined) {
  const settle = useSettle(id);
  return useMutation({ mutationFn: (invitationId: string) => api<unknown>(`/workspaces/${id}/invitations/${invitationId}/revoke`, { method: "POST" }), onSuccess: () => settle.invitations() });
}

/** POST /workspaces/:id/invitations. The link is returned once and shown once; the pending list is refetched before resolving. */
export function useInvite(id: string | undefined) {
  const settle = useSettle(id);
  return useMutation({
    mutationFn: (body: { email: string; role: WsRole; projectIds?: string[] }) => api<InviteResult>(`/workspaces/${id}/invitations`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => settle.invitations(),
  });
}

/** A new link replaces the old one, so the raw link is returned once and shown once. */
export function useResendInvitation(id: string | undefined) {
  const settle = useSettle(id);
  return useMutation({ mutationFn: (invitationId: string) => api<InviteLink>(`/workspaces/${id}/invitations/${invitationId}/resend`, { method: "POST" }), onSuccess: () => settle.invitations() });
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Whether a workspace URL slug is valid (3 to 50 characters, lowercase letters, digits and single hyphens). */
export const validSlug = (s: string) => s.length >= 3 && s.length <= 50 && SLUG_RE.test(s);
/** Whole days from now to an ISO date (negative once it has passed). */
export const daysUntil = (iso: string, now = Date.now()) => Math.round((new Date(iso).getTime() - now) / 86400000);

/** Message key (messages "Settings") for a refused request. */
export function settingsErrorKey(code: string): "eOwnerRole" | "eOwnRole" | "eOwnerRm" | "eSelfRm" | "ePerm" | "eInvNotPending" | "eGeneric" {
  if (code === "OWNER_ROLE_IMMUTABLE") return "eOwnerRole";
  if (code === "CANNOT_CHANGE_OWN_ROLE") return "eOwnRole";
  if (code === "OWNER_NOT_REMOVABLE") return "eOwnerRm";
  if (code === "CANNOT_REMOVE_SELF") return "eSelfRm";
  if (code === "PERMISSION_DENIED") return "ePerm";
  if (code === "INVITATION_NOT_PENDING" || code === "INVITATION_NOT_RESENDABLE") return "eInvNotPending";
  return "eGeneric";
}
