"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader } from "@/components/loader/loader";
import { refreshSession } from "@/lib/api";
import { safeNext } from "@/lib/safe-next";
import { useRouter } from "@/i18n/navigation";

// The refresh cookie is only sent to /api/v1/auth/refresh, so only the browser can renew a session.
export function SessionGate() {
  const t = useTranslations("Session");
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));

  useEffect(() => {
    refreshSession().then((ok) => router.replace(ok ? next : { pathname: "/login", query: { next } }));
  }, [next, router]);

  return <Loader size="full" label={t("signingIn")} />;
}
