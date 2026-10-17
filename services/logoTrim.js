/**
 * Logo trimming: crop an uploaded logo to the logo itself.
 *
 * Merchants often upload a logo with a wide empty margin, on a white or black
 * background, or as a phone screenshot (black bars and a status bar around
 * the real logo). Shown in a 40px header, the real logo then shrinks to a
 * sliver. Here the margin is cut off at upload, so every theme shows the logo
 * at full size.
 *
 * Only a transparent, near-white or near-black border is treated as
 * background: a logo designed on a coloured tile keeps its tile. A thin strip
 * of small marks at the very top or bottom (a phone status bar) is dropped
 * too. Nothing is cropped when the margin is small or when the result would
 * be a tiny piece of the image.
 *
 * `findLogoBox` is pure (RGBA pixels in, box out) and unit tested;
 * `trimLogo` wraps it with sharp.
 */
import sharp from "sharp";

/** Longest side of the copy the box is computed on (speed; box is scaled back). */
const ANALYSIS_SIDE = 400;
/** Below this alpha a pixel is transparent. */
const ALPHA_MIN = 32;
/** Channel distance from pure white / black still counted as that colour. */
const NEAR_EXTREME = 40;
/** Max per-channel distance from the background colour still counted as background. */
const BG_TOLERANCE = 40;
/** A row/column holds content when more than this share of it is not background. */
const LINE_CONTENT_MIN = 0.01;
/** Background rows/columns needed to separate two bands, as a share of the side. */
const BAND_GAP = 0.04;
/** An edge band is noise when it holds less than this share of all content... */
const NOISE_CONTENT = 0.08;
/** ...and is shorter than this share of the side. */
const NOISE_SIZE = 0.15;
/** Margin kept around the logo, as a share of its longer side. */
const PADDING = 0.04;
/** Crop only when it removes more than this share of the area. */
const MIN_GAIN = 0.08;
/** Never crop to less than this share of the area (likely a misread). */
const MIN_KEEP = 0.02;

const isNearWhite = (r, g, b) => r >= 255 - NEAR_EXTREME && g >= 255 - NEAR_EXTREME && b >= 255 - NEAR_EXTREME;
const isNearBlack = (r, g, b) => r <= NEAR_EXTREME && g <= NEAR_EXTREME && b <= NEAR_EXTREME;

/**
 * The background, read from the border pixels: "transparent", an opaque
 * near-white / near-black colour, or null (a coloured tile — no background).
 */
function readBackground(px, width, height) {
  let transparent = 0;
  let white = [0, 0, 0, 0];
  let black = [0, 0, 0, 0];
  let total = 0;
  const visit = (x, y) => {
    const i = (y * width + x) * 4;
    total++;
    if (px[i + 3] < ALPHA_MIN) return void transparent++;
    const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
    const bucket = isNearWhite(r, g, b) ? white : isNearBlack(r, g, b) ? black : null;
    if (!bucket) return;
    bucket[0]++;
    bucket[1] += r;
    bucket[2] += g;
    bucket[3] += b;
  };
  for (let x = 0; x < width; x++) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    visit(0, y);
    visit(width - 1, y);
  }
  // The border must be mostly one background for it to be a margin.
  const majority = total * 0.6;
  if (transparent >= majority) return "transparent";
  const solid = white[0] >= black[0] ? white : black;
  if (solid[0] + transparent >= majority && solid[0] > 0) {
    return [solid[1] / solid[0], solid[2] / solid[0], solid[3] / solid[0]];
  }
  return null;
}

/** Content ranges along one axis: [start, end] bands of lines with content. */
function bands(counts, side) {
  const gap = Math.max(2, Math.round(side * BAND_GAP));
  const out = [];
  let start = -1;
  let last = -1;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] === 0) continue;
    if (start === -1) start = i;
    else if (i - last > gap) {
      out.push([start, last]);
      start = i;
    }
    last = i;
  }
  if (start !== -1) out.push([start, last]);
  return out;
}

