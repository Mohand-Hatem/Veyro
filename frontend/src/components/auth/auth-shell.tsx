import { Suspense, type ReactNode } from "react";
import { AuthAside } from "./auth-aside";
import { AuthTopbar } from "./auth-topbar";
import "./auth.css";

// Markup and class names follow screens/groups/02-auth-onboarding/*.html (Parity Gate).
export function AuthShell({ scene, children }: { scene: "a" | "b"; children: ReactNode }) {
  return (
    <div className="au">
      <div className="au-shell">
        <main className="au-main">
          <Suspense>
            <AuthTopbar />
          </Suspense>
          <div className="au-center">
            <section className="au-card" aria-labelledby="au-title">{children}</section>
          </div>
        </main>
        <AuthAside scene={scene} />
      </div>
    </div>
  );
}

const BADGES = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 9-9M16 7l3 3M14 9l2 2" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
};

export function AuthHeading({ title, sub, badge }: { title: string; sub?: ReactNode; badge?: keyof typeof BADGES }) {
  return (
    <>
      {badge && (
        <span className="au-badge" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{BADGES[badge]}</svg>
        </span>
      )}
      <h1 id="au-title">{title}</h1>
      {sub && <p className="au-sub">{sub}</p>}
    </>
  );
}
