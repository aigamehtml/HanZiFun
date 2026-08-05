const SETTINGS_KEY = "hanzifun.settings";
const SETTINGS_VERSION = 7;
const APP_TITLE = "汉字 Fun";
const CSS_PX_PER_MM = 96 / 25.4;
const VIEWBOX_SIZE = 1024;
const BASELINE = 900;
const MAX_CACHED_CHUNKS = 16;
const USE_ZIP_PACK = location.protocol !== "file:";
const STEP_CELL_MM = 16;
const STEP_COLUMN_GAP_MM = 2.5;
const STEP_ITEM_HEIGHT_MM = 20;
const STROKE_CARD_MIN_HEIGHT_MM = 48;
const STROKE_CARD_FIXED_WIDTH_MM = 38;
const STROKE_CARD_PADDING_MM = 4;

const PAPER_SIZES = {
  A5: [148, 210],
  A4: [210, 297],
  A3: [297, 420],
  Letter: [216, 279],
};

const DEFAULT_SETTINGS = {
  settingsVersion: SETTINGS_VERSION,
  inputText: "人 口 日 月 水 火 山 田 木 永",
  template: "trace",
  gridStyle: "tian",
  paperSize: "A4",
  orientation: "portrait",
  headerPreset: "homework",
  footerPreset: "right",
  title: "中文写字练习",
  studentName: "",
  className: "",
  date: new Date().toISOString().slice(0, 10),
  cellSizeMm: 16,
  marginMm: 10,
  rowsPerPage: 0,
  cellsPerRow: 0,
  rowsPerCharacter: 1,
  cellGapMm: 1,
  rowGapMm: 3,
  blankPageCount: 1,
  dedupe: true,
  showPinyin: true,
  showRowGuide: true,
  showStrokeNumbers: true,
  showStartDots: true,
  showArrows: true,
  showGuides: true,
  traceMode: "full",
  traceOpacity: 0.2,
  gridFrameColor: "#aebac2",
  gridCrossColor: "#c9d2d8",
  gridDiagonalColor: "#d8c6c6",
  zoom: 70,
};

const NUMBER_FIELDS = new Set([
  "cellSizeMm", "marginMm", "rowsPerPage", "cellsPerRow",
  "rowsPerCharacter", "cellGapMm", "rowGapMm", "blankPageCount",
  "traceOpacity", "zoom",
]);

const TEMPLATE_LABELS = {
  trace: "描红练习",
  stroke: "笔顺分解",
  blank: "空白格纸",
  copy: "文章临摹",
};

const GRID_STYLE_LABELS = {
  tian: "田字格",
  mi: "米字格",
};

