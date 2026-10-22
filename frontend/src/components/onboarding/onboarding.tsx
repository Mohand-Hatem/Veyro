"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { LangToggle, ThemeToggle } from "@/components/auth/auth-topbar";
import { Field, TextInput } from "@/components/auth/fields";
import { FormBanner, SubmitButton, useAuthErrors } from "@/components/auth/form-parts";
import { Link, useRouter } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import { inviteSchema, onboardingSchema } from "@/lib/auth-schemas";
import { useMe, useWorkspaces } from "@/lib/queries";
import { inviteToken, slugify, workspaceSlugFrom } from "@/lib/slug";
import { VisualA, VisualB, VisualC } from "./visuals";
import "@/components/auth/auth.css";
import "./onboarding.css";

type Pick = "a" | "b" | "c";
const CARDS: { key: Pick; Visual: () => React.JSX.Element; tint: string; title: string; text: string; foot: string }[] = [
  { key: "a", Visual: VisualA, tint: "tint-a", title: "ob_a_t", text: "ob_a_d", foot: "ob_a_f" },
  { key: "b", Visual: VisualB, tint: "tint-b", title: "ob_b_t", text: "ob_b_d", foot: "ob_b_f" },
  { key: "c", Visual: VisualC, tint: "tint-c", title: "ob_c_t", text: "ob_c_d", foot: "ob_c_f" },
];
const MSG: Record<string, string> = { len2: "e_len2", slug: "e_slug", invite: "e_invite" };
const CONFLICT_CODES = ["ACCOUNT_SLUG_TAKEN", "WORKSPACE_SLUG_TAKEN"];

