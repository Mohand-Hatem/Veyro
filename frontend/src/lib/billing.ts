"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./api";

// Shapes of the owner-only billing endpoints (docs/06 §2.4, CS-07 / ADR-014). Payments run on Stripe's hosted pages.
export type Tier = "FREE" | "PRO" | "ENTERPRISE" | "EPIC";
export type PaidTier = Exclude<Tier, "FREE">;
export type SubStatus = "ACTIVE" | "PAST_DUE" | "DOWNGRADED";
export type Subscription = {
  account: { id: string; name: string; slug: string; offboardingState: "NONE" | "PENDING" | string };
  subscription: { tier: Tier; status: SubStatus; cancelAtPeriodEnd: boolean; billingCycleEndsAt: string | null; gracePeriodEndsAt: string | null; requiresProjectSelection: boolean };
  limits: { tier: Tier; maxProjects: number; currentProjects: number; maxWorkspaces: number | null; currentWorkspaces: number };
  grace: { endsAt: string; daysLeft: number; expired: boolean } | null;
  readOnlyProjects: number;
  /** Monthly prices in cents, and whether Stripe's billing portal can be opened (the account has been through checkout). */
  billing: { currency: string; priceCents: Record<PaidTier, number>; canManage: boolean; canSwitch: boolean; testMode: boolean };
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

/** Moving up or down between plans; the order of TIERS is the order of price. */
export const isUpgrade = (from: Tier, to: Tier) => TIERS.indexOf(to) > TIERS.indexOf(from);

/** The number of editable projects the new plan keeps when the account has more than that (the owner then has to choose), otherwise null. */
export const projectsToChoose = (currentProjects: number, to: Tier) => (currentProjects > PLANS[to].projects ? PLANS[to].projects : null);

/** Right after paying, the plan changes when Stripe's webhook arrives: ask again every 2 seconds, up to 15 times. */
const pollWhile = (poll: boolean) => (q: { state: { dataUpdateCount: number } }) => (poll && q.state.dataUpdateCount < 15 ? 2000 : false);

export const useSubscription = (accountId: string | undefined, enabled: boolean, poll = false) =>
  useQuery({ queryKey: ["subscription", accountId], enabled: enabled && !!accountId, refetchInterval: pollWhile(poll), queryFn: () => api<Subscription>(`/accounts/${accountId}/subscription`) });

export const useBillingEvents = (accountId: string | undefined, enabled: boolean, poll = false) =>
  useQuery({ queryKey: ["billing-events", accountId], enabled: enabled && !!accountId, refetchInterval: pollWhile(poll), queryFn: async () => (await api<{ events: BillingEvent[] }>(`/accounts/${accountId}/billing-events`)).events });

/** "$9". A dollar amount reads the same in both languages, so it is not localised (the Arabic format would print "US$"). */
export const formatPrice = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

/** Checkout (a plan) and the billing portal (card, invoices, cancel): both answer with a Stripe address and we go there. */
export function useStripeRedirect(accountId: string | undefined) {
  const go = (r: { url: string }) => window.location.assign(r.url);
  const checkout = useMutation({
    mutationFn: (tier: PaidTier) => api<{ url: string }>(`/accounts/${accountId}/billing/checkout`, { method: "POST", body: JSON.stringify({ tier }) }),
    onSuccess: go,
  });
  const portal = useMutation({ mutationFn: () => api<{ url: string }>(`/accounts/${accountId}/billing/portal`, { method: "POST" }), onSuccess: go });
  return { checkout, portal };
}

/** Usage as a bar width: unlimited plans show a short fixed bar, full plans are flagged. */
export function meterOf(used: number, max: number | null) {
  const unlimited = max === null;
  return { unlimited, pct: unlimited ? 12 : Math.min(100, Math.round((used / max) * 100)), full: !unlimited && used >= max };
}

const CHANGE_ERRORS: Record<string, "errSwitchPay" | "errSwitchDue" | "selELocked"> = {
  PAYMENT_FAILED: "errSwitchPay",
  PAYMENT_PAST_DUE: "errSwitchDue",
  ACCOUNT_OFFBOARDING_LOCKED: "selELocked",
};
/** The message for a refused plan change; anything unexpected gets the general one. */
export const changeErrorKey = (code: string) => CHANGE_ERRORS[code] ?? "errSwitch";

const EVENT_KEY: Record<string, "evPaid" | "evFailed" | "evUpgraded" | "evDowngraded" | "evUpdated" | "evCheckout" | "evStarted" | "evEnded"> = {
  "invoice.paid": "evPaid",
  "invoice.payment_failed": "evFailed",
  "checkout.session.completed": "evCheckout",
  "customer.subscription.created": "evStarted",
  "customer.subscription.updated": "evUpdated",
  "customer.subscription.deleted": "evEnded",
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

/** Switching to another paid plan: Stripe applies it, then its signed webhook updates the account, so the caller waits for the new plan to show up. */
export function useChangePlan(accountId: string | undefined) {
  return useMutation({ mutationFn: (tier: PaidTier) => api<{ tier: PaidTier }>(`/accounts/${accountId}/billing/change-plan`, { method: "POST", body: JSON.stringify({ tier }) }) });
}

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
