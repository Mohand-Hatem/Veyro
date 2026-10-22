import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

// Everything not listed here needs a session. New pages are protected by default.
const PUBLIC = ["/", "/login", "/register", "/verify-email", "/forgot-password", "/reset-password", "/invitation", "/session", "/how-it-works", "/contact"];
const isPublic = (path: string) => PUBLIC.some((p) => path === p || (p !== "/" && path.startsWith(`${p}/`)));

// UX gate only: the backend still authorizes every request. A missing access_token means "try to refresh first".
export default function proxy(req: NextRequest) {
  const match = req.nextUrl.pathname.match(/^\/(en|ar)(\/.*)?$/);
  const path = match?.[2] || "/";
  if (match && !isPublic(path) && !req.cookies.has("access_token")) {
    const url = req.nextUrl.clone();
    url.pathname = `/${match[1]}/session`;
    url.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return intl(req);
}

export const config = { matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)" };
