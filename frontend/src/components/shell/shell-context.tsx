"use client";

import { createContext, useContext, useEffect } from "react";
import type { Me } from "@/lib/queries";
import type { Role, Workspace } from "@/lib/nav";

export type ShellValue = { workspace?: Workspace; role: Role; user?: Me; notify: (message: string) => void; search: string; openCreateProject: () => void; setTitle: (title: string | null) => void };

export const ShellContext = createContext<ShellValue | null>(null);

/** The signed-in user, the current workspace and the viewer's role, for any page rendered inside the shell. */
export function useShell() {
  const v = useContext(ShellContext);
  if (!v) throw new Error("useShell must be used inside <AppShell>");
  return v;
}

/** A state page (404, access denied) names itself in the header instead of the shell guessing a section; the header search steps aside too. */
export function usePageTitle(title: string) {
  const { setTitle } = useShell();
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
}
