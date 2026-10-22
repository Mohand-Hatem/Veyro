// What the shell shows to whom. Convenience only: the backend checks every request.
export type Role = "owner" | "admin" | "member";
export type Workspace = { id: string; name: string; slug: string; role: "ADMIN" | "MEMBER"; isAccountOwner: boolean; account: { id: string; name: string; slug: string; ownerId: string } };
export type NavKey = "dashboard" | "projects" | "tasks" | "ai" | "audit" | "members" | "billing";

export const roleOf = (w: Pick<Workspace, "role" | "isAccountOwner">): Role => (w.isAccountOwner ? "owner" : w.role === "ADMIN" ? "admin" : "member");

const ALL: Role[] = ["owner", "admin", "member"];
const ADMINS: Role[] = ["owner", "admin"];

// `built` flips to true when the screen lands; until then the item explains itself instead of leading to a 404.
export const NAV: { key: NavKey; href: (slug: string) => string; roles: Role[]; built: boolean }[] = [
  { key: "dashboard", href: (s) => `/w/${s}`, roles: ALL, built: true },
  { key: "projects", href: (s) => `/w/${s}/projects`, roles: ALL, built: true },
  { key: "tasks", href: (s) => `/w/${s}/my-tasks`, roles: ALL, built: true },
  { key: "ai", href: () => "/assistant", roles: ALL, built: true },
  { key: "audit", href: (s) => `/w/${s}/audit`, roles: ADMINS, built: true },
  { key: "members", href: (s) => `/w/${s}/settings`, roles: ADMINS, built: true },
  { key: "billing", href: () => "/account/billing", roles: ["owner"], built: true },
];

export const BOTTOM_NAV: NavKey[] = ["dashboard", "projects", "tasks", "ai"];

export const visibleNav = (role: Role) => NAV.filter((n) => n.roles.includes(role));

export const isActive = (pathname: string, href: string, key: NavKey) => (key === "dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
