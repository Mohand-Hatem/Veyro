"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { AuthHeading } from "@/components/auth/auth-shell";
import { Field, PasswordInput, PasswordRules, TextInput } from "@/components/auth/fields";
import { FormBanner, SubmitButton, useAuthErrors } from "@/components/auth/form-parts";
import { DemoRegisterNote } from "@/components/auth/demo-notice";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { registerSchema } from "@/lib/auth-schemas";
import { safeNext } from "@/lib/safe-next";
import { useRedirectIfSignedIn } from "@/lib/use-signed-in-redirect";

type Values = { name: string; email: string; password: string };

export function RegisterForm() {
  const t = useTranslations("Auth");
  const { te, banner, setBanner, fail } = useAuthErrors();
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next");
  const carry = nextParam ? { next: safeNext(nextParam) } : {};
  useRedirectIfSignedIn(safeNext(nextParam));
  const { register, handleSubmit, setError, control, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(registerSchema(te)), defaultValues: { password: "", email: params.get("email") ?? "" } }); // the landing page hands over the address typed in its hero field
  const password = useWatch({ control, name: "password" });

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    try {
      await api("/auth/register", { method: "POST", body: JSON.stringify(values) });
      router.replace({ pathname: "/verify-email", query: { email: values.email.trim().toLowerCase(), ...carry } });
    } catch (err) {
      fail(err, setError);
    }
  });

  return (
    <>
      <AuthHeading title={t("registerTitle")} sub={t("registerSub")} />
      <FormBanner banner={banner} />
      <DemoRegisterNote />
      <OAuthButtons />
      <form className="au-form" onSubmit={onSubmit} noValidate>
        <Field id="name" label={t("fName")} error={errors.name?.message}>
          <TextInput id="name" type="text" autoComplete="name" error={errors.name?.message} {...register("name")} />
        </Field>
        <Field id="email" label={t("fEmail")} error={errors.email?.message}>
          <TextInput id="email" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register("email")} />
        </Field>
        <Field id="password" label={t("fPassword")} error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" describedBy="password-rules" error={errors.password?.message} {...register("password")} />
          <PasswordRules id="password-rules" value={password} />
        </Field>
        <SubmitButton busy={isSubmitting}>{t("registerBtn")}</SubmitButton>
      </form>
      <p className="au-switch"><span>{t("haveAccount")}</span> <Link href={{ pathname: "/login", query: carry }}>{t("signIn")}</Link></p>
    </>
  );
}
