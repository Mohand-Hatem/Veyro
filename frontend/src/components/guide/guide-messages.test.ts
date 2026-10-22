import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";

// The guide has about 250 strings in two languages (one illustration per section carries some of them), so a missing or extra key is easy to make.
const keys = (o: unknown, p = ""): string[] =>
  o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p];

describe("Guide messages", () => {
  it("has the same keys in English and Arabic", () => {
    expect(keys(ar.Guide).sort()).toEqual(keys(en.Guide).sort());
  });
  it("has text for every string the illustrations ask for", () => {
    const used = [...readFileSync("src/components/guide/guide-scenes.tsx", "utf8").matchAll(/t\("scene\.(\w+)"\)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(30);
    for (const k of used) {
      expect((en.Guide.scene as Record<string, string>)[k], `en scene.${k}`).toBeTruthy();
      expect((ar.Guide.scene as Record<string, string>)[k], `ar scene.${k}`).toBeTruthy();
    }
  });
  it("has all four roles in every section that speaks to a role", () => {
    for (const role of ["owner", "admin", "padmin", "member"]) {
      for (const id of ["picture", "start", "tasks", "people", "ai", "plans", "trust"]) {
        expect((en.Guide.sections as Record<string, { r?: Record<string, string> }>)[id].r?.[role], `${id}.r.${role}`).toBeTruthy();
      }
      for (const group of ["steps", "can", "cant"] as const) expect(Object.keys((en.Guide.sections.cycle[group] as Record<string, unknown>)[role] as object).length, `cycle.${group}.${role}`).toBeGreaterThan(0);
    }
  });
});
