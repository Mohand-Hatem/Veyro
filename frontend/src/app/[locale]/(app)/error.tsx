"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useShell } from "@/components/shell/shell-context";
import { ErrorCard } from "@/components/state/error-card";

// A page that throws while rendering ends here, inside the shell, instead of a blank screen. `reset` renders the page again.
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("States");
  const ts = useTranslations("Settings");
  const tw = useTranslations("Work");
  const { workspace } = useShell();
  const queryClient = useQueryClient();
  // Bad data can be what made the page throw, so retrying also drops what is cached and refetches what is on screen.
  const retry = () => {
    void queryClient.resetQueries();
    reset();
  };
  return <ErrorCard title={t("crashT")} text={t("crashD")} retryLabel={tw("retry")} onRetry={retry} homeLabel={ts("backDash")} homeHref={workspace ? `/w/${workspace.slug}` : "/dashboard"} />;
}
