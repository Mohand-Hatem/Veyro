"use client";

import { useState } from "react";
import { initials } from "@/lib/dashboard";

/**
 * One person's circle. The caller passes the class it always used (size and colour), so with no photo this renders exactly
 * what it did before: the initials. A photo that is missing or fails to load falls back to the initials too.
 */
export function Avatar({ name, url, className, title }: { name: string; url?: string | null; className?: string; title?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = url && failed !== url ? url : null;
  // A plain <img>: the server already stored a small square WebP, so next/image would only add a second optimizer.
  /* eslint-disable @next/next/no-img-element */
  return (
    <span className={show ? `${className ?? ""} has-img`.trim() : className} title={title}>
      {show ? <img className="av-img" src={show} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(show)} /> : initials(name)}
    </span>
  );
}
