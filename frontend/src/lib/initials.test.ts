import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it.each([
    ["Mohand Hatem", "MH"],
    ["Mohand Ahmed Hatem", "MH"],
    ["  mohand   hatem  ", "MH"],
    ["Mohand", "M"],
    ["Jean-Luc Picard", "JP"],
    ["Sara Ahmed Ali", "SA"],
    ["Acme Engineering", "AE"],
  ])("%s gives %s", (name, expected) => expect(initials(name)).toBe(expected));

  it("handles Arabic names, with or without marks", () => {
    expect(initials("محمد حاتم")).toBe("مح");
    expect(initials("مُحَمَّد حَاتِم")).toBe("مح");
    expect(initials("محمد")).toBe("م");
  });

  it("skips emoji and symbols up to the first letter or digit, and never splits an emoji", () => {
    expect(initials("😀 Sara Ali")).toBe("SA");
    expect(initials("Sara 😀 Ali")).toBe("SA");
    expect(initials("(Dr.) Omar")).toBe("DO");
    expect(initials("😀😀", "omar@x.io")).toBe("O");
  });

  it("falls back to the email, then to a question mark", () => {
    expect(initials("😀", "omar@x.io")).toBe("O");
    expect(initials("😀")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});
