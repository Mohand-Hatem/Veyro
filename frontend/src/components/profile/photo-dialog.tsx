"use client";
/* eslint-disable @next/next/no-img-element -- the crop preview is a local blob and the presets are tiny static SVGs: next/image would only get in the way */

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api";
import { avatarClass, initials } from "@/lib/dashboard";
import { MAX_ZOOM, PRESETS, clampCrop, cropStyle, cropToBlob, isPreset, isStoredPhoto, loadForCrop, presetSrc, type Crop, type Preset, type Source } from "@/lib/avatar";
import { useRemoveAvatar, useSetPreset, useUploadAvatar, type Profile } from "@/lib/profile";
import "@/components/dashboard/dashboard.css";
import "./photo-dialog.css";

const CLOSE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
const CAMERA = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
const TICK = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const MINUS = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>;
const PLUS = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></svg>;
const RING_SHARE = 0.86; // the ring is 86% of the stage (CSS inset 7%)
const MAX_FILE = 20 * 1024 * 1024;

type Choice = Preset | "initials";
type Who = Pick<Profile, "id" | "name" | "email" | "avatarUrl" | "avatarType" | "avatarPresetKey">;

// Native <dialog> kept in sync with an `open` flag; the body is mounted only while open so every opening starts clean.
export function PhotoDialog({ open, profile, onClose, notify }: { open: boolean; profile: Who; onClose: () => void; notify: (m: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} className="pm avd-dlg" aria-labelledby="avd-t" aria-describedby="avd-s" onClose={onClose} onCancel={(e) => { if (busy) e.preventDefault(); }}>
      {open && <PhotoBody profile={profile} onClose={onClose} onBusy={setBusy} notify={notify} />}
    </dialog>
  );
}

