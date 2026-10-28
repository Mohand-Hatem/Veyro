"use client";
/* eslint-disable @next/next/no-img-element -- the server already stored a small square WebP; next/image would add a second optimizer */

import { useState, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Loader } from "@/components/loader/loader";
import { useShell } from "@/components/shell/shell-context";
import { ApiError } from "@/lib/api";
import { initials } from "@/lib/dashboard";
import { highestRole, nameOk, ownedPlan, passwordOk, passwordScore, themeToNext, useChangePassword, useProfile, useRemoveAvatar, useUpdateProfile, type Locale, type Profile as ProfileData, type ThemePref } from "@/lib/profile";
import "@/components/dashboard/illustration.css";
import "@/components/dashboard/dashboard.css";
import "@/components/projects/projects.css";
import "@/components/projects/create-project.css";
import "@/components/ui/badges.css";
import "@/components/billing/billing.css";
import { PhotoDialog } from "./photo-dialog";
import "./profile.css";

const CAMERA = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
const LOCALES: [Locale, string][] = [["EN", "English"], ["AR", "العربية"]];
const THEMES: [ThemePref, "light" | "dark" | "system"][] = [["LIGHT", "light"], ["DARK", "dark"], ["SYSTEM", "system"]];
const METER = ["mWeak", "mWeak", "mFair", "mGood", "mStrong"] as const;

// SCR-ACC-01 / SCR-ACC-02. Markup and class names follow screens/groups/06-account-governance/profile.html (Parity Gate).
// Any signed-in person. The photo or avatar is chosen in PhotoDialog; the server stores only a small processed picture.
export function Profile() {
  const t = useTranslations("Profile");
  const ts = useTranslations("Shell");
  const tw = useTranslations("Work");
  const { workspace, notify } = useShell();
  const q = useProfile();
  const head = (
    <div className="ap-ovh">
      <nav className="bd-crumbs" aria-label={tw("breadcrumb")}>
        {workspace ? <Link href={`/w/${workspace.slug}`}>{ts("navDash")}</Link> : <span>{ts("navDash")}</span>}<span aria-hidden="true">/</span><b>{t("crumb")}</b>
      </nav>
    </div>
  );
  if (q.isError && !q.data) {
    return (
      <div className="st-page pf-page">
        {head}
        <section className="ap-card st-error" role="alert">
          <b>{t("errT")}</b>
          <p>{t("errD")}</p>
          <button type="button" className="pm-btn pm-ghost" onClick={() => q.refetch()}>{tw("retry")}</button>
        </section>
      </div>
    );
  }
  if (!q.data) return <Loader />;
  return <ProfileView p={q.data} head={head} notify={notify} />;
}