const els = {
  controls: document.querySelector("#controls"),
  pages: document.querySelector("#pages"),
  summary: document.querySelector("#summary"),
  dataStatus: document.querySelector("#dataStatus"),
  contentStatus: document.querySelector("#contentStatus"),
  compactStatus: document.querySelector("#compactStatus"),
  saveStatus: document.querySelector("#saveStatus"),
  contentCategory: document.querySelector("#contentCategory"),
  contentTemplate: document.querySelector("#contentTemplate"),
  replaceContentBtn: document.querySelector("#replaceContentBtn"),
  appendContentBtn: document.querySelector("#appendContentBtn"),
  exportPdfBtn: document.querySelector("#exportPdfBtn"),
  exportStatus: document.querySelector("#exportStatus"),
  printBtn: document.querySelector("#printBtn"),
  printNote: document.querySelector("#printNote"),
  installBtn: document.querySelector("#installBtn"),
  settingsBtn: document.querySelector("#settingsBtn"),
  closeSettingsBtn: document.querySelector("#closeSettingsBtn"),
  drawerBackdrop: document.querySelector("#drawerBackdrop"),
  resetBtn: document.querySelector("#resetBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  printPageStyle: document.querySelector("#printPageStyle"),
  previewWrap: document.querySelector(".preview-wrap"),
};

let settings = loadSettings();
let renderFrame = 0;
let markerSequence = 0;
let installPrompt = null;
const pendingChunks = new Map();
const failedChunks = new Set();
const loadedChunks = new Map();
const chunkCharacters = new Map();
const coreCharacters = new Set(Object.keys(window.HANZI_STROKES || {}));
let activeChunkIds = new Set();
const zipArchivePromises = new Map();
const zipArchiveStates = new Map();
let exportStatusTimer = 0;
let strokePrefetchScheduled = false;

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (stored && typeof stored === "object" && Number(stored.settingsVersion) <= SETTINGS_VERSION) {
      const migrated = { ...stored };
      delete migrated.practiceCount;
      delete migrated.stepCount;
      if (["tian", "mizi"].includes(migrated.template)) {
        migrated.gridStyle = migrated.template === "mizi" ? "mi" : "tian";
        migrated.template = "trace";
      }
      if (/^#[0-9a-f]{6}$/i.test(migrated.gridColor || "")) {
        migrated.gridFrameColor ??= migrated.gridColor;
        migrated.gridCrossColor ??= migrated.gridColor;
        migrated.gridDiagonalColor ??= migrated.gridColor;
      }
      delete migrated.gridColor;
      return { ...DEFAULT_SETTINGS, ...migrated, settingsVersion: SETTINGS_VERSION };
    }
  } catch {
    // Private browsing and file URLs can deny storage access.
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings() {
  settings.settingsVersion = SETTINGS_VERSION;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    els.saveStatus.textContent = "已自动保存";
  } catch {
    els.saveStatus.textContent = "本机未允许保存";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function extractCharacters(text, dedupe) {
  const chars = Array.from(text.matchAll(/[\u3400-\u9fff]/gu), (match) => match[0]);
  return dedupe ? [...new Set(chars)] : chars;
}

function extractCopyItems(text) {
  return Array.from(text).filter((character) => !/\s/u.test(character));
}

function layoutCopyItems(text, columns) {
  const slots = [];
  let cursor = 0;
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((line, lineIndex) => {
    const characters = Array.from(line).filter((character) => !/\s/u.test(character));
    for (const character of characters) slots[cursor++] = character;
    if (lineIndex === lines.length - 1) return;
    const remainder = cursor % columns;
    if (!characters.length && remainder === 0) cursor += columns;
    else if (remainder) cursor += columns - remainder;
  });
  return { slots, usedSlots: cursor };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function settingColor(key) {
  return /^#[0-9a-f]{6}$/i.test(settings[key]) ? settings[key] : DEFAULT_SETTINGS[key];
}

function headerReservedHeight() {
  if (settings.headerPreset === "blank") return 0;
  return settings.headerPreset === "simple" ? 18 : 28;
}

function paperDimensions() {
  const base = PAPER_SIZES[settings.paperSize] || PAPER_SIZES.A4;
  return settings.orientation === "landscape" ? { width: base[1], height: base[0] } : { width: base[0], height: base[1] };
}

function gridStyle() {
  return settings.gridStyle === "mi" ? "mi" : "tian";
}

function pointToSvg(point) {
  return { x: point[0], y: BASELINE - point[1] };
}

function makeGrid(type, options = {}) {
  // Keep the frame clear of the SVG clipping edge so print rasterization
  // cannot drop the left or bottom stroke at some scaling factors.
  const edge = 8;
  const farEdge = VIEWBOX_SIZE - edge;
  const size = VIEWBOX_SIZE - edge * 2;
  const frame = options.joinLeft
    ? `<path class="grid-frame-line" d="M${edge} ${edge}H${farEdge}V${farEdge}H${edge}"></path>`
    : `<rect class="grid-frame-line" x="${edge}" y="${edge}" width="${size}" height="${size}"></rect>`;
  if (!settings.showGuides) return frame;
  const diagonals = type === "mi"
    ? `<line class="grid-diagonal-line" x1="${edge}" y1="${edge}" x2="${farEdge}" y2="${farEdge}"></line><line class="grid-diagonal-line" x1="${farEdge}" y1="${edge}" x2="${edge}" y2="${farEdge}"></line>`
    : "";
  return `${frame}<line class="grid-cross-line" x1="512" y1="${edge}" x2="512" y2="${farEdge}"></line><line class="grid-cross-line" x1="${edge}" y1="512" x2="${farEdge}" y2="512"></line>${diagonals}`;
}

function renderStrokePaths(data, options) {
  if (options.blank) return "";
  const mode = options.mode || "full";
  const step = options.step ?? data.strokes.length - 1;
  return data.strokes.map((path, index) => {
    if (mode === "step" && index > step) return "";
    let className = "stroke";
    if (mode === "step" && index < step) className = "done";
    if (options.trace) className = "trace";
    const opacity = options.trace ? settings.traceOpacity : 1;
    return `<path class="${className}" d="${path}" opacity="${opacity}"></path>`;
  }).join("");
}

function renderAnnotations(data) {
  return data.medians.map((median, index) => {
    const start = pointToSvg(median[0]);
    const directionPoint = pointToSvg(median[Math.min(Math.max(1, Math.floor(median.length * 0.18)), median.length - 1)]);
    const markerId = `arrow-${markerSequence += 1}`;
    const marker = settings.showArrows
      ? `<defs><marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z"></path></marker></defs>`
      : "";
    const arrow = settings.showArrows
      ? `<line class="median-arrow" x1="${start.x}" y1="${start.y}" x2="${directionPoint.x}" y2="${directionPoint.y}" marker-end="url(#${markerId})"></line>`
      : "";
    const dot = settings.showStartDots ? `<circle class="start-dot" cx="${start.x}" cy="${start.y}" r="22"></circle>` : "";
    const number = settings.showStrokeNumbers
      ? `<text class="order-label" x="${start.x + 34}" y="${start.y - 28}">${index + 1}</text>`
      : "";
    return `${marker}${arrow}${dot}${number}`;
  }).join("");
}

function makeCharacterSvg(character, options = {}) {
  const data = window.HANZI_STROKES?.[character];
  const grid = makeGrid(options.gridStyle || gridStyle(), options);
  if (options.blank) {
    return `<svg class="hanzi-cell" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" role="img" aria-label="空白练习格">${grid}</svg>`;
  }
  if (!data) {
    const opacity = options.trace ? settings.traceOpacity : 1;
    return `<svg class="hanzi-cell pending-cell" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" role="img" aria-label="${escapeHtml(character)} 正在载入">${grid}<text class="fallback-glyph" x="512" y="512" opacity="${opacity}">${escapeHtml(character)}</text></svg>`;
  }
  const paths = renderStrokePaths(data, options);
  const annotations = options.annotate ? renderAnnotations(data) : "";
  return `<svg class="hanzi-cell" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" role="img" aria-label="${escapeHtml(character)} 字练习格">${grid}<g transform="translate(0 ${BASELINE}) scale(1 -1)">${paths}</g>${annotations}</svg>`;
}

function makeCopyCell(character, options = {}) {
  if (window.HANZI_STROKES?.[character]) {
    return makeCharacterSvg(character, { ...options, trace: true, gridStyle: gridStyle() });
  }
  const grid = makeGrid(gridStyle(), options);
  return `<svg class="hanzi-cell copy-cell" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" role="img" aria-label="${escapeHtml(character)} 临摹格">${grid}<text class="copy-glyph" x="512" y="650" opacity="${settings.traceOpacity}">${escapeHtml(character)}</text></svg>`;
}

function pinyinFor(character) {
  return settings.showPinyin ? (window.HANZI_PINYIN?.[character] || "") : "";
}

function makePracticeCells(character, cellCount) {
  const joinLeft = settings.cellGapMm === 0;
  return Array.from({ length: cellCount }, (_, index) =>
    makeCharacterSvg(character, index === 0
      ? { trace: true, annotate: true, joinLeft }
      : { blank: true, joinLeft })
  ).join("");
}

function progressiveRowsNeeded(character, maximumCells) {
  const strokeCount = window.HANZI_STROKES?.[character]?.strokes.length || 1;
  const firstRowCapacity = maximumCells - 1;
  return strokeCount <= firstRowCapacity
    ? 1
    : 1 + Math.ceil((strokeCount - firstRowCapacity) / maximumCells);
}

function makeProgressiveCells(character, cellCount, startStep, hasLeadingCell) {
  const strokeCount = window.HANZI_STROKES?.[character]?.strokes.length || 1;
  return Array.from({ length: cellCount }, (_, index) => makeCharacterSvg(character, {
    trace: true,
    mode: "step",
    step: Math.min(startStep + index, strokeCount - 1),
    joinLeft: settings.cellGapMm === 0 && (hasLeadingCell || index > 0),
  })).join("");
}

function makeStandardRow(row, maximumCells) {
  const { character, rowIndex } = row;
  const rowClass = settings.showRowGuide ? "char-row" : "char-row no-row-guide";
  const rowStyle = `style="--cell-mm:${settings.cellSizeMm}mm;--cell-gap-mm:${settings.cellGapMm}mm"`;
  const guide = settings.showRowGuide
    ? `<div class="char-info"><span class="pinyin">${escapeHtml(pinyinFor(character))}</span><strong>${escapeHtml(character)}</strong></div>`
    : "";
  let cells;
  if (settings.traceMode === "progressive") {
    const isFirstRow = rowIndex === 0;
    const startStep = isFirstRow ? 0 : maximumCells - 1 + (rowIndex - 1) * maximumCells;
    const leadingCell = isFirstRow ? makeCharacterSvg(character) : "";
    cells = `${leadingCell}${makeProgressiveCells(character, maximumCells - (isFirstRow ? 1 : 0), startStep, isFirstRow)}`;
  } else {
    cells = `${makeCharacterSvg(character)}${makePracticeCells(character, maximumCells - 1)}`;
  }
  return `<article class="${rowClass}" ${rowStyle}>
    ${guide}<div class="exercise-strip">${cells}</div>
  </article>`;
}

function makeStrokeCard(layout) {
  const { character, stepColumns, height } = layout;
  const data = window.HANZI_STROKES?.[character];
  const cardStyle = `style="--step-columns:${stepColumns};min-height:${height}mm"`;
  if (!data) return `<article class="stroke-card loading-card" ${cardStyle}><strong>${escapeHtml(character)}</strong><span>正在载入笔顺数据</span></article>`;
  const steps = Array.from({ length: data.strokes.length }, (_, step) =>
    `<div class="step-item">${makeCharacterSvg(character, { mode: "step", step })}<span>${step + 1} 画</span></div>`
  ).join("");
  return `<article class="stroke-card" ${cardStyle}>
    <div class="stroke-main"><span class="pinyin">${escapeHtml(pinyinFor(character))}</span>${makeCharacterSvg(character, { trace: true, annotate: true })}<strong>${escapeHtml(character)} · ${data.strokes.length} 画</strong></div>
    <div class="step-grid">${steps}</div>
  </article>`;
}

function strokeCardLayout(character, usableWidth) {
  const strokeCount = window.HANZI_STROKES?.[character]?.strokes.length || 1;
  const stepAreaWidth = Math.max(STEP_CELL_MM, usableWidth - STROKE_CARD_FIXED_WIDTH_MM);
  const stepColumns = Math.max(1, Math.floor((stepAreaWidth + STEP_COLUMN_GAP_MM) / (STEP_CELL_MM + STEP_COLUMN_GAP_MM)));
  const stepRows = Math.ceil(strokeCount / stepColumns);
  const stepHeight = stepRows * STEP_ITEM_HEIGHT_MM + Math.max(0, stepRows - 1) * STEP_COLUMN_GAP_MM;
  return {
    character,
    stepColumns,
    height: Math.max(STROKE_CARD_MIN_HEIGHT_MM, stepHeight + STROKE_CARD_PADDING_MM),
  };
}

function headerFields() {
  const preset = settings.headerPreset;
  if (preset === "blank") return "";
  const title = `<h2>${escapeHtml(settings.title || TEMPLATE_LABELS[settings.template])}</h2>`;
  const fields = [];
  const writableField = (label, value) => `<span class="meta-field"><span>${label}</span><span class="meta-write">${escapeHtml(value)}</span></span>`;
  if (["class", "teacher"].includes(preset)) fields.push(writableField("班级", settings.className));
  if (["homework", "class", "teacher"].includes(preset)) fields.push(writableField("姓名", settings.studentName));
  if (["homework", "class"].includes(preset)) fields.push(writableField("日期", settings.date));
  const expandedClass = preset === "simple" ? "" : " expanded-header";
  return `<header class="page-header${expandedClass}">${title}${fields.length ? `<div class="page-meta">${fields.join("")}</div>` : ""}</header>`;
}

function footerFields(pageIndex, pageCount) {
  if (settings.footerPreset === "none") return "";
  const alignment = settings.footerPreset === "center" ? "center" : "right";
  return `<footer class="page-footer footer-${alignment}">${pageIndex + 1} / ${pageCount}</footer>`;
}

function makePage(body, pageIndex, pageCount, dimensions, extraClass = "") {
  return `<div class="page-shell" style="--paper-width:${dimensions.width}mm;--paper-height:${dimensions.height}mm">
    <section class="page ${extraClass}" style="--paper-width:${dimensions.width}mm;--paper-height:${dimensions.height}mm;--page-margin:${settings.marginMm}mm;--grid-frame-color:${settingColor("gridFrameColor")};--grid-cross-color:${settingColor("gridCrossColor")};--grid-diagonal-color:${settingColor("gridDiagonalColor")}">
      ${headerFields()}${body}${footerFields(pageIndex, pageCount)}
    </section>
  </div>`;
}

function renderStandardPages(characters, dimensions) {
  const usableWidth = dimensions.width - settings.marginMm * 2;
  const usableHeight = dimensions.height - settings.marginMm * 2 - headerReservedHeight();
  const guideWidth = settings.showRowGuide ? 17.5 : 0;
  const exerciseWidth = Math.max(settings.cellSizeMm * 2, usableWidth - guideWidth);
  const maximumCells = Math.max(2, Math.floor((exerciseWidth + settings.cellGapMm) / (settings.cellSizeMm + settings.cellGapMm)));
  const automaticRows = Math.max(1, Math.floor((usableHeight + settings.rowGapMm) / (settings.cellSizeMm + settings.rowGapMm)));
  const rows = settings.rowsPerPage > 0 ? Math.min(settings.rowsPerPage, automaticRows) : automaticRows;
  const configuredRowsPerCharacter = clamp(Math.round(settings.rowsPerCharacter), 1, 6);
  let rowsPerCharacter = configuredRowsPerCharacter;
  let autoExpandedRows = false;
  const pages = [];
  let currentPage = [];
  for (const character of characters) {
    const requiredRows = settings.traceMode === "progressive" ? progressiveRowsNeeded(character, maximumCells) : 1;
    const characterRowCount = Math.max(configuredRowsPerCharacter, requiredRows);
    rowsPerCharacter = Math.max(rowsPerCharacter, characterRowCount);
    if (requiredRows > configuredRowsPerCharacter) autoExpandedRows = true;
    const characterRows = Array.from({ length: characterRowCount }, (_, rowIndex) => ({ character, rowIndex }));
    if (currentPage.length && characterRows.length <= rows && currentPage.length + characterRows.length > rows) {
      pages.push(currentPage);
      currentPage = [];
    }
    while (characterRows.length) {
      const available = rows - currentPage.length;
      currentPage.push(...characterRows.splice(0, available));
      if (currentPage.length === rows) {
        pages.push(currentPage);
        currentPage = [];
      }
    }
  }
  if (currentPage.length) pages.push(currentPage);
  if (!pages.length) pages.push([]);
  const markup = pages.map((pageRows, pageIndex) => {
    const body = pageRows.length
      ? `<div class="practice-list" style="--row-gap-mm:${settings.rowGapMm}mm">${pageRows.map((row) => makeStandardRow(row, maximumCells)).join("")}</div>`
      : '<div class="empty-page-message">请在左侧输入要练习的汉字</div>';
    return makePage(body, pageIndex, pages.length, dimensions);
  }).join("");
  return { markup, pageCount: pages.length, rowsPerCharacter, autoExpandedRows };
}

function renderStrokePages(characters, dimensions) {
  const usableWidth = dimensions.width - settings.marginMm * 2;
  const usableHeight = dimensions.height - settings.marginMm * 2 - headerReservedHeight();
  const maximumCardsPerPage = settings.rowsPerPage > 0 ? settings.rowsPerPage : Infinity;
  const pages = [];
  let currentPage = [];
  let currentHeight = 0;
  for (const layout of characters.map((character) => strokeCardLayout(character, usableWidth))) {
    const gap = currentPage.length ? settings.rowGapMm : 0;
    if (currentPage.length && (currentPage.length >= maximumCardsPerPage || currentHeight + gap + layout.height > usableHeight)) {
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 0;
    }
    currentHeight += (currentPage.length ? settings.rowGapMm : 0) + layout.height;
    currentPage.push(layout);
  }
  if (currentPage.length) pages.push(currentPage);
  if (!pages.length) pages.push([]);
  const markup = pages.map((pageLayouts, pageIndex) => {
    const body = pageLayouts.length
      ? `<div class="stroke-list" style="--row-gap-mm:${settings.rowGapMm}mm">${pageLayouts.map(makeStrokeCard).join("")}</div>`
      : '<div class="empty-page-message">请在左侧输入要学习笔顺的汉字</div>';
    return makePage(body, pageIndex, pages.length, dimensions, "stroke-page");
  }).join("");
  return { markup, pageCount: pages.length };
}

function renderBlankPages(dimensions) {
  const usableWidth = dimensions.width - settings.marginMm * 2;
  const usableHeight = dimensions.height - settings.marginMm * 2 - headerReservedHeight();
  const automaticColumns = Math.max(1, Math.floor((usableWidth + settings.cellGapMm) / (settings.cellSizeMm + settings.cellGapMm)));
  const automaticRows = Math.max(1, Math.floor((usableHeight + settings.rowGapMm) / (settings.cellSizeMm + settings.rowGapMm)));
  const columns = settings.cellsPerRow > 0 ? Math.min(settings.cellsPerRow, automaticColumns) : automaticColumns;
  const rows = settings.rowsPerPage > 0 ? Math.min(settings.rowsPerPage, automaticRows) : automaticRows;
  const cells = Array.from({ length: columns * rows }, (_, index) => makeCharacterSvg("", {
    blank: true,
    gridStyle: gridStyle(),
    joinLeft: settings.cellGapMm === 0 && index % columns !== 0,
  })).join("");
  const body = `<div class="blank-grid" style="--blank-columns:${columns};--cell-mm:${settings.cellSizeMm}mm;--cell-gap-mm:${settings.cellGapMm}mm;--row-gap-mm:${settings.rowGapMm}mm">${cells}</div>`;
  const pages = Array.from({ length: settings.blankPageCount }, (_, index) => makePage(body, index, settings.blankPageCount, dimensions, "blank-page"));
  return { markup: pages.join(""), pageCount: pages.length, columns, rows };
}

function renderCopyPages(text, dimensions) {
  const usableWidth = dimensions.width - settings.marginMm * 2;
  const usableHeight = dimensions.height - settings.marginMm * 2 - headerReservedHeight();
  const automaticColumns = Math.max(1, Math.floor((usableWidth + settings.cellGapMm) / (settings.cellSizeMm + settings.cellGapMm)));
  const automaticRows = Math.max(1, Math.floor((usableHeight + settings.rowGapMm) / (settings.cellSizeMm + settings.rowGapMm)));
  const columns = settings.cellsPerRow > 0 ? Math.min(settings.cellsPerRow, automaticColumns) : automaticColumns;
  const rows = settings.rowsPerPage > 0 ? Math.min(settings.rowsPerPage, automaticRows) : automaticRows;
  const pageCapacity = columns * rows;
  const { slots, usedSlots } = layoutCopyItems(text, columns);
  const pageCount = Math.max(1, Math.ceil(Math.max(1, usedSlots) / pageCapacity));
  const markup = Array.from({ length: pageCount }, (_, pageIndex) => {
    const cells = Array.from({ length: pageCapacity }, (_, index) => {
      const character = slots[pageIndex * pageCapacity + index];
      const options = { joinLeft: settings.cellGapMm === 0 && index % columns !== 0 };
      return character !== undefined
        ? makeCopyCell(character, options)
        : makeCharacterSvg("", { ...options, blank: true, gridStyle: gridStyle() });
    }).join("");
    const body = `<div class="blank-grid copy-grid" style="--blank-columns:${columns};--cell-mm:${settings.cellSizeMm}mm;--cell-gap-mm:${settings.cellGapMm}mm;--row-gap-mm:${settings.rowGapMm}mm">${cells}</div>`;
    return makePage(body, pageIndex, pageCount, dimensions, "copy-page");
  }).join("");
  return { markup, pageCount, columns, rows };
}

function renderDataErrorPage(dimensions) {
  const body = `<div class="preview-data-state error" role="status" aria-live="polite">
    <span class="preview-error-mark" aria-hidden="true">!</span>
    <strong>笔顺数据加载失败</strong><span>请检查网络连接后刷新页面重试</span>
  </div>`;
  return { markup: makePage(body, 0, 1, dimensions, "data-state-page"), pageCount: 1 };
}

function unsupportedCharacters(characters) {
  return [...new Set(characters.filter((character) => !window.HANZI_STROKES?.[character] && !window.HANZI_CHUNK_INDEX?.[character]))];
}

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${source}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    const script = existing || document.createElement("script");
    script.src = source;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = reject;
    if (!existing) document.head.append(script);
  });
}

