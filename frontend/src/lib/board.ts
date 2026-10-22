"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import type { TaskCounts } from "./dashboard";

export type Status = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
export type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
export const STATUSES: Status[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"];
export const CATEGORIES = ["FEATURE", "BUG", "IMPROVEMENT", "DESIGN", "RESEARCH", "DOCS", "OTHER"] as const;

export type User = { id: string; name: string; email: string; avatarUrl: string | null };

// Shape of GET /projects/:id (docs/06, CS-04 and CS-05).
export type BoardProject = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  lifecycleStatus: "ACTIVE" | "ARCHIVED";
  isBillingReadOnly: boolean;
  createdById: string | null;
  members: { userId: string; role: "ADMIN" | "MEMBER"; user: User }[];
  taskCounts: TaskCounts;
  viewer: { userId: string; isAdmin: boolean; projectRole: "ADMIN" | "MEMBER"; isWorkspaceOverride: boolean; canCreateTask: boolean; canManageMembers: boolean };
};

// Shape of one row of GET /projects/:id/tasks.
export type BoardTask = {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  category: (typeof CATEGORIES)[number] | null;
  dueDate: string | null;
  assigneeId: string | null;
  assignee: User | null;
  _count: { comments: number };
};
export type DeletedTask = BoardTask & { deletedAt: string; purgeAt: string; author: User };
type TaskPage = { tasks: BoardTask[]; meta: { total: number; page: number; limit: number; totalPages: number } };

export type BoardFilter = { assigneeId: string; priority: string; category: string };

// The workflow of docs/03 (BR-TSK): terminal tasks only come back through the reopen dialog.
export const ALLOWED: Record<Status, Status[]> = {
  TODO: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["IN_REVIEW", "TODO", "CANCELLED"],
  IN_REVIEW: ["DONE", "IN_PROGRESS", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};
export const REOPEN_TARGET: Partial<Record<Status, Status>> = { DONE: "IN_PROGRESS", CANCELLED: "TODO" };
export const isTerminal = (s: Status) => s === "DONE" || s === "CANCELLED";

/**
 * Where this viewer may move a task: project admins follow the workflow (terminal tasks only reopen), an assigned member
 * the same without cancelling. Mirrors the server (CS-05); the server stays the authority and the UI never relies on it.
 */
export function dropTargets(task: Pick<BoardTask, "status" | "assigneeId">, v: { blocked: boolean; isAdmin: boolean; userId: string }): Status[] {
  if (v.blocked) return [];
  if (isTerminal(task.status)) return v.isAdmin ? [REOPEN_TARGET[task.status]!] : [];
  if (v.isAdmin) return ALLOWED[task.status];
  return task.assigneeId === v.userId ? ALLOWED[task.status].filter((s) => s !== "CANCELLED") : [];
}

/** The counter of a status in `taskCounts`. */
export const countKey = (s: Status): keyof TaskCounts => ({ TODO: "todo", IN_PROGRESS: "inProgress", IN_REVIEW: "inReview", DONE: "done", CANCELLED: "cancelled" } as const)[s];

export const useBoardProject = (projectId?: string) =>
  useQuery({ queryKey: ["project", projectId], enabled: !!projectId, queryFn: () => api<BoardProject>(`/projects/${projectId}`) });

// shortcut: one page of 100 tasks (the API cap); the column counters come from taskCounts and stay exact. Paginate when a project outgrows it.
export const useBoardTasks = (projectId: string | undefined, f: BoardFilter) =>
  useQuery({
    queryKey: ["tasks", projectId, f],
    enabled: !!projectId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const p = new URLSearchParams({ limit: "100" });
      if (f.assigneeId) p.set("assigneeId", f.assigneeId);
      if (f.priority) p.set("priority", f.priority);
      if (f.category) p.set("category", f.category);
      return (await api<TaskPage>(`/projects/${projectId}/tasks?${p}`)).tasks;
    },
  });

/** Moves a task between two columns in every cached list and in the counters. Returns the previous state for a rollback. */
export function applyMove(qc: QueryClient, projectId: string, id: string, from: Status, to: Status) {
  const lists = qc.getQueriesData<BoardTask[]>({ queryKey: ["tasks", projectId] });
  const project = qc.getQueryData<BoardProject>(["project", projectId]);
  for (const [key, rows] of lists) {
    if (rows) qc.setQueryData<BoardTask[]>(key, rows.map((r) => (r.id === id ? { ...r, status: to } : r)));
  }
  if (project) {
    const c = { ...project.taskCounts };
    c[countKey(from)] -= 1;
    c[countKey(to)] += 1;
    qc.setQueryData<BoardProject>(["project", projectId], { ...project, taskCounts: c });
  }
  return { lists, project };
}

