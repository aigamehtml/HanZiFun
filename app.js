const SETTINGS_KEY = "hanzifun.settings";
const SETTINGS_VERSION = 2;
const CSS_PX_PER_MM = 96 / 25.4;
const VIEWBOX_SIZE = 1024;
const BASELINE = 900;

const PAPER_SIZES = {
  A5: [148, 210],
  A4: [210, 297],
  A3: [297, 420],
  Letter: [216, 279],
};

const DEFAULT_SETTINGS = {
  settingsVersion: SETTINGS_VERSION,
  inputText: "人 口 日 月 水 火 山 田 木 永",
  template: "tian",
  paperSize: "A4",
  orientation: "portrait",
  headerPreset: "homework",
  title: "中文写字练习",
  studentName: "",
  className: "",
  date: new Date().toISOString().slice(0, 10),
  cellSizeMm: 21,
  marginMm: 10,
  rowsPerPage: 0,
  cellsPerRow: 0,
  practiceCount: 5,
  stepCount: 8,
  blankPageCount: 1,
  dedupe: true,
  showPinyin: true,
  showStrokeNumbers: true,
  showStartDots: true,
  showArrows: true,
  showGuides: true,
  traceOpacity: 0.2,
  zoom: 70,
};

const NUMBER_FIELDS = new Set([
  "cellSizeMm", "marginMm", "rowsPerPage", "cellsPerRow", "practiceCount",
  "stepCount", "blankPageCount", "traceOpacity", "zoom",
]);

