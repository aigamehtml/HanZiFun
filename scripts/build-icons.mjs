import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "icons");

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

function makeIcon(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const line = Math.max(4, Math.round(size * 0.025));
  const inset = Math.round(size * 0.2);
  const center = Math.round(size / 2);
  const dotX = Math.round(size * 0.7);
  const dotY = Math.round(size * 0.3);
  const dotRadius = Math.round(size * 0.055);

  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = row + 1 + x * 4;
      let color = [23, 107, 135, 255];
      const outer =
        x >= inset && x <= size - inset && y >= inset && y <= size - inset &&
        (x - inset < line || size - inset - x < line || y - inset < line || size - inset - y < line);
      const guide =
        x >= inset && x <= size - inset && y >= inset && y <= size - inset &&
        (Math.abs(x - center) < line / 2 || Math.abs(y - center) < line / 2);
      const dot = (x - dotX) ** 2 + (y - dotY) ** 2 <= dotRadius ** 2;
      if (outer || guide) color = [255, 255, 255, guide ? 180 : 255];
      if (dot) color = [217, 72, 15, 255];
      pixels.set(color, offset);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(pixels, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir(outputDir, { recursive: true });
await Promise.all([192, 512].map((size) => writeFile(path.join(outputDir, `icon-${size}.png`), makeIcon(size))));
console.log("Built PWA icons (192px and 512px).");
