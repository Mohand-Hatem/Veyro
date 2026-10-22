import type { ReactNode } from "react";
import type { NavKey } from "@/lib/nav";

// Icons copied from screens/groups/03-workspace-dashboard/index.html and shared/shell-extras.js.
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const NAV_ICONS: Record<NavKey, ReactNode> = {
  dashboard: <svg {...base}><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></svg>,
  projects: <svg {...base}><rect x="3" y="3" width="7" height="18" rx="2" /><rect x="14" y="3" width="7" height="11" rx="2" /></svg>,
  tasks: <svg {...base}><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>,
  ai: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>,
  audit: <svg {...base}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>,
  members: <svg {...base}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>,
  billing: <svg {...base}><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20M6 15h4" /></svg>,
};
export const NavIcon = ({ k }: { k: NavKey }) => NAV_ICONS[k];

const s = (n: number, w: number) => ({ width: n, height: n, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" }) as const;

export const Icons = {
  collapse: <svg {...s(14, 3)}><path d="m15 18-6-6 6-6" /></svg>,
  chevrons: <svg className="ap-hide-c" {...s(16, 2.4)}><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  burger: <svg {...s(22, 2)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  search: <svg {...s(18, 2.2)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>,
  ai: <svg {...s(18, 2.2)}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>,
  bell: <svg {...s(20, 2)}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>,
  moon: <svg className="i-moon" {...s(18, 2)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>,
  sun: <svg className="i-sun" {...s(18, 2)}><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  caret: <svg {...s(16, 2.4)}><path d="m6 9 6 6 6-6" /></svg>,
  help: <svg {...s(22, 2.4)} stroke="#fff" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.2M12 17.5v.01" /></svg>,
  mail: <svg {...s(22, 2.4)} stroke="#fff" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3.5 7 8.5 6.5L20.5 7" /></svg>,
  menuHelp: <svg {...s(18, 2)}><circle cx="12" cy="12" r="9.5" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.2M12 17.5v.01" /></svg>,
  user: <svg {...s(18, 2)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  out: <svg {...s(18, 2)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
};
