"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { slugify } from "./slug";
import type { Workspace } from "./nav";

/** "<account address>-<name>", at most 40 characters. A name with no Latin letters or digits (Arabic only) suggests nothing: the person types the address. */
export const suggestWorkspaceSlug = (accountSlug: string, name: string) => {
  const part = slugify(name);
  return part ? `${accountSlug}-${part}`.slice(0, 40).replace(/-+$/, "") : "";
};

/** The first free "<slug>-2", "<slug>-3"... (kept within 40 characters) for the "address in use" message. */
export const nextFreeSlug = (slug: string, taken: Set<string>) => {
  const at = (n: number) => `${slug.slice(0, 39 - String(n).length)}-${n}`;
  let n = 2;
  while (taken.has(at(n))) n++;
  return at(n);
};

export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2);

/**
 * POST /accounts/:id/workspaces (owner only, plan cap enforced by the server, CS-14).
 * The new workspace is written into the list straight away so the shell knows its address when the page moves there; the list and the plan counts then refresh in the background.
 */
export function useCreateWorkspace(account: Workspace["account"] | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; slug: string }) => api<{ id: string; name: string; slug: string }>(`/accounts/${account?.id}/workspaces`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (made) => {
      if (account) qc.setQueryData<Workspace[]>(["workspaces"], (old) => [...(old ?? []), { id: made.id, name: made.name, slug: made.slug, role: "ADMIN", isAccountOwner: true, account }]);
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
      void qc.invalidateQueries({ queryKey: ["subscription", account?.id] });
    },
  });
}