// Markup and class names follow screens/groups/02-auth-onboarding/onboarding.html (Parity Gate).
export function Onboarding() {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const workspaces = useWorkspaces();
  const initial = useSearchParams().get("pick");
  const [pick, setPick] = useState<Pick>(initial === "b" || initial === "c" ? initial : "a");
  const [created, setCreated] = useState<{ name: string; slug: string } | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Onboarding is for people without a workspace; everyone else goes to the app.
  useEffect(() => {
    if (workspaces.data?.length && !created) router.replace("/dashboard");
  }, [workspaces.data, created, router]);

  async function signOut() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      queryClient.clear();
      router.replace({ pathname: "/login", query: { signedout: "1" } });
    }
  }

  const onCardKeys = (i: number) => (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + CARDS.length) % CARDS.length;
    cardRefs.current[next]?.focus();
    setPick(CARDS[next].key);
  };

  return (
    <div className="au ob">
      <div className="ob-shell">
        <header className="au-top ob-top">
          <Link href="/" className="au-brand" aria-label="Veyro home"><Image src="/logo.png" alt="" width={34} height={34} priority /><span>Veyro</span></Link>
          <div className="au-tools">
            <span className="ob-who"><span>{t("ob_signed")}</span> <b>{me.data?.email}</b></span>
            <a href="#" className="au-back" onClick={(e) => { e.preventDefault(); signOut(); }}>{t("ob_out")}</a>
            <ThemeToggle />
            <LangToggle />
          </div>
        </header>

        <main className="ob-main">
          <div className="ob-head">
            <h1><span>{t("ob_hi")}</span> <span>{me.data?.name.split(" ")[0]}</span>.</h1>
            <p className="au-sub">{t("ob_sub")}</p>
          </div>

          <div className="ob-cards" role="radiogroup" aria-label={t("howStart")}>
            {CARDS.map(({ key, Visual, tint, title, text, foot }, i) => (
              <button key={key} ref={(el) => { cardRefs.current[i] = el; }} type="button" className={`ob-card${pick === key ? " is-on" : ""}`} role="radio" aria-checked={pick === key} onClick={() => setPick(key)} onKeyDown={onCardKeys(i)}>
                <span className={`ob-visual ${tint}`} aria-hidden="true"><Visual /></span>
                <span className="ob-radio" aria-hidden="true" />
                <h2>{t(title)}</h2>
                <p>{t(text)}</p>
                <small>{t(foot)}</small>
              </button>
            ))}
          </div>

          {pick === "a" && <CreatePanel created={created} onCreated={(c) => { setCreated(c); queryClient.invalidateQueries({ queryKey: ["workspaces"] }); }} />}
          {pick === "b" && <JoinPanel />}
          {pick === "c" && (
            <section className="ob-panel" data-panel="c" aria-labelledby="ob-c-title">
              <h2 id="ob-c-title">{t("pc_t")}</h2>
              <p className="ob-lead">{t("pc_d")}</p>
              <div className="ob-actions">
                <a href="#" className="au-btn au-btn-link ob-btn" onClick={(e) => { e.preventDefault(); toast.info(t("openAssistantSoon")); }}>{t("pc_btn")}</a>
                <p className="ob-note">{t("pc_note")}</p>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

type CreateValues = { accountName: string; accountSlug: string; workspaceName: string; workspaceSlug: string };

function CreatePanel({ created, onCreated }: { created: { name: string; slug: string } | null; onCreated: (c: { name: string; slug: string }) => void }) {
  const t = useTranslations("Onboarding");
  const { banner, setBanner, fail } = useAuthErrors();
  const [conflict, setConflict] = useState(false);
  // once the person types in an address field we stop suggesting one
  const [edited, setEdited] = useState({ accountSlug: false, workspaceSlug: false });
  const msg = (k: string) => t(MSG[k]);
  const { register, handleSubmit, setValue, getValues, control, formState: { errors, isSubmitting } } = useForm<CreateValues>({
    resolver: zodResolver(onboardingSchema(msg)),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { accountName: "", accountSlug: "", workspaceName: "", workspaceSlug: "" },
  });
  const slugNow = useWatch({ control, name: "workspaceSlug" });
  const suggest = () => {
    if (!edited.workspaceSlug) setValue("workspaceSlug", workspaceSlugFrom(getValues("accountSlug"), getValues("workspaceName")));
  };

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    setConflict(false);
    try {
      await api("/onboarding/atomic", { method: "POST", body: JSON.stringify(values) });
      onCreated({ name: values.workspaceName.trim(), slug: values.workspaceSlug });
    } catch (err) {
      if (err instanceof ApiError && CONFLICT_CODES.includes(err.code)) setConflict(true);
      else fail(err);
    }
  });

  const field = (id: keyof CreateValues, label: string, extra: object = {}) => (
    <Field id={id} label={t(label)} error={errors[id]?.message}>
      <TextInput id={id} type="text" placeholder={t(`ph_${id}`)} error={errors[id]?.message} {...register(id, extra)} {...(id.endsWith("Slug") ? { autoCapitalize: "off", spellCheck: false } : {})} />
      {id === "workspaceSlug" && <p className="ob-hint">/w/<b>{slugNow || "your-workspace"}</b></p>}
    </Field>
  );

  return (
    <section className={`ob-panel${created ? " is-done" : ""}`} data-panel="a" aria-labelledby="ob-a-title">
      <h2 id="ob-a-title">{t("pa_t")}</h2>
      {!created && (
        <form className="ob-form" onSubmit={onSubmit} onChange={() => setConflict(false)} noValidate>
          <FormBanner banner={banner} />
          <div className="ob-grid">
            {field("accountName", "pa_acc", { onChange: (e: { target: { value: string } }) => { if (!edited.accountSlug) setValue("accountSlug", slugify(e.target.value)); suggest(); } })}
            {field("accountSlug", "pa_accslug", { onChange: () => { setEdited((v) => ({ ...v, accountSlug: true })); suggest(); } })}
            {field("workspaceName", "pa_ws", { onChange: () => suggest() })}
            {field("workspaceSlug", "pa_wsslug", { onChange: () => setEdited((v) => ({ ...v, workspaceSlug: true })) })}
          </div>
          <p className="ob-conflict" role="alert" hidden={!conflict}>{t("e_taken")}</p>
          <div className="ob-actions">
            <SubmitButton busy={isSubmitting} className="ob-btn">{t("pa_btn")}</SubmitButton>
            <p className="ob-note">{t("pa_note")}</p>
          </div>
        </form>
      )}
      {created && (
        <div className="ob-done ob-done-pop">
          <span className="au-done-icon"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg></span>
          <h2>{t("pa_done_t")}</h2>
          <p><b>{created.name}</b> <span>{t("pa_done_d")}</span></p>
          <Link href={`/w/${created.slug}`} className="au-btn au-btn-link ob-btn">{t("pa_open")}</Link>
        </div>
      )}
    </section>
  );
}

function JoinPanel() {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const msg = (k: string) => t(MSG[k]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ invite: string }>({ resolver: zodResolver(inviteSchema(msg)), reValidateMode: "onChange" });
  const onSubmit = handleSubmit(({ invite }) => router.push({ pathname: "/invitations/accept", query: { token: inviteToken(invite) } }));
  return (
    <section className="ob-panel" data-panel="b" aria-labelledby="ob-b-title">
      <h2 id="ob-b-title">{t("pb_t")}</h2>
      <form className="ob-form ob-form-narrow" onSubmit={onSubmit} noValidate>
        <Field id="invite" label={t("pb_lbl")} error={errors.invite?.message}>
          <TextInput id="invite" type="text" autoCapitalize="off" spellCheck={false} error={errors.invite?.message} {...register("invite")} />
        </Field>
        <div className="ob-actions">
          <SubmitButton busy={isSubmitting} className="ob-btn">{t("pb_btn")}</SubmitButton>
          <p className="ob-note">{t("pb_note")}</p>
        </div>
      </form>
    </section>
  );
}
