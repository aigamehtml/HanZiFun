// 构建内嵌正楷子集字体（AR PL UKai CN）+ harfbuzz hb-subset 运行时。
// 1) 下载 Debian fonts-arphic-ukai .deb，解包得 ukai.ttc（TrueType Collection；face 0 = AR PL UKai CN 简体正楷，覆盖 2 万余字）
// 2) 用 hb-subset.wasm 按「全部笔顺字(~9574) + 标点 + 数字 + 拉丁 + 拼音」预子集 face 0 为 vendor/fonts/kai.ttf
// 3) fontkit 生成 kai-chars.json（实际覆盖字符集，运行时生僻字 fallback 判断）
// 4) 拷贝 hb-subset.wasm + LICENSE + Arphic Public License
//
// 运行时：app.js 用 hb-subset.wasm 把 kai.ttf 二次裁剪到页面实际用字，嵌入 jsPDF，
// 用 pdf.text() 真文本渲染页眉等排版文字，解决 helvetica 无中文导致的乱码。
import { mkdir, writeFile, readFile, copyFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fontkit = require("fontkit");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = path.join(root, "vendor");
const fontDir = path.join(vendorDir, "fonts");
const cacheDir = path.join(vendorDir, ".cache");
const DEB_SOURCES = [
  "https://mirrors.tuna.tsinghua.edu.cn/debian/pool/main/f/fonts-arphic-ukai/fonts-arphic-ukai_0.2.20080216.2-5_all.deb",
  "https://ftp.debian.org/debian/pool/main/f/fonts-arphic-ukai/fonts-arphic-ukai_0.2.20080216.2-5_all.deb",
];
const DEB_CACHE = path.join(cacheDir, "ukai.deb");
const TTC_CACHE = path.join(cacheDir, "ukai.ttc");
const COPYRIGHT_CACHE = path.join(cacheDir, "arphic-copyright");

async function fetchFirst(sources, validate) {
  for (const url of sources) {
    try {
      console.log(`  尝试 ${url}`);
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (validate && !validate(buf)) throw new Error("校验失败");
      return buf;
    } catch (e) {
      console.warn(`    失败：${e.message}`);
    }
  }
  throw new Error("所有源均不可用");
}

async function ensureUkai() {
  if (existsSync(TTC_CACHE) && existsSync(COPYRIGHT_CACHE)) {
    return { ttc: await readFile(TTC_CACHE), copyright: await readFile(COPYRIGHT_CACHE, "utf8") };
  }
  await mkdir(cacheDir, { recursive: true });
  console.log("下载 fonts-arphic-ukai .deb...");
  const deb = await fetchFirst(DEB_SOURCES, (b) => b.includes(Buffer.from("data.tar")));
  await writeFile(DEB_CACHE, deb);
  console.log("  解包 .deb...");
  execSync(`ar x "${DEB_CACHE}"`, { cwd: cacheDir });
  execSync(`tar -xf "${path.join(cacheDir, "data.tar.xz")}" -C "${cacheDir}"`);
  const ttcPath = path.join(cacheDir, "usr/share/fonts/truetype/arphic/ukai.ttc");
  const copyrightPath = path.join(cacheDir, "usr/share/doc/fonts-arphic-ukai/copyright");
  if (!existsSync(ttcPath)) throw new Error("解包后未找到 ukai.ttc");
  const ttc = await readFile(ttcPath);
  const copyright = existsSync(copyrightPath) ? await readFile(copyrightPath, "utf8") : "";
  await writeFile(TTC_CACHE, ttc);
  await writeFile(COPYRIGHT_CACHE, copyright);
  return { ttc, copyright };
}

// 中文标点用 \u 转义，避免引号字符与 JS 字符串分隔符冲突。
const CJK_PUNCT = "，。、；：！？" + "“”‘’" + "（）《》〈〉【】「」『』…·～";
const PINYIN_TONES = "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹḿ";

async function collectSubsetChars(ttc) {
  const collection = fontkit.create(ttc);
  const font = collection.fonts[0]; // face 0 = AR PL UKai CN（简体正楷）
  const covered = new Set(font.characterSet);
  const family = font.names?.records?.[1] ? Object.values(font.names.records[1])[0] : "AR PL UKai CN";
  // 全部笔顺字（hanzi-writer-data 单码位 JSON）
  const dataDir = path.join(root, "node_modules", "hanzi-writer-data");
  const files = await readdir(dataDir);
  const strokeChars = files
    .filter((f) => f.endsWith(".json") && f !== "package.json")
    .map((f) => f.replace(/\.json$/, ""))
    .filter((c) => Array.from(c).length === 1);
  const wanted = new Set();
  const add = (s) => { for (const ch of s) if (!/\s/.test(ch)) wanted.add(ch); };
  add(strokeChars.join(""));
  add("0123456789");
  add("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
  add(" !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~");
  add(CJK_PUNCT);
  add(PINYIN_TONES);
  // kai-chars = 期望字符集 ∩ UKai CN 实际覆盖
  const kaiChars = [...wanted].filter((c) => covered.has(c.codePointAt(0)));
  const missing = [...wanted].filter((c) => !covered.has(c.codePointAt(0)));
  return { kaiChars, missing, family, total: font.characterSet.length };
}

// hb-subset 子集化（.ttc face 0），与 app.js subsetFontKai 同源逻辑。
async function subsetWithHb(ttc, text) {
  const H = (await WebAssembly.instantiate(readFileSync(path.join(root, "node_modules", "harfbuzzjs", "hb-subset.wasm")))).instance.exports;
  const heapu8 = new Uint8Array(H.memory.buffer);
  const input = H.hb_subset_input_create_or_fail();
  if (!input) throw new Error("hb_subset_input_create_or_fail");
  const fb = H.malloc(ttc.byteLength);
  heapu8.set(new Uint8Array(ttc), fb);
  const blob = H.hb_blob_create(fb, ttc.byteLength, 2, 0, 0);
  const face = H.hb_face_create(blob, 0); // face 0 = AR PL UKai CN
  H.hb_blob_destroy(blob);
  const lf = H.hb_subset_input_set(input, 6);
  H.hb_set_clear(lf);
  H.hb_set_invert(lf);
  const unicodes = H.hb_subset_input_unicode_set(input);
  for (const c of text) H.hb_set_add(unicodes, c.codePointAt(0));
  const sub = H.hb_subset_or_fail(face, input);
  H.hb_subset_input_destroy(input);
  if (!sub) { H.hb_face_destroy(face); H.free(fb); throw new Error("hb_subset_or_fail"); }
  const result = H.hb_face_reference_blob(sub);
  const off = H.hb_blob_get_data(result, 0);
  const len = H.hb_blob_get_length(result);
  const copy = Buffer.from(heapu8.subarray(off, off + len));
  H.hb_blob_destroy(result);
  H.hb_face_destroy(sub);
  H.hb_face_destroy(face);
  H.free(fb);
  return copy;
}

const { ttc, copyright } = await ensureUkai();
console.log(`ukai.ttc: ${(ttc.length / 1024 / 1024).toFixed(1)}MB`);
const { kaiChars, missing, family, total } = await collectSubsetChars(ttc);
console.log(`${family}: 覆盖 ${total} 字；预子集 ${kaiChars.length} 字（笔顺字+标点+数字+拉丁+拼音 ∩ 覆盖）${missing.length ? `，缺 ${missing.length} 字: ${missing.slice(0, 20).join("")}` : ""}`);
const kaiText = kaiChars.join("");
const subset = await subsetWithHb(ttc, kaiText);
await mkdir(fontDir, { recursive: true });
await writeFile(path.join(fontDir, "kai.ttf"), subset);
await writeFile(path.join(fontDir, "kai-chars.json"), JSON.stringify(kaiText));
console.log(`  vendor/fonts/kai.ttf: ${(subset.length / 1024).toFixed(0)} KB`);
console.log(`  vendor/fonts/kai-chars.json: ${kaiChars.length} 字`);

await copyFile(path.join(root, "node_modules", "harfbuzzjs", "hb-subset.wasm"), path.join(vendorDir, "hb-subset.wasm"));
await copyFile(path.join(root, "node_modules", "harfbuzzjs", "LICENSE"), path.join(vendorDir, "hb-subset.LICENSE"));
await writeFile(path.join(vendorDir, "kai.LICENSE"), copyright || "AR PL UKai - Arphic Public License");
console.log("  vendor/hb-subset.wasm + hb-subset.LICENSE + kai.LICENSE（Arphic Public License）");
console.log("Built local AR PL UKai CN subset font, hb-subset runtime, and licenses.");