const TEMPLATE_LABELS = {
  tian: "田字格描红",
  mizi: "米字格描红",
  stroke: "笔顺分解",
  blank: "空白格纸",
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

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (stored?.settingsVersion === SETTINGS_VERSION) return { ...DEFAULT_SETTINGS, ...stored };
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

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function paperDimensions() {
  const base = PAPER_SIZES[settings.paperSize] || PAPER_SIZES.A4;
  return settings.orientation === "landscape" ? { width: base[1], height: base[0] } : { width: base[0], height: base[1] };
}

function gridStyle() {
  return settings.template === "mizi" ? "mi" : "tian";
}

function pointToSvg(point) {
  return { x: point[0], y: BASELINE - point[1] };
}

function makeGrid(type) {
  if (!settings.showGuides) return '<rect class="grid-line" x="80" y="80" width="864" height="864"></rect>';
  const diagonals = type === "mi"
    ? '<line class="guide-line" x1="80" y1="80" x2="944" y2="944"></line><line class="guide-line" x1="944" y1="80" x2="80" y2="944"></line>'
    : "";
  return `<rect class="grid-line" x="80" y="80" width="864" height="864"></rect><line class="guide-line" x1="512" y1="80" x2="512" y2="944"></line><line class="guide-line" x1="80" y1="512" x2="944" y2="512"></line>${diagonals}`;
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
  const grid = makeGrid(options.gridStyle || gridStyle());
  if (!data) {
    return `<svg class="hanzi-cell pending-cell" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" role="img" aria-label="${escapeHtml(character)} 正在载入">${grid}<text class="fallback-glyph" x="512" y="640">${escapeHtml(character)}</text></svg>`;
  }
  const paths = renderStrokePaths(data, options);
  const annotations = options.annotate ? renderAnnotations(data) : "";
  return `<svg class="hanzi-cell" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" role="img" aria-label="${escapeHtml(character)} 字练习格">${grid}<g transform="translate(0 ${BASELINE}) scale(1 -1)">${paths}</g>${annotations}</svg>`;
}

function pinyinFor(character) {
  return settings.showPinyin ? (window.HANZI_PINYIN?.[character] || "") : "";
}

function makeStandardRow(character, practiceCount) {
  const cellStyle = `style="--cell-mm:${settings.cellSizeMm}mm"`;
  const blanks = Array.from({ length: practiceCount }, () => makeCharacterSvg(character, { blank: true })).join("");
  return `<article class="char-row" ${cellStyle}>
    <div class="char-info"><span class="pinyin">${escapeHtml(pinyinFor(character))}</span><strong>${escapeHtml(character)}</strong></div>
    <div class="model-cell">${makeCharacterSvg(character)}</div>
    <div class="trace-cell">${makeCharacterSvg(character, { trace: true, annotate: true })}</div>
    <div class="cell-strip">${blanks}</div>
  </article>`;
}

function selectStepIndexes(strokeCount) {
  const count = Math.min(strokeCount, settings.stepCount);
  if (count === strokeCount) return Array.from({ length: strokeCount }, (_, index) => index);
  return Array.from({ length: count }, (_, index) => Math.round(index * (strokeCount - 1) / (count - 1)));
}

function makeStrokeCard(character) {
  const data = window.HANZI_STROKES?.[character];
  if (!data) return `<article class="stroke-card loading-card"><strong>${escapeHtml(character)}</strong><span>正在载入笔顺数据</span></article>`;
  const steps = selectStepIndexes(data.strokes.length).map((step) =>
    `<div class="step-item">${makeCharacterSvg(character, { mode: "step", step })}<span>${step + 1} 画</span></div>`
  ).join("");
  return `<article class="stroke-card">
    <div class="stroke-main"><span class="pinyin">${escapeHtml(pinyinFor(character))}</span>${makeCharacterSvg(character, { trace: true, annotate: true })}<strong>${escapeHtml(character)} · ${data.strokes.length} 画</strong></div>
    <div class="step-grid">${steps}</div>
  </article>`;
}

function headerFields(pageIndex, pageCount) {
  const preset = settings.headerPreset;
  if (preset === "blank") return "";
  const title = `<h2>${escapeHtml(settings.title || TEMPLATE_LABELS[settings.template])}</h2>`;
  const fields = [];
  if (["class", "teacher"].includes(preset)) fields.push(`班级：${escapeHtml(settings.className)}`);
  if (["homework", "class", "teacher"].includes(preset)) fields.push(`姓名：${escapeHtml(settings.studentName)}`);
  if (["homework", "class"].includes(preset)) fields.push(`日期：${escapeHtml(settings.date)}`);
  if (preset === "teacher") fields.push(`第 ${pageIndex + 1} / ${pageCount} 页`);
  return `<header class="page-header">${title}<div class="page-meta">${fields.map((field) => `<span>${field}</span>`).join("")}</div></header>`;
}

function makePage(body, pageIndex, pageCount, dimensions, extraClass = "") {
  return `<div class="page-shell" style="--paper-width:${dimensions.width}mm;--paper-height:${dimensions.height}mm">
    <section class="page ${extraClass}" style="--paper-width:${dimensions.width}mm;--paper-height:${dimensions.height}mm;--page-margin:${settings.marginMm}mm">
      ${headerFields(pageIndex, pageCount)}${body}
      ${settings.headerPreset !== "teacher" ? `<span class="page-number">${pageIndex + 1} / ${pageCount}</span>` : ""}
    </section>
  </div>`;
}

function renderStandardPages(characters, dimensions) {
  const usableWidth = dimensions.width - settings.marginMm * 2;
  const usableHeight = dimensions.height - settings.marginMm * 2 - (settings.headerPreset === "blank" ? 0 : 18);
  const requestedPractice = settings.practiceCount;
  const maximumPractice = Math.floor((usableWidth - 17 - settings.cellSizeMm * 2 - 10) / (settings.cellSizeMm + 2));
  const practiceCount = clamp(Math.min(requestedPractice, maximumPractice), 1, requestedPractice);
  const automaticRows = Math.max(1, Math.floor(usableHeight / (settings.cellSizeMm + 6)));
  const rows = settings.rowsPerPage > 0 ? Math.min(settings.rowsPerPage, automaticRows) : automaticRows;
  const pages = chunk(characters, rows);
  if (!pages.length) pages.push([]);
  const markup = pages.map((pageCharacters, pageIndex) => {
    const body = pageCharacters.length
      ? `<div class="practice-list">${pageCharacters.map((character) => makeStandardRow(character, practiceCount)).join("")}</div>`
      : '<div class="empty-page-message">请在左侧输入要练习的汉字</div>';
    return makePage(body, pageIndex, pages.length, dimensions);
  }).join("");
  return { markup, pageCount: pages.length, practiceCount };
}

function renderStrokePages(characters, dimensions) {
  const usableHeight = dimensions.height - settings.marginMm * 2 - (settings.headerPreset === "blank" ? 0 : 18);
  const cardHeight = dimensions.width > dimensions.height ? 48 : 55;
  const automaticRows = Math.max(1, Math.floor(usableHeight / cardHeight));
  const rows = settings.rowsPerPage > 0 ? Math.min(settings.rowsPerPage, automaticRows) : automaticRows;
  const pages = chunk(characters, rows);
  if (!pages.length) pages.push([]);
  const markup = pages.map((pageCharacters, pageIndex) => {
    const body = pageCharacters.length
      ? `<div class="stroke-list">${pageCharacters.map(makeStrokeCard).join("")}</div>`
      : '<div class="empty-page-message">请在左侧输入要学习笔顺的汉字</div>';
    return makePage(body, pageIndex, pages.length, dimensions, "stroke-page");
  }).join("");
  return { markup, pageCount: pages.length };
}

function renderBlankPages(dimensions) {
  const usableWidth = dimensions.width - settings.marginMm * 2;
  const usableHeight = dimensions.height - settings.marginMm * 2 - (settings.headerPreset === "blank" ? 0 : 18);
  const automaticColumns = Math.max(1, Math.floor(usableWidth / settings.cellSizeMm));
  const automaticRows = Math.max(1, Math.floor(usableHeight / settings.cellSizeMm));
  const columns = settings.cellsPerRow > 0 ? Math.min(settings.cellsPerRow, automaticColumns) : automaticColumns;
  const rows = settings.rowsPerPage > 0 ? Math.min(settings.rowsPerPage, automaticRows) : automaticRows;
  const cells = Array.from({ length: columns * rows }, () => makeCharacterSvg("", { blank: true, gridStyle: gridStyle() })).join("");
  const body = `<div class="blank-grid" style="--blank-columns:${columns};--cell-mm:${settings.cellSizeMm}mm">${cells}</div>`;
  const pages = Array.from({ length: settings.blankPageCount }, (_, index) => makePage(body, index, settings.blankPageCount, dimensions, "blank-page"));
  return { markup: pages.join(""), pageCount: pages.length, columns, rows };
}

function unsupportedCharacters(characters) {
  return [...new Set(characters.filter((character) => !window.HANZI_STROKES?.[character] && !window.HANZI_CHUNK_INDEX?.[character]))];
}

function ensureCharacterData(characters) {
  const chunkIds = [...new Set(characters
    .filter((character) => !window.HANZI_STROKES?.[character])
    .map((character) => window.HANZI_CHUNK_INDEX?.[character])
    .filter(Boolean))];

  for (const chunkId of chunkIds) {
    if (pendingChunks.has(chunkId) || failedChunks.has(chunkId)) continue;
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `data/characters/chunk-${chunkId}.js`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    }).then(() => {
      pendingChunks.delete(chunkId);
      scheduleRender(false);
    }).catch(() => {
      pendingChunks.delete(chunkId);
      failedChunks.add(chunkId);
      scheduleRender(false);
    });
    pendingChunks.set(chunkId, promise);
  }
}

