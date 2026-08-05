import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zipPackageDir = path.join(root, "node_modules", "@zip.js", "zip.js");
const fflatePackageDir = path.join(root, "node_modules", "fflate");
const jsPdfPackageDir = path.join(root, "node_modules", "jspdf");
const vendorDir = path.join(root, "vendor");

await mkdir(vendorDir, { recursive: true });
await Promise.all([
  copyFile(path.join(zipPackageDir, "LICENSE"), path.join(vendorDir, "zip.LICENSE")),
  copyFile(path.join(fflatePackageDir, "umd", "index.js"), path.join(vendorDir, "fflate.min.js")),
  copyFile(path.join(fflatePackageDir, "LICENSE"), path.join(vendorDir, "fflate.LICENSE")),
  copyFile(path.join(jsPdfPackageDir, "dist", "jspdf.umd.min.js"), path.join(vendorDir, "jspdf.umd.min.js")),
  copyFile(path.join(jsPdfPackageDir, "LICENSE"), path.join(vendorDir, "jspdf.LICENSE")),
]);

const jsPdfVendorPath = path.join(vendorDir, "jspdf.umd.min.js");
const jsPdfSource = await readFile(jsPdfVendorPath, "utf8");
await writeFile(jsPdfVendorPath, jsPdfSource.replace(/[ \t]+$/gm, ""));

console.log("Built local fflate and jsPDF runtime assets plus dependency licenses.");
