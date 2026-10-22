"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Person, TaskCounts } from "./dashboard";

// Shape of GET /workspaces/:id/projects (docs/06 §2.3, CS-08 and CS-12).
export type ProjectRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  lifecycleStatus: "ACTIVE" | "ARCHIVED";
  isBillingReadOnly: boolean;
  deletedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { members: number; tasks: number };
  members: Person[];
  taskCounts: TaskCounts;
  viewer: { projectRole: "ADMIN" | "MEMBER"; canEdit: boolean; canArchive: boolean; canDelete: boolean; canRestore: boolean };
};

export type ProjectFilter = { q?: string; show?: "ACTIVE" | "ARCHIVED" | "DELETED" };

/** Search and the Active / Archived / Deleted tabs run on the server, so the trash is never sent to members. */
export const useProjectList = (workspaceId: string | undefined, { q, show }: ProjectFilter = {}) =>
  useQuery({
    queryKey: ["projects", workspaceId, q ?? "", show ?? "ALL"],
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (show === "DELETED") p.set("deleted", "true");
      else if (show) p.set("status", show);
      const qs = p.toString();
      return api<ProjectRow[]>(`/workspaces/${workspaceId}/projects${qs ? `?${qs}` : ""}`);
    },
  });

export type ProjectState = "active" | "readonly" | "archived" | "deleted";
export const projectState = (p: Pick<ProjectRow, "deletedAt" | "isBillingReadOnly" | "lifecycleStatus">): ProjectState =>
  p.deletedAt ? "deleted" : p.isBillingReadOnly ? "readonly" : p.lifecycleStatus === "ARCHIVED" ? "archived" : "active";

/** Done / (everything except cancelled), as a whole percent. */
export const progressPercent = (c: TaskCounts) => {
  const total = c.todo + c.inProgress + c.inReview + c.done;
  return { total, pct: total ? Math.round((c.done / total) * 100) : 0 };
};

/** Whole days since an ISO timestamp (never negative). */
export const daysSince = (iso: string, now = Date.now()) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000));

export type NewProject = { name: string; key?: string; description?: string };

/** POST /workspaces/:id/projects. The lists and the dashboard (capacity, counts) are stale afterwards, so they are refetched. */
export function useCreateProject(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewProject) => api<{ id: string; key: string; name: string }>(`/workspaces/${workspaceId}/projects`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", workspaceId] });
      qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    },
  });
}

/** Refetch everything a project change touches: the lists (counts, status), the dashboard (capacity, KPIs) and my tasks. */
function useRefreshProjects(workspaceId?: string) {
  const qc = useQueryClient();
  // Not awaited: the dialog closes as soon as the server answered; the lists catch up in the background.
  return () => {
    for (const k of ["projects", "dashboard", "my-tasks"]) void qc.invalidateQueries({ queryKey: [k, workspaceId] });
  };
}

export type ProjectPatch = { name?: string; description?: string; lifecycleStatus?: "ACTIVE" | "ARCHIVED" };

export function useUpdateProject(workspaceId?: string) {
  const refresh = useRefreshProjects(workspaceId);
  return useMutation({
    mutationFn: ({ id, ...body }: ProjectPatch & { id: string }) => api<unknown>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSettled: refresh,
  });
}

export function useDeleteProject(workspaceId?: string) {
  const refresh = useRefreshProjects(workspaceId);
  return useMutation({ mutationFn: (id: string) => api<unknown>(`/projects/${id}`, { method: "DELETE" }), onSettled: refresh });
}

export function useRestoreProject(workspaceId?: string) {
  const refresh = useRefreshProjects(workspaceId);
  return useMutation({ mutationFn: (id: string) => api<unknown>(`/projects/${id}/restore`, { method: "POST" }), onSettled: refresh });
}
