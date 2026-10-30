"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useShell } from "@/components/shell/shell-context";
import { useFormat } from "@/components/dashboard/use-format";
import { ApiError } from "@/lib/api";
import { avatarClass } from "@/lib/dashboard";
import { Avatar } from "@/components/ui/avatar";
import {
  daysUntil, settingsErrorKey, useChangeRole, useInvitations, useMembers, useRemoveMember, useResendInvitation, useRevokeInvitation, useUpdateWorkspace, useWorkspaceDetails, validSlug,
  type WsMember, type WsRole,
} from "@/lib/settings";
import { ConfirmDialog, LinkDialog, type Ask } from "./dialogs";
import { InviteDialog } from "./invite-dialog";
import "@/components/dashboard/illustration.css";
import "@/components/dashboard/dashboard.css";
import "@/components/projects/projects.css";
import "@/components/ui/badges.css";
import "./settings.css";
import { usePersonName } from "@/lib/person";

const CAPTION_MS = 5200;
const TRASH = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" /></svg>;
const codeOf = (err: unknown) => (err instanceof ApiError ? err.code : "");

// SCR-SET-01. Markup and class names follow screens/groups/03-workspace-dashboard/settings.html (Parity Gate).
// Only workspace admins and the account owner get here; the server answers 403 to everyone else, so members see the explanation instead.
export function Settings() {
  const t = useTranslations("Settings");
  const tw = useTranslations("Work");
  const { workspace, role } = useShell();
  const manager = role !== "member";
  const slug = workspace?.slug ?? "";
  const details = useWorkspaceDetails(workspace?.id, manager);
  const members = useMembers(workspace?.id, manager);
  const invitations = useInvitations(workspace?.id, manager);

  const head = <div className="ap-ovh"><h2>{t("sub")}</h2></div>;
  if (role === "member" && workspace) {
    return (
      <div className="st-page">
        {head}
        <section className="ap-empty st-denied">
          <div className="ap-empty-ill" aria-hidden="true">
            <svg viewBox="0 0 220 150"><rect className="e-doc" x="62" y="28" width="96" height="86" rx="14" /><circle className="e-plus-c" cx="110" cy="62" r="17" /><path className="e-plus" d="M104 62h12M110 56v12" transform="rotate(45 110 62)" /><rect className="e-fold-f" x="82" y="86" width="56" height="10" rx="5" /></svg>
          </div>
          <h2>{t("deniedT")}</h2>
          <p>{t("deniedD")}</p>
          <Link className="ap-btn st-back" href={`/w/${slug}`}>{t("backDash")}</Link>
        </section>
      </div>
    );
  }
  const failed = (details.isError && !details.data) || (members.isError && !members.data) || (invitations.isError && !invitations.data);
  if (failed) {
    return (
      <div className="st-page">
        {head}
        <section className="ap-card st-error" role="alert">
          <b>{t("errT")}</b>
          <p>{t("errD")}</p>
          <button type="button" className="pm-btn pm-ghost" onClick={() => { void details.refetch(); void members.refetch(); void invitations.refetch(); }}>{tw("retry")}</button>
        </section>
      </div>
    );
  }
  return (
    <div className="st-page">
      {head}
      <div id="st-content">
        <div className="st-top">
          {details.data ? <DetailsCard key={`${details.data.name}|${details.data.slug}`} /> : <section className="ap-card st-details" aria-hidden="true" />}
          <RolesScene />
        </div>
        <MembersCard />
        <InvitationsCard />
      </div>
    </div>
  );
}

