// Generates the favicon set, logo and default OG image into public/.
// Pure Node (zlib only), so it needs no native image dependencies.
// Run: node scripts/generate-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const BRAND = [15, 118, 110]; // #0f766e
const BRAND_LIGHT = [204, 251, 241]; // #ccfbf1
const BG = [240, 253, 250]; // #f0fdfa
const WHITE = [255, 255, 255];
const BORDER = [153, 214, 205];

function createCanvas(width, height) {
  return { width, height, data: new Float64Array(width * height * 4) };
}

/** Paint `color` wherever `sdf(x, y)` (signed distance in px) is negative, anti-aliased. */
function paint(canvas, color, sdf) {
  const { width, height, data } = canvas;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const coverage = Math.min(1, Math.max(0, 0.5 - sdf(x + 0.5, y + 0.5)));
      if (coverage === 0) continue;
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      const outA = coverage + a * (1 - coverage);
      for (let c = 0; c < 3; c++) {
        data[i + c] = (color[c] * coverage + data[i + c] * a * (1 - coverage)) / outA;
      }
      data[i + 3] = outA;
    }
  }
}

function roundedRect(x0, y0, w, h, r) {
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  return (x, y) => {
    const qx = Math.abs(x - cx) - (w / 2 - r);
    const qy = Math.abs(y - cy) - (h / 2 - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
}

function polyline(points, thickness) {
  return (x, y) => {
    let best = Infinity;
    for (let k = 0; k < points.length - 1; k++) {
      const [ax, ay] = points[k];
      const [bx, by] = points[k + 1];
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
    }
    return best - thickness / 2;
  };
}

/** Checkmark inside the box (x, y, size), matching public/favicon.svg. */
function checkmark(x, y, size) {
  const p = (u, v) => [x + (u / 32) * size, y + (v / 32) * size];
  return polyline([p(9, 16.5), p(14, 21.5), p(23.5, 11)], (3.6 / 32) * size);
}

/** Brand mark: rounded teal square with a white checkmark. */
function drawMark(canvas, x, y, size, { fullBleed = false } = {}) {
  const radius = fullBleed ? 0 : size * (7 / 32);
  paint(canvas, BRAND, roundedRect(x, y, size, size, radius));
  paint(canvas, WHITE, checkmark(x, y, size));
}

function encodePng(canvas) {
  const { width, height, data } = canvas;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width * 4; x++) {
      const v = data[y * width * 4 + x];
      // Color channels are stored as 0–255, alpha as 0–1.
      raw[y * (width * 4 + 1) + 1 + x] = Math.round(x % 4 === 3 ? v * 255 : v);
    }
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([len, typed, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function iconPng(size, options) {
  const canvas = createCanvas(size, size);
  drawMark(canvas, 0, 0, size, options);
  return encodePng(canvas);
}

/** ICO container holding PNG-encoded images. */
function encodeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.png)]);
}

function ogImage() {
  const canvas = createCanvas(1200, 630);
  paint(canvas, BG, () => -1);
  // Card with a chart grid: 5 columns × 3 rows, some boxes checked.
  const card = { x: 140, y: 95, w: 920, h: 440 };
  paint(canvas, BORDER, roundedRect(card.x - 3, card.y - 3, card.w + 6, card.h + 6, 39));
  paint(canvas, WHITE, roundedRect(card.x, card.y, card.w, card.h, 36));
  drawMark(canvas, card.x + 60, card.y + 60, 120);
  const cols = 5;
  const rows = 3;
  const box = 92;
  const gap = 24;
  const gridX = card.x + 240;
  const gridY = card.y + (card.h - (rows * box + (rows - 1) * gap)) / 2;
  const checked = new Set(['0,0', '1,0', '2,0', '0,1', '1,1', '3,1', '0,2', '2,2']);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gridX + c * (box + gap);
      const y = gridY + r * (box + gap);
      paint(canvas, BORDER, roundedRect(x, y, box, box, 18));
      paint(canvas, checked.has(`${c},${r}`) ? BRAND_LIGHT : WHITE, roundedRect(x + 3, y + 3, box - 6, box - 6, 15));
      if (checked.has(`${c},${r}`)) paint(canvas, BRAND, checkmark(x, y, box));
    }
  }
  return encodePng(canvas);
}

const out = (name, buf) => writeFileSync(new URL(`../public/${name}`, import.meta.url), buf);

out('favicon.ico', encodeIco([16, 32, 48].map((size) => ({ size, png: iconPng(size) }))));
out('apple-touch-icon.png', iconPng(180, { fullBleed: true }));
out('icon-192.png', iconPng(192));
out('icon-512.png', iconPng(512));
out('icon-maskable-512.png', (() => {
  const canvas = createCanvas(512, 512);
  paint(canvas, BRAND, () => -1);
  drawMark(canvas, 512 * 0.15, 512 * 0.15, 512 * 0.7, { fullBleed: true });
  return encodePng(canvas);
})());
out('logo.png', iconPng(512));
out('og-default.png', ogImage());
console.log('Icons and OG image written to public/');
