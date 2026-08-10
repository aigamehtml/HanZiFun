import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as OpenCC from "opencc-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = process.env.CHINESE_POETRY_DIST
  ? path.resolve(process.env.CHINESE_POETRY_DIST)
  : path.resolve("/private/tmp/hanzifun-poetry/package/dist");
const commonListPath = path.join(root, "data", "common-3500.txt");
const outputPath = path.join(root, "data", "content-templates.js");
const toSimplified = OpenCC.Converter({ from: "tw", to: "cn" });

function toScriptValue(value) {
  return JSON.stringify(value).replaceAll("</script", "<\\/script");
}

function simplify(value) {
  return toSimplified(String(value || ""));
}

function normalizeText(lines) {
  return lines
    .map((line) => simplify(line).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("");
}

function chunkText(text, size) {
  const characters = Array.from(text);
  const chunks = [];
  for (let offset = 0; offset < characters.length; offset += size) {
    chunks.push(characters.slice(offset, offset + size).join(""));
  }
  return chunks;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(sourceRoot, relativePath), "utf8"));
}

async function commonCharacterTemplates() {
  const source = await readFile(commonListPath, "utf8");
  const characters = Array.from(source.matchAll(/[\u3400-\u9fff]/gu), (match) => match[0]);
  return chunkText(characters.join(""), 100).map((text, index) => {
    const start = index * 100 + 1;
    const end = start + Array.from(text).length - 1;
    return {
      id: `common-3500-${String(index + 1).padStart(2, "0")}`,
      category: "小学常用",
      title: `常用3500字 · ${String(start).padStart(4, "0")}-${String(end).padStart(4, "0")}`,
      text: Array.from(text).join(" "),
    };
  });
}

async function tangPoemTemplates() {
  const tang = await readJson("mengxue/tangshisanbaishou.json");
  return tang.content
    .flatMap((section) => section.content || [])
    .filter((poem) => (poem.paragraphs || []).some((line) => String(line).trim()))
    .slice(0, 100)
    .map((poem, index) => ({
      id: `tang-300-${String(index + 1).padStart(3, "0")}`,
      category: "唐诗精选",
      title: `${simplify(poem.chapter)} · ${simplify(poem.author)}`,
      text: normalizeText(poem.paragraphs || []),
    }));
}

async function sanZiJingTemplates() {
  const classic = await readJson("mengxue/sanzijing-new.json");
  const paragraphs = classic.paragraphs.map(simplify);
  const templates = [{
    id: "sanzijing-full",
    category: "启蒙经典",
    title: "三字经 · 全文",
    text: paragraphs.join(""),
  }];
  for (let offset = 0; offset < paragraphs.length; offset += 12) {
    const index = offset / 12 + 1;
    templates.push({
      id: `sanzijing-section-${String(index).padStart(2, "0")}`,
      category: "启蒙经典",
      title: `三字经 · 第 ${index} 段`,
      text: paragraphs.slice(offset, offset + 12).join(""),
    });
  }
  return templates;
}

async function shiJingTemplates() {
  const shijing = await readJson("shijing/shijing.json");
  return shijing.slice(0, 20).map((poem, index) => ({
    id: `shijing-${String(index + 1).padStart(2, "0")}`,
    category: "诗经选读",
    title: `${poem.section} · ${poem.title}`,
    text: normalizeText(poem.content || []),
  }));
}

async function songCiTemplates() {
  const songCi = await readFirstJson([
    "songci/宋词三百首.json",
    "songci/songcisanbaishou.json",
    "宋词/宋词三百首.json",
  ]);
  return songCi
    .filter((ci) => (ci.paragraphs || []).some((line) => String(line).trim()))
    .map((ci, index) => ({
      id: `songci-300-${String(index + 1).padStart(3, "0")}`,
      category: "宋词精选",
      title: `${simplify(ci.rhythmic)} · ${simplify(ci.author)}`,
      text: normalizeText(ci.paragraphs || []),
    }));
}

async function readFirstJson(relativePaths) {
  const errors = [];
  for (const relativePath of relativePaths) {
    try {
      return await readJson(relativePath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      errors.push(relativePath);
    }
  }
  throw new Error(`Missing JSON source. Tried: ${errors.join(", ")}`);
}

const templates = [
  { id: "demo", category: "快速开始", title: "基础示例字", text: "人 口 日 月 水 火 山 田 木 永" },
  { id: "numbers", category: "小学常用", title: "数字与方位", text: "一 二 三 四 五 六 七 八 九 十 上 下 左 右 中 东 南 西 北" },
  { id: "nature", category: "小学常用", title: "自然词语", text: "天地 日月 山川 江河 湖海 风雨 雷电 春夏 秋冬 花草 树木" },
  { id: "animals", category: "小学常用", title: "动物词语", text: "猫 狗 鸟 鱼 虫 马 牛 羊 兔 鸡 鸭 鹅 熊 猴" },
  { id: "structures", category: "基础结构", title: "基础笔画字", text: "一 二 十 人 八 大 天 木 本 禾 上 下 中 口 日 月 田 山 水 火 永" },
  ...(await commonCharacterTemplates()),
  ...(await tangPoemTemplates()),
  ...(await sanZiJingTemplates()),
  ...(await shiJingTemplates()),
  ...(await songCiTemplates()),
];

await writeFile(outputPath, `window.HANZI_CONTENT_TEMPLATES=${toScriptValue(templates)};\n`);
console.log(`Built ${templates.length} content templates.`);
