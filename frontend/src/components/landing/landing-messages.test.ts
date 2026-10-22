import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";

const used = (file: string) => [...readFileSync(`src/components/landing/${file}`, "utf8").matchAll(/\bt(?:\.rich)?\("(\w+)"/g)].map((m) => m[1]);

describe("Landing messages", () => {
  it("has the same keys in English and Arabic", () => {
    expect(Object.keys(ar.Landing).sort()).toEqual(Object.keys(en.Landing).sort());
  });
  it("has text for every key the page asks for, in both languages", () => {
    const keys = [...new Set([...used("sections.tsx"), ...used("landing-client.tsx"), ...used("landing.tsx"), ...used("landing-actions.tsx")])];
    expect(keys.length).toBeGreaterThan(60);
    for (const k of keys) {
      expect((en.Landing as Record<string, string>)[k], `en ${k}`).toBeTruthy();
      expect((ar.Landing as Record<string, string>)[k], `ar ${k}`).toBeTruthy();
    }
  });
  it("has text for every card and label of the features grid, in both languages", () => {
    const list = readFileSync("src/components/landing/magic-bento.tsx", "utf8").match(/const KEYS = \[([\s\S]*?)\]/)?.[1] ?? "";
    const keys = [...list.matchAll(/"(\w+)"/g)].map((m) => m[1]);
    expect(keys.length).toBe(17);
    for (const k of keys) {
      expect((en.Landing as Record<string, string>)[k], `en ${k}`).toBeTruthy();
      expect((ar.Landing as Record<string, string>)[k], `ar ${k}`).toBeTruthy();
    }
  });
  it("keeps the tags the page renders (b and scribble) in both languages", () => {
    for (const k of ["hero_title", "ai_card_body"]) {
      const tags = (s: string) => [...s.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();
      expect(tags((ar.Landing as Record<string, string>)[k])).toEqual(tags((en.Landing as Record<string, string>)[k]));
    }
  });
});
