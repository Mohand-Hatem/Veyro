"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { GithubIcon, GoogleIcon } from "./oauth-icons";

const ENABLED = process.env.NEXT_PUBLIC_OAUTH_ENABLED === "true";

// Identical to the reference. Until OAuth credentials exist (NEXT_PUBLIC_OAUTH_ENABLED=false) a click explains that instead of hitting a broken provider page.
export function OAuthButtons() {
  const t = useTranslations("Auth");
  const go = (provider: "google" | "github", name: string) => {
    // The backend route (proxied by next.config.ts) starts the provider redirect; it is not a Next page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (ENABLED) window.location.href = `/api/v1/auth/${provider}`;
    else toast.info(t("oauthOff", { provider: name }));
  };
  return (
    <>
      <div className="au-oauth">
        <button type="button" data-oauth="google" onClick={() => go("google", "Google")}><GoogleIcon /><span>{t("google")}</span></button>
        <button type="button" data-oauth="github" onClick={() => go("github", "GitHub")}><GithubIcon /><span>{t("github")}</span></button>
      </div>
      <div className="au-or" data-or><span>{t("or")}</span></div>
    </>
  );
}