function packForChunk(chunkId) {
  const packInfo = window.HANZI_PACK_INFO || {};
  if (!Array.isArray(packInfo.packs)) {
    return { id: "legacy", file: packInfo.file || "data/strokes-pack-000.zip", chunks: packInfo.chunks || 0 };
  }
  const numericChunkId = Number(chunkId);
  let firstChunk = 0;
  for (const pack of packInfo.packs) {
    const chunks = Number(pack.chunks) || 0;
    if (numericChunkId >= firstChunk && numericChunkId < firstChunk + chunks) return { ...pack, firstChunk };
    firstChunk += chunks;
  }
  return null;
}

function charactersInChunk(chunkId) {
  if (!chunkCharacters.has(chunkId)) {
    chunkCharacters.set(
      chunkId,
      Object.entries(window.HANZI_CHUNK_INDEX || {})
        .filter(([, id]) => id === chunkId)
        .map(([character]) => character)
    );
  }
  return chunkCharacters.get(chunkId);
}

function touchLoadedChunk(chunkId) {
  if (!loadedChunks.has(chunkId)) return;
  const characters = loadedChunks.get(chunkId);
  loadedChunks.delete(chunkId);
  loadedChunks.set(chunkId, characters);
}

function evictUnusedChunks() {
  for (const [chunkId, characters] of loadedChunks) {
    if (loadedChunks.size <= MAX_CACHED_CHUNKS || activeChunkIds.has(chunkId)) continue;
    for (const character of characters) {
      if (!coreCharacters.has(character)) delete window.HANZI_STROKES[character];
    }
    loadedChunks.delete(chunkId);
  }
}

