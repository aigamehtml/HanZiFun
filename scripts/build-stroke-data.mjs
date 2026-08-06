import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BlobWriter, TextReader, ZipWriter, configure } from "@zip.js/zip.js";
import { pinyin } from "pinyin-pro";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "node_modules", "hanzi-writer-data");
const dataDir = path.join(root, "data");
const chunkDir = path.join(dataDir, "characters");
const commonListPath = path.join(dataDir, "common-3500.txt");
const commonCharacterCount = 3500;
const coreCharacters = Array.from("人口日月水火山田木永一二三上下大小中天地你我他好学春风雨");
const chunkSize = 50;
const packCharacterSize = 250;
const chunksPerPack = packCharacterSize / chunkSize;
const coreOnly = process.argv.includes("--core-only");
const archiveDate = new Date("2026-01-01T00:00:00.000Z");

configure({ useWebWorkers: false });

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

async function removeOldArchives() {
  const files = await readdir(dataDir);
  await Promise.all(
    files
      .filter((file) => /^strokes-(?:\d+|pack-\d+)\.zip$/.test(file))
      .map((file) => unlink(path.join(dataDir, file)))
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

async function listSourceCharacters() {
  const files = await readdir(sourceDir);
  return files
    .filter((file) => file.endsWith(".json") && file !== "package.json")
    .map((file) => file.replace(/\.json$/, ""))
    .filter((character) => Array.from(character).length === 1)
    .sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
}

async function buildFullData() {
  const source = await readFile(commonListPath, "utf8");
  const commonCharacters = Array.from(source.matchAll(/[\u3400-\u9fff]/gu), (match) => match[0]);
  if (commonCharacters.length !== commonCharacterCount || new Set(commonCharacters).size !== commonCharacterCount) {
    throw new Error(`common-3500.txt should contain ${commonCharacterCount} unique characters; found ${commonCharacters.length}`);
  }

  const sourceCharacters = await listSourceCharacters();
  const characters = [...new Set([...commonCharacters, ...sourceCharacters])];

  await removeOldChunks();
  await removeOldArchives();
  const index = {};
  const pinyinMap = {};
  const missing = [];
  const packs = [];
  let written = 0;
  let zipWriter = null;
  let packChunks = 0;

  async function closePack() {
    if (!zipWriter) return;
    const archive = await zipWriter.close();
    const archiveBuffer = Buffer.from(await archive.arrayBuffer());
    const packId = String(packs.length).padStart(3, "0");
    const file = `data/strokes-pack-${packId}.zip`;
    await writeFile(path.join(dataDir, `strokes-pack-${packId}.zip`), archiveBuffer);
    packs.push({ id: packId, file, chunks: packChunks, bytes: archiveBuffer.length });
    zipWriter = null;
    packChunks = 0;
  }

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
    if (!zipWriter) zipWriter = new ZipWriter(new BlobWriter("application/zip"), { useWebWorkers: false });
    await zipWriter.add(`chunk-${chunkId}.json`, new TextReader(JSON.stringify(chunk)), {
      level: 9,
      lastModDate: archiveDate,
      extendedTimestamp: false,
      useWebWorkers: false,
    });
    packChunks += 1;
    if (packChunks >= chunksPerPack) await closePack();
  }

  await closePack();

  const packInfo = {
    chunks: Math.ceil(characters.length / chunkSize),
    characters: characters.length,
    chunkSize,
    packCharacterSize,
    packs,
  };
  await writeFile(
    path.join(dataDir, "stroke-index.js"),
    `window.HANZI_CHUNK_INDEX=${toScriptValue(index)};window.HANZI_PACK_INFO=${toScriptValue(packInfo)};\n`
  );
  await writeFile(path.join(dataDir, "pinyin.js"), `window.HANZI_PINYIN=${toScriptValue(pinyinMap)};\n`);
  await writeFile(
    path.join(dataDir, "data-manifest.json"),
    `${JSON.stringify({ source: "hanzi-writer-data@2.0.1", requested: characters.length, commonCharacters: commonCharacterCount, expandedBy: "All single-codepoint JSON data files from upstream, with the 3500 common characters kept first", available: written, missing, chunkSize, packCharacterSize, archive: packInfo }, null, 2)}\n`
  );
  return { written, missing, archiveBytes: packs.reduce((total, pack) => total + pack.bytes, 0), packs: packs.length };
}

await mkdir(dataDir, { recursive: true });
const coreCount = await buildCoreBundle();
if (coreOnly) {
  console.log(`Built ${coreCount} core characters.`);
} else {
  const result = await buildFullData();
  console.log(`Built ${coreCount} core characters and ${result.written} on-demand characters in chunks of ${chunkSize}.`);
  console.log(`Built ${result.packs} stroke ZIP packs (${(result.archiveBytes / 1024 / 1024).toFixed(2)}MB total).`);
  if (result.missing.length) console.warn(`Missing source data: ${result.missing.join(" ")}`);
}
