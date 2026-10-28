"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "./api";

// Shape of GET /audit-logs (docs/06 §2.6, CS-03 / ADR-010).
export type AuditLog = {
  id: string;
  action: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
  project: { id: string; key: string; name: string; isDeleted: boolean } | null;
  subjectUser: { id: string; name: string } | null;
};
export type AuditPage = { logs: AuditLog[]; meta: { total: number; page: number; limit: number; totalPages: number } };

/** The reference page lists fifteen records at a time. */
export const AUDIT_LIMIT = 15;

export type Cat = "people" | "projects" | "tasks" | "workspace";
export const CAT_ORDER: Cat[] = ["people", "projects", "tasks", "workspace"];
// Every action the backend writes for a workspace, by the filter chip it belongs to (the chips send these as `action=A,B`).
export const CATS: Record<Cat, string[]> = {
  people: ["MEMBER_ROLE_CHANGED", "MEMBER_REMOVED", "MEMBER_ASSIGNED_TO_PROJECT", "MEMBER_REMOVED_FROM_PROJECT", "PROJECT_MEMBER_ROLE_CHANGED", "WORKSPACE_INVITATION_ISSUED", "WORKSPACE_INVITATION_ACCEPTED", "WORKSPACE_INVITATION_REVOKED", "WORKSPACE_INVITATION_RESENT"],
  projects: ["PROJECT_CREATED", "PROJECT_UPDATED", "PROJECT_ARCHIVED", "PROJECT_UNARCHIVED", "PROJECT_DELETED", "PROJECT_RESTORED", "PROJECT_SELECTION_CONFIRMED"],
  tasks: ["TASK_CREATED", "TASK_CREATED_VIA_AI_CONFIRMATION", "TASK_UPDATED", "TASK_STATUS_CHANGED", "TASK_REOPENED", "TASK_REINSTATED", "TASK_DELETED", "TASK_RESTORED", "TASK_UNASSIGNED", "COMMENT_CREATED"],
  workspace: ["WORKSPACE_CREATED", "WORKSPACE_UPDATED", "ACCOUNT_ONBOARDED", "SUBSCRIPTION_UPDATED"],
};
export const catOf = (action: string): Cat => CAT_ORDER.find((k) => CATS[k].includes(action)) ?? "workspace";

export type AuditFilter = { range: number; from: string; to: string; actor: string; proj: string; cats: Cat[]; page: number };
export const EMPTY_FILTER: AuditFilter = { range: 0, from: "", to: "", actor: "", proj: "", cats: [], page: 1 };
export const isFiltered = (f: AuditFilter) => !!(f.from || f.to || f.actor || f.proj || f.cats.length);

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
/** The "Last 24 hours / 7 days / 30 days" chips as a from/to pair (dates, UTC). 0 means all time. */
export function rangeDates(days: number, now = Date.now()): { from: string; to: string } {
  if (days === 0) return { from: "", to: "" };
  const from = days === 1 ? now - DAY : now - (days - 1) * DAY;
  return { from: iso(new Date(from)), to: iso(new Date(now)) };
}

export const useAuditLogs = (workspaceId: string | undefined, f: AuditFilter, enabled: boolean) =>
  useQuery({
    queryKey: ["audit", workspaceId, f],
    enabled: enabled && !!workspaceId,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const p = new URLSearchParams({ workspaceId: workspaceId!, page: String(f.page), limit: String(AUDIT_LIMIT) });
      if (f.actor) p.set("actorUserId", f.actor);
      if (f.proj) p.set("projectId", f.proj);
      if (f.from) p.set("from", f.from);
      if (f.to) p.set("to", f.to);
      if (f.cats.length) p.set("action", f.cats.flatMap((c) => CATS[c]).join(","));
      return api<AuditPage>(`/audit-logs?${p}`);
    },
  });

// ---- Account audit trail (SCR-AUD-02): the same endpoint scoped by `accountId` (CS-07), owner only. Account events only, 10 per page.
export type AccountCat = "billing" | "projects" | "workspaces" | "account";
export const ACCOUNT_CAT_ORDER: AccountCat[] = ["billing", "projects", "workspaces", "account"];
export const ACCOUNT_CATS: Record<AccountCat, string[]> = {
  billing: ["SUBSCRIPTION_UPDATED"],
  projects: ["PROJECT_SELECTION_CONFIRMED"],
  workspaces: ["WORKSPACE_CREATED", "WORKSPACE_ARCHIVED", "WORKSPACE_DELETED"],
  account: ["ACCOUNT_ONBOARDED", "ACCOUNT_UPDATED", "ACCOUNT_OFFBOARDING_INITIATED", "ACCOUNT_PURGED"],
};
export const accountCatOf = (action: string): AccountCat => ACCOUNT_CAT_ORDER.find((k) => ACCOUNT_CATS[k].includes(action)) ?? "account";
export const ACCOUNT_AUDIT_LIMIT = 10;

export type AccountAuditFilter = { range: number; from: string; to: string; cats: AccountCat[]; page: number };
export const EMPTY_ACCOUNT_FILTER: AccountAuditFilter = { range: 0, from: "", to: "", cats: [], page: 1 };
export const isAccountFiltered = (f: AccountAuditFilter) => !!(f.from || f.to || f.cats.length);

export const useAccountAuditLogs = (accountId: string | undefined, f: AccountAuditFilter, enabled: boolean) =>
  useQuery({
    queryKey: ["account-audit", accountId, f],
    enabled: enabled && !!accountId,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const p = new URLSearchParams({ accountId: accountId!, page: String(f.page), limit: String(ACCOUNT_AUDIT_LIMIT) });
      if (f.from) p.set("from", f.from);
      if (f.to) p.set("to", f.to);
      if (f.cats.length) p.set("action", f.cats.flatMap((c) => ACCOUNT_CATS[c]).join(","));
      return api<AuditPage>(`/audit-logs?${p}`);
    },
  });
