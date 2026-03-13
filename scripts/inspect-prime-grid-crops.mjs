import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from 'canvas';

const inputPath = process.argv[2] || path.join(process.cwd(), 'debug', 'primeparts_inventory.png');
const outputDir = process.argv[3] || path.join(process.cwd(), 'debug', 'results', 'grid-inspection');

const CFG = {
  headerHeight: 0.17,
  sidebarWidth: 0.23,
  bottomHeight: 0.08,
  leftPadding: 0.02,
  columns: 8,
  rowsFallback: 4,
  rowsVisual: 3,
  columnOverlap: 0.02,
  rowOverlap: 0.03,
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const toPxRegion = (imgW, imgH, xPct, yPct, wPct, hPct) => {
  const x = Math.floor(imgW * clamp01(xPct));
  const y = Math.floor(imgH * clamp01(yPct));
  const w = Math.max(1, Math.floor(imgW * Math.min(clamp01(wPct), 1 - xPct)));
  const h = Math.max(1, Math.floor(imgH * Math.min(clamp01(hPct), 1 - yPct)));
  return { x, y, w, h };
};

const cropRegion = (image, region) => {
  const canvas = createCanvas(region.w, region.h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
  return canvas;
};

const saveCanvas = async (canvas, outPath) => {
  const buf = canvas.toBuffer('image/png');
  await fs.writeFile(outPath, buf);
};

const makeContactSheet = async ({ title, crops, cols, outPath }) => {
  if (!crops.length) return;
  const padding = 8;
  const labelH = 20;
  const thumbW = crops[0].canvas.width;
  const thumbH = crops[0].canvas.height;
  const rows = Math.ceil(crops.length / cols);
  const canvas = createCanvas(
    cols * (thumbW + padding) + padding,
    rows * (thumbH + labelH + padding) + padding + 28
  );
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(title, padding, 20);

  crops.forEach((crop, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const x = padding + c * (thumbW + padding);
    const y = padding + 28 + r * (thumbH + labelH + padding);
    ctx.drawImage(crop.canvas, x, y);
    ctx.strokeStyle = '#777';
    ctx.strokeRect(x, y, thumbW, thumbH);
    ctx.fillStyle = '#ddd';
    ctx.font = '12px monospace';
    ctx.fillText(crop.name, x, y + thumbH + 14);
  });

  await saveCanvas(canvas, outPath);
};

const drawOverlay = async ({ image, gridPct, imgW, imgH, columnsPct, rowsPct, outPath }) => {
  const canvas = createCanvas(imgW, imgH);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const gridPx = toPxRegion(imgW, imgH, gridPct.x, gridPct.y, gridPct.w, gridPct.h);
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(gridPx.x, gridPx.y, gridPx.w, gridPx.h);

  columnsPct.forEach((r, i) => {
    const p = toPxRegion(imgW, imgH, r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(255,255,0,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,0,0.9)';
    ctx.font = '18px monospace';
    ctx.fillText(`C${i + 1}`, p.x + 4, p.y + 20);
  });

  rowsPct.forEach((r, i) => {
    const p = toPxRegion(imgW, imgH, r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(255,120,120,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,120,120,0.9)';
    ctx.font = '18px monospace';
    ctx.fillText(`R${i + 1}`, p.x + 4, p.y + 24);
  });

  await saveCanvas(canvas, outPath);
};

await ensureDir(outputDir);

const image = await loadImage(inputPath);
const imgW = image.width;
const imgH = image.height;

const gridPct = {
  x: CFG.leftPadding,
  y: CFG.headerHeight,
  w: 1 - CFG.leftPadding - CFG.sidebarWidth,
  h: 1 - CFG.headerHeight - CFG.bottomHeight,
};

const columnsPct = [];
const rowsPct = [];
const visualRowsPct = [];

const baseCol = gridPct.w / CFG.columns;
for (let i = 0; i < CFG.columns; i++) {
  const start = Math.max(0, baseCol * i - CFG.columnOverlap / 2);
  const w = baseCol + CFG.columnOverlap;
  const x = gridPct.x + start;
  columnsPct.push({
    x,
    y: gridPct.y,
    w: Math.min(w, 1 - x),
    h: gridPct.h,
  });
}

const baseRow = gridPct.h / CFG.rowsFallback;
for (let i = 0; i < CFG.rowsFallback; i++) {
  const start = Math.max(0, baseRow * i - CFG.rowOverlap / 2);
  const h = baseRow + CFG.rowOverlap;
  const y = gridPct.y + start;
  rowsPct.push({
    x: gridPct.x,
    y,
    w: gridPct.w,
    h: Math.min(h, 1 - y),
  });
}

const baseVisualRow = gridPct.h / CFG.rowsVisual;
for (let i = 0; i < CFG.rowsVisual; i++) {
  const y = gridPct.y + baseVisualRow * i;
  visualRowsPct.push({ x: gridPct.x, y, w: gridPct.w, h: Math.min(baseVisualRow, 1 - y) });
}

const columnCrops = [];
const rowCrops = [];
const cellCrops = [];

for (let i = 0; i < columnsPct.length; i++) {
  const px = toPxRegion(imgW, imgH, columnsPct[i].x, columnsPct[i].y, columnsPct[i].w, columnsPct[i].h);
  const canvas = cropRegion(image, px);
  const name = `old-column-${String(i + 1).padStart(2, '0')}`;
  await saveCanvas(canvas, path.join(outputDir, `${name}.png`));
  columnCrops.push({ name, canvas, region: px, pct: columnsPct[i] });
}

for (let i = 0; i < rowsPct.length; i++) {
  const px = toPxRegion(imgW, imgH, rowsPct[i].x, rowsPct[i].y, rowsPct[i].w, rowsPct[i].h);
  const canvas = cropRegion(image, px);
  const name = `old-row-${String(i + 1).padStart(2, '0')}`;
  await saveCanvas(canvas, path.join(outputDir, `${name}.png`));
  rowCrops.push({ name, canvas, region: px, pct: rowsPct[i] });
}

for (let r = 0; r < visualRowsPct.length; r++) {
  for (let c = 0; c < columnsPct.length; c++) {
    const x = columnsPct[c].x;
    const y = visualRowsPct[r].y;
    const w = baseCol;
    const h = baseVisualRow;
    const pct = {
      x,
      y,
      w: Math.min(w, 1 - x),
      h: Math.min(h, 1 - y),
    };
    const px = toPxRegion(imgW, imgH, pct.x, pct.y, pct.w, pct.h);
    const canvas = cropRegion(image, px);
    const name = `cell-r${r + 1}-c${c + 1}`;
    await saveCanvas(canvas, path.join(outputDir, `${name}.png`));
    cellCrops.push({ name, canvas, region: px, pct });
  }
}

await drawOverlay({
  image,
  gridPct,
  imgW,
  imgH,
  columnsPct,
  rowsPct,
  outPath: path.join(outputDir, 'overlay-old-grid-columns-rows.png'),
});

await makeContactSheet({
  title: 'Old grid fallback columns',
  crops: columnCrops,
  cols: 4,
  outPath: path.join(outputDir, 'contact-old-columns.png'),
});

await makeContactSheet({
  title: 'Old grid fallback rows',
  crops: rowCrops,
  cols: 2,
  outPath: path.join(outputDir, 'contact-old-rows.png'),
});

await makeContactSheet({
  title: 'Visual 8x3 cells (non-overlap)',
  crops: cellCrops,
  cols: 8,
  outPath: path.join(outputDir, 'contact-8x3-cells.png'),
});

const metadata = {
  inputPath,
  image: { width: imgW, height: imgH },
  config: CFG,
  gridPct,
  gridPx: toPxRegion(imgW, imgH, gridPct.x, gridPct.y, gridPct.w, gridPct.h),
  columns: columnCrops.map(({ name, region, pct }) => ({ name, region, pct })),
  rows: rowCrops.map(({ name, region, pct }) => ({ name, region, pct })),
  cells8x3: cellCrops.map(({ name, region, pct }) => ({ name, region, pct })),
};

await fs.writeFile(path.join(outputDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf8');

console.log('Generated grid inspection artifacts:');
console.log(`- ${outputDir}`);
console.log(`- overlay-old-grid-columns-rows.png`);
console.log(`- contact-old-columns.png`);
console.log(`- contact-old-rows.png`);
console.log(`- contact-8x3-cells.png`);
console.log(`- metadata.json`);
