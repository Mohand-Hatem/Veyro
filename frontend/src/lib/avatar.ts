/** The five illustrated avatars (their files are in public/avatars/presets; the server only accepts these keys). */
export const PRESETS = ["amber", "sage", "sky", "sand", "rose"] as const;
export type Preset = (typeof PRESETS)[number];
export const presetSrc = (key: Preset) => `/avatars/presets/${key}.svg`;
export const isPreset = (key: string | null): key is Preset => !!key && (PRESETS as readonly string[]).includes(key);

/** A picture we stored ourselves (a Google or GitHub photo, or a preset, is not). */
export const isStoredPhoto = (url: string | null) => !!url && url.startsWith("https://res.cloudinary.com/");

/**
 * Cropping. The ring is a circle of `ring` pixels in the middle of the stage. At zoom 1 the picture's shorter side exactly fills
 * the ring; `x` and `y` move the picture from the ring's centre. All of it is plain arithmetic so it can be tested.
 */
export type Crop = { zoom: number; x: number; y: number };
export const MAX_ZOOM = 3;
const OUTPUT = 512;

export const baseScale = (w: number, h: number, ring: number) => ring / Math.min(w, h);

/** Keeps the ring covered by the picture, so the result never has empty corners. */
export function clampCrop(c: Crop, w: number, h: number, ring: number): Crop {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, c.zoom));
  const s = baseScale(w, h, ring) * zoom;
  const mx = Math.max(0, (w * s - ring) / 2);
  const my = Math.max(0, (h * s - ring) / 2);
  return { zoom, x: Math.min(mx, Math.max(-mx, c.x)), y: Math.min(my, Math.max(-my, c.y)) };
}

/** The square of the original picture, in its own pixels, that lies inside the ring. */
export function cropRect(c: Crop, w: number, h: number, ring: number) {
  const s = baseScale(w, h, ring) * c.zoom;
  const size = ring / s;
  return { sx: w / 2 - c.x / s - size / 2, sy: h / 2 - c.y / s - size / 2, size };
}

/** Style of the picture inside a box whose side stands for the ring (the stage itself, or a small preview). */
export function cropStyle(c: Crop, w: number, h: number, ring: number, box: number) {
  const f = box / ring;
  const s = baseScale(w, h, ring) * c.zoom;
  return { width: w * s * f, transform: `translate(-50%, -50%) translate(${c.x * f}px, ${c.y * f}px)` };
}

export type Source = { canvas: HTMLCanvasElement; url: string; w: number; h: number };

/** Opens a picked file for cropping. The browser applies the photo's rotation, and a huge photo is brought down to 2048px first. */
export async function loadForCrop(file: File): Promise<Source> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("encode failed"))), "image/jpeg", 0.92));
  return { canvas, url: URL.createObjectURL(blob), w: canvas.width, h: canvas.height };
}

/** The 512px square the person chose. (The server shrinks it again and does the trusted checks.) */
export function cropToBlob(src: Source, crop: Crop, ring: number): Promise<Blob> {
  const { sx, sy, size } = cropRect(crop, src.w, src.h, ring);
  const out = document.createElement("canvas");
  out.width = out.height = OUTPUT;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fff"; // a transparent PNG would turn black in a JPEG
  ctx.fillRect(0, 0, OUTPUT, OUTPUT);
  ctx.drawImage(src.canvas, sx, sy, size, size, 0, 0, OUTPUT, OUTPUT);
  return new Promise((ok, no) => out.toBlob((b) => (b ? ok(b) : no(new Error("encode failed"))), "image/jpeg", 0.9));
}
