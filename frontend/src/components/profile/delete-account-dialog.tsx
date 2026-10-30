"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { deleteAccountError, ownedAccountName, useDeleteAccount, type Profile } from "@/lib/profile";
import { CLOSE, Modal, Side, bold, useCaptions } from "@/components/billing/billing-dialogs";
import "./delete-account.css";

// SCR-ACC-03 (step G2b), reference: screens/groups/06-account-governance/delete-user.html. The server anonymizes the person (docs/03 rule 5).
export function DeleteAccountDialog({ open, profile, onClose }: { open: boolean; profile: Profile; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal id="du-dlg" titleId="du-t" subId="du-s" open={open} busy={busy} onClose={onClose}>
      {open && <Body profile={profile} onClose={onClose} onBusy={setBusy} />}
    </Modal>
  );
}

function Body({ profile, onClose, onBusy }: { profile: Profile; onClose: () => void; onBusy: (b: boolean) => void }) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const queryClient = useQueryClient();
  const remove = useDeleteAccount();
  const pwRef = useRef<HTMLInputElement>(null);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [alert, setAlert] = useState("");
  const [cur, setCur] = useCaptions();
  const owned = ownedAccountName(profile);
  const busy = remove.isPending;
  const ready = pw.length > 0;

  useEffect(() => { onBusy(busy); }, [busy, onBusy]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setAlert("");
    try {
      await remove.mutateAsync(pw);
      // The server cleared the cookies; drop everything cached for this person and land on the sign-in page.
      queryClient.clear();
      router.replace({ pathname: "/login", query: { deleted: "1" } });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (deleteAccountError(code) === "password") { setPwErr(t("duEPw")); pwRef.current?.focus(); }
      else setAlert(t("duEFail"));
    }
  }

  const head = (sub: string) => (
    <header className="pm-head">
      <div>
        <h2 id="du-t">{t("dzT")}</h2>
        <p id="du-s">{sub}</p>
      </div>
      <button type="button" className="pm-x" id="du-x" aria-label={t("duClose")} onClick={onClose}>{CLOSE}</button>
    </header>
  );

  return (
    <form className="pm-form" id="du-form" onSubmit={onSubmit} noValidate autoComplete="off">
      <input type="text" name="username" autoComplete="username" hidden aria-hidden="true" tabIndex={-1} />
      <div className="pm-main">
        {owned !== null ? (
          <>
            {head(t("duOwnS"))}
            <div className="du-block"><b>{t("duOwnT", { name: owned })}</b><p>{t("duOwnD")}</p></div>
            <footer className="pm-foot">
              <button type="button" className="pm-btn pm-ghost" id="du-cancel" onClick={onClose}>{t("duClose")}</button>
              <Link className="pm-btn pm-go" href="/account/billing" onClick={onClose}>{t("duBilling")}</Link>
            </footer>
          </>
        ) : (
          <>
            {head(t("duS"))}
            <ul className="du-list">
              <li>{t("duL1")}</li>
              <li>{t("duL2")}</li>
              <li>{t("duL3")}</li>
              <li>{t("duL4")}</li>
            </ul>
            <div className="pm-alert" id="du-alert" role="alert" hidden={!alert}>{alert}</div>
            <div className={`pm-f${pwErr ? " is-bad" : ""}`} id="du-f-pw">
              <label htmlFor="du-pw">{t("duPw")}</label>
              <input ref={pwRef} id="du-pw" name="password" type="password" autoComplete="current-password" aria-describedby="du-pw-e du-pw-h" aria-invalid={pwErr ? true : undefined} value={pw} onChange={(e) => { setPw(e.target.value); setPwErr(""); setAlert(""); }} />
              <p className="pm-err" id="du-pw-e" hidden={!pwErr}>{pwErr}</p>
              <p className="du-hint" id="du-pw-h">{t.rich("duHint", { link: (c) => <Link href="/forgot-password">{c}</Link> })}</p>
            </div>
            <footer className="pm-foot">
              <button type="button" className="pm-btn pm-ghost" id="du-cancel" onClick={onClose}>{t("duCancel")}</button>
              <button type="submit" className="pm-btn st-danger" id="du-go" aria-busy={busy} disabled={!ready || busy}><span className="pm-spin" aria-hidden="true" /><span>{busy ? t("duBusy") : t("dzBtn")}</span></button>
            </footer>
          </>
        )}
      </div>

      <Side className="du-side" label={t("duSide")} cur={cur} onPick={setCur} captions={[t.rich("duCap1", bold), t.rich("duCap2", bold), t.rich("duCap3", bold)]}>
        <svg viewBox="0 0 420 420" role="img" aria-label={t("duSvg")}>
          <g className="il-dots" aria-hidden="true"><path d="M104 352 C106 336 108 326 112 316" /><path d="M236 258 C262 240 290 236 316 244" /></g>
          <g className="il-float d2"><rect className="il-paper il-line" x="18" y="34" width="224" height="40" rx="20" /><circle className="il-tick-c" cx="42" cy="54" r="10" /><path className="il-tick" d="M37.5 54 l3.5 3.5 l6 -7" /><text className="il-t3" x="60" y="59" style={{ fontSize: "12.5px" }}>{t("duSvgKeeps")}</text></g>
          <g className="il-float d3"><rect className="il-paper il-line" x="38" y="88" width="178" height="40" rx="20" /><path d="M64 116 L74 98 L84 116 Z" fill="none" stroke="var(--il-brand)" strokeWidth="2.4" strokeLinejoin="round" /><path d="M74 104 v6 M74 113 v.5" stroke="var(--il-brand)" strokeWidth="2.4" strokeLinecap="round" /><text className="il-t3" x="94" y="113" style={{ fontSize: "12.5px" }}>{t("duSvgUndo")}</text></g>
          <rect className="il-soft" x="318" y="176" width="92" height="244" rx="12" /><rect className="il-paper il-line" x="330" y="190" width="68" height="230" rx="8" /><circle className="il-brandfill" cx="344" cy="312" r="5.5" />
          <rect className="il-brandfill" x="332" y="146" width="64" height="24" rx="8" /><path d="M350 158 h26 m-8 -6 l8 6 l-8 6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <g className="il-float">
            <rect className="il-soft" x="22" y="332" width="196" height="88" rx="12" /><rect className="il-paper il-line" x="14" y="320" width="212" height="16" rx="8" />
            <path className="il-folder-b" d="M38 320 v-60 a10 10 0 0 1 10 -10 h32 l11 13 h46 a10 10 0 0 1 10 10 v47 z" />
            <rect className="il-paper il-line" x="52" y="276" width="104" height="44" rx="6" /><path className="il-bar" d="M64 290 h60 M64 302 h80" stroke="var(--il-ink)" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path className="il-brandfill" d="M156 320 v-36 a8 8 0 0 1 8 -8 h14 l8 10 h20 a8 8 0 0 1 8 8 v26 z" />
            <rect className="il-paper il-line" x="46" y="352" width="148" height="34" rx="10" /><circle className="il-slot" cx="68" cy="369" r="10" /><text className="il-t3" x="88" y="374" style={{ fontSize: "12.5px" }}>{t("duSvgName")}</text>
          </g>
          <g transform="translate(150 0)">
            <path className="il-arm-o" d="M168 372 L206 358 L214 304" /><path className="il-arm-f" d="M168 372 L206 358 L214 304" /><circle className="il-fist" cx="214" cy="294" r="12" />
            <path className="il-body" d="M62 420 C62 378 92 350 120 350 C148 350 176 378 176 420 Z" /><polygon className="il-emblem" points="119,370 131,377 131,391 119,398 107,391 107,377" />
            <rect className="il-neck" x="111" y="336" width="16" height="20" rx="6" /><circle className="il-head" cx="119" cy="308" r="32" />
            <path className="il-hair" d="M87 306 C84 272 106 264 121 266 C140 268 154 284 151 308 C146 294 136 286 122 286 C106 286 94 292 87 306 Z" /><path className="il-hair" d="M88 306 C82 322 86 336 97 340 L100 318 Z" /><circle className="il-hair" cx="134" cy="264" r="10" />
            <path className="il-face" d="M99 316 q5 -3 10 0 M121 316 q5 -3 10 0 M108 326 q11 8 22 0" />
          </g>
        </svg>
      </Side>
    </form>
  );
}
