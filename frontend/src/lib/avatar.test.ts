import { describe, expect, it } from "vitest";
import { baseScale, clampCrop, cropRect, cropStyle, isPreset, isStoredPhoto } from "./avatar";

const RING = 240;

describe("cropping", () => {
  it("at zoom 1 the shorter side fills the ring and the longer side can slide", () => {
    expect(baseScale(1200, 800, RING)).toBeCloseTo(0.3);
    const c = clampCrop({ zoom: 1, x: 500, y: 500 }, 1200, 800, RING);
    expect(c.y).toBe(0); // nothing to slide on the shorter side
    expect(c.x).toBeCloseTo((1200 * 0.3 - RING) / 2); // 60 px each way on the longer side
    expect(clampCrop({ zoom: 1, x: -500, y: 0 }, 1200, 800, RING).x).toBeCloseTo(-60);
  });

  it("zooming in allows more movement, and zoom stays between 1 and 3", () => {
    expect(clampCrop({ zoom: 2, x: 999, y: 999 }, 800, 800, RING)).toEqual({ zoom: 2, x: RING / 2, y: RING / 2 });
    expect(clampCrop({ zoom: 9, x: 0, y: 0 }, 800, 800, RING).zoom).toBe(3);
    expect(clampCrop({ zoom: 0.2, x: 0, y: 0 }, 800, 800, RING).zoom).toBe(1);
  });

  it("the crop rectangle is a square inside the picture, centred when the picture is not moved", () => {
    const r = cropRect({ zoom: 1, x: 0, y: 0 }, 1200, 800, RING);
    expect(r.size).toBeCloseTo(800);
    expect(r.sx).toBeCloseTo(200);
    expect(r.sy).toBeCloseTo(0);
    const zoomed = cropRect({ zoom: 2, x: 0, y: 0 }, 1200, 800, RING);
    expect(zoomed.size).toBeCloseTo(400);
    expect(zoomed.sx).toBeCloseTo(400);
    expect(zoomed.sy).toBeCloseTo(200);
  });

  it("a clamped crop always stays inside the picture", () => {
    for (const [x, y] of [[1000, -1000], [-1000, 1000], [0, 0]]) {
      const c = clampCrop({ zoom: 1.5, x, y }, 1200, 800, RING);
      const r = cropRect(c, 1200, 800, RING);
      expect(r.sx).toBeGreaterThanOrEqual(-0.001);
      expect(r.sy).toBeGreaterThanOrEqual(-0.001);
      expect(r.sx + r.size).toBeLessThanOrEqual(1200.001);
      expect(r.sy + r.size).toBeLessThanOrEqual(800.001);
    }
  });

  it("a small preview shows the same crop scaled to its size", () => {
    const stage = cropStyle({ zoom: 1.5, x: 20, y: -10 }, 1200, 800, RING, RING);
    const preview = cropStyle({ zoom: 1.5, x: 20, y: -10 }, 1200, 800, RING, 60);
    expect(preview.width).toBeCloseTo(stage.width / 4);
    expect(preview.transform).toBe("translate(-50%, -50%) translate(5px, -2.5px)");
  });
});

describe("avatar helpers", () => {
  it("knows presets and stored photos", () => {
    expect(isPreset("sage")).toBe(true);
    expect(isPreset("purple-dragon")).toBe(false);
    expect(isPreset(null)).toBe(false);
    expect(isStoredPhoto("https://res.cloudinary.com/demo/image/upload/v1/Veyro/avatars/u1.webp")).toBe(true);
    expect(isStoredPhoto("https://lh3.googleusercontent.com/a/photo")).toBe(false);
    expect(isStoredPhoto("/avatars/presets/sage.svg")).toBe(false);
  });
});