function updatePreviewScale(dimensions) {
  const availableWidth = Math.max(240, els.previewWrap.clientWidth - 40);
  const requestedScale = settings.zoom / 100;
  const fitScale = availableWidth / (dimensions.width * CSS_PX_PER_MM);
  const scale = Math.min(requestedScale, fitScale);
  document.documentElement.style.setProperty("--preview-scale", scale.toFixed(4));
  for (const shell of els.pages.querySelectorAll(".page-shell")) {
    shell.style.width = `${dimensions.width * CSS_PX_PER_MM * scale}px`;
    shell.style.height = `${dimensions.height * CSS_PX_PER_MM * scale}px`;
  }
}

function render() {
  markerSequence = 0;
  const dimensions = paperDimensions();
  const characters = extractCharacters(settings.inputText, settings.dedupe);
  const unsupported = unsupportedCharacters(characters);
  const printable = characters.filter((character) => !unsupported.includes(character));
  let result;

  if (settings.template === "blank") result = renderBlankPages(dimensions);
  else if (settings.template === "stroke") result = renderStrokePages(printable, dimensions);
  else result = renderStandardPages(printable, dimensions);

  els.pages.innerHTML = result.markup;
  updatePreviewScale(dimensions);
  els.printPageStyle.textContent = `@page { size: ${dimensions.width}mm ${dimensions.height}mm; margin: 0; }`;

  const loaded = printable.filter((character) => window.HANZI_STROKES?.[character]).length;
  const loading = printable.length - loaded;
  let summary = settings.template === "blank"
    ? `${result.pageCount} 页 · ${result.columns} × ${result.rows} 格`
    : `${printable.length} 个字 · ${result.pageCount} 页`;
  if (result.practiceCount && result.practiceCount < settings.practiceCount) summary += ` · 每字 ${result.practiceCount} 个空白格`;
  els.summary.textContent = summary;
  els.contentStatus.textContent = unsupported.length ? `${unsupported.length} 个字暂无数据：${unsupported.join(" ")}` : `${characters.length} 个汉字`;
  els.dataStatus.textContent = failedChunks.size
    ? `${failedChunks.size} 个数据分片加载失败`
    : loading ? `正在载入 ${loading} 个字` : navigator.onLine ? "笔顺数据已就绪" : "离线可用";
  els.compactStatus.textContent = `${settings.paperSize} · ${settings.orientation === "portrait" ? "纵向" : "横向"} · ${TEMPLATE_LABELS[settings.template]}`;
  document.body.dataset.template = settings.template;
  updateHeaderFieldVisibility();
  updateOutputs();

  if (settings.template !== "blank") ensureCharacterData(printable);
}

