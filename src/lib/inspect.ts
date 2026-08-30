export type Severity = "pass" | "warn" | "fail";

export type Issue = {
  id: string;
  severity: Severity;
  title: string;
  why: string;
  fix: string;
  fixable?: "resize" | "convert" | "pad" | "rename" | null;
};

export type InspectedFile = {
  id: string;
  file: File;
  name: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  transparentMarginPct: number;
  previewUrl: string;
  issues: Issue[];
  status: Severity;
};

export type Preset = {
  id: string;
  label: string;
  width?: number;
  height?: number;
  square?: boolean;
  minWidth?: number;
  formats: string[];
  requireTransparency?: boolean;
  requireOpaque?: boolean;
  note: string;
};

export const PRESETS: Preset[] = [
  {
    id: "android-icon",
    label: "Android Icon",
    width: 512,
    height: 512,
    formats: ["png"],
    requireTransparency: true,
    note: "512×512 PNG with transparency (Play Store icon rules).",
  },
  {
    id: "app-icon",
    label: "App Icon",
    width: 1024,
    height: 1024,
    formats: ["png"],
    requireOpaque: true,
    note: "1024×1024 PNG, no transparency (iOS App Store).",
  },
  {
    id: "website",
    label: "Website",
    minWidth: 1200,
    formats: ["png", "jpg", "jpeg", "webp", "svg"],
    note: "At least 1200px wide, web-friendly format.",
  },
  {
    id: "social",
    label: "Social Media",
    width: 1200,
    height: 630,
    formats: ["png", "jpg", "jpeg"],
    note: "1200×630 landscape share card.",
  },
  {
    id: "etsy",
    label: "Etsy / Product Listing",
    minWidth: 2000,
    square: true,
    formats: ["png", "jpg", "jpeg"],
    note: "Square, 2000px or larger on the shortest side.",
  },
  {
    id: "print",
    label: "Print",
    minWidth: 2480,
    formats: ["png", "jpg", "jpeg"],
    note: "Large pixel dimensions; DPI cannot be verified in-browser.",
  },
  {
    id: "poster",
    label: "Poster / Flyer",
    minWidth: 3508,
    formats: ["png", "jpg", "jpeg"],
    note: "A3-ish at 300dpi equivalent pixel dimensions.",
  },
  {
    id: "sticker",
    label: "Sticker",
    minWidth: 1000,
    formats: ["png"],
    requireTransparency: true,
    note: "Transparent PNG, 1000px or larger.",
  },
  {
    id: "wallpaper",
    label: "Wallpaper",
    minWidth: 1920,
    formats: ["png", "jpg", "jpeg", "webp"],
    note: "1920px or wider.",
  },
  {
    id: "custom",
    label: "Custom",
    formats: [],
    note: "Define your own requirements.",
  },
];

export type CustomSpec = {
  width: string;
  height: string;
  format: string;
  transparency: "any" | "required" | "forbidden";
};

const SUSPICIOUS = [
  /^final\d*(_final)*\./i,
  /^final_final/i,
  /^untitled/i,
  /^image\d+\./i,
  /^img_?\d+\./i,
  /^screenshot/i,
  /copy( \d+)?\./i,
  /^download/i,
  /^asset\d*\.$/i,
];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extensionOf(name: string): string {
  const parts = name.split(".");
  return (parts.length > 1 ? parts.pop() ?? "" : "").toLowerCase();
}

