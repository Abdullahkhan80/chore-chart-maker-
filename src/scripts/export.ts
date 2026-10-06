// Browser exports: PDF (jsPDF + svg2pdf.js), 300 DPI PNG and print. Everything
// happens on this device; the only network requests fetch our own static icons
// and fonts. This module itself is loaded on demand when an export button is used,
// and the PDF libraries only when "Download PDF" is clicked.
import type { IconId } from '../lib/icons.ts';
import { ICON_MANIFEST } from '../lib/iconManifest.ts';
import { pageGeometry, renderChartPages, type IconResolver } from '../lib/renderChart.ts';
import { exportFileName, setPngDpi } from '../lib/exportUtils.ts';
import type { ChartConfig } from '../lib/types.ts';

const PNG_DPI = 300;
const ASSET_PREFIXES = ['/icons/', '/fonts/'];

/** The only network access in the editor: same-origin static assets. */
async function fetchAsset(path: string): Promise<ArrayBuffer> {
  if (!ASSET_PREFIXES.some((prefix) => path.startsWith(prefix))) throw new Error(`Refusing to fetch ${path}`);
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.arrayBuffer();
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const dataUriCache = new Map<string, Promise<string>>();

function dataUri(path: string, mime: string): Promise<string> {
  let cached = dataUriCache.get(path);
  if (!cached) {
    cached = fetchAsset(path).then((buffer) => `data:${mime};base64,${toBase64(buffer)}`);
    dataUriCache.set(path, cached);
  }
  return cached;
}

/** An icon resolver returning data: URIs, so exported files are self-contained. */
async function embeddedIconResolver(config: ChartConfig): Promise<IconResolver> {
  const used = new Set<IconId>();
  renderChartPages(config, { iconResolver: (id) => (used.add(id), '') });
  const entries = await Promise.all(
    [...used].map(async (id) => [id, await dataUri(ICON_MANIFEST[id].path, 'image/svg+xml')] as const),
  );
  const map = new Map<IconId, string>(entries);
  return (id) => map.get(id) ?? '';
}

async function embeddedFontCss(): Promise<string> {
  const [regular, bold] = await Promise.all([
    dataUri('/fonts/nunito-latin-400-normal.woff2', 'font/woff2'),
    dataUri('/fonts/nunito-latin-700-normal.woff2', 'font/woff2'),
  ]);
  return (
    `@font-face{font-family:Nunito;font-weight:400;src:url(${regular}) format("woff2")}` +
    `@font-face{font-family:Nunito;font-weight:700;src:url(${bold}) format("woff2")}`
  );
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function pageSuffix(config: ChartConfig, index: number, count: number): string | undefined {
  if (count === 1) return undefined;
  return config.kids[index]?.name || `page-${index + 1}`;
}

// ---------------------------------------------------------------------------
// PDF

export async function exportPdf(config: ChartConfig): Promise<void> {
  const [{ jsPDF }, { svg2pdf }, iconResolver, regular, bold] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
    embeddedIconResolver(config),
    fetchAsset('/fonts/pdf/nunito-latin-400.ttf'),
    fetchAsset('/fonts/pdf/nunito-latin-700.ttf'),
  ]);
  const geo = pageGeometry(config);
  const orientation = geo.widthIn > geo.heightIn ? 'landscape' : 'portrait';
  const doc = new jsPDF({ unit: 'in', format: [geo.widthIn, geo.heightIn], orientation, compress: true });
  doc.addFileToVFS('Nunito-Regular.ttf', toBase64(regular));
  doc.addFont('Nunito-Regular.ttf', 'Nunito', 'normal');
  doc.addFileToVFS('Nunito-Bold.ttf', toBase64(bold));
  doc.addFont('Nunito-Bold.ttf', 'Nunito', 'bold');
  doc.setFont('Nunito', 'normal');
  doc.setProperties({ title: config.title, creator: 'chorechartmaker.com' });

  const pages = renderChartPages(config, { iconResolver });
  // svg2pdf reads layout from live elements, so render each page off-screen.
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden';
  document.body.append(host);
  try {
    for (const [index, svg] of pages.entries()) {
      if (index > 0) doc.addPage([geo.widthIn, geo.heightIn], orientation);
      host.innerHTML = svg;
      const element = host.firstElementChild;
      if (!element) continue;
      await svg2pdf(element, doc, { x: 0, y: 0, width: geo.widthIn, height: geo.heightIn });
    }
  } finally {
    host.remove();
  }
  doc.save(exportFileName(config, 'pdf'));
}

// ---------------------------------------------------------------------------
// PNG

async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not create the PNG');
    return new Blob([setPngDpi(new Uint8Array(await blob.arrayBuffer()), PNG_DPI)], { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportPng(config: ChartConfig): Promise<void> {
  const [iconResolver, fontCss] = await Promise.all([embeddedIconResolver(config), embeddedFontCss()]);
  const geo = pageGeometry(config);
  const pages = renderChartPages(config, { iconResolver, fontCss });
  const width = Math.round(geo.widthIn * PNG_DPI);
  const height = Math.round(geo.heightIn * PNG_DPI);
  for (const [index, svg] of pages.entries()) {
    const png = await svgToPng(svg, width, height);
    download(png, exportFileName(config, 'png', new Date(), pageSuffix(config, index, pages.length)));
  }
}

// ---------------------------------------------------------------------------
// Print

export async function printChart(config: ChartConfig): Promise<void> {
  const iconResolver = await embeddedIconResolver(config);
  const pages = renderChartPages(config, { iconResolver });
  let root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.append(root);
  }
  let pageStyle = document.getElementById('print-page-style');
  if (!pageStyle) {
    pageStyle = document.createElement('style');
    pageStyle.id = 'print-page-style';
    document.head.append(pageStyle);
  }
  pageStyle.textContent = `@page { size: ${config.paper === 'a4' ? 'A4' : 'letter'} ${config.orientation}; margin: 0; }`;
  // Renderer output escapes all user text, so it is safe to insert as markup.
  root.innerHTML = pages.join('');
  await document.fonts.ready;
  const cleanup = () => {
    root.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
