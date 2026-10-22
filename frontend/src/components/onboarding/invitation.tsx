"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { DoneCard, FormBanner, useAuthErrors } from "@/components/auth/form-parts";
import { Link, useRouter } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { expiresIn } from "@/lib/slug";
import "@/components/auth/auth.css";
import "./onboarding.css";

type Preview = { workspaceName: string; workspaceSlug: string; inviterName: string; role: "ADMIN" | "MEMBER"; email: string; status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"; expiresAt: string; emailMatches: boolean };
type View = "loading" | "valid" | "accepted" | "expired" | "mismatch" | "invalid";

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// The invitation card. States follow screens/groups/02-auth-onboarding/invitation.html: valid, accepted, expired, mismatch, invalid.
export function Invitation() {
  const t = useTranslations("Invitation");
  const to = useTranslations("Onboarding");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = (useSearchParams().get("token") ?? "").trim();
  const me = useMe();
  const { te, banner, setBanner } = useAuthErrors();
  const [override, setOverride] = useState<View | null>(null);

  const preview = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => api<Preview>(`/invitations/preview?token=${encodeURIComponent(token)}`),
    enabled: !!token,
    retry: false,
  });
  const p = preview.data;

  const accept = useMutation({
    mutationFn: () => api("/invitations/accept", { method: "POST", body: JSON.stringify({ token }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setOverride("accepted");
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "INVITATION_EMAIL_MISMATCH") setOverride("mismatch");
      else if (code === "INVITATION_EXPIRED" || code === "INVITATION_ALREADY_RESOLVED") setOverride("expired");
      else if (code === "RESOURCE_NOT_FOUND") setOverride("invalid");
      else setBanner({ kind: "error", text: te("generic") });
    },
  });

  let view: View = "loading";
  if (!token || (preview.isError && preview.error instanceof ApiError && preview.error.status === 404)) view = "invalid";
  else if (p) {
    if (p.status === "ACCEPTED") view = p.emailMatches ? "accepted" : "invalid";
    else if (p.status !== "PENDING") view = "expired";
    else view = p.emailMatches ? "valid" : "mismatch";
  }
  if (override) view = override;

  async function switchAccount() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      queryClient.clear();
      router.replace({ pathname: "/login", query: { next: `/invitations/accept?token=${token}` } });
    }
  }

  const back = <p className="au-switch"><Link className="au-backlink" href="/onboarding">{t("inv_back")}</Link></p>;

  if (view === "loading") return preview.isError ? <FormBanner banner={{ kind: "error", text: te("network") }} /> : <p aria-busy="true" className="au-sub">…</p>;

  if (view === "valid" && p) {
    return (
      <div className="inv-state" data-state="valid">
        <span className="au-badge" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>
        </span>
        <h1 id="au-title"><span>{t("inv_h1")}</span> <span>{p.workspaceName}</span></h1>
        <p className="au-sub"><b>{p.inviterName}</b> <span>{t("inv_sub")}</span></p>

        <FormBanner banner={banner} />
        <dl className="inv-card">
          <div className="inv-ws-row"><span className="inv-ws-av" aria-hidden="true">{initials(p.workspaceName)}</span><div><b>{p.workspaceName}</b><small>{t("inv_private")}</small></div><span className="inv-role">{t(p.role === "ADMIN" ? "inv_role_admin" : "inv_role_member")}</span></div>
          <div><dt>{t("inv_for")}</dt><dd>{p.email}</dd></div>
          <div><dt>{t("inv_expires")}</dt><dd>{expiresIn(p.expiresAt, locale)}</dd></div>
        </dl>
        <p className="inv-note">{t("inv_note")}</p>

        <button type="button" className={`au-btn${accept.isPending ? " loading" : ""}`} disabled={accept.isPending} onClick={() => accept.mutate()}>
          <span className="au-spin" />
          <span>{t("inv_accept")}</span>
        </button>
        <p className="au-switch"><span>{t("inv_notyou")}</span> <a href="#" onClick={(e) => { e.preventDefault(); switchAccount(); }}>{t("inv_switch_link")}</a></p>
      </div>
    );
  }

  if (view === "accepted") {
    return (
      <DoneCard className="inv-state" title={<><span>{t("inv_ok_t")}</span> <span>{p?.workspaceName}</span></>}>
        <p>{t("inv_ok_d")}</p>
        <Link href={p ? `/w/${p.workspaceSlug}` : "/dashboard"} className="au-btn au-btn-link">{to("pa_open")}</Link>
      </DoneCard>
    );
  }
  if (view === "expired") {
    return (
      <DoneCard icon="clock" className="inv-state" title={t("inv_exp_t")}>
        <p>{t("inv_exp_d")}</p>
        <a href="mailto:?subject=Please%20resend%20my%20Veyro%20invitation" className="au-btn au-btn-link">{t("inv_contact")}</a>
        {back}
      </DoneCard>
    );
  }
  if (view === "mismatch") {
    return (
      <DoneCard icon="alert" className="inv-state" title={t("inv_mm_t")}>
        <p><span>{t("inv_mm_a")}</span> <b className="au-email">{p?.email}</b>. <span>{t("inv_mm_b")}</span> <b className="au-email">{me.data?.email}</b> <span>{t("inv_mm_c")}</span></p>
        <a href="#" className="au-btn au-btn-link" onClick={(e) => { e.preventDefault(); switchAccount(); }}>{t("inv_switch")}</a>
        {back}
      </DoneCard>
    );
  }
  return (
    <DoneCard icon="notFound" className="inv-state" title={t("inv_nf_t")}>
      <p>{t("inv_nf_d")}</p>
      <Link href={{ pathname: "/onboarding", query: { pick: "b" } }} className="au-btn au-btn-link">{t("inv_nf_btn")}</Link>
    </DoneCard>
  );
}
