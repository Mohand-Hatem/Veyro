import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { countdown, findConversation, proposalFailure, sendFailure, type AiConversation } from "./ai";

describe("countdown", () => {
  const at = Date.UTC(2026, 9, 22, 0, 0, 0);
  it("counts hours, minutes and seconds to the reset", () => {
    expect(countdown(new Date(at).toISOString(), at - (5 * 3600 + 7 * 60 + 9) * 1000)).toBe("05:07:09");
    expect(countdown(new Date(at).toISOString(), at - 1500)).toBe("00:00:01");
  });
  it("never goes below zero", () => {
    expect(countdown(new Date(at).toISOString(), at + 60000)).toBe("00:00:00");
  });
});

describe("sendFailure", () => {
  it("keeps the key after a gateway failure so a retry is not charged twice", () => {
    expect(sendFailure(new ApiError(502, "AI_GATEWAY_ERROR", "x"))).toEqual({ key: "errGateway", keepKey: true });
  });
  it("drops the key for the other failures", () => {
    expect(sendFailure(new ApiError(429, "AI_QUOTA_EXCEEDED", "x"))).toEqual({ key: "errQuota", keepKey: false });
    expect(sendFailure(new ApiError(422, "IDEMPOTENCY_KEY_MISMATCH", "x"))).toEqual({ key: "errGeneric", keepKey: false });
    expect(sendFailure(new Error("network"))).toEqual({ key: "errGeneric", keepKey: false });
  });
});

describe("proposalFailure", () => {
  it("names a lost right, an already resolved card, and anything else", () => {
    expect(proposalFailure(new ApiError(403, "PERMISSION_DENIED", "x"))).toBe("pcForbidden");
    expect(proposalFailure(new ApiError(409, "PROPOSAL_ALREADY_RESOLVED", "x"))).toBe("pcResolved");
    expect(proposalFailure(new Error("network"))).toBe("errGeneric");
  });
});

describe("findConversation", () => {
  const c = (id: string, contextScope: AiConversation["contextScope"], workspaceId: string | null): AiConversation => ({ id, title: id, mode: "PROJECT", contextScope, workspaceId, updatedAt: "" });
  const list = [c("w2", "WORKSPACE", "ws2"), c("g", "GLOBAL", null), c("w1", "WORKSPACE", "ws1")];
  it("gives each workspace its own conversation", () => {
    expect(findConversation(list, { contextScope: "WORKSPACE", workspaceId: "ws1" })?.id).toBe("w1");
    expect(findConversation(list, { contextScope: "WORKSPACE", workspaceId: "ws3" })).toBeUndefined();
  });
  it("finds the global one regardless of workspace", () => {
    expect(findConversation(list, { contextScope: "GLOBAL" })?.id).toBe("g");
  });
});