function scheduleRender(shouldSave = true) {
  if (shouldSave) saveSettings();
  cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(render);
}

function readControl(control) {
  if (control.type === "checkbox") return control.checked;
  if (NUMBER_FIELDS.has(control.dataset.setting)) return Number(control.value);
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
    if (control.type === "checkbox" || control.type === "radio") control.checked = control.type === "checkbox" ? Boolean(settings[key]) : control.value === settings[key];
    else control.value = settings[key];
  }
}

function updateOutputs() {
  document.querySelector("#practiceCountOutput").value = `${settings.practiceCount} 格`;
  document.querySelector("#stepCountOutput").value = `${settings.stepCount} 幅`;
  document.querySelector("#blankPageCountOutput").value = `${settings.blankPageCount} 页`;
  document.querySelector("#traceOpacityOutput").value = `${Math.round(settings.traceOpacity * 100)}%`;
  document.querySelector("#zoomOutput").value = `${settings.zoom}%`;
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
    control.addEventListener(control.type === "text" || control.type === "textarea" || control.type === "range" || control.type === "number" ? "input" : "change", () => syncSettingFromControl(control));
  }
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
  els.printBtn.addEventListener("click", () => {
    els.printNote.hidden = false;
    setTimeout(() => { els.printNote.hidden = true; }, 5000);
    window.print();
  });
  window.addEventListener("resize", () => updatePreviewScale(paperDimensions()));
  window.addEventListener("online", () => scheduleRender(false));
  window.addEventListener("offline", () => scheduleRender(false));
  registerPwa();
  render();
}

init();