function registerChunk(chunkId, data) {
  Object.assign(window.HANZI_STROKES, data);
  loadedChunks.delete(chunkId);
  loadedChunks.set(chunkId, Object.keys(data));
  evictUnusedChunks();
}

async function openZipArchive(pack) {
  if (!pack) throw new Error("Stroke ZIP pack not found");
  if (zipArchivePromises.has(pack.id)) return zipArchivePromises.get(pack.id);
  zipArchiveStates.set(pack.id, "loading");
  scheduleRender(false);
  const promise = (async () => {
    await loadScript("vendor/zip.min.js");
    window.zip.configure({ useWebWorkers: false });
    const response = await fetch(pack.file);
    if (!response.ok) throw new Error(`Stroke ZIP request failed: ${response.status}`);
    const reader = new window.zip.ZipReader(new window.zip.BlobReader(await response.blob()), { useWebWorkers: false });
    const entries = new Map((await reader.getEntries()).map((entry) => [entry.filename, entry]));
    zipArchiveStates.set(pack.id, "ready");
    scheduleRender(false);
    return { entries, reader };
  })().catch((error) => {
    zipArchiveStates.set(pack.id, "error");
    scheduleRender(false);
    throw error;
  });
  zipArchivePromises.set(pack.id, promise);
  return promise;
}

