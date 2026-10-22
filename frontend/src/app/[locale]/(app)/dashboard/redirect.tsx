"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useWorkspaces } from "@/lib/queries";

// /dashboard is where sign-in lands: forward to the last used workspace, or the first one.
export function DashboardRedirect() {
  const router = useRouter();
  const { data } = useWorkspaces();

  useEffect(() => {
    if (!data) return;
    if (!data.length) {
      router.replace("/onboarding");
      return;
    }
    let last: string | null = null;
    try {
      last = localStorage.getItem("veyro-ws");
    } catch {
      /* storage unavailable */
    }
    router.replace(`/w/${(data.find((w) => w.slug === last) ?? data[0]).slug}`);
  }, [data, router]);

  return null;
}