export async function readFileMeta(file: File): Promise<Omit<InspectedFile, "issues" | "status">> {
  const previewUrl = URL.createObjectURL(file);
  const format = extensionOf(file.name) || file.type.split("/")[1] || "unknown";

  if (format === "svg") {
    return {
      id: crypto.randomUUID(),
      file,
      name: file.name,
      format,
      bytes: file.size,
      width: 0,
      height: 0,
      hasAlpha: true,
      transparentMarginPct: 0,
      previewUrl,
    };
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`${file.name} could not be decoded.`));
    el.src = previewUrl;
  });

  const width = img.naturalWidth;
  const height = img.naturalHeight;

  const scale = Math.min(1, 400 / Math.max(width, height, 1));
  const cw = Math.max(1, Math.round(width * scale));
  const ch = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let hasAlpha = false;
  let transparentMarginPct = 0;
  if (ctx) {
    ctx.drawImage(img, 0, 0, cw, ch);
    const { data } = ctx.getImageData(0, 0, cw, ch);
    let x0 = cw;
    let y0 = ch;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const a = data[(y * cw + x) * 4 + 3] ?? 255;
        if (a < 250) hasAlpha = true;
        if (a > 8) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
    }
    if (hasAlpha && x1 >= x0 && y1 >= y0) {
      const contentArea = (x1 - x0 + 1) * (y1 - y0 + 1);
      transparentMarginPct = Math.max(0, 1 - contentArea / (cw * ch)) * 100;
    }
  }

  return {
    id: crypto.randomUUID(),
    file,
    name: file.name,
    format,
    bytes: file.size,
    width,
    height,
    hasAlpha,
    transparentMarginPct,
    previewUrl,
  };
}

function worst(issues: Issue[]): Severity {
  if (issues.some((i) => i.severity === "fail")) return "fail";
  if (issues.some((i) => i.severity === "warn")) return "warn";
  return "pass";
}