async function loadChunkFromZip(chunkId) {
  const archive = await openZipArchive(packForChunk(chunkId));
  const entry = archive.entries.get(`chunk-${chunkId}.json`);
  if (!entry) throw new Error(`Stroke ZIP entry not found: ${chunkId}`);
  const text = await entry.getData(new window.zip.TextWriter(), { useWebWorkers: false });
  registerChunk(chunkId, JSON.parse(text));
}

async function loadChunkScript(chunkId) {
  await loadScript(`data/characters/chunk-${chunkId}.js`);
  const data = {};
  for (const character of charactersInChunk(chunkId)) {
    if (window.HANZI_STROKES[character]) data[character] = window.HANZI_STROKES[character];
  }
  registerChunk(chunkId, data);
}

function ensureCharacterData(characters) {
  const chunkIds = [...new Set(characters.map((character) => window.HANZI_CHUNK_INDEX?.[character]).filter(Boolean))];
  activeChunkIds = new Set(chunkIds);
  for (const chunkId of chunkIds) touchLoadedChunk(chunkId);
  evictUnusedChunks();

  for (const chunkId of chunkIds) {
    const needsData = charactersInChunk(chunkId).some((character) => characters.includes(character) && !window.HANZI_STROKES?.[character]);
    if (!needsData || pendingChunks.has(chunkId) || failedChunks.has(chunkId)) continue;
    const promise = (USE_ZIP_PACK ? loadChunkFromZip(chunkId) : loadChunkScript(chunkId)).then(() => {
      pendingChunks.delete(chunkId);
      scheduleRender(false);
    }).catch(() => {
      pendingChunks.delete(chunkId);
      failedChunks.add(chunkId);
      scheduleRender(false);
    });
    pendingChunks.set(chunkId, promise);
  }
  return Promise.all(chunkIds.map((chunkId) => pendingChunks.get(chunkId)).filter(Boolean));
}

