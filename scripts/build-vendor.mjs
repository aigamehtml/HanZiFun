import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = path.join(root, "node_modules", "@zip.js", "zip.js");
const vendorDir = path.join(root, "vendor");

await mkdir(vendorDir, { recursive: true });
await Promise.all([
  copyFile(path.join(packageDir, "dist", "zip.min.js"), path.join(vendorDir, "zip.min.js")),
  copyFile(path.join(packageDir, "LICENSE"), path.join(vendorDir, "zip.LICENSE")),
]);
console.log("Built local zip.js vendor assets.");
