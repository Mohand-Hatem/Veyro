import { describe, expect, it } from "vitest";
import { FILE_MAX_BYTES, fileProblem, formatBytes } from "./task";

describe("fileProblem", () => {
  it("accepts pictures, PDFs and Office or text documents up to 10 MB", () => {
    for (const name of ["shot.PNG", "brief.pdf", "plan.docx", "data.csv", "deck.pptx"]) expect(fileProblem({ name, size: 1024 })).toBeNull();
    expect(fileProblem({ name: "a.pdf", size: FILE_MAX_BYTES })).toBeNull();
  });
  it("refuses other kinds of file and anything larger", () => {
    for (const name of ["setup.exe", "logo.svg", "page.html", "README"]) expect(fileProblem({ name, size: 10 })).toBe("fileType");
    expect(fileProblem({ name: "big.pdf", size: FILE_MAX_BYTES + 1 })).toBe("fileBig");
  });
});

describe("formatBytes", () => {
  it("reads like a file size", () => {
    expect(formatBytes(134, "en")).toBe("134 B");
    expect(formatBytes(4300, "en")).toBe("4.2 KB");
    expect(formatBytes(3.25 * 1024 * 1024, "en")).toBe("3.3 MB");
  });
});