function DetailsCard() {
  const t = useTranslations("Settings");
  const { workspace, notify } = useShell();
  const router = useRouter();
  const { date } = useFormat();
  const w = useWorkspaceDetails(workspace?.id, true).data!;
  const update = useUpdateWorkspace(workspace?.id);
  const [name, setName] = useState(w.name);
  const [slug, setSlug] = useState(w.slug);
  const [errName, setErrName] = useState("");
  const [errSlug, setErrSlug] = useState("");
  const busy = update.isPending;
  const dirty = name.trim() !== w.name || slug.trim().toLowerCase() !== w.slug;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim(), s = slug.trim().toLowerCase();
    const nameBad = n.length < 2, slugBad = !validSlug(s);
    setErrName(nameBad ? t("eName") : "");
    setErrSlug(slugBad ? t("eSlug") : "");
    if (nameBad || slugBad || !dirty || busy) return;
    const body: { name?: string; slug?: string } = {};
    if (n !== w.name) body.name = n;
    if (s !== w.slug) body.slug = s;
    try {
      await update.mutateAsync(body);
      notify(body.slug ? t("slugChanged") : t("saved"));
      if (body.slug) router.replace(`/w/${body.slug}/settings`); // the old address no longer opens this workspace
    } catch (err) {
      if (codeOf(err) === "WORKSPACE_SLUG_TAKEN") {
        setErrSlug(`${t("eTaken")} ${s}-2`);
        document.getElementById("st-slug")?.focus();
      } else notify(t(settingsErrorKey(codeOf(err))));
    }
  }
  const discard = () => { setName(w.name); setSlug(w.slug); setErrName(""); setErrSlug(""); };

  return (
    <section className="ap-card st-details" aria-labelledby="st-d-h">
      <header className="ap-ch"><h2 id="st-d-h">{t("details")}</h2><span className="ap-chip" id="st-counts">{t("counts", { members: w._count.members, projects: w._count.projects })}</span></header>
      <form id="st-form" onSubmit={onSubmit} noValidate>
        <div className={`pm-f${errName ? " is-bad" : ""}`} id="st-f-name">
          <label htmlFor="st-name">{t("name")}</label>
          <input id="st-name" name="name" type="text" maxLength={100} autoComplete="off" aria-describedby="st-name-e" value={name} onChange={(e) => { setName(e.target.value); setErrName(""); }} />
          <p className="pm-err" id="st-name-e" hidden={!errName}>{errName}</p>
        </div>
        <div className={`pm-f${errSlug ? " is-bad" : ""}`} id="st-f-slug">
          <label htmlFor="st-slug">{t("slug")}</label>
          <div className="st-slugrow"><span className="st-slugpre" aria-hidden="true">veyro.app/w/</span><input id="st-slug" name="slug" type="text" maxLength={50} autoComplete="off" spellCheck={false} aria-describedby="st-slug-h st-slug-e" value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setErrSlug(""); }} /></div>
          <p className="pm-hint" id="st-slug-h">{t("slugHint")}</p>
          <p className="pm-err" id="st-slug-e" hidden={!errSlug}>{errSlug}</p>
        </div>
        <div className="st-foot">
          <button type="button" className="pm-btn pm-ghost" id="st-reset" disabled={!dirty || busy} onClick={discard}>{t("discard")}</button>
          <button type="submit" className="pm-btn pm-go" id="st-save" disabled={!dirty || busy} aria-busy={busy}><span className="pm-spin" aria-hidden="true" /><span>{t("save")}</span></button>
        </div>
      </form>
      <dl className="st-meta" id="st-meta">
        <div><dt>{t("account")}</dt><dd>{w.account.name}</dd></div>
        <div><dt>{t("created")}</dt><dd>{date(w.createdAt, true)}</dd></div>
      </dl>
    </section>
  );
}

