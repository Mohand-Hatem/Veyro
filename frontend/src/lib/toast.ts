"use client";

import { toast } from "sonner";

export type ToastKind = "success" | "error" | "info";

/**
 * The one way to say "that worked", "that failed" or "here is why not", on every page (the Toaster sits in the root layout).
 * Errors stay longer because they usually need reading. A fixed `id` replaces an earlier toast with the same id instead of stacking.
 */
export function notify(message: string, kind: ToastKind = "success", id?: string) {
  toast[kind](message, { ...(kind === "error" ? { duration: 6000 } : {}), ...(id ? { id } : {}) });
}

// Signing in ends on another page, and Google and GitHub come back through a full page load, so the greeting waits in
// session storage until the app shell knows the person's name.
const WELCOME = "veyro-welcome";

export function expectWelcome() {
  try { sessionStorage.setItem(WELCOME, "1"); } catch { /* storage blocked: no greeting, nothing else changes */ }
}

/** True once after a sign-in; reading it clears it. */
export function takeWelcome(): boolean {
  try {
    const on = sessionStorage.getItem(WELCOME) === "1";
    sessionStorage.removeItem(WELCOME);
    return on;
  } catch {
    return false;
  }
}
