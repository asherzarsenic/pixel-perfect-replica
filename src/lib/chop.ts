export type Box = { id: string; x: number; y: number; w: number; h: number };

export type DetectOptions = {
  /** 0-255 tolerance against the detected background colour */
  tolerance?: number;
  /** ignore blobs smaller than this fraction of the image area */
  minAreaRatio?: number;
};

type Rgba = [number, number, number, number];

function sample(data: Uint8ClampedArray, i: number): Rgba {
  return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, data[i + 3] ?? 0];
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

/**
 * Detect individual assets on a sheet using the ORIGINAL pixels only.
 * Nothing here modifies, redraws or regenerates artwork — it returns boxes.
 */
export function detectAssets(
  source: HTMLCanvasElement,
  options: DetectOptions = {},
): { boxes: Box[]; backgroundIsTransparent: boolean } {
  const tolerance = options.tolerance ?? 26;
  const minAreaRatio = options.minAreaRatio ?? 0.0004;

  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));

  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const ctx = work.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Background estimate: border pixels.
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const as: number[] = [];
  const push = (x: number, y: number) => {
    const [r, g, b, a] = sample(data, (y * w + x) * 4);
    rs.push(r);
    gs.push(g);
    bs.push(b);
    as.push(a);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  const bg: Rgba = [median(rs), median(gs), median(bs), median(as)];
  const backgroundIsTransparent = bg[3] < 24;

  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b, a] = sample(data, i * 4);
    if (backgroundIsTransparent) {
      mask[i] = a > 16 ? 1 : 0;
    } else {
      const diff = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
      mask[i] = a > 16 && diff > tolerance ? 1 : 0;
    }
  }

  // Dilate once so antialiased/broken strokes join up.
  const dil = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) dil[ny * w + nx] = 1;
        }
      }
    }
  }

  // Connected components (iterative flood fill, 8-connected).
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const raw: { x0: number; y0: number; x1: number; y1: number; area: number }[] = [];

  for (let start = 0; start < w * h; start++) {
    if (!dil[start] || seen[start]) continue;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    let area = 0;

    while (stack.length) {
      const idx = stack.pop() as number;
      const x = idx % w;
      const y = (idx - x) / w;
      area++;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nIdx = ny * w + nx;
          if (dil[nIdx] && !seen[nIdx]) {
            seen[nIdx] = 1;
            stack.push(nIdx);
          }
        }
      }
    }
    raw.push({ x0, y0, x1, y1, area });
  }

  const minArea = w * h * minAreaRatio;
  let boxes = raw
    .filter((b) => b.area >= minArea && b.x1 - b.x0 > 3 && b.y1 - b.y0 > 3)
    .map((b) => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }));

  // Merge overlapping / heavily nested boxes.
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const overlapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (overlapX > -2 && overlapY > -2) {
          boxes[i] = {
            x0: Math.min(a.x0, b.x0),
            y0: Math.min(a.y0, b.y0),
            x1: Math.max(a.x1, b.x1),
            y1: Math.max(a.y1, b.y1),
          };
          boxes.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  boxes = boxes.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);

  const inv = 1 / scale;
  return {
    backgroundIsTransparent,
    boxes: boxes.map((b, i) => ({
      id: `box-${i}-${Math.random().toString(36).slice(2, 7)}`,
      x: Math.max(0, Math.floor((b.x0 - 1) * inv)),
      y: Math.max(0, Math.floor((b.y0 - 1) * inv)),
      w: Math.min(source.width, Math.ceil((b.x1 - b.x0 + 3) * inv)),
      h: Math.min(source.height, Math.ceil((b.y1 - b.y0 + 3) * inv)),
    })),
  };
}

export type ExtractOptions = {
  removeBackground: "off" | "safe" | "aggressive";
  padding: number;
  crop: "tight" | "bounds";
};

/**
 * Copies ORIGINAL pixels out of the source canvas. No resampling, no filters.
 */
export function extractAsset(
  source: HTMLCanvasElement,
  box: Box,
  options: ExtractOptions,
): HTMLCanvasElement {
  const x = Math.max(0, Math.min(source.width - 1, Math.round(box.x)));
  const y = Math.max(0, Math.min(source.height - 1, Math.round(box.y)));
  const w = Math.max(1, Math.min(source.width - x, Math.round(box.w)));
  const h = Math.max(1, Math.min(source.height - y, Math.round(box.h)));

  const cut = document.createElement("canvas");
  cut.width = w;
  cut.height = h;
  const cctx = cut.getContext("2d", { willReadFrequently: true });
  if (!cctx) throw new Error("Canvas is unavailable in this browser.");
  cctx.imageSmoothingEnabled = false;
  cctx.drawImage(source, x, y, w, h, 0, 0, w, h);

  if (options.removeBackground !== "off") {
    const img = cctx.getImageData(0, 0, w, h);
    const d = img.data;
    const corners = [
      0,
      (w - 1) * 4,
      (h - 1) * w * 4,
      ((h - 1) * w + (w - 1)) * 4,
    ].map((i) => sample(d, i));
    const bg: Rgba = [
      median(corners.map((c) => c[0])),
      median(corners.map((c) => c[1])),
      median(corners.map((c) => c[2])),
      median(corners.map((c) => c[3])),
    ];

    if (bg[3] > 24) {
      const hard = options.removeBackground === "aggressive" ? 46 : 14;
      const soft = options.removeBackground === "aggressive" ? 90 : 42;
      for (let i = 0; i < d.length; i += 4) {
        const diff =
          Math.abs((d[i] ?? 0) - bg[0]) +
          Math.abs((d[i + 1] ?? 0) - bg[1]) +
          Math.abs((d[i + 2] ?? 0) - bg[2]);
        if (diff <= hard) {
          d[i + 3] = 0;
        } else if (diff < soft) {
          // Feather only the ambiguous band so antialiasing survives.
          const t = (diff - hard) / (soft - hard);
          d[i + 3] = Math.round((d[i + 3] ?? 255) * t);
        }
      }
      cctx.putImageData(img, 0, 0);
    }
  }

  let result = cut;

  if (options.crop === "tight") {
    const img = result.getContext("2d")!.getImageData(0, 0, result.width, result.height);
    const d = img.data;
    let x0 = result.width;
    let y0 = result.height;
    let x1 = -1;
    let y1 = -1;
    for (let py = 0; py < result.height; py++) {
      for (let px = 0; px < result.width; px++) {
        if ((d[(py * result.width + px) * 4 + 3] ?? 0) > 4) {
          if (px < x0) x0 = px;
          if (py < y0) y0 = py;
          if (px > x1) x1 = px;
          if (py > y1) y1 = py;
        }
      }
    }
    if (x1 >= x0 && y1 >= y0 && (x0 > 0 || y0 > 0 || x1 < result.width - 1)) {
      const tight = document.createElement("canvas");
      tight.width = x1 - x0 + 1;
      tight.height = y1 - y0 + 1;
      const tctx = tight.getContext("2d")!;
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(result, x0, y0, tight.width, tight.height, 0, 0, tight.width, tight.height);
      result = tight;
    }
  }

  if (options.padding > 0) {
    const padded = document.createElement("canvas");
    padded.width = result.width + options.padding * 2;
    padded.height = result.height + options.padding * 2;
    const pctx = padded.getContext("2d")!;
    pctx.imageSmoothingEnabled = false;
    pctx.drawImage(result, options.padding, options.padding);
    result = padded;
  }

  return result;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode the image."));
    }, type);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function loadImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Canvas is unavailable in this browser."));
        return;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} could not be decoded as an image.`));
    };
    img.src = url;
  });
}