export function inspectBatch(
  files: Omit<InspectedFile, "issues" | "status">[],
  preset: Preset,
  custom: CustomSpec,
): InspectedFile[] {
  const targetW =
    preset.id === "custom" ? Number(custom.width) || undefined : preset.width;
  const targetH =
    preset.id === "custom" ? Number(custom.height) || undefined : preset.height;
  const allowedFormats =
    preset.id === "custom"
      ? custom.format
        ? [custom.format.toLowerCase()]
        : []
      : preset.formats;
  const requireTransparency =
    preset.id === "custom" ? custom.transparency === "required" : !!preset.requireTransparency;
  const requireOpaque =
    preset.id === "custom" ? custom.transparency === "forbidden" : !!preset.requireOpaque;

  const dimKeys = files.map((f) => `${f.width}×${f.height}`);
  const formats = files.map((f) => f.format);
  const modeOf = (arr: string[]) => {
    const counts = new Map<string, number>();
    arr.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const dimMode = modeOf(dimKeys);
  const formatMode = modeOf(formats);

  return files.map((f, index) => {
    const issues: Issue[] = [];
    const isSvg = f.format === "svg";

    if (!isSvg && targetW && targetH) {
      if (f.width !== targetW || f.height !== targetH) {
        issues.push({
          id: "dimensions",
          severity: "fail",
          title: `Dimensions are ${f.width}×${f.height}, not ${targetW}×${targetH}`,
          why: "The destination rejects or rescales files that do not match the required canvas.",
          fix: `Re-export at ${targetW}×${targetH}, or let Brief Buster produce a resized copy.`,
          fixable: "resize",
        });
      }
    }

    if (!isSvg && preset.minWidth && f.width < preset.minWidth) {
      issues.push({
        id: "too-small",
        severity: "fail",
        title: `Only ${f.width}px wide (minimum ${preset.minWidth}px)`,
        why: "Upscaling a small export loses detail and looks soft at final size.",
        fix: "Re-export from the source document at a larger size.",
        fixable: null,
      });
    }

    if (!isSvg && preset.square && f.width !== f.height) {
      issues.push({
        id: "aspect",
        severity: "warn",
        title: `Aspect ratio is ${(f.width / Math.max(f.height, 1)).toFixed(2)}:1, not square`,
        why: "Square-only listings crop or letterbox non-square images.",
        fix: "Crop or pad to a 1:1 canvas.",
        fixable: "pad",
      });
    }

    if (allowedFormats.length && !allowedFormats.includes(f.format)) {
      issues.push({
        id: "format",
        severity: "fail",
        title: `.${f.format} is not accepted here`,
        why: `This destination expects ${allowedFormats.map((x) => `.${x}`).join(", ")}.`,
        fix: "Convert the file to an accepted format.",
        fixable: "convert",
      });
    }

    if (!isSvg && requireTransparency && !f.hasAlpha) {
      issues.push({
        id: "no-alpha",
        severity: "fail",
        title: "No transparency detected",
        why: "The background will render as a solid rectangle instead of sitting on the surface behind it.",
        fix: "Re-export with an alpha channel, or remove the background in Chop Shop.",
        fixable: null,
      });
    }

    if (!isSvg && requireOpaque && f.hasAlpha) {
      issues.push({
        id: "unexpected-alpha",
        severity: "fail",
        title: "Transparency present where it is not allowed",
        why: "Stores that require opaque icons reject files with an alpha channel.",
        fix: "Flatten onto a solid background before exporting.",
        fixable: null,
      });
    }

    if (!isSvg && f.hasAlpha && f.transparentMarginPct > 45) {
      issues.push({
        id: "margins",
        severity: "warn",
        title: `About ${f.transparentMarginPct.toFixed(0)}% of the canvas is empty`,
        why: "Large transparent margins make the artwork appear smaller than everything around it.",
        fix: "Crop tightly, then add deliberate padding.",
        fixable: null,
      });
    }

    if (SUSPICIOUS.some((re) => re.test(f.name))) {
      issues.push({
        id: "naming",
        severity: "warn",
        title: `"${f.name}" looks like a working filename`,
        why: "Clients and developers receive the filename; scratch names read as unfinished work.",
        fix: "Rename using a predictable pattern such as brand_icon_512.png.",
        fixable: "rename",
      });
    }

    if (files.length > 1 && dimMode && dimKeys[index] !== dimMode) {
      issues.push({
        id: "batch-dimensions",
        severity: "warn",
        title: `Different size to the rest of the batch (${dimMode})`,
        why: "Inconsistent sizes break grids and automated pipelines.",
        fix: "Normalise the batch to one canvas size.",
        fixable: "resize",
      });
    }

    if (files.length > 1 && formatMode && f.format !== formatMode) {
      issues.push({
        id: "batch-format",
        severity: "warn",
        title: `Format differs from the rest of the batch (.${formatMode})`,
        why: "Mixed formats in one delivery usually mean an export was missed.",
        fix: "Export the whole set in one format.",
        fixable: "convert",
      });
    }

    if (isSvg) {
      issues.push({
        id: "svg",
        severity: "warn",
        title: "SVG contents are not fully inspectable in the browser",
        why: "Vector dimensions, embedded rasters and fonts cannot be verified reliably here.",
        fix: "Open the SVG in your editor to confirm viewBox, fonts and embedded images.",
        fixable: null,
      });
    }

    return { ...f, issues, status: worst(issues) };
  });
}

export type FixSettings = { width?: number; height?: number; format: string; prefix: string };

/** Produces a corrected COPY. The original file object is never modified. */
export async function buildFixedFile(
  item: InspectedFile,
  settings: FixSettings,
  index: number,
): Promise<{ blob: Blob; name: string }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`${item.name} could not be decoded.`));
    el.src = item.previewUrl;
  });

  const width = settings.width ?? img.naturalWidth;
  const height = settings.height ?? img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");

  const mime = settings.format === "jpg" || settings.format === "jpeg" ? "image/jpeg" : `image/${settings.format}`;
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  // Contain, never crop artwork.
  const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode the corrected copy."))),
      mime,
      0.95,
    );
  });

  const base = settings.prefix
    ? `${settings.prefix}_${String(index + 1).padStart(2, "0")}`
    : item.name.replace(/\.[^.]+$/, "");
  return { blob, name: `${base}.${settings.format}` };
}