function RolesScene() {
  const t = useTranslations("Settings");
  const [cur, setCur] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCur((c) => (c + 1) % 3), CAPTION_MS);
    return () => clearInterval(id);
  }, [cur]); // a click on the pager changes cur and so restarts the timer
  const bold = { b: (c: ReactNode) => <b>{c}</b> };
  const captions: ReactNode[] = [t.rich("cap1", bold), t.rich("cap2", bold), t.rich("cap3", bold)];
  const names = [t("cOwner"), t("cAdmin"), t("cMember")];
  return (
    <aside className="st-roles il-scene" aria-label={t("rolesLabel")}>
      <div className="il-illu">
                <svg viewBox="0 0 420 400" role="img" aria-label={t("rolesSvg")}>
                  <g className="il-dots" aria-hidden="true"><path d="M106 240 C96 210 80 180 72 154"/><path d="M210 188 C210 175 210 165 210 154"/><path d="M314 240 C324 210 340 180 348 154"/></g>
                  <g className={`rc${cur === 0 ? " is-hi" : ""}`}><g className="il-float">
                    <rect className="il-paper il-line" x="10" y="14" width="120" height="136" rx="16"/>
                    <circle className="il-tick-c" cx="26" cy="34" r="5"/><text className="il-t3" x="38" y="38">{t("cOwner")}</text>
                    <circle className="il-soft" cx="40" cy="78" r="18"/><path className="il-hair" d="M22 74 C24 54 56 54 58 74 C50 66 30 66 22 74 Z"/><circle className="il-eye" cx="34" cy="82" r="2"/><circle className="il-eye" cx="46" cy="82" r="2"/><path className="il-face" d="M34 90 q6 5 12 0" style={{ strokeWidth: "2" }}/>
                    <text className="il-t2" x="22" y="116" style={{ fontSize: "11.5px" }}>{t("cOwner1")}</text><text className="il-t2" x="22" y="133" style={{ fontSize: "11.5px" }}>{t("cOwner2")}</text>
                  </g></g>
                  <g className={`rc${cur === 1 ? " is-hi" : ""}`}><g className="il-float d2">
                    <rect className="il-paper il-line" x="150" y="14" width="120" height="136" rx="16"/>
                    <circle cx="166" cy="34" r="5" fill="var(--il-ink)"/><text className="il-t3" x="178" y="38">{t("cAdmin")}</text>
                    <circle className="il-soft" cx="180" cy="78" r="18"/><path className="il-hair" d="M160 76 C160 54 200 54 200 76 C192 66 170 66 160 76 Z"/><circle className="il-eye" cx="174" cy="82" r="2"/><circle className="il-eye" cx="186" cy="82" r="2"/><path className="il-face" d="M174 90 q6 5 12 0" style={{ strokeWidth: "2" }}/>
                    <text className="il-t2" x="162" y="116" style={{ fontSize: "11.5px" }}>{t("cAdmin1")}</text><text className="il-t2" x="162" y="133" style={{ fontSize: "11.5px" }}>{t("cAdmin2")}</text>
                  </g></g>
                  <g className={`rc${cur === 2 ? " is-hi" : ""}`}><g className="il-float d3">
                    <rect className="il-paper il-line" x="290" y="14" width="120" height="136" rx="16"/>
                    <circle cx="306" cy="34" r="5" fill="none" stroke="var(--il-ink)" strokeWidth="2"/><text className="il-t3" x="318" y="38">{t("cMember")}</text>
                    <circle className="il-soft" cx="320" cy="78" r="18"/><path className="il-hair" d="M302 74 C304 56 336 56 338 74 C330 68 310 68 302 74 Z"/><circle className="il-eye" cx="314" cy="82" r="2"/><circle className="il-eye" cx="326" cy="82" r="2"/><path className="il-face" d="M314 90 q6 5 12 0" style={{ strokeWidth: "2" }}/>
                    <text className="il-t2" x="302" y="116" style={{ fontSize: "11.5px" }}>{t("cMember1")}</text><text className="il-t2" x="302" y="133" style={{ fontSize: "11.5px" }}>{t("cMember2")}</text>
                  </g></g>
                  <path className="il-arm-o" d="M172 328 L134 306 L112 264"/><path className="il-arm-f" d="M172 328 L134 306 L112 264"/><circle className="il-fist" cx="108" cy="254" r="12"/>
                  <path className="il-arm-o" d="M248 328 L286 306 L308 264"/><path className="il-arm-f" d="M248 328 L286 306 L308 264"/><circle className="il-fist" cx="312" cy="254" r="12"/>
                  <path className="il-body" d="M150 400 C150 332 176 290 210 290 C244 290 270 332 270 400 Z"/>
                  <polygon className="il-emblem" points="210,314 225,323 225,341 210,350 195,341 195,323"/>
                  <rect className="il-neck" x="202" y="268" width="16" height="24" rx="6"/>
                  <circle className="il-head" cx="210" cy="238" r="34"/>
                  <path className="il-hair" d="M174 236 C170 200 196 192 212 194 C234 196 250 214 246 240 C240 224 228 214 212 214 C196 214 182 222 174 236 Z"/>
                  <path className="il-hair" d="M175 236 C168 258 172 276 186 282 L190 254 Z"/><path className="il-hair" d="M245 240 C252 260 247 278 235 284 L231 256 Z"/>
                  <path className="il-hair" d="M178 228 C196 208 232 208 246 234 C232 220 206 218 178 228 Z"/>
                  <path className="il-face" d="M186 244 q6 5 12 0 M208 244 q6 5 12 0 M194 258 q10 8 20 0"/>
                </svg>
      </div>
      <div className="il-caps" aria-live="polite">
        {captions.map((c, i) => <p key={i} className={`il-cap${cur === i ? " is-on" : ""}`}>{c}</p>)}
      </div>
      <div className="il-pager" role="tablist" aria-label={t("rolesPager")}>
        {names.map((n, i) => <button key={i} type="button" role="tab" className={cur === i ? "is-on" : undefined} aria-label={n} aria-selected={cur === i} onClick={() => setCur(i)} />)}
      </div>
    </aside>
  );
}

