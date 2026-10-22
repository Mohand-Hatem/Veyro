"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./api";

// Shapes of the owner-only billing endpoints (docs/06 §2.4, CS-07 / ADR-014). There is no payment provider yet.
export type Tier = "FREE" | "PRO" | "ENTERPRISE" | "EPIC";
export type SubStatus = "ACTIVE" | "PAST_DUE" | "DOWNGRADED";
export type Subscription = {
  account: { id: string; name: string; slug: string; offboardingState: "NONE" | "PENDING" | string };
  subscription: { tier: Tier; status: SubStatus; cancelAtPeriodEnd: boolean; billingCycleEndsAt: string | null; gracePeriodEndsAt: string | null; requiresProjectSelection: boolean };
  limits: { tier: Tier; maxProjects: number; currentProjects: number; maxWorkspaces: number | null; currentWorkspaces: number };
  grace: { endsAt: string; daysLeft: number; expired: boolean } | null;
  readOnlyProjects: number;
};
export type BillingEvent = { id: string; eventType: string; amount: number | null; currency: string | null; occurredAt: string };

/** The plans as the comparison cards show them: the same limits the backend enforces (BR-SUB-02). `ws: null` is unlimited. */
export const PLANS: Record<Tier, { projects: number; ws: number | null }> = {
  FREE: { projects: 3, ws: 1 },
  PRO: { projects: 7, ws: 3 },
  ENTERPRISE: { projects: 15, ws: 10 },
  EPIC: { projects: 25, ws: null },
};
export const TIERS: Tier[] = ["FREE", "PRO", "ENTERPRISE", "EPIC"];

export const useSubscription = (accountId: string | undefined, enabled: boolean) =>
  useQuery({ queryKey: ["subscription", accountId], enabled: enabled && !!accountId, queryFn: () => api<Subscription>(`/accounts/${accountId}/subscription`) });

export const useBillingEvents = (accountId: string | undefined, enabled: boolean) =>
  useQuery({ queryKey: ["billing-events", accountId], enabled: enabled && !!accountId, queryFn: async () => (await api<{ events: BillingEvent[] }>(`/accounts/${accountId}/billing-events`)).events });

/** Usage as a bar width: unlimited plans show a short fixed bar, full plans are flagged. */
export function meterOf(used: number, max: number | null) {
  const unlimited = max === null;
  return { unlimited, pct: unlimited ? 12 : Math.min(100, Math.round((used / max) * 100)), full: !unlimited && used >= max };
}

const EVENT_KEY: Record<string, "evPaid" | "evFailed" | "evUpgraded" | "evDowngraded" | "evUpdated"> = {
  "invoice.paid": "evPaid",
  "invoice.payment_failed": "evFailed",
  "subscription.upgraded": "evUpgraded",
  "subscription.downgraded": "evDowngraded",
  "subscription.updated": "evUpdated",
};
/** Message key for a billing event type, or null for one the screen has no wording for. */
export const eventKey = (type: string) => EVENT_KEY[type] ?? null;

// ---- Choosing the editable projects (SCR-SET-03) and deleting the account (SCR-SET-04).
export type AccountProject = { id: string; key: string; name: string; lifecycleStatus: "ACTIVE" | "ARCHIVED"; isBillingReadOnly: boolean; taskCount: number; workspace: { id: string; name: string } };
export type AccountProjects = { selectionCap: number; requiresProjectSelection: boolean; projects: AccountProject[] };

/** Always asks the server: the picker must start from the flags as they are right now. */
export const fetchAccountProjects = (qc: QueryClient, accountId: string) =>
  qc.fetchQuery({ queryKey: ["account-projects", accountId], staleTime: 0, queryFn: () => api<AccountProjects>(`/accounts/${accountId}/projects`) });

/** The picker starts from what the plan already keeps editable, never more than the cap (we never pick for the owner). */
export const initialPick = (d: AccountProjects) => d.projects.filter((p) => !p.isBillingReadOnly).slice(0, d.selectionCap).map((p) => p.id);

const SELECT_ERRORS: Record<string, "selEExceeds" | "selENone" | "selEInvalid" | "selELocked"> = {
  PROJECT_SELECTION_EXCEEDS_LIMIT: "selEExceeds",
  NO_PROJECT_SELECTION_REQUIRED: "selENone",
  INVALID_PROJECT_SELECTION: "selEInvalid",
  ACCOUNT_OFFBOARDING_LOCKED: "selELocked",
};
export const selectErrorKey = (code: string) => SELECT_ERRORS[code] ?? "errGeneric";

const DELETE_ERRORS: Record<string, "delESlug" | "delEDup"> = { SLUG_CONFIRMATION_MISMATCH: "delESlug", ACCOUNT_ALREADY_OFFBOARDING: "delEDup" };
/** The banner message for a refused deletion; a wrong password has its own inline message and is not listed. */
export const deleteErrorKey = (code: string) => DELETE_ERRORS[code] ?? "errGeneric";

/** Both actions change what the banner, the meters and the project lists say, so those are refetched before the dialog closes. */
function useRefreshAfter(accountId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    for (const k of ["projects", "project", "dashboard", "my-tasks"]) void qc.invalidateQueries({ queryKey: [k] });
    return Promise.all(["subscription", "billing-events", "account-projects"].map((k) => qc.invalidateQueries({ queryKey: [k, accountId] })));
  };
}

export function useSelectProjects(accountId: string | undefined) {
  const refresh = useRefreshAfter(accountId);
  return useMutation({
    mutationFn: (activeProjectIds: string[]) => api(`/accounts/${accountId}/select-active-projects`, { method: "POST", body: JSON.stringify({ activeProjectIds }) }),
    onSuccess: refresh,
  });
}

export function useOffboard(accountId: string | undefined) {
  const refresh = useRefreshAfter(accountId);
  return useMutation({
    mutationFn: (b: { passwordConfirmation: string; slugConfirmation: string }) => api(`/accounts/${accountId}/offboard`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: refresh,
  });
}
