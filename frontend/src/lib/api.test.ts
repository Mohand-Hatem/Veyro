import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";
import { safeNext } from "./safe-next";

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const ok = (data: unknown) => reply(200, { success: true, data, meta: {} });
const fail = (status: number, code: string, details?: unknown) =>
  reply(status, { success: false, error: { code, message: code.toLowerCase(), details }, meta: {} });

afterEach(() => vi.unstubAllGlobals());

describe("api()", () => {
  it("returns data from the envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ user: { name: "Sara" } })));
    expect(await api("/auth/me")).toEqual({ user: { name: "Sara" } });
  });

  it("accepts an empty 204 answer (DELETE)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await api("/projects/p1", { method: "DELETE" })).toBeUndefined();
  });

  it("throws ApiError with code and details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fail(400, "VALIDATION_FAILED", ["Email is required."])));
    const err = await api("/auth/login", { method: "POST" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "VALIDATION_FAILED", details: ["Email is required."] });
  });

  it("refreshes once on 401 and retries the request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fail(401, "UNAUTHORIZED")) // original call
      .mockResolvedValueOnce(ok({})) // POST /auth/refresh
      .mockResolvedValueOnce(ok({ id: 1 })); // retry
    vi.stubGlobal("fetch", fetchMock);
    expect(await api("/projects")).toEqual({ id: 1 });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/api/v1/projects", "/api/v1/auth/refresh", "/api/v1/projects"]);
  });

  it("shares one refresh between parallel 401s", async () => {
    let refreshCalls = 0;
    const stale = new Set<string>(["/api/v1/a", "/api/v1/b", "/api/v1/c"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/v1/auth/refresh") {
          refreshCalls++;
          await new Promise((r) => setTimeout(r, 10));
          stale.clear();
          return ok({});
        }
        return stale.has(url) ? fail(401, "UNAUTHORIZED") : ok(url);
      }),
    );
    await Promise.all([api("/a"), api("/b"), api("/c")]);
    expect(refreshCalls).toBe(1);
  });

  it("throws the 401 when the refresh fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(fail(401, "UNAUTHORIZED")).mockResolvedValueOnce(fail(401, "UNAUTHORIZED")));
    await expect(api("/projects")).rejects.toMatchObject({ status: 401 });
  });

  it("does not try to refresh when login credentials are wrong", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fail(401, "INVALID_CREDENTIALS"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/auth/login", { method: "POST" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("safeNext()", () => {
  it("keeps same-site paths", () => expect(safeNext("/projects/1?tab=a")).toBe("/projects/1?tab=a"));
  it("rejects external targets", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", null]) expect(safeNext(bad)).toBe("/dashboard");
  });
});
