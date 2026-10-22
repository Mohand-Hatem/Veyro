"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { TaskStatus } from "./dashboard";

// Shape of GET /workspaces/:id/my-tasks (docs/06, CS-08 and CS-12).
export type Bucket = "overdue" | "today" | "upcoming" | "nodate";
export type MyTaskRow = {
  id: string;
  title: string;
  status: TaskStatus | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  category: string | null;
  dueDate: string | null;
  completedAt: string | null;
  project: { id: string; key: string; name: string; lifecycleStatus: string; isBillingReadOnly: boolean };
};
export type MyTasks = {
  tasks: MyTaskRow[];
  counts: { open: number; overdue: number; today: number; upcoming: number; noDate: number; done: number; projects: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
};
/** The reference page lists eight tasks at a time. */
const PAGE_SIZE = 8;
export type MyTasksFilter = { view: "open" | "done"; bucket: "" | Bucket; projectId: string; page: number };

export const useMyTasks = (workspaceId: string | undefined, f: MyTasksFilter) =>
  useQuery({
    queryKey: ["my-tasks", workspaceId, f],
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const p = new URLSearchParams({ view: f.view, page: String(f.page), limit: String(PAGE_SIZE) });
      if (f.view === "open" && f.bucket) p.set("bucket", f.bucket);
      if (f.projectId) p.set("projectId", f.projectId);
      return api<MyTasks>(`/workspaces/${workspaceId}/my-tasks?${p}`);
    },
  });

const DAY = 86400000;
export const startOfDayUtc = (now = Date.now()) => {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/** Same split the server uses for its counts (UTC days). */
export function bucketOf(dueDate: string | null, now = Date.now()): Bucket {
  if (dueDate === null) return "nodate";
  const sod = startOfDayUtc(now), d = new Date(dueDate).getTime();
  return d < sod ? "overdue" : d < sod + DAY ? "today" : "upcoming";
}

/** Whole days from today (negative = overdue). */
export const daysFromToday = (dueDate: string, now = Date.now()) => Math.floor((new Date(dueDate).getTime() - startOfDayUtc(now)) / DAY);
