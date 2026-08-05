import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zipPackageDir = path.join(root, "node_modules", "@zip.js", "zip.js");
const html2canvasPackageDir = path.join(root, "node_modules", "html2canvas");
const jsPdfPackageDir = path.join(root, "node_modules", "jspdf");
const vendorDir = path.join(root, "vendor");

await mkdir(vendorDir, { recursive: true });
await Promise.all([
  copyFile(path.join(zipPackageDir, "dist", "zip.min.js"), path.join(vendorDir, "zip.min.js")),
  copyFile(path.join(zipPackageDir, "LICENSE"), path.join(vendorDir, "zip.LICENSE")),
  copyFile(path.join(html2canvasPackageDir, "dist", "html2canvas.min.js"), path.join(vendorDir, "html2canvas.min.js")),
  copyFile(path.join(html2canvasPackageDir, "LICENSE"), path.join(vendorDir, "html2canvas.LICENSE")),
  copyFile(path.join(jsPdfPackageDir, "dist", "jspdf.umd.min.js"), path.join(vendorDir, "jspdf.umd.min.js")),
  copyFile(path.join(jsPdfPackageDir, "LICENSE"), path.join(vendorDir, "jspdf.LICENSE")),
]);

const jsPdfVendorPath = path.join(vendorDir, "jspdf.umd.min.js");
const jsPdfSource = await readFile(jsPdfVendorPath, "utf8");
await writeFile(jsPdfVendorPath, jsPdfSource.replace(/[ \t]+$/gm, ""));

console.log("Built local zip.js, html2canvas, and jsPDF vendor assets.");