function PhotoBody({ profile, onClose, onBusy, notify }: { profile: Who; onClose: () => void; onBusy: (b: boolean) => void; notify: (m: string) => void }) {
  const t = useTranslations("Profile");
  const upload = useUploadAvatar();
  const setPreset = useSetPreset();
  const remove = useRemoveAvatar();
  const busy = upload.isPending || setPreset.isPending || remove.isPending;
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);

  const current: Choice | null = profile.avatarType === "PRESET" && isPreset(profile.avatarPresetKey) ? profile.avatarPresetKey : profile.avatarType === "INITIALS" ? "initials" : null;
  const [tab, setTab] = useState<"upload" | "avatars">(profile.avatarType === "PRESET" ? "avatars" : "upload");
  const [pick, setPick] = useState<Choice | null>(current);
  const [src, setSrc] = useState<Source | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const [alert, setAlert] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(300);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const ring = stage * RING_SHARE;
  const c = src ? clampCrop(crop, src.w, src.h, ring) : crop;

  useEffect(() => () => { if (src) URL.revokeObjectURL(src.url); }, [src]);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage(el.clientWidth));
    ro.observe(el);
    setStage(el.clientWidth);
    return () => ro.disconnect();
  }, [src, tab]);

  const errorText = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : "";
    return code === "STORAGE_NOT_CONFIGURED" ? t("ePhotoOff") : code === "AVATAR_TOO_LARGE" ? t("ePhotoBig") : code === "AVATAR_INVALID_IMAGE" ? t("ePhotoType") : t("ePhoto");
  };

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAlert("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setAlert(t("ePhotoType")); return; }
    if (file.size > MAX_FILE) { setAlert(t("ePhotoBig")); return; }
    setLoading(true);
    try {
      setSrc(await loadForCrop(file));
      setCrop({ zoom: 1, x: 0, y: 0 });
    } catch {
      setAlert(t("pdOpenFail"));
    } finally {
      setLoading(false);
    }
  }

  const moveTo = (x: number, y: number, zoom = c.zoom) => src && setCrop(clampCrop({ zoom, x, y }, src.w, src.h, ring));
  const onDown = (e: PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y }; };
  const onMove = (e: PointerEvent<HTMLDivElement>) => { const d = drag.current; if (d) moveTo(d.cx + e.clientX - d.x, d.cy + e.clientY - d.y); };
  const onUp = () => { drag.current = null; };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 30 : 10;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (move[e.key]) { e.preventDefault(); moveTo(c.x + move[e.key][0], c.y + move[e.key][1]); }
    else if (e.key === "+" || e.key === "=") moveTo(c.x, c.y, c.zoom + 0.1);
    else if (e.key === "-") moveTo(c.x, c.y, c.zoom - 0.1);
  };

  async function save() {
    if (busy) return;
    setAlert("");
    try {
      if (tab === "upload") {
        if (!src) return;
        await upload.mutateAsync(await cropToBlob(src, c, ring));
        notify(t("photoSaved"));
      } else if (pick === "initials") {
        await remove.mutateAsync();
        notify(t("avatarSaved"));
      } else if (pick) {
        await setPreset.mutateAsync(pick);
        notify(t("avatarSaved"));
      }
      onClose();
    } catch (err) {
      setAlert(errorText(err));
    }
  }

  const canSave = tab === "upload" ? !!src : !!pick && pick !== current;
  const preview = (size: number) => src && <span className="avd-pv" style={{ width: size, height: size }}><img src={src.url} alt="" draggable={false} style={cropStyle(c, src.w, src.h, ring, size)} /></span>;

  return (
    <div className="avd">
      <header className="avd-head">
        <div>
          <h2 id="avd-t">{t("pdTitle")}</h2>
          <p id="avd-s">{t("pdSub")}</p>
        </div>
        <button type="button" className="pm-x" aria-label={t("pdClose")} disabled={busy} onClick={onClose}>{CLOSE}</button>
      </header>

      <div className="avd-tabs" role="tablist">
        <button type="button" role="tab" className="avd-tab" aria-selected={tab === "upload"} disabled={busy} onClick={() => setTab("upload")}>{t("pdTabUp")}</button>
        <button type="button" role="tab" className="avd-tab" aria-selected={tab === "avatars"} disabled={busy} onClick={() => setTab("avatars")}>{t("pdTabAv")}</button>
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />

      {tab === "upload" && !src && (
        <div className="avd-zone" role="tabpanel">
          <span className={`avd-ini avd-ini-92 ${avatarClass(profile.id)}`} aria-hidden="true">{initials(profile.name, profile.email)}</span>
          <button type="button" className="pm-btn pm-go" disabled={loading} aria-busy={loading} onClick={() => fileRef.current?.click()}>{CAMERA}<span>{loading ? t("pdOpening") : t("pdChoose")}</span></button>
          <p>{t("pdHint")}</p>
        </div>
      )}

      {tab === "upload" && src && (
        <div className="avd-crop" role="tabpanel">
          <div className="avd-stage" ref={stageRef} tabIndex={0} role="group" aria-label={t("pdCrop")} aria-describedby="avd-hint" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
            <img src={src.url} alt="" draggable={false} style={cropStyle(c, src.w, src.h, ring, ring)} />
            <div className="avd-ring" />
          </div>
          <p className="avd-hint" id="avd-hint">{t("pdMove")}</p>
          <div className="avd-zoom">
            {MINUS}
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={c.zoom} aria-label={t("pdZoom")} onChange={(e) => moveTo(c.x, c.y, Number(e.target.value))} />
            {PLUS}
          </div>
          <div className="avd-prev">{preview(56)}{preview(36)}<span>{t("pdPreview")}</span></div>
        </div>
      )}

      {tab === "avatars" && (
        <div role="tabpanel" className="avd-pick">
          <div className="avd-grid" role="group" aria-label={t("pdTabAv")}>
            <button type="button" className="avd-opt" aria-pressed={pick === "initials"} onClick={() => setPick("initials")}>
              <span className="face"><span className={`avd-ini avd-ini-80 ${avatarClass(profile.id)}`}>{initials(profile.name, profile.email)}</span><span className="tick">{TICK}</span></span>
              <span className="name">{t("pdInitials")}</span>
            </button>
            {PRESETS.map((k) => (
              <button type="button" key={k} className="avd-opt" aria-pressed={pick === k} onClick={() => setPick(k)}>
                <span className="face"><img src={presetSrc(k)} alt="" width={80} height={80} /><span className="tick">{TICK}</span></span>
                <span className="name">{t(`pdP_${k}`)}</span>
              </button>
            ))}
          </div>
          {isStoredPhoto(profile.avatarUrl) && <p className="avd-note">{t("pdNote")}</p>}
        </div>
      )}

      <div className="pm-alert" role="alert" hidden={!alert}>{alert}</div>

      <footer className="pm-foot">
        {tab === "upload" && src ? (
          <button type="button" className="pm-btn pm-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>{t("pdAnother")}</button>
        ) : (
          <button type="button" className="pm-btn pm-ghost" disabled={busy} onClick={onClose}>{t("pdCancel")}</button>
        )}
        <button type="button" className="pm-btn pm-go" aria-busy={busy} disabled={busy || !canSave} onClick={save}>
          <span className="pm-spin" aria-hidden="true" />
          <span>{busy ? t("pdSaving") : tab === "upload" ? t("pdSave") : t("pdSaveAv")}</span>
        </button>
      </footer>
    </div>
  );
}