/** The content range along one axis, dropping thin sparse bands at either edge. */
function contentRange(counts, side) {
  const list = bands(counts, side).map(([a, b]) => {
    let sum = 0;
    for (let i = a; i <= b; i++) sum += counts[i];
    return { a, b, sum };
  });
  if (!list.length) return null;
  const total = list.reduce((s, x) => s + x.sum, 0);
  const isNoise = (band) => band.sum < total * NOISE_CONTENT && band.b - band.a + 1 < side * NOISE_SIZE;
  while (list.length > 1 && isNoise(list[0])) list.shift();
  while (list.length > 1 && isNoise(list[list.length - 1])) list.pop();
  return [list[0].a, list[list.length - 1].b];
}

/**
 * The logo's box in an RGBA image, or null when it should stay as is.
 * @param {Uint8Array|Buffer} px  RGBA pixels, row by row
 * @returns {{ left: number, top: number, width: number, height: number } | null}
 */
export function findLogoBox(px, width, height) {
  if (!width || !height || px.length < width * height * 4) return null;
  const bg = readBackground(px, width, height);
  if (!bg) return null;
  const isBg = (i) => {
    if (px[i + 3] < ALPHA_MIN) return true;
    if (bg === "transparent") return false;
    return (
      Math.abs(px[i] - bg[0]) <= BG_TOLERANCE &&
      Math.abs(px[i + 1] - bg[1]) <= BG_TOLERANCE &&
      Math.abs(px[i + 2] - bg[2]) <= BG_TOLERANCE
    );
  };

  const content = new Uint8Array(width * height);
  const rowCount = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isBg((y * width + x) * 4)) {
        content[y * width + x] = 1;
        rowCount[y]++;
      }
    }
  }
  const rowMin = Math.max(1, width * LINE_CONTENT_MIN);
  const rows = contentRange(rowCount.map((n) => (n >= rowMin ? n : 0)), height);
  if (!rows) return null;

  const colCount = new Array(width).fill(0);
  for (let y = rows[0]; y <= rows[1]; y++) {
    for (let x = 0; x < width; x++) colCount[x] += content[y * width + x];
  }
  const colMin = Math.max(1, (rows[1] - rows[0] + 1) * LINE_CONTENT_MIN);
  const cols = contentRange(colCount.map((n) => (n >= colMin ? n : 0)), width);
  if (!cols) return null;

  const pad = Math.round(Math.max(cols[1] - cols[0] + 1, rows[1] - rows[0] + 1) * PADDING);
  const left = Math.max(0, cols[0] - pad);
  const top = Math.max(0, rows[0] - pad);
  const box = {
    left,
    top,
    width: Math.min(width, cols[1] + pad + 1) - left,
    height: Math.min(height, rows[1] + pad + 1) - top,
  };
  const share = (box.width * box.height) / (width * height);
  if (share > 1 - MIN_GAIN || share < MIN_KEEP) return null;
  return box;
}

/**
 * The logo cropped to its content, as PNG (transparency kept), or the input
 * unchanged when there is nothing to crop or the image cannot be read.
 * @param {Buffer} input
 * @returns {Promise<{ buffer: Buffer, trimmed: boolean }>}
 */
export async function trimLogo(input) {
  try {
    // Upright (EXIF) PNG first, so the box and the crop use the same pixels.
    const base = await sharp(input, { failOn: "none" }).rotate().png().toBuffer();
    const { width, height } = await sharp(base).metadata();
    if (!width || !height) return { buffer: input, trimmed: false };

    const scale = Math.min(1, ANALYSIS_SIDE / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const { data } = await sharp(base)
      .resize(w, h, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const box = findLogoBox(data, w, h);
    if (!box) return { buffer: input, trimmed: false };

    const left = Math.floor(box.left / scale);
    const top = Math.floor(box.top / scale);
    const region = {
      left,
      top,
      width: Math.min(width - left, Math.ceil(box.width / scale)),
      height: Math.min(height - top, Math.ceil(box.height / scale)),
    };
    const buffer = await sharp(base).extract(region).png().toBuffer();
    return { buffer, trimmed: true };
  } catch {
    return { buffer: input, trimmed: false };
  }
}

export default trimLogo;