function MembersCard() {
  const t = useTranslations("Settings");
  const { workspace, notify, user } = useShell();
  const { date } = useFormat();
  const list = useMembers(workspace?.id, true);
  const change = useChangeRole(workspace?.id);
  const remove = useRemoveMember(workspace?.id);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | WsRole>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [inviting, setInviting] = useState(false);

  const all = list.data ?? [];
  const needle = q.trim().toLowerCase();
  const rows = all.filter((m) => (filter === "all" || m.role === filter) && (!needle || m.name.toLowerCase().includes(needle) || m.email.toLowerCase().includes(needle)));
  const roleLabel = (r: WsRole) => t(r === "ADMIN" ? "admin" : "member");

  async function onRole(m: WsMember, role: WsRole) {
    setBusyId(m.id);
    try {
      await change.mutateAsync({ memberId: m.id, role });
      notify(`${t("roleOk")}: ${m.name} → ${roleLabel(role)}`);
    } catch (err) {
      notify(t(settingsErrorKey(codeOf(err))));
    } finally {
      setBusyId(null);
    }
  }
  const askRemove = (m: WsMember) => setAsk({
    title: t("rmT"),
    body: `${m.name} (${m.email}). ${t("rmD")}`,
    cta: t("rmYes"),
    run: async () => {
      try {
        const r = await remove.mutateAsync(m.id);
        notify(`${t("removed")}${r.unassignedTasks ? ` · ${r.unassignedTasks} ${t("unassigned")}` : ""}`);
      } catch (err) {
        notify(t(settingsErrorKey(codeOf(err))));
      }
    },
  });

  return (
    <>
    <section className="ap-card st-members" aria-labelledby="st-m-h">
      <header className="ap-ch st-mh">
        <h2 id="st-m-h"><span>{t("members")}</span> <span className="st-count" id="st-m-count">{list.isPending ? "" : all.length}</span></h2>
        <div className="st-tools">
          <label className="ap-search st-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg><span className="ap-sr">{t("searchLabel")}</span><input id="st-q" type="search" placeholder={t("searchPh")} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <label className="ap-select"><span className="ap-sr">{t("filterLabel")}</span>
            <select id="st-filter" value={filter} onChange={(e) => setFilter(e.target.value as "all" | WsRole)}><option value="all">{t("fAll")}</option><option value="ADMIN">{t("fAdmin")}</option><option value="MEMBER">{t("fMember")}</option></select>
          </label>
          <button type="button" className="pm-btn pm-go st-invite" id="st-invite" onClick={() => setInviting(true)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg><span>{t("invite")}</span></button>
        </div>
      </header>
      <div className="st-tw" role="table" aria-label={t("members")}>
        <div className="st-tr st-th" role="row"><span role="columnheader">{t("colMember")}</span><span role="columnheader">{t("colRole")}</span><span role="columnheader">{t("colJoined")}</span><span role="columnheader"><span className="ap-sr">{t("colActions")}</span></span></div>
        <div id="st-rows">
          {list.isPending
            ? Array.from({ length: 4 }, (_, i) => <div className="st-tr st-row st-skel" aria-hidden="true" key={i}><span className="st-who"><span className="st-av" /><span className="st-wt"><b /><small /></span></span><span /><span /><span /></div>)
            : rows.map((m) => {
                const me = m.userId === user?.id;
                const fixed = m.isAccountOwner || me;
                return (
                  <div className={`st-tr st-row${busyId === m.id ? " is-busy" : ""}`} role="row" key={m.id}>
                    <span className="st-who" role="cell"><Avatar className={`st-av ${avatarClass(m.userId)}`} name={m.name} url={m.avatarUrl} /><span className="st-wt"><b>{m.name}{me && <> <i className="st-you">{t("you")}</i></>}</b><small>{m.email}</small></span></span>
                    <span role="cell" className="st-rc">
                      {m.isAccountOwner ? <span className="st-badge b-owner">{t("owner")}</span>
                        : me ? <span className={`st-badge b-${m.role.toLowerCase()}`}>{roleLabel(m.role)}</span>
                        : (
                          <label className="ap-select st-rsel"><span className="ap-sr">{t("colRole")}: {m.name}</span>
                            <select value={m.role} disabled={busyId === m.id} onChange={(e) => void onRole(m, e.target.value as WsRole)}><option value="ADMIN">{roleLabel("ADMIN")}</option><option value="MEMBER">{roleLabel("MEMBER")}</option></select>
                          </label>
                        )}
                    </span>
                    <span role="cell" className="st-jd">{date(m.joinedAt, true)}</span>
                    <span role="cell" className="st-ac">{!fixed && <button type="button" className="st-icon" aria-label={`${t("remove")} ${m.name}`} title={t("remove")} onClick={() => askRemove(m)}>{TRASH}</button>}</span>
                  </div>
                );
              })}
        </div>
        <p className="ap-none" id="st-none" hidden={list.isPending || rows.length > 0}>{t("none")}</p>
      </div>
    </section>
    <ConfirmDialog ask={ask} onClose={() => setAsk(null)} />
    <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </>
  );
}

function InvitationsCard() {
  const t = useTranslations("Settings");
  const pn = usePersonName();
  const { workspace, notify } = useShell();
  const list = useInvitations(workspace?.id, true);
  const resend = useResendInvitation(workspace?.id);
  const revoke = useRevokeInvitation(workspace?.id);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rows = list.data ?? [];

  async function onResend(id: string) {
    setBusyId(id);
    try {
      const r = await resend.mutateAsync(id);
      setLink({ email: r.email, url: r.inviteLink });
    } catch (err) {
      notify(t(settingsErrorKey(codeOf(err))));
    } finally {
      setBusyId(null);
    }
  }
  const askRevoke = (id: string, email: string) => setAsk({
    title: t("rvT"),
    body: `${email}. ${t("rvD")}`,
    cta: t("rvYes"),
    run: async () => {
      try {
        await revoke.mutateAsync(id);
        notify(t("revoked"));
      } catch (err) {
        notify(t(settingsErrorKey(codeOf(err))));
      }
    },
  });

  return (
    <>
    <section className="ap-card st-invites" aria-labelledby="st-i-h">
      <header className="ap-ch"><h2 id="st-i-h"><span>{t("pending")}</span> <span className="st-count" id="st-i-count">{list.isPending ? "" : rows.length}</span></h2><span className="st-note">{t("invNote")}</span></header>
      <ul className="st-il" id="st-il">
        {list.isPending ? <li className="st-inv st-skel" aria-hidden="true"><span className="st-iw"><b /><small /></span></li>
          : rows.length ? rows.map((i) => {
              const d = daysUntil(i.expiresAt);
              return (
                <li className="st-inv" key={i.id}>
                  <span className="st-iw"><b>{i.email}</b><small>{t("invitedBy")} {pn(i.inviter.name)}</small></span>
                  <span className="st-ir"><span className={`st-badge b-${i.role.toLowerCase()}`}>{t(i.role === "ADMIN" ? "admin" : "member")}</span>{i.projects.map((p) => <span className="ap-key" key={p.id} title={p.name}>{p.key}</span>)}</span>
                  <span className="st-ie">{i.isExpired ? <><span className="st-badge b-exp">{t("expired")}</span> <small>{t("expiredAgo", { n: Math.abs(d) })}</small></> : <small>{t("expiresIn", { n: d })}</small>}</span>
                  <span className="st-ia">
                    <button type="button" className="pm-btn pm-ghost st-sm" aria-busy={busyId === i.id} disabled={busyId === i.id} onClick={() => void onResend(i.id)}>{t("resend")}</button>
                    <button type="button" className="pm-btn st-sm st-link-danger" onClick={() => askRevoke(i.id, i.email)}>{t("revoke")}</button>
                  </span>
                </li>
              );
            }) : <li className="st-inv-empty">{t("noInv")}</li>}
      </ul>
    </section>
    <ConfirmDialog ask={ask} onClose={() => setAsk(null)} />
    <LinkDialog link={link} onClose={() => setLink(null)} />
    </>
  );
}