/** Puts the lists and counters back as `applyMove` found them. */
export function restoreMove(qc: QueryClient, projectId: string, prev: ReturnType<typeof applyMove>) {
  for (const [key, rows] of prev.lists) qc.setQueryData(key, rows);
  if (prev.project) qc.setQueryData(["project", projectId], prev.project);
}

/**
 * Optimistic move: the card jumps at once, the server decides, and a refusal puts everything back with the reason.
 * Reopening a done or cancelled task needs a reason, so it goes through its own dialog and never through here.
 */
export function useMoveTask(projectId: string | undefined, workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; from: Status; to: Status }) => api<unknown>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status: to }) }),
    onMutate: async ({ id, from, to }) => {
      // A refetch landing mid-flight would overwrite the optimistic card with the old column.
      await Promise.all([qc.cancelQueries({ queryKey: ["tasks", projectId] }), qc.cancelQueries({ queryKey: ["project", projectId] })]);
      return applyMove(qc, projectId!, id, from, to);
    },
    onError: (_err, _vars, prev) => {
      if (prev) restoreMove(qc, projectId!, prev);
    },
    onSettled: () => {
      // Whatever happened, the server is the truth: resync the board, the project lists, the dashboard and My tasks.
      void qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      void qc.invalidateQueries({ queryKey: ["project", projectId] });
      for (const k of ["projects", "dashboard", "my-tasks"]) void qc.invalidateQueries({ queryKey: [k, workspaceId] });
    },
  });
}

export type NewTask = { title: string; description?: string; priority: Priority; category?: string; assigneeId?: string; dueDate?: string };

/** Refetch what a task change touches: the board, the counters, the project lists, the dashboard and My tasks. Not awaited, so dialogs close as soon as the server answers. */
export function useRefreshBoard(projectId?: string, workspaceId?: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    void qc.invalidateQueries({ queryKey: ["task"] }); // an open task page
    void qc.invalidateQueries({ queryKey: ["project", projectId] });
    for (const k of ["projects", "dashboard", "my-tasks"]) void qc.invalidateQueries({ queryKey: [k, workspaceId] });
  };
}

/** POST /projects/:id/tasks. Not optimistic: the server assigns the id, and may refuse (read-only, not a member). */
export function useCreateTask(projectId?: string, workspaceId?: string) {
  const qc = useQueryClient();
  const refresh = useRefreshBoard(projectId, workspaceId);
  return useMutation({
    mutationFn: (body: NewTask) => api<BoardTask>(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (task) => {
      // The card shows at once, in every cached list whose filter it matches; the refetch below only reconciles.
      for (const [key, rows] of qc.getQueriesData<BoardTask[]>({ queryKey: ["tasks", projectId] })) {
        const f = key[2] as BoardFilter;
        const fits = (!f.assigneeId || f.assigneeId === task.assigneeId) && (!f.priority || f.priority === task.priority) && (!f.category || f.category === task.category);
        if (rows && fits) qc.setQueryData<BoardTask[]>(key, [{ ...task, _count: { comments: 0 } }, ...rows]);
      }
      const project = qc.getQueryData<BoardProject>(["project", projectId]);
      if (project) qc.setQueryData<BoardProject>(["project", projectId], { ...project, taskCounts: { ...project.taskCounts, todo: project.taskCounts.todo + 1 } });
      refresh();
    },
  });
}

/** POST /tasks/:id/reopen: Done goes back to In progress, Cancelled to To do, with a reason kept as a comment and in the audit trail. */
export function useReopenTask(projectId?: string, workspaceId?: string) {
  const qc = useQueryClient();
  const refresh = useRefreshBoard(projectId, workspaceId);
  return useMutation({
    mutationFn: ({ id, targetStatus, reason }: { id: string; from: Status; targetStatus: Status; reason: string }) => api<unknown>(`/tasks/${id}/reopen`, { method: "POST", body: JSON.stringify({ targetStatus, reason }) }),
    onSuccess: (_res, { id, from, targetStatus }) => {
      applyMove(qc, projectId!, id, from, targetStatus); // after the server said yes, so no rollback is needed
      refresh();
    },
  });
}

/** The restore window: tasks soft-deleted in this project, newest first (project admins only; the server answers an empty list to everyone else). */
export const useDeletedTasks = (projectId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ["deleted", projectId],
    enabled: enabled && !!projectId,
    queryFn: async () => (await api<{ tasks: DeletedTask[] }>(`/projects/${projectId}/tasks?deleted=true&limit=100`)).tasks,
  });