function ProfileView({ p, head, notify }: { p: ProfileData; head: ReactNode; notify: (m: string) => void }) {
  const t = useTranslations("Profile");
  const ts = useTranslations("Shell");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const update = useUpdateProfile();
  const change = useChangePassword();
  const removePhoto = useRemoveAvatar();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoBad, setPhotoBad] = useState<string | null>(null);
  const tag = locale === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const roleLabel = ts({ owner: "roleOwner", admin: "roleAdmin", member: "roleMember" }[highestRole(p)] as "roleOwner");
  const tier = (k: ProfileData["aiSubscription"]["tier"]) => t(`tier${k}`);

  const [name, setName] = useState(p.name);
  const [nameErr, setNameErr] = useState("");
  const [alert, setAlert] = useState("");
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [pwErr, setPwErr] = useState<{ cur?: string; nw?: string; cf?: string }>({});
  const [pwAlert, setPwAlert] = useState("");
  const [pwDone, setPwDone] = useState<number | null>(null);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (update.isPending) return;
    if (!nameOk(name)) { setNameErr(t("eName")); document.getElementById("pf-name")?.focus(); return; }
    setNameErr("");
    try {
      await update.mutateAsync({ name: name.trim() });
      setAlert("");
      notify(t("saved"));
    } catch {
      setAlert(t("eGeneric"));
    }
  }

  async function dropPhoto() {
    try {
      await removePhoto.mutateAsync();
      notify(t(p.avatarType === "PRESET" ? "avatarSaved" : "photoRemoved"));
    } catch {
      notify(t("ePhoto"));
    }
  }

  // The saved choice also applies on this device right away.
  function applyHere(patch: { locale?: Locale; theme?: ThemePref }) {
    if (patch.theme) setTheme(themeToNext(patch.theme));
    if (patch.locale) router.replace(pathname, { locale: patch.locale.toLowerCase() });
  }
  // Saves what changed. A choice that is already saved but not yet in effect here (the header toggles are per device) is just applied.
  async function choose(patch: { locale?: Locale; theme?: ThemePref }) {
    if (patch.locale === p.preferences.locale || patch.theme === p.preferences.theme) {
      applyHere(patch);
      return;
    }
    try {
      await update.mutateAsync(patch);
    } catch {
      notify(t("eGeneric"));
      return;
    }
    notify(t("saved"));
    applyHere(patch);
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (change.isPending) return;
    setPwDone(null);
    setPwAlert("");
    const errs: typeof pwErr = {};
    if (!cur) errs.cur = t("eCurReq");
    if (!passwordOk(nw)) errs.nw = t("eRule");
    else if (cf !== nw) errs.cf = t("eMatch");
    setPwErr(errs);
    if (errs.cur || errs.nw || errs.cf) {
      document.getElementById(errs.cur ? "pw-cur" : errs.nw ? "pw-new" : "pw-conf")?.focus();
      return;
    }
    try {
      const r = await change.mutateAsync({ currentPassword: cur, newPassword: nw });
      setCur(""); setNw(""); setCf("");
      setPwDone(r.otherSessionsRevoked);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "INVALID_CURRENT_PASSWORD") { setPwErr({ cur: t("eCur") }); document.getElementById("pw-cur")?.focus(); }
      else if (code === "PASSWORD_UNCHANGED") { setPwErr({ nw: t("eSame") }); document.getElementById("pw-new")?.focus(); }
      else setPwAlert(t("eGeneric"));
    }
  }

  const score = passwordScore(nw);
  const plan = ownedPlan(p);
  const tiles: [string | number, string, boolean][] = [
    [p.stats.workspaces, t("sWs"), false], [p.stats.projects, t("sPr"), false], [p.stats.openTasks, t("sTk"), false],
    [`${tier(p.aiSubscription.tier)} · ${p.aiSubscription.dailyQuota}/${t("perDay")}`, t("sAi"), true],
  ];
  if (plan?.account.plan) tiles.push([`${tier(plan.account.plan.tier)} · ${plan.account.name}`, t("sPlan"), true]);

  const ar = p.preferences.locale === "AR";
  const th = p.preferences.theme;
  const dark = th === "DARK" || (th === "SYSTEM" && resolvedTheme === "dark");

  return (
    <div className="st-page pf-page">
      {head}
      <div className="pf-wrap" id="pf-content">
        <section className="pf-hero il-scene" aria-labelledby="pf-name-h">
          <div className="pf-hero-l">
            <button type="button" className={`pf-avatar${p.avatarUrl && photoBad !== p.avatarUrl ? " has-img" : ""}`} id="pf-avatar" aria-label={t("avatarLabel")} disabled={removePhoto.isPending} onClick={() => setPhotoOpen(true)}>{p.avatarUrl && photoBad !== p.avatarUrl ? <img className="av-img" src={p.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setPhotoBad(p.avatarUrl)} /> : <span id="pf-av-t">{initials(p.name, p.email)}</span>}<i aria-hidden="true">{CAMERA}</i></button>
            <div className="pf-id-t">
              <h2 id="pf-name-h">{p.name}</h2>
              <p className="pf-mail"><span id="pf-mail">{p.email}</span> <span className={`pf-ver ${p.isEmailVerified ? "is-ok" : "is-no"}`} id="pf-ver">{p.isEmailVerified ? t("verified") : t("unverified")}</span></p>
              <p className="pf-since" id="pf-since">{`${t("since", { date: new Date(p.createdAt).toLocaleDateString(tag, { year: "numeric", month: "long" }) })} · ${roleLabel}`}</p>
              <p className="pf-hint">{t("heroN")}</p>
              {p.avatarUrl && <button type="button" className="pf-photo-rm" disabled={removePhoto.isPending} onClick={dropPhoto}>{t(p.avatarType === "PRESET" ? "useInitials" : "photoRemove")}</button>}
            </div>
          </div>
          <div className="il-illu pf-ill">
            <svg viewBox="0 0 420 240" role="img" aria-label={t("heroSvg")}>
              <g className="il-dots" aria-hidden="true"><path d="M176 34 C150 14 126 14 112 40" /></g>
              <g className="il-float"><g>
                <rect className="il-paper il-line" x="178" y="12" width="230" height="216" rx="18" />
                <text className="il-t3" x="198" y="40" style={{ fontSize: "12px" }}>{t("lang")}</text>
                <rect className="il-pill" x="198" y="50" width="124" height="28" rx="14" />
                <rect className="il-brandfill" id="pfs-l-en" x="200" y="52" width="60" height="24" rx="12" style={{ strokeWidth: 0, display: ar ? "none" : undefined }} />
                <rect className="il-brandfill" id="pfs-l-ar" x="262" y="52" width="58" height="24" rx="12" style={{ strokeWidth: 0, display: ar ? undefined : "none" }} />
                <text className="il-pill-t" x="230" y="69" id="pfs-t-en" style={{ fontSize: "12px", fontWeight: 800, fill: ar ? undefined : "#fff" }}>EN</text>
                <text className="il-pill-t" x="291" y="69" id="pfs-t-ar" style={{ fontSize: "13px", fontWeight: 800, fill: ar ? "#fff" : undefined }}>ع</text>
                <path d="M198 98 H388" stroke="var(--il-ink)" strokeWidth="1.4" strokeDasharray="2 6" opacity=".35" />
                <text className="il-t3" x="198" y="124" style={{ fontSize: "12px" }}>{t("theme")}</text>
                <rect className="il-pill" x="198" y="134" width="64" height="28" rx="14" id="pfs-track" />
                <circle className="il-brandfill" id="pfs-knob" cx={dark ? 248 : 212} cy="148" r="10" style={{ strokeWidth: 2 }} />
                <text className="il-t3" id="pfs-th" x="274" y="153" style={{ fontSize: "12px" }}>{t(themeToNext(th))}</text>
                <path d="M198 182 H388" stroke="var(--il-ink)" strokeWidth="1.4" strokeDasharray="2 6" opacity=".35" />
                <text className="il-t3" x="198" y="206" style={{ fontSize: "12px" }}>{t("pwT")}</text>
                <g fill="var(--il-ink)" opacity=".55"><circle cx="304" cy="202" r="3" /><circle cx="318" cy="202" r="3" /><circle cx="332" cy="202" r="3" /><circle cx="346" cy="202" r="3" /><circle cx="360" cy="202" r="3" /><circle cx="374" cy="202" r="3" /></g>
              </g></g>
              <g transform="translate(-19 -190)">
                <path className="il-arm-o" d="M168 372 L206 350 L190 290" /><path className="il-arm-f" d="M168 372 L206 350 L190 290" /><circle className="il-fist" cx="186" cy="279" r="12" />
                <path className="il-body" d="M62 420 C62 378 92 350 120 350 C148 350 176 378 176 420 Z" />
                <polygon className="il-emblem" points="119,370 131,377 131,391 119,398 107,391 107,377" />
                <rect className="il-neck" x="111" y="336" width="16" height="20" rx="6" />
                <circle className="il-head" cx="119" cy="308" r="32" />
                <path className="il-hair" d="M87 306 C84 272 106 264 121 266 C140 268 154 284 151 308 C146 294 136 286 122 286 C106 286 94 292 87 306 Z" />
                <path className="il-hair" d="M88 306 C82 322 86 336 97 340 L100 318 Z" /><circle className="il-hair" cx="134" cy="264" r="10" />
                <path className="il-face" d="M99 314 q5 4 10 0 M121 314 q5 4 10 0 M105 327 q8 7 16 0" />
              </g>
            </svg>
          </div>
        </section>

        <div className="pf-cols">
          <div className="pf-col">
            <form className="ap-card pf-form" id="pf-form" onSubmit={saveName} noValidate aria-labelledby="pf-edit-h">
              <header className="ap-ch"><h2 id="pf-edit-h">{t("editT")}</h2></header>
              <div className="pm-alert" id="pf-alert" role="alert" hidden={!alert}>{alert}</div>
              <div className={`pm-f${nameErr ? " is-bad" : ""}`} id="pf-f-name">
                <div className="pm-lrow"><label htmlFor="pf-name">{t("name")}</label><span className="pm-count" id="pf-count" aria-hidden="true">{name.length}/100</span></div>
                <input id="pf-name" name="name" type="text" maxLength={100} autoComplete="name" aria-describedby="pf-name-e" value={name} onChange={(e) => { setName(e.target.value); setNameErr(""); }} />
                <p className="pm-err" id="pf-name-e" hidden={!nameErr}>{nameErr}</p>
              </div>
              <div className="pm-f">
                <div className="pm-lrow"><label htmlFor="pf-email">{t("email")}</label><span className="pm-count">{t("emailH")}</span></div>
                <input id="pf-email" type="email" readOnly autoComplete="email" value={p.email} />
              </div>
              <div className="pm-foot"><button type="submit" className="pm-btn pm-go" id="pf-save" aria-busy={update.isPending} disabled={update.isPending}><span className="pm-spin" aria-hidden="true" /><span>{t("save")}</span></button></div>
            </form>

            <form className="ap-card pf-form" id="pw-form" onSubmit={savePassword} noValidate aria-labelledby="pw-h" autoComplete="off">
              <input type="text" name="username" autoComplete="username" hidden aria-hidden="true" tabIndex={-1} />
              <header className="ap-ch"><h2 id="pw-h">{t("pwT")}</h2><span className="st-note">{t("pwN")}</span></header>
              <div className="pm-alert" id="pw-alert" role="alert" hidden={!pwAlert}>{pwAlert}</div>
              <div className="pw-ok" id="pw-ok" role="status" hidden={pwDone === null}>{pwDone === null ? "" : t("pwOk", { n: pwDone })}</div>
              <div className={`pm-f${pwErr.cur ? " is-bad" : ""}`} id="pw-f-cur">
                <label htmlFor="pw-cur">{t("pwCur")}</label>
                <input id="pw-cur" name="current" type="password" autoComplete="current-password" aria-describedby="pw-cur-e" value={cur} onChange={(e) => { setCur(e.target.value); setPwErr((x) => ({ ...x, cur: undefined })); }} />
                <p className="pm-err" id="pw-cur-e" hidden={!pwErr.cur}>{pwErr.cur}</p>
              </div>
              <div className={`pm-f${pwErr.nw ? " is-bad" : ""}`} id="pw-f-new">
                <label htmlFor="pw-new">{t("pwNew")}</label>
                <input id="pw-new" name="new" type="password" autoComplete="new-password" aria-describedby="pw-new-e pw-meter" value={nw} onChange={(e) => { setNw(e.target.value); setPwErr((x) => ({ ...x, nw: undefined })); }} />
                <div className="pw-meter" id="pw-meter" aria-live="polite">
                  <span className="pw-bars" aria-hidden="true">{[0, 1, 2, 3].map((k) => <i key={k} className={k < score ? `on s${score}` : undefined} />)}</span>
                  <small id="pw-meter-t">{nw ? t(METER[score]) : t("mEmpty")}</small>
                </div>
                <p className="pm-err" id="pw-new-e" hidden={!pwErr.nw}>{pwErr.nw}</p>
              </div>
              <div className={`pm-f${pwErr.cf ? " is-bad" : ""}`} id="pw-f-conf">
                <label htmlFor="pw-conf">{t("pwConf")}</label>
                <input id="pw-conf" name="confirm" type="password" autoComplete="new-password" aria-describedby="pw-conf-e" value={cf} onChange={(e) => { setCf(e.target.value); setPwErr((x) => ({ ...x, cf: undefined })); }} />
                <p className="pm-err" id="pw-conf-e" hidden={!pwErr.cf}>{pwErr.cf}</p>
              </div>
              <div className="pm-foot"><button type="submit" className="pm-btn pm-go" id="pw-save" aria-busy={change.isPending} disabled={change.isPending}><span className="pm-spin" aria-hidden="true" /><span>{t("pwGo")}</span></button></div>
            </form>
          </div>

          <div className="pf-col">
            <section className="ap-card pf-foot" aria-labelledby="pf-foot-h">
              <header className="ap-ch"><h2 id="pf-foot-h">{t("footT")}</h2></header>
              <dl className="pf-stats" id="pf-stats">
                {tiles.map(([v, l, txt]) => <div key={l} className={txt ? "is-txt" : undefined}><dd>{v}</dd><dt>{l}</dt></div>)}
              </dl>
              {p.workspaces.length > 0 ? (
                <div className="pf-ws" id="pf-ws" role="list" aria-label={t("wsList")}>
                  {p.workspaces.map((w) => (
                    <div className="pf-w" role="listitem" key={w.id}>
                      <span className="pf-wav">{initials(w.name)}</span>
                      <span className="pf-wn"><b>{w.name}</b><small>{t("projectsN", { n: w.projectCount })}</small></span>
                      <span className="pf-wt">{w.isAccountOwner && <span className="ap-st st-active">{t("ownerTag")}</span>}<span className="ap-st st-todo">{t(`r${w.role}`)}</span></span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pf-empty" id="pf-ws-empty">
                  <b>{t("wsNoneT")}</b>
                  <p>{t("wsNoneD")}</p>
                  <Link className="pm-btn pm-go st-sm" href="/onboarding">{t("wsNoneB")}</Link>
                </div>
              )}
            </section>

            <section className="ap-card pf-prefs" aria-labelledby="pf-pref-h">
              <header className="ap-ch"><h2 id="pf-pref-h">{t("prefT")}</h2><span className="st-note">{t("prefN")}</span></header>
              <div className="pf-pr">
                <div><b>{t("lang")}</b><p>{t("langD")}</p></div>
                <div className="ap-seg" id="pf-lang" role="radiogroup" aria-label={t("lang")}>
                  {LOCALES.map(([v, label]) => <button key={v} type="button" role="radio" aria-checked={p.preferences.locale === v} data-v={v} onClick={() => choose({ locale: v })}>{label}</button>)}
                </div>
              </div>
              <div className="pf-pr">
                <div><b>{t("theme")}</b><p>{t("themeD")}</p></div>
                <div className="ap-seg" id="pf-theme" role="radiogroup" aria-label={t("theme")}>
                  {THEMES.map(([v, key]) => <button key={v} type="button" role="radio" aria-checked={p.preferences.theme === v} data-v={v} onClick={() => choose({ theme: v })}>{t(key)}</button>)}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      <PhotoDialog open={photoOpen} profile={p} onClose={() => setPhotoOpen(false)} notify={notify} />
    </div>
  );
}
