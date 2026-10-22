import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// The sign-in part of the navigation. The rest of the page is static; this reads the session cookie on the server, so it streams in
// (its fallback is the signed-out version) and a signed-in visitor sees "Open workspace" instead of "Sign in" and "Get started".
export async function GuestActions({ drawer }: { drawer?: boolean }) {
  const t = await getTranslations("Landing");
  return drawer ? (
    <div className="mk-drawer-actions">
      <Link href="/login" className="mk-btn mk-btn-ghost">{t("signin")}</Link>
      <Link href="/register" className="mk-btn mk-btn-primary">{t("get_started")}</Link>
    </div>
  ) : (
    <>
      <Link href="/login" className="mk-link-signin">{t("signin")}</Link>
      <Link href="/register" className="mk-btn mk-btn-primary mk-btn-sm">{t("get_started")}</Link>
    </>
  );
}

export async function AuthActions({ drawer }: { drawer?: boolean }) {
  if (!(await cookies()).has("access_token")) return <GuestActions drawer={drawer} />;
  const t = await getTranslations("Landing");
  return drawer ? (
    <div className="mk-drawer-actions">
      <Link href="/dashboard" className="mk-btn mk-btn-primary">{t("open_ws")}</Link>
    </div>
  ) : (
    <Link href="/dashboard" className="mk-btn mk-btn-primary mk-btn-sm">{t("open_ws")}</Link>
  );
}
