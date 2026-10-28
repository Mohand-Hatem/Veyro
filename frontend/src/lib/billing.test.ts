import { describe, expect, it } from "vitest";
import { PLANS, TIERS, changeErrorKey, deleteErrorKey, eventKey, formatPrice, initialPick, isUpgrade, meterOf, projectsToChoose, selectErrorKey, type AccountProject } from "./billing";

describe("billing helpers", () => {
  it("measures usage against a limit", () => {
    expect(meterOf(1, 3)).toEqual({ unlimited: false, pct: 33, full: false });
    expect(meterOf(3, 3)).toEqual({ unlimited: false, pct: 100, full: true });
    expect(meterOf(5, 3).pct).toBe(100);
  });
  it("shows a short bar for unlimited limits", () => {
    expect(meterOf(9, null)).toEqual({ unlimited: true, pct: 12, full: false });
  });
  it("knows the plan limits in order", () => {
    expect(TIERS.map((t) => PLANS[t].projects)).toEqual([3, 7, 15, 25]);
    expect(PLANS.EPIC.ws).toBeNull();
  });
  it("words known billing events only", () => {
    expect(eventKey("invoice.payment_failed")).toBe("evFailed");
    expect(eventKey("something.else")).toBeNull();
  });
  it("words every Stripe event the backend records, so the history never shows a raw event name", () => {
    for (const type of ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"]) {
      expect(eventKey(type), type).not.toBeNull();
    }
  });
  it("tells an upgrade from a downgrade by the order of the plans", () => {
    expect(isUpgrade("PRO", "EPIC")).toBe(true);
    expect(isUpgrade("EPIC", "PRO")).toBe(false);
    expect(isUpgrade("ENTERPRISE", "PRO")).toBe(false);
  });
  it("warns only when a smaller plan keeps fewer projects than the account has", () => {
    expect(projectsToChoose(20, "PRO")).toBe(7);
    expect(projectsToChoose(7, "PRO")).toBeNull();
    expect(projectsToChoose(2, "PRO")).toBeNull();
  });
  it("words each refusal of a plan change, with a general fallback", () => {
    expect(changeErrorKey("PAYMENT_FAILED")).toBe("errSwitchPay");
    expect(changeErrorKey("PAYMENT_PAST_DUE")).toBe("errSwitchDue");
    expect(changeErrorKey("ACCOUNT_OFFBOARDING_LOCKED")).toBe("selELocked");
    expect(changeErrorKey("SOMETHING_ELSE")).toBe("errSwitch");
  });
  it("prints whole-dollar plan prices", () => {
    expect(formatPrice(900)).toBe("$9");
    expect(formatPrice(2900)).toBe("$29");
    expect(formatPrice(1900)).toBe("$19");
  });
});

describe("project selection and account deletion", () => {
  const p = (id: string, isBillingReadOnly: boolean): AccountProject => ({ id, key: id.toUpperCase(), name: id, lifecycleStatus: "ACTIVE", isBillingReadOnly, taskCount: 0, workspace: { id: "w", name: "W" } });
  it("starts the picker from the editable projects, capped by the plan", () => {
    expect(initialPick({ selectionCap: 3, requiresProjectSelection: false, projects: [p("a", false), p("b", true), p("c", false)] })).toEqual(["a", "c"]);
    expect(initialPick({ selectionCap: 1, requiresProjectSelection: false, projects: [p("a", false), p("c", false)] })).toEqual(["a"]);
  });
  it("starts empty when every project is read-only (the owner picks, we never do)", () => {
    expect(initialPick({ selectionCap: 3, requiresProjectSelection: true, projects: [p("a", true), p("b", true)] })).toEqual([]);
  });
  it("maps refusals to messages, with a generic fallback", () => {
    expect(selectErrorKey("PROJECT_SELECTION_EXCEEDS_LIMIT")).toBe("selEExceeds");
    expect(selectErrorKey("NOPE")).toBe("errGeneric");
    expect(deleteErrorKey("SLUG_CONFIRMATION_MISMATCH")).toBe("delESlug");
    expect(deleteErrorKey("ACCOUNT_ALREADY_OFFBOARDING")).toBe("delEDup");
    expect(deleteErrorKey("UNKNOWN")).toBe("errGeneric");
  });
});