function activeZipPacks() {
  const packs = new Map();
  for (const chunkId of activeChunkIds) {
    const pack = packForChunk(chunkId);
    if (pack) packs.set(pack.id, pack);
  }
  return [...packs.values()];
}

function prefetchUnusedStrokePacks() {
  strokePrefetchScheduled = false;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!USE_ZIP_PACK || !navigator.onLine || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")) return;
  if (pendingChunks.size || [...zipArchiveStates.values()].includes("loading")) {
    scheduleStrokePackPrefetch(2000);
    return;
  }

  for (const pack of window.HANZI_PACK_INFO?.packs || []) {
    if (!pack?.file || zipArchivePromises.has(pack.id)) continue;
    if (document.head.querySelector(`link[rel="prefetch"][href="${pack.file}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "fetch";
    link.type = "application/zip";
    link.href = pack.file;
    link.fetchPriority = "low";
    document.head.append(link);
  }
}

function scheduleStrokePackPrefetch(delay = 0) {
  if (strokePrefetchScheduled) return;
  strokePrefetchScheduled = true;
  const schedule = () => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(prefetchUnusedStrokePacks, { timeout: 4000 });
    else setTimeout(prefetchUnusedStrokePacks, 1200);
  };
  if (delay) setTimeout(schedule, delay);
  else schedule();
}

function updatePreviewScale(dimensions) {
  const availableWidth = Math.max(240, els.previewWrap.clientWidth - 40);
  const requestedScale = settings.zoom / 100;
  const fitScale = availableWidth / (dimensions.width * CSS_PX_PER_MM);
  const baseScale = Math.min(1, fitScale);
  const scale = settings.zoom > 100 ? baseScale * requestedScale : Math.min(requestedScale, fitScale);
  document.documentElement.style.setProperty("--preview-scale", scale.toFixed(4));
  for (const shell of els.pages.querySelectorAll(".page-shell")) {
    shell.style.width = `${dimensions.width * CSS_PX_PER_MM * scale}px`;
    shell.style.height = `${dimensions.height * CSS_PX_PER_MM * scale}px`;
  }
}

function render() {
  markerSequence = 0;
  const dimensions = paperDimensions();
  const copyItems = settings.template === "copy" ? extractCopyItems(settings.inputText) : [];
  const characters = extractCharacters(settings.inputText, settings.template === "copy" ? false : settings.dedupe);
  const unsupported = unsupportedCharacters(characters);
  const printable = characters.filter((character) => !unsupported.includes(character));
  if (settings.template !== "blank") ensureCharacterData(printable);

  const loaded = printable.filter((character) => window.HANZI_STROKES?.[character]).length;
  const loading = printable.length - loaded;
  const activeFailedChunks = [...activeChunkIds].filter((chunkId) => failedChunks.has(chunkId));
  const dataState = settings.template === "blank" || loading === 0
    ? "ready"
    : activeFailedChunks.length ? "error" : "loading";
  let result;

  if (dataState === "error") result = renderDataErrorPage(dimensions);
  else if (settings.template === "blank") result = renderBlankPages(dimensions);
  else if (settings.template === "copy") result = renderCopyPages(settings.inputText, dimensions);
  else if (settings.template === "stroke") result = renderStrokePages(printable, dimensions);
  else result = renderStandardPages(printable, dimensions);

  els.pages.innerHTML = result.markup;
  updatePreviewScale(dimensions);
  els.printPageStyle.textContent = `@page { size: ${dimensions.width}mm ${dimensions.height}mm; margin: 0; }`;

  const contentAmount = settings.template === "copy" ? `${copyItems.length} 个字符` : `${printable.length} 个字`;
  let summary = dataState === "loading"
    ? `${contentAmount} · 笔顺加载中…`
    : dataState === "error"
      ? `${contentAmount} · 笔顺加载失败`
      : settings.template === "blank"
    ? `${result.pageCount} 页 · ${result.columns} × ${result.rows} 格`
    : settings.template === "copy"
      ? `${copyItems.length} 个字符 · ${result.pageCount} 页`
      : `${printable.length} 个字 · ${result.pageCount} 页`;
  if (result.autoExpandedRows) summary += ` · 笔顺最多 ${result.rowsPerCharacter} 行`;
  else if (result.rowsPerCharacter > 1) summary += ` · 每字 ${result.rowsPerCharacter} 行`;
  els.summary.textContent = summary;
  els.contentStatus.textContent = settings.template === "copy"
    ? `${copyItems.length} 个字符${unsupported.length ? ` · ${unsupported.length} 字使用字体` : ""}`
    : unsupported.length ? `${unsupported.length} 个字暂无数据：${unsupported.join(" ")}` : `${characters.length} 个汉字`;
  const activePacks = activeZipPacks();
  const loadingPacks = activePacks.filter((pack) => zipArchiveStates.get(pack.id) === "loading");
  const readyPackCount = [...zipArchiveStates.values()].filter((state) => state === "ready").length;
  const loadingMegabytes = (loadingPacks.reduce((total, pack) => total + (pack.bytes || 0), 0) / 1024 / 1024).toFixed(1);
  els.dataStatus.textContent = activeFailedChunks.length
    ? `${activeFailedChunks.length} 个笔顺分片加载失败`
    : loadingPacks.length ? `正在加载 ${loadingMegabytes}MB 笔顺字库`
      : loading ? `正在解压 ${loading} 个字`
        : readyPackCount ? `ZIP 字库已就绪 · ${readyPackCount} 包 · 内存 ${loadedChunks.size} 分片`
          : navigator.onLine ? "笔顺数据已就绪" : "离线可用";
  els.dataStatus.dataset.state = dataState;
  els.dataStatus.setAttribute("aria-busy", dataState === "loading" ? "true" : "false");
  els.summary.dataset.state = dataState;
  els.pages.setAttribute("aria-busy", dataState === "loading" ? "true" : "false");
  els.printBtn.disabled = dataState !== "ready";
  const compactSuffix = dataState === "loading" ? " · 笔顺加载中…" : dataState === "error" ? " · 笔顺加载失败" : "";
  els.compactStatus.textContent = `${settings.paperSize} · ${settings.orientation === "portrait" ? "纵向" : "横向"} · ${GRID_STYLE_LABELS[gridStyle()]} · ${TEMPLATE_LABELS[settings.template]}${compactSuffix}`;
  document.title = dataState === "loading"
    ? `${APP_TITLE}（笔顺加载中…）`
    : dataState === "error" ? `${APP_TITLE}（笔顺加载失败）` : APP_TITLE;
  document.body.dataset.template = settings.template;
  updateHeaderFieldVisibility();
  updateOutputs();
}

function scheduleRender(shouldSave = true) {
  if (shouldSave) saveSettings();
  cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(render);
}

function readControl(control) {
  if (control.type === "checkbox") return control.checked;
  if (NUMBER_FIELDS.has(control.dataset.setting)) {
    const value = Number(control.value);
    if (!Number.isFinite(value)) return DEFAULT_SETTINGS[control.dataset.setting];
    const minimum = control.min === "" ? -Infinity : Number(control.min);
    const maximum = control.max === "" ? Infinity : Number(control.max);
    return clamp(value, minimum, maximum);
  }
  return control.value;
}

function syncSettingFromControl(control) {
  if (control.type === "radio" && !control.checked) return;
  settings[control.dataset.setting] = readControl(control);
  scheduleRender();
}

function applySettingsToControls() {
  for (const control of document.querySelectorAll("[data-setting]")) {
    const key = control.dataset.setting;
    if (!(key in settings)) continue;
    if (control.type === "checkbox" || control.type === "radio") control.checked = control.type === "checkbox" ? Boolean(settings[key]) : control.value === String(settings[key]);
    else control.value = settings[key];
  }
}

function updateOutputs() {
  document.querySelector("#traceOpacityOutput").value = `${Math.round(settings.traceOpacity * 100)}%`;
  document.querySelector("#zoomOutput").value = `${settings.zoom}%`;
  updateSteppers();
}

function updateSteppers() {
  for (const stepper of document.querySelectorAll("[data-stepper]")) {
    const input = stepper.querySelector("input[type='number']");
    const value = Number(input.value);
    const minimum = input.min === "" ? -Infinity : Number(input.min);
    const maximum = input.max === "" ? Infinity : Number(input.max);
    stepper.querySelector("[data-stepper-action='decrement']").disabled = Number.isFinite(value) && value <= minimum;
    stepper.querySelector("[data-stepper-action='increment']").disabled = Number.isFinite(value) && value >= maximum;
  }
}

function adjustStepper(button) {
  const input = button.closest("[data-stepper]")?.querySelector("input[type='number']");
  if (!input) return;
  if (button.dataset.stepperAction === "increment") input.stepUp();
  else input.stepDown();
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function showExportStatus(message, isError = false) {
  clearTimeout(exportStatusTimer);
  els.exportStatus.textContent = message;
  els.exportStatus.classList.toggle("error", isError);
  els.exportStatus.hidden = false;
  exportStatusTimer = setTimeout(() => { els.exportStatus.hidden = true; }, 5000);
}

function exportFilename() {
  const fallback = TEMPLATE_LABELS[settings.template] || "汉字练习";
  const title = String(settings.title || fallback).trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 48) || fallback;
  return `${title}-${settings.paperSize}-${settings.orientation === "landscape" ? "横向" : "纵向"}.pdf`;
}

function pdfRenderScale(dimensions) {
  const longestSidePx = Math.max(dimensions.width, dimensions.height) * CSS_PX_PER_MM;
  return clamp(2400 / longestSidePx, 1.5, 2);
}

async function preparePdfPages() {
  if (settings.template !== "blank") {
    const characters = extractCharacters(settings.inputText, settings.template === "copy" ? false : settings.dedupe);
    const unsupported = unsupportedCharacters(characters);
    const printable = characters.filter((character) => !unsupported.includes(character));
    await ensureCharacterData(printable);
    const missing = printable.filter((character) => !window.HANZI_STROKES?.[character]);
    if (missing.length && settings.template !== "copy") throw new Error(`笔顺数据载入失败：${missing.join(" ")}`);
  }
  if (document.fonts?.ready) await document.fonts.ready;
  render();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function exportPdf() {
  if (els.exportPdfBtn.disabled) return;
  const originalLabel = els.exportPdfBtn.textContent;
  els.exportPdfBtn.disabled = true;
  els.exportPdfBtn.setAttribute("aria-busy", "true");
  els.exportPdfBtn.textContent = "生成中…";
  try {
    await preparePdfPages();
    await Promise.all([
      loadScript("vendor/html2canvas.min.js"),
      loadScript("vendor/jspdf.umd.min.js"),
    ]);
    if (!window.html2canvas || !window.jspdf?.jsPDF) throw new Error("PDF 组件载入失败");

    const dimensions = paperDimensions();
    const orientation = dimensions.width > dimensions.height ? "landscape" : "portrait";
    const pdf = new window.jspdf.jsPDF({
      orientation,
      unit: "mm",
      format: [dimensions.width, dimensions.height],
      compress: true,
    });
    const pages = [...els.pages.querySelectorAll(".page")];
    const scale = pdfRenderScale(dimensions);

    for (const [index, page] of pages.entries()) {
      const canvas = await window.html2canvas(page, {
        backgroundColor: "#ffffff",
        logging: false,
        scale,
        useCORS: false,
        onclone(clonedDocument) {
          clonedDocument.documentElement.style.setProperty("--preview-scale", "1");
          for (const clonedPage of clonedDocument.querySelectorAll(".page")) {
            clonedPage.style.position = "relative";
            clonedPage.style.inset = "auto";
            clonedPage.style.transform = "none";
            clonedPage.style.boxShadow = "none";
          }
        },
      });
      if (index > 0) pdf.addPage([dimensions.width, dimensions.height], orientation);
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, dimensions.width, dimensions.height, undefined, "FAST");
      canvas.width = 1;
      canvas.height = 1;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    pdf.save(exportFilename());
    showExportStatus(`已生成 ${pages.length} 页 PDF`);
  } catch (error) {
    console.error(error);
    showExportStatus(error?.message || "PDF 导出失败，请重试", true);
  } finally {
    els.exportPdfBtn.disabled = false;
    els.exportPdfBtn.removeAttribute("aria-busy");
    els.exportPdfBtn.textContent = originalLabel;
  }
}

function updateHeaderFieldVisibility() {
  const visible = {
    title: settings.headerPreset !== "blank",
    className: ["class", "teacher"].includes(settings.headerPreset),
    studentName: ["homework", "class", "teacher"].includes(settings.headerPreset),
    date: ["homework", "class"].includes(settings.headerPreset),
  };
  for (const field of document.querySelectorAll("[data-header-field]")) field.hidden = !visible[field.dataset.headerField];
}

function populateContentTemplates() {
  const templates = window.HANZI_CONTENT_TEMPLATES || [];
  const categories = [...new Set(templates.map((item) => item.category))];
  els.contentCategory.innerHTML = categories.map((category) => `<option>${escapeHtml(category)}</option>`).join("");

  const updateItems = () => {
    const items = templates.filter((item) => item.category === els.contentCategory.value);
    els.contentTemplate.innerHTML = items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("");
  };
  els.contentCategory.addEventListener("change", updateItems);
  updateItems();
}

function selectedContentTemplate() {
  return (window.HANZI_CONTENT_TEMPLATES || []).find((item) => item.id === els.contentTemplate.value);
}

function insertContent(append) {
  const template = selectedContentTemplate();
  if (!template) return;
  settings.inputText = append && settings.inputText.trim() ? `${settings.inputText.trim()}\n${template.text}` : template.text;
  if (!append) settings.title = template.title;
  applySettingsToControls();
  scheduleRender();
}

function setDrawer(open) {
  document.body.classList.toggle("settings-open", open);
  els.settingsBtn.setAttribute("aria-expanded", String(open));
}

function registerPwa() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      els.dataStatus.textContent = "离线缓存暂不可用";
    });
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    els.installBtn.hidden = false;
  });
  els.installBtn.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    els.installBtn.hidden = true;
  });
}

function init() {
  applySettingsToControls();
  populateContentTemplates();
  for (const control of document.querySelectorAll("[data-setting]")) {
    const liveInputTypes = ["text", "textarea", "range", "number", "color"];
    control.addEventListener(liveInputTypes.includes(control.type) ? "input" : "change", () => syncSettingFromControl(control));
  }
  els.controls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stepper-action]");
    if (button) adjustStepper(button);
  });
  els.replaceContentBtn.addEventListener("click", () => insertContent(false));
  els.appendContentBtn.addEventListener("click", () => insertContent(true));
  els.settingsBtn.addEventListener("click", () => setDrawer(true));
  els.closeSettingsBtn.addEventListener("click", () => setDrawer(false));
  els.drawerBackdrop.addEventListener("click", () => setDrawer(false));
  els.resetBtn.addEventListener("click", () => {
    settings = { ...DEFAULT_SETTINGS, date: new Date().toISOString().slice(0, 10) };
    applySettingsToControls();
    scheduleRender();
  });
  els.clearBtn.addEventListener("click", () => {
    settings.inputText = "";
    applySettingsToControls();
    scheduleRender();
  });
  els.exportPdfBtn.addEventListener("click", exportPdf);
  els.printBtn.addEventListener("click", () => {
    els.printNote.hidden = false;
    setTimeout(() => { els.printNote.hidden = true; }, 5000);
    window.print();
  });
  els.previewWrap.addEventListener("wheel", (event) => {
    if ((!event.metaKey && !event.ctrlKey) || event.deltaY === 0) return;
    event.preventDefault();
    const nextZoom = clamp(settings.zoom + (event.deltaY < 0 ? 5 : -5), 35, 150);
    if (nextZoom === settings.zoom) return;
    settings.zoom = nextZoom;
    document.querySelector("#zoom").value = nextZoom;
    scheduleRender();
  }, { passive: false });
  window.addEventListener("resize", () => updatePreviewScale(paperDimensions()));
  window.addEventListener("online", () => {
    scheduleRender(false);
    scheduleStrokePackPrefetch();
  });
  window.addEventListener("offline", () => scheduleRender(false));
  window.addEventListener("load", () => scheduleStrokePackPrefetch());
  registerPwa();
  render();
}

init();
