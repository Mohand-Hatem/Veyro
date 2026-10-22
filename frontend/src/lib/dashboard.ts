"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

// Shape of GET /workspaces/:id/dashboard (docs/06 §2.3.1). Admin-only blocks are null for members.
export type TaskCounts = { todo: number; inProgress: number; inReview: number; done: number; cancelled: number };
export type Person = { userId: string; name: string; avatarUrl: string | null };
export type DashProject = {
  id: string;
  key: string;
  name: string;
  lifecycleStatus: "ACTIVE" | "ARCHIVED";
  isBillingReadOnly: boolean;
  createdAt: string;
  memberCount: number;
  members: Person[];
  tasks: TaskCounts;
};
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type MyTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  project: { id: string; key: string; name: string };
};
export type BillingState = "OK" | "GRACE" | "PAST_DUE" | "READ_ONLY";
export type Tier = "FREE" | "PRO" | "ENTERPRISE" | "EPIC";
export type Dashboard = {
  capacity: { tier: Tier; maxProjects: number; currentProjects: number } | null;
  notices: { billingState: BillingState; gracePeriodEndsAt: string | null; requiresProjectSelection: boolean } | null;
  counts: { members: number | null; projects: number; openTasks: number; myOpenTasks: number; myDueToday: number; completedThisWeek: number };
  projects: DashProject[];
  myTasks: MyTask[];
  workload: (Person & { openTasks: number })[] | null;
};
export type AiQuota = { tier: string; dailyQuota: number; messagesUsed: number; remaining: number };

export const useDashboard = (workspaceId?: string) =>
  useQuery({ queryKey: ["dashboard", workspaceId], queryFn: () => api<Dashboard>(`/workspaces/${workspaceId}/dashboard`), enabled: !!workspaceId });

export const useAiQuota = () => useQuery({ queryKey: ["ai-quota"], queryFn: () => api<AiQuota>("/ai/quota") });

/** Cancelled tasks never count toward progress. */
export const taskTotal = (t: TaskCounts) => t.todo + t.inProgress + t.inReview + t.done;

export type ProjectStatus = "active" | "readonly" | "archived";
export const projectStatus = (p: Pick<DashProject, "lifecycleStatus" | "isBillingReadOnly">): ProjectStatus =>
  p.lifecycleStatus === "ARCHIVED" ? "archived" : p.isBillingReadOnly ? "readonly" : "active";

/** Gauge arcs as percentages of all counted tasks (0 when the project list is empty). */
export function gaugeShares(projects: Pick<DashProject, "tasks">[]) {
  const sum = (k: keyof TaskCounts) => projects.reduce((a, p) => a + p.tasks[k], 0);
  const done = sum("done"), review = sum("inReview"), doing = sum("inProgress"), todo = sum("todo");
  const all = done + review + doing + todo;
  const base = all || 1;
  return { all, done, review, doing, pctDone: (done / base) * 100, pctReview: (review / base) * 100, pctDoing: (doing / base) * 100, percent: all ? Math.round((done / base) * 100) : 0 };
}

export const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
/** Same user, same colour (av0 to av5) on every screen. */
export const avatarClass = (id: string) => "av" + ([...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 6);
