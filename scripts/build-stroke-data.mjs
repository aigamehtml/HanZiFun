import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pinyin } from "pinyin-pro";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "node_modules", "hanzi-writer-data");
const dataDir = path.join(root, "data");
const chunkDir = path.join(dataDir, "characters");
const commonListPath = path.join(dataDir, "common-3500.txt");
const coreCharacters = Array.from("人口日月水火山田木永一二三上下大小中天地你我他好学春风雨");
const chunkSize = 50;
const coreOnly = process.argv.includes("--core-only");

function toScriptValue(value) {
  return JSON.stringify(value).replaceAll("</script", "<\\/script");
}

async function readStrokeData(character) {
  const file = path.join(sourceDir, `${character}.json`);
  const raw = JSON.parse(await readFile(file, "utf8"));
  return { strokes: raw.strokes, medians: raw.medians };
}

async function removeOldChunks() {
  await mkdir(chunkDir, { recursive: true });
  const files = await readdir(chunkDir);
  await Promise.all(
    files.filter((file) => /^chunk-\d+\.js$/.test(file)).map((file) => unlink(path.join(chunkDir, file)))
  );
}

async function buildCoreBundle() {
  const entries = {};
  for (const character of coreCharacters) {
    entries[character] = await readStrokeData(character);
  }
  const script = `window.HANZI_STROKES=${toScriptValue(entries)};\n`;
  await writeFile(path.join(dataDir, "strokes.js"), script);
  return Object.keys(entries).length;
}

async function buildFullData() {
  const source = await readFile(commonListPath, "utf8");
  const characters = Array.from(source.matchAll(/[\u3400-\u9fff]/gu), (match) => match[0]);
  if (characters.length !== 3500 || new Set(characters).size !== 3500) {
    throw new Error(`common-3500.txt should contain 3500 unique characters; found ${characters.length}`);
  }

  await removeOldChunks();
  const index = {};
  const pinyinMap = {};
  const missing = [];
  let written = 0;

  for (let offset = 0; offset < characters.length; offset += chunkSize) {
    const chunkId = String(offset / chunkSize).padStart(3, "0");
    const chunk = {};
    for (const character of characters.slice(offset, offset + chunkSize)) {
      try {
        chunk[character] = await readStrokeData(character);
        index[character] = chunkId;
        pinyinMap[character] = pinyin(character, { toneType: "none", type: "array" })[0] || "";
        written += 1;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        missing.push(character);
      }
    }

    const script = [
      "window.HANZI_STROKES=window.HANZI_STROKES||{};",
      `Object.assign(window.HANZI_STROKES,${toScriptValue(chunk)});`,
      `window.dispatchEvent(new CustomEvent("hanzi-data-loaded",{detail:${toScriptValue(Object.keys(chunk))}}));`,
      "",
    ].join("\n");
    await writeFile(path.join(chunkDir, `chunk-${chunkId}.js`), script);
  }

  await writeFile(path.join(dataDir, "stroke-index.js"), `window.HANZI_CHUNK_INDEX=${toScriptValue(index)};\n`);
  await writeFile(path.join(dataDir, "pinyin.js"), `window.HANZI_PINYIN=${toScriptValue(pinyinMap)};\n`);
  await writeFile(
    path.join(dataDir, "data-manifest.json"),
    `${JSON.stringify({ source: "hanzi-writer-data@2.0.1", requested: 3500, available: written, missing, chunkSize }, null, 2)}\n`
  );
  return { written, missing };
}

await mkdir(dataDir, { recursive: true });
const coreCount = await buildCoreBundle();
if (coreOnly) {
  console.log(`Built ${coreCount} core characters.`);
} else {
  const result = await buildFullData();
  console.log(`Built ${coreCount} core characters and ${result.written} on-demand characters in chunks of ${chunkSize}.`);
  if (result.missing.length) console.warn(`Missing source data: ${result.missing.join(" ")}`);
}
