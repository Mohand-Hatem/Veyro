"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useRefreshBoard, type BoardTask, type Priority, type Status, type User } from "./board";

// Shape of GET /tasks/:id (docs/06, CS-04 and CS-05): the task, its comments, and what this viewer may do.
export type TaskDetail = Omit<BoardTask, "_count" | "assignee"> & {
  description: string | null;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  purgeAt: string | null;
  author: User;
  assignee: User | null;
  project: { id: string; name: string; lifecycleStatus: "ACTIVE" | "ARCHIVED"; isBillingReadOnly: boolean; workspaceId: string };
  comments: { id: string; content: string; createdAt: string; author: User }[];
  viewer: {
    userId: string;
    isProjectAdmin: boolean;
    isAssignee: boolean;
    canEdit: boolean;
    canAssign: boolean;
    canReopen: boolean;
    canDelete: boolean;
    canRestore: boolean;
    allowedStatuses: Status[];
  };
};

export const useTask = (id: string) => useQuery({ queryKey: ["task", id], queryFn: () => api<TaskDetail>(`/tasks/${id}`) });

export type TaskPatch = { title?: string; description?: string; priority?: Priority; category?: string | null; assigneeId?: string | null; dueDate?: string | null; status?: Status };

/** PATCH /tasks/:id. Resolves after the task is refetched, so the page already shows the server's answer when the "Saved" note appears. */
export function usePatchTask(id: string, projectId: string, workspaceId?: string) {
  const qc = useQueryClient();
  const refresh = useRefreshBoard(projectId, workspaceId);
  return useMutation({
    mutationFn: (body: TaskPatch) => api<unknown>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      refresh();
      return qc.invalidateQueries({ queryKey: ["task", id] });
    },
  });
}

export function useAddComment(id: string, projectId: string, workspaceId?: string) {
  const qc = useQueryClient();
  const refresh = useRefreshBoard(projectId, workspaceId);
  return useMutation({
    mutationFn: (content: string) => api<unknown>(`/tasks/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: () => {
      refresh();
      return qc.invalidateQueries({ queryKey: ["task", id] });
    },
  });
}

/** DELETE /tasks/:id (soft delete: it can be restored for 30 days). */
export function useDeleteTask(id: string, projectId: string, workspaceId?: string) {
  const refresh = useRefreshBoard(projectId, workspaceId);
  return useMutation({ mutationFn: () => api<unknown>(`/tasks/${id}`, { method: "DELETE" }), onSuccess: refresh });
}
