import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { agoParts, applyMove, boardErrorKey, daysLeft, dropTargets, restoreMove, type BoardProject, type BoardTask } from "./board";

const task = (id: string, status: BoardTask["status"], assigneeId: string | null = null): BoardTask =>
  ({ id, title: id, status, priority: "MEDIUM", category: null, dueDate: null, assigneeId, assignee: null, _count: { comments: 0 } });
const admin = { blocked: false, isAdmin: true, userId: "a" };
const member = { blocked: false, isAdmin: false, userId: "m" };

describe("dropTargets", () => {
  it("lets admins follow the workflow and reopen terminal tasks to one column", () => {
    expect(dropTargets(task("1", "IN_PROGRESS"), admin)).toEqual(["IN_REVIEW", "TODO", "CANCELLED"]);
    expect(dropTargets(task("1", "DONE"), admin)).toEqual(["IN_PROGRESS"]);
    expect(dropTargets(task("1", "CANCELLED"), admin)).toEqual(["TODO"]);
  });

  it("lets a member move only their own tasks and never cancel", () => {
    expect(dropTargets(task("1", "IN_PROGRESS", "m"), member)).toEqual(["IN_REVIEW", "TODO"]);
    expect(dropTargets(task("1", "IN_PROGRESS", "someone"), member)).toEqual([]);
    expect(dropTargets(task("1", "DONE", "m"), member)).toEqual([]);
  });

  it("allows nothing on an archived or read-only project", () => {
    expect(dropTargets(task("1", "TODO"), { ...admin, blocked: true })).toEqual([]);
  });
});

describe("optimistic move", () => {
  const project = { id: "p", taskCounts: { todo: 2, inProgress: 0, inReview: 0, done: 0, cancelled: 0 } } as BoardProject;
  const setup = () => {
    const qc = new QueryClient();
    qc.setQueryData(["tasks", "p", { assigneeId: "", priority: "", category: "" }], [task("1", "TODO"), task("2", "TODO")]);
    qc.setQueryData(["tasks", "p", { assigneeId: "x", priority: "", category: "" }], [task("1", "TODO")]);
    qc.setQueryData(["project", "p"], project);
    return qc;
  };
  const statuses = (qc: QueryClient) => qc.getQueriesData<BoardTask[]>({ queryKey: ["tasks", "p"] }).flatMap(([, rows]) => (rows ?? []).filter((r) => r.id === "1").map((r) => r.status));

  it("moves the card in every cached list and shifts the counters", () => {
    const qc = setup();
    applyMove(qc, "p", "1", "TODO", "IN_PROGRESS");
    expect(statuses(qc)).toEqual(["IN_PROGRESS", "IN_PROGRESS"]);
    expect(qc.getQueryData<BoardProject>(["project", "p"])?.taskCounts).toMatchObject({ todo: 1, inProgress: 1 });
  });

  it("puts everything back after a refusal", () => {
    const qc = setup();
    restoreMove(qc, "p", applyMove(qc, "p", "1", "TODO", "IN_PROGRESS"));
    expect(statuses(qc)).toEqual(["TODO", "TODO"]);
    expect(qc.getQueryData<BoardProject>(["project", "p"])?.taskCounts).toMatchObject({ todo: 2, inProgress: 0 });
  });
});

describe("boardErrorKey", () => {
  it("maps backend codes to messages", () => {
    expect(boardErrorKey(new ApiError(403, "PROJECT_BILLING_READ_ONLY", ""))).toBe("eReadonly");
    expect(boardErrorKey(new ApiError(400, "INVALID_STATE_TRANSITION", ""))).toBe("invalidMove");
    expect(boardErrorKey(new Error("offline"))).toBe("eGeneric");
  });
});

describe("agoParts and daysLeft", () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  it("picks the largest whole unit", () => {
    expect(agoParts("2026-10-19T11:59:40Z", now)).toEqual({ key: "agoNow", n: 0 });
    expect(agoParts("2026-10-19T11:15:00Z", now)).toEqual({ key: "agoMin", n: 45 });
    expect(agoParts("2026-10-19T07:00:00Z", now)).toEqual({ key: "agoH", n: 5 });
    expect(agoParts("2026-10-16T12:00:00Z", now)).toEqual({ key: "agoD", n: 3 });
  });
  it("counts days left and never goes negative", () => {
    expect(daysLeft("2026-11-18T12:00:00Z", now)).toBe(30);
    expect(daysLeft("2026-10-01T12:00:00Z", now)).toBe(0);
  });
});
