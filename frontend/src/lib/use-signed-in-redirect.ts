"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { api } from "./api";

/**
 * Sign-in and sign-up pages: someone who is still signed in goes straight to the app. The 15-minute access cookie may already be gone
 * while the 7-day refresh cookie is valid, and api() renews the session silently when that happens, so "still signed in" is judged by
 * the same rule the app itself uses. A visitor who is signed out just keeps the form (the call fails and nothing happens).
 */
export function useRedirectIfSignedIn(target: string) {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    api("/auth/me")
      .then(() => { if (alive) router.replace(target); })
      .catch(() => {});
    return () => { alive = false; };
  }, [router, target]);
}
