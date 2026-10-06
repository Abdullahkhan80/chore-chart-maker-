// Pure helpers for exports: file names and PNG resolution metadata.
import type { ChartConfig } from './types.ts';

function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

function localIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** chore-chart-[name]-[YYYY-MM-DD].[ext], named after the first kid, else the title. */
export function exportFileName(config: ChartConfig, extension: string, date: Date = new Date(), suffix?: string): string {
  const name = slug(config.kids[0]?.name ?? '') || slug(config.title) || 'chart';
  const extra = suffix ? `-${slug(suffix) || 'page'}` : '';
  return `chore-chart-${name}${extra}-${localIsoDate(date)}.${extension}`;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Inserts a pHYs chunk so the PNG prints at `dpi` (canvas output carries no resolution). */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  const IHDR_END = 8 + 25; // signature + IHDR chunk (4 length + 4 type + 13 data + 4 crc)
  const isPng = png.length > IHDR_END && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47;
  if (!isPng) throw new Error('Not a PNG file');
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, pixelsPerMeter);
  view.setUint32(12, pixelsPerMeter);
  chunk[16] = 1; // unit: meter
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, IHDR_END));
  out.set(chunk, IHDR_END);
  out.set(png.subarray(IHDR_END), IHDR_END + chunk.length);
  return out;
}
