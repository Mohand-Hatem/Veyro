import { afterEach, describe, expect, it, vi } from "vitest";

const sonner = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("sonner", () => sonner);

import { expectWelcome, notify, takeWelcome } from "./toast";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("notify", () => {
  it("shows a success by default, keeps errors on screen longer and passes a fixed id", () => {
    notify("Saved");
    notify("Could not save", "error");
    notify("Signed out", "info", "signed-out");
    expect(sonner.toast.success).toHaveBeenCalledWith("Saved", {});
    expect(sonner.toast.error).toHaveBeenCalledWith("Could not save", { duration: 6000 });
    expect(sonner.toast.info).toHaveBeenCalledWith("Signed out", { id: "signed-out" });
  });
});

describe("welcome flag", () => {
  it("greets once after a sign-in, then never again", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { setItem: (k: string, v: string) => store.set(k, v), getItem: (k: string) => store.get(k) ?? null, removeItem: (k: string) => store.delete(k) });
    expect(takeWelcome()).toBe(false);
    expectWelcome();
    expect(takeWelcome()).toBe(true);
    expect(takeWelcome()).toBe(false);
  });
  it("stays quiet when storage is blocked", () => {
    vi.stubGlobal("sessionStorage", { setItem: () => { throw new Error("blocked"); }, getItem: () => { throw new Error("blocked"); }, removeItem: () => {} });
    expect(() => expectWelcome()).not.toThrow();
    expect(takeWelcome()).toBe(false);
  });
});