/** POST /tasks/:id/restore. The task is back on the board, so the board, the counters and the trash list are all refetched. */
export function useRestoreTask(projectId?: string, workspaceId?: string) {
  const qc = useQueryClient();
  const refresh = useRefreshBoard(projectId, workspaceId);
  return useMutation({
    mutationFn: (id: string) => api<unknown>(`/tasks/${id}/restore`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["deleted", projectId] });
      refresh();
    },
  });
}

export type WorkspaceMember = { userId: string; name: string; email: string; avatarUrl: string | null };
/** The pool a project admin can add people from: the workspace's members (the ones already in the project are filtered out by the caller). */
export const useWorkspaceMembers = (workspaceId: string | undefined, enabled: boolean) =>
  useQuery({ queryKey: ["ws-members", workspaceId], enabled: enabled && !!workspaceId, queryFn: () => api<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`) });

/**
 * Add, re-role and remove project members (CS-05). Each call resolves only after the project is refetched, so the dialog's list is
 * already current when its row stops being busy; the project lists (member counts) follow in the background.
 */
export function useProjectMemberActions(projectId: string, workspaceId?: string) {
  const qc = useQueryClient();
  const done = () => {
    void qc.invalidateQueries({ queryKey: ["projects", workspaceId] });
    return qc.invalidateQueries({ queryKey: ["project", projectId] });
  };
  const json = (method: string, body?: object) => ({ method, ...(body ? { body: JSON.stringify(body) } : {}) });
  return {
    add: useMutation({ mutationFn: (v: { userId: string; role: "ADMIN" | "MEMBER" }) => api<unknown>(`/projects/${projectId}/members`, json("POST", v)), onSuccess: done }),
    setRole: useMutation({ mutationFn: (v: { userId: string; role: "ADMIN" | "MEMBER" }) => api<unknown>(`/projects/${projectId}/members/${v.userId}`, json("PATCH", { role: v.role })), onSuccess: done }),
    remove: useMutation({ mutationFn: (userId: string) => api<unknown>(`/projects/${projectId}/members/${userId}`, json("DELETE")), onSuccess: done }),
  };
}

/** Friendly message key (messages "Board") for a refused request. */
export function boardErrorKey(err: unknown): "eArchived" | "eReadonly" | "ePerm" | "eNotMember" | "eOwner" | "eSelf" | "invalidMove" | "reopenRule" | "eGone" | "eGeneric" {
  const code = err instanceof ApiError ? err.code : "";
  if (code === "PROJECT_ARCHIVED") return "eArchived";
  if (code === "PROJECT_BILLING_READ_ONLY") return "eReadonly";
  if (code === "PERMISSION_DENIED") return "ePerm";
  if (code === "ASSIGNEE_NOT_PROJECT_MEMBER") return "eNotMember";
  if (code === "PROJECT_OWNER_PROTECTED") return "eOwner";
  if (code === "CANNOT_CHANGE_OWN_ROLE" || code === "CANNOT_REMOVE_SELF") return "eSelf";
  if (code === "INVALID_STATE_TRANSITION") return "invalidMove";
  if (code === "REOPEN_REQUIRED") return "reopenRule";
  if (code === "RESOURCE_NOT_FOUND") return "eGone";
  return "eGeneric";
}

/** How long ago a moment was, as the unit and amount the messages ("agoMin", "agoH", "agoD", "agoNow") expect. */
export function agoParts(iso: string, now = Date.now()): { key: "agoNow" | "agoMin" | "agoH" | "agoD"; n: number } {
  const ms = now - new Date(iso).getTime();
  if (ms < 60000) return { key: "agoNow", n: 0 };
  if (ms < 3600000) return { key: "agoMin", n: Math.floor(ms / 60000) };
  if (ms < 86400000) return { key: "agoH", n: Math.floor(ms / 3600000) };
  return { key: "agoD", n: Math.floor(ms / 86400000) };
}

/** Whole days left until a purge date (never negative). */
export const daysLeft = (iso: string, now = Date.now()) => Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86400000));
