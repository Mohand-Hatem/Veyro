"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { api } from "./api";

export type NoticeType = "TASK_ASSIGNED" | "TASK_COMMENTED" | "ADDED_TO_PROJECT" | "ROLE_CHANGED" | "INVITATION_ACCEPTED";
/** One notification. The sentence is built on screen from `type` and `data` (copied when the event happened), never stored as text. */
export type Notice = {
  id: string;
  type: NoticeType;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
  workspaceId: string;
  projectId: string | null;
  taskId: string | null;
  data: Record<string, string>;
  readAt: string | null;
  createdAt: string;
};
type Page = { items: Notice[]; nextCursor: string | null };
type Pages = InfiniteData<Page, string>;

const UNREAD = ["notifications", "unread"] as const;
const LIST = ["notifications", "list"] as const;
/** The bell asks for the unread count once a minute while the tab is visible (no live connection: a minute of delay is fine here). */
export const POLL_MS = 60_000;

export const useUnreadCount = () =>
  useQuery({
    queryKey: UNREAD,
    queryFn: async () => (await api<{ unreadCount: number }>("/notifications/unread-count")).unreadCount,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

/** The list is fetched only while the popover is open. */
export const useNotifications = (enabled: boolean) =>
  useInfiniteQuery({
    queryKey: LIST,
    enabled,
    initialPageParam: "",
    queryFn: ({ pageParam }) => api<Page>(`/notifications?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

function patchRead(qc: ReturnType<typeof useQueryClient>, ids: "all" | string, unreadCount: number) {
  qc.setQueryData(UNREAD, unreadCount);
  const readAt = new Date().toISOString();
  qc.setQueryData<Pages>(LIST, (d) => d && { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.map((n) => (!n.readAt && (ids === "all" || n.id === ids) ? { ...n, readAt } : n)) })) });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ unreadCount: number }>(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: (r, id) => patchRead(qc, id, r.unreadCount),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ unreadCount: number }>("/notifications/read-all", { method: "POST" }),
    onSuccess: (r) => patchRead(qc, "all", r.unreadCount),
  });
}

/** Where a click goes: the task, the project board, or the members page. */
export function noticeHref(n: Pick<Notice, "type" | "taskId" | "data">): string | null {
  const { workspaceSlug: slug, projectKey: key } = n.data;
  if (!slug) return null;
  if ((n.type === "TASK_ASSIGNED" || n.type === "TASK_COMMENTED") && key && n.taskId) return `/w/${slug}/projects/${key}/tasks/${n.taskId}`;
  if (n.type === "ADDED_TO_PROJECT" && key) return `/w/${slug}/projects/${key}`;
  if (n.type === "ROLE_CHANGED" || n.type === "INVITATION_ACCEPTED") return `/w/${slug}/settings`;
  return null;
}

/** The badge on the bell: the number up to 9, then 9+. Nothing when everything is read. */
export const badgeText = (count: number) => (count <= 0 ? "" : count > 9 ? "9+" : String(count));

/** "2 min. ago", "yesterday", in the page language; a week or older becomes a short date. */
export function ago(iso: string, tag: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000); // negative: in the past
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto", style: "short" });
  if (abs < 45) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86_400) return rtf.format(Math.round(seconds / 86_400), "day");
  return new Date(iso).toLocaleDateString(tag, { month: "short", day: "numeric" });
}
