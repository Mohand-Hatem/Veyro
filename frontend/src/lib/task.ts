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
  /** Who set the current assignee (null for unassigned tasks and for tasks assigned before this was recorded). */
  assignedBy: Pick<User, "id" | "name" | "avatarUrl"> | null;
  project: { id: string; name: string; lifecycleStatus: "ACTIVE" | "ARCHIVED"; isBillingReadOnly: boolean; workspaceId: string };
  comments: { id: string; content: string; createdAt: string; author: User }[];
  viewer: {
    userId: string;
    isProjectAdmin: boolean;
    isTaskAuthor: boolean;
    isAssignee: boolean;
    canEdit: boolean;
    canAssign: boolean;
    canReopen: boolean;
    canDelete: boolean;
    canRestore: boolean;
    allowedStatuses: Status[];
    /** May add (and remove) files: the task's creator or a project admin, while storage is set up and there is room. */
    canUpload: boolean;
    /** May open the files: the creator, the assignee and project admins. Everyone else gets the count only. */
    canOpenFiles: boolean;
  };
  /** Empty for people who may not open the files; `attachmentCount` is for everybody. */
  attachments: Attachment[];
  attachmentCount: number;
};

export const useTask = (id: string) => useQuery({ queryKey: ["task", id], queryFn: () => api<TaskDetail>(`/tasks/${id}`) });

/** A file on a task. The links are private Cloudinary links that stop working ten minutes after the task was loaded. */
export type Attachment = {
  id: string;
  fileName: string;
  format: string;
  bytes: number;
  isImage: boolean;
  createdAt: string;
  uploader: { id: string; name: string } | null;
  downloadUrl: string | null;
  previewUrl: string | null;
};

// The same rules the server applies (task-attachments.service.ts); checked here first so nobody waits for a refusal.
export const FILE_IMAGE = ["jpg", "jpeg", "png", "webp", "gif"];
export const FILE_DOCS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"];
export const FILE_MAX_BYTES = 10 * 1024 * 1024;
export const FILES_PER_TASK = 10;
export const FILE_ACCEPT = [...FILE_IMAGE, ...FILE_DOCS].map((e) => `.${e}`).join(",");

/** Why this file cannot be added (a message key), or null when it can. */
export function fileProblem(file: { name: string; size: number }): "fileType" | "fileBig" | null {
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] ?? "";
  if (![...FILE_IMAGE, ...FILE_DOCS].includes(ext)) return "fileType";
  return file.size > FILE_MAX_BYTES ? "fileBig" : null;
}

/** 134 B, 4.2 KB, 3.1 MB: one decimal from KB up, digits in the reader's locale. */
export function formatBytes(bytes: number, locale: string): string {
  const units = ["B", "KB", "MB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: u ? 1 : 0 }).format(n)} ${units[u]}`;
}

type Signed = { publicId: string; resourceType: "image" | "raw"; url: string; fields: Record<string, string> };

/** Sends the file to Cloudinary with the signed fields, reporting progress (fetch cannot report upload progress). */
function sendToStorage(signed: Signed, file: File, onProgress: (share: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(signed.fields)) form.append(k, v);
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", signed.url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`storage ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("storage unreachable"));
    xhr.send(form);
  });
}

/** Adding and removing files. Each success reloads the task, so the list and its fresh links come from the server. */
export function useTaskFiles(taskId: string) {
  const qc = useQueryClient();
  const reload = () => qc.invalidateQueries({ queryKey: ["task", taskId] });
  return {
    /** Sign, upload straight to Cloudinary, then let the server check and record the file. */
    async upload(file: File, onProgress: (share: number) => void) {
      const signed = await api<Signed>(`/tasks/${taskId}/attachments/sign`, { method: "POST", body: JSON.stringify({ fileName: file.name }) });
      await sendToStorage(signed, file, onProgress);
      await api<Attachment>(`/tasks/${taskId}/attachments`, { method: "POST", body: JSON.stringify({ publicId: signed.publicId, fileName: file.name }) });
      await reload();
    },
    async remove(attachmentId: string) {
      await api<unknown>(`/tasks/${taskId}/attachments/${attachmentId}`, { method: "DELETE" });
      await reload();
    },
    /** The task with links made just now (links expire), for a download that should never meet an expired one. */
    fresh: () => qc.fetchQuery({ queryKey: ["task", taskId], queryFn: () => api<TaskDetail>(`/tasks/${taskId}`), staleTime: 0 }),
  };
}

/** `note` goes with a status change: required from members, optional for admins, posted as a comment by the server. */
export type TaskPatch = { title?: string; description?: string; priority?: Priority; category?: string | null; assigneeId?: string | null; dueDate?: string | null; status?: Status; note?: string };

/** The longest status note the server accepts. */
export const NOTE_MAX = 500;

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
