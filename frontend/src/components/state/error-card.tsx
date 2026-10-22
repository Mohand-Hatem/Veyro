"use client";

import { Link } from "@/i18n/navigation";
import "@/components/dashboard/dashboard.css";
import "@/components/projects/projects.css";
import "./state.css";

/**
 * The approved error card (the one every screen's "could not load" uses), as a whole content area: a title, one sentence,
 * "Try again" and, when it makes sense, a way home. The reference has no separate crash scene, so none is invented.
 */
export function ErrorCard({ title, text, retryLabel, onRetry, homeLabel, homeHref = "/dashboard" }: { title: string; text: string; retryLabel: string; onRetry: () => void; homeLabel?: string; homeHref?: string }) {
  return (
    <div className="st-page">
      <section className="ap-card st-error" role="alert">
        <b>{title}</b>
        <p>{text}</p>
        <div className="gs-actions">
          <button type="button" className="pm-btn pm-ghost" onClick={onRetry}>{retryLabel}</button>
          {homeLabel && <Link className="pm-btn pm-ghost" href={homeHref}>{homeLabel}</Link>}
        </div>
      </section>
    </div>
  );
}
