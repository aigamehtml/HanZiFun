import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "icons");
const hanData = JSON.parse(await readFile(path.join(root, "node_modules", "hanzi-writer-data", "汉.json"), "utf8"));
const supersampling = 3;

const COLORS = {
  background: [23, 107, 135, 255],
  paper: [250, 252, 252, 255],
  grid: [23, 107, 135, 255],
  guide: [128, 169, 181, 255],
  character: [24, 35, 43, 255],
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}

function fill(canvas, color) {
  for (let offset = 0; offset < canvas.length; offset += 4) canvas.set(color, offset);
}

function setPixel(canvas, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  canvas.set(color, (Math.floor(y) * size + Math.floor(x)) * 4);
}

function fillRect(canvas, size, x, y, width, height, color) {
  for (let row = Math.max(0, Math.floor(y)); row < Math.min(size, Math.ceil(y + height)); row += 1) {
    for (let column = Math.max(0, Math.floor(x)); column < Math.min(size, Math.ceil(x + width)); column += 1) {
      setPixel(canvas, size, column, row, color);
    }
  }
}

function drawSegment(canvas, size, start, end, width, color) {
  const radius = width / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const minX = Math.max(0, Math.floor(Math.min(start.x, end.x) - radius));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(start.x, end.x) + radius));
  const minY = Math.max(0, Math.floor(Math.min(start.y, end.y) - radius));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(start.y, end.y) + radius));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const projection = Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / lengthSquared));
      const nearestX = start.x + projection * dx;
      const nearestY = start.y + projection * dy;
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2) setPixel(canvas, size, x, y, color);
    }
  }
}

function drawDashedSegment(canvas, size, start, end, width, dashLength, color) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  for (let offset = 0; offset < length; offset += dashLength * 2) {
    const from = offset / length;
    const to = Math.min(1, (offset + dashLength) / length);
    drawSegment(
      canvas,
      size,
      { x: start.x + dx * from, y: start.y + dy * from },
      { x: start.x + dx * to, y: start.y + dy * to },
      width,
      color
    );
  }
}

function drawMiziGrid(canvas, size) {
  const inset = size * 0.14;
  const far = size - inset;
  const center = size / 2;
  const borderWidth = size * 0.026;
  const guideWidth = size * 0.009;
  const dash = size * 0.035;

  fillRect(canvas, size, inset, inset, far - inset, far - inset, COLORS.paper);
  drawSegment(canvas, size, { x: inset, y: inset }, { x: far, y: inset }, borderWidth, COLORS.grid);
  drawSegment(canvas, size, { x: far, y: inset }, { x: far, y: far }, borderWidth, COLORS.grid);
  drawSegment(canvas, size, { x: far, y: far }, { x: inset, y: far }, borderWidth, COLORS.grid);
  drawSegment(canvas, size, { x: inset, y: far }, { x: inset, y: inset }, borderWidth, COLORS.grid);
  drawDashedSegment(canvas, size, { x: center, y: inset }, { x: center, y: far }, guideWidth, dash, COLORS.guide);
  drawDashedSegment(canvas, size, { x: inset, y: center }, { x: far, y: center }, guideWidth, dash, COLORS.guide);
  drawDashedSegment(canvas, size, { x: inset, y: inset }, { x: far, y: far }, guideWidth, dash, COLORS.guide);
  drawDashedSegment(canvas, size, { x: far, y: inset }, { x: inset, y: far }, guideWidth, dash, COLORS.guide);
}

function drawHanCharacter(canvas, size) {
  const points = hanData.medians.flat().map(([x, y]) => ({ x, y: 900 - y }));
  const bounds = points.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x),
    maxX: Math.max(result.maxX, point.x),
    minY: Math.min(result.minY, point.y),
    maxY: Math.max(result.maxY, point.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const targetSize = size * 0.64;
  const scale = Math.min(targetSize / (bounds.maxX - bounds.minX), targetSize / (bounds.maxY - bounds.minY));
  const offsetX = (size - (bounds.maxX - bounds.minX) * scale) / 2 - bounds.minX * scale;
  const offsetY = (size - (bounds.maxY - bounds.minY) * scale) / 2 - bounds.minY * scale;
  const strokeWidth = size * 0.052;

  for (const median of hanData.medians) {
    const transformed = median.map(([x, y]) => ({ x: x * scale + offsetX, y: (900 - y) * scale + offsetY }));
    for (let index = 1; index < transformed.length; index += 1) {
      drawSegment(canvas, size, transformed[index - 1], transformed[index], strokeWidth, COLORS.character);
    }
  }
}

function downsample(source, sourceSize, targetSize) {
  const output = Buffer.alloc(targetSize * targetSize * 4);
  const factor = sourceSize / targetSize;
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sampleY = 0; sampleY < factor; sampleY += 1) {
        for (let sampleX = 0; sampleX < factor; sampleX += 1) {
          const sourceOffset = ((y * factor + sampleY) * sourceSize + x * factor + sampleX) * 4;
          for (let channel = 0; channel < 4; channel += 1) totals[channel] += source[sourceOffset + channel];
        }
      }
      const targetOffset = (y * targetSize + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) output[targetOffset + channel] = Math.round(totals[channel] / (factor * factor));
    }
  }
  return output;
}

function encodePng(size, rgba) {
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    scanlines[row] = 0;
    rgba.copy(scanlines, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIcon(size) {
  const sourceSize = size * supersampling;
  const canvas = Buffer.alloc(sourceSize * sourceSize * 4);
  fill(canvas, COLORS.background);
  drawMiziGrid(canvas, sourceSize);
  drawHanCharacter(canvas, sourceSize);
  return encodePng(size, downsample(canvas, sourceSize, size));
}

await mkdir(outputDir, { recursive: true });
await Promise.all([192, 512].map((size) => writeFile(path.join(outputDir, `icon-${size}.png`), makeIcon(size))));
console.log("Built PWA icons with 汉 in a Mizi grid (192px and 512px).");
