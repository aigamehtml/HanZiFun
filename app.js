const PINYIN = {
  人: "ren",
  口: "kou",
  日: "ri",
  月: "yue",
  水: "shui",
  火: "huo",
  山: "shan",
  田: "tian",
  木: "mu",
  永: "yong",
};

const VIEWBOX_SIZE = 1024;
const BASELINE = 900;
const PAGE_SIZE = {
  standard: 9,
  mizi: 9,
  stroke: 4,
};

const els = {
  inputText: document.querySelector("#inputText"),
  template: document.querySelector("#template"),
  gridStyle: document.querySelector("#gridStyle"),
  practiceCount: document.querySelector("#practiceCount"),
  traceOpacity: document.querySelector("#traceOpacity"),
  dedupe: document.querySelector("#dedupe"),
  showNumbers: document.querySelector("#showNumbers"),
  showArrows: document.querySelector("#showArrows"),
  generateBtn: document.querySelector("#generateBtn"),
  printBtn: document.querySelector("#printBtn"),
  pages: document.querySelector("#pages"),
  summary: document.querySelector("#summary"),
  supportedChars: document.querySelector("#supportedChars"),
};

function extractCharacters(text, shouldDedupe) {
  const chars = Array.from(text.matchAll(/[\u3400-\u9fff]/gu), (match) => match[0]);
  if (!shouldDedupe) return chars;
  return [...new Set(chars)];
}

function chunk(items, size) {
  const pages = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}

function pointToSvg(point) {
  return {
    x: point[0],
    y: BASELINE - point[1],
  };
}

function makeGrid(type) {
  const diagonals =
    type === "mi"
      ? `
        <line class="guide-line" x1="80" y1="80" x2="944" y2="944"></line>
        <line class="guide-line" x1="944" y1="80" x2="80" y2="944"></line>
      `
      : "";

  return `
    <rect class="grid-line" x="80" y="80" width="864" height="864"></rect>
    <line class="guide-line" x1="512" y1="80" x2="512" y2="944"></line>
    <line class="guide-line" x1="80" y1="512" x2="944" y2="512"></line>
    ${diagonals}
  `;
}

function makeMarker(id) {
  return `
    <defs>
      <marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#d9480f"></path>
      </marker>
    </defs>
  `;
}

function renderStrokePaths(data, options = {}) {
  const mode = options.mode || "full";
  const step = options.step ?? data.strokes.length - 1;
  const traceOpacity = options.traceOpacity ?? 1;

  return data.strokes
    .map((path, index) => {
      if (mode === "step" && index > step) return "";
      const className = mode === "step" && index < step ? "done" : options.trace ? "trace" : "stroke";
      const opacity = options.trace ? traceOpacity : 1;
      return `<path class="${className}" d="${path}" opacity="${opacity}"></path>`;
    })
    .join("");
}

function renderAnnotations(data, char, showNumbers, showArrows) {
  return data.medians
    .map((median, index) => {
      const start = pointToSvg(median[0]);
      const end = pointToSvg(median[Math.min(1, median.length - 1)]);
      const label = showNumbers
        ? `<text class="order-label" x="${start.x + 34}" y="${start.y - 28}">${index + 1}</text>`
        : "";
      const arrow =
        showArrows && median.length > 1
          ? `<line class="median-arrow" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" marker-end="url(#arrow-${char.codePointAt(0)}-${index})"></line>`
          : "";
      const marker = showArrows ? makeMarker(`arrow-${char.codePointAt(0)}-${index}`) : "";
      return `${marker}${arrow}<circle class="start-dot" cx="${start.x}" cy="${start.y}" r="24"></circle>${label}`;
    })
    .join("");
}

function makeCharacterSvg(char, options = {}) {
  const data = window.HANZI_STROKES[char];
  if (!data) {
    return `<div class="fallback">${char}<br>暂无笔顺数据</div>`;
  }

  const grid = makeGrid(options.gridStyle || "tian");
  const paths = renderStrokePaths(data, options);
  const annotations = options.annotate ? renderAnnotations(data, char, options.showNumbers, options.showArrows) : "";

  return `
    <svg class="hanzi-cell" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" role="img" aria-label="${char} 字练习格">
      ${grid}
      <g transform="translate(0 ${BASELINE}) scale(1 -1)">
        ${paths}
      </g>
      ${annotations}
    </svg>
  `;
}

function makeStandardRow(char, settings) {
  const trace = makeCharacterSvg(char, {
    gridStyle: settings.gridStyle,
    trace: true,
    traceOpacity: settings.traceOpacity,
    annotate: true,
    showNumbers: settings.showNumbers,
    showArrows: settings.showArrows,
  });
  const blanks = Array.from({ length: settings.practiceCount }, () =>
    makeCharacterSvg(char, { gridStyle: settings.gridStyle })
  ).join("");

  return `
    <article class="char-row">
      <div class="char-info">
        <div class="pinyin">${PINYIN[char] || ""}</div>
        <div class="hanzi-label">${char}</div>
      </div>
      ${trace}
      <div class="cell-strip">${blanks}</div>
    </article>
  `;
}

function makeStrokeCard(char, settings) {
  const data = window.HANZI_STROKES[char];
  if (!data) {
    return `<article class="stroke-card"><div class="fallback">${char}<br>暂无笔顺数据</div></article>`;
  }

  const steps = data.strokes
    .map((_, index) => {
      const svg = makeCharacterSvg(char, {
        gridStyle: settings.gridStyle,
        mode: "step",
        step: index,
      });
      return `<div class="step-item">${svg}<span>第 ${index + 1} 笔</span></div>`;
    })
    .join("");

  return `
    <article class="stroke-card">
      <div class="stroke-main">
        <div class="pinyin">${PINYIN[char] || ""}</div>
        ${makeCharacterSvg(char, {
          gridStyle: settings.gridStyle,
          trace: true,
          traceOpacity: settings.traceOpacity,
          annotate: true,
          showNumbers: settings.showNumbers,
          showArrows: settings.showArrows,
        })}
        <strong>${char}</strong>
      </div>
      <div class="step-grid">${steps}</div>
    </article>
  `;
}

function makePage(chars, pageIndex, pageCount, settings) {
  const body =
    settings.template === "stroke"
      ? chars.map((char) => makeStrokeCard(char, settings)).join("")
      : chars.map((char) => makeStandardRow(char, settings)).join("");

  return `
    <section class="page">
      <header class="page-header">
        <h2 class="page-title">${settings.template === "stroke" ? "笔顺分解练习" : "中文写字练习"}</h2>
        <div class="page-meta">第 ${pageIndex + 1} / ${pageCount} 页</div>
      </header>
      <div class="practice-list">${body}</div>
    </section>
  `;
}

function currentSettings() {
  const template = els.template.value;
  return {
    template,
    gridStyle: template === "mizi" ? "mi" : els.gridStyle.value,
    practiceCount: Number(els.practiceCount.value) || 6,
    traceOpacity: Number(els.traceOpacity.value) || 0.2,
    dedupe: els.dedupe.checked,
    showNumbers: els.showNumbers.checked,
    showArrows: els.showArrows.checked,
  };
}

function render() {
  const settings = currentSettings();
  const chars = extractCharacters(els.inputText.value, settings.dedupe);
  const available = chars.filter((char) => window.HANZI_STROKES[char]);
  const missing = chars.filter((char) => !window.HANZI_STROKES[char]);
  const pageSize = PAGE_SIZE[settings.template] || PAGE_SIZE.standard;
  const pageChunks = chunk(available, pageSize);

  els.pages.innerHTML =
    pageChunks.length > 0
      ? pageChunks.map((pageChars, index) => makePage(pageChars, index, pageChunks.length, settings)).join("")
      : `<section class="page"><div class="fallback">请输入内置示例字：${Object.keys(window.HANZI_STROKES).join(" ")}</div></section>`;

  const missingText = missing.length ? `，${missing.length} 个字暂无内置数据：${missing.join(" ")}` : "";
  els.summary.textContent = `已生成 ${available.length} 个字，${pageChunks.length || 1} 页${missingText}`;
}

function init() {
  els.supportedChars.textContent = Object.keys(window.HANZI_STROKES).join(" ");
  els.template.addEventListener("change", render);
  els.gridStyle.addEventListener("change", render);
  els.practiceCount.addEventListener("input", render);
  els.traceOpacity.addEventListener("input", render);
  els.dedupe.addEventListener("change", render);
  els.showNumbers.addEventListener("change", render);
  els.showArrows.addEventListener("change", render);
  els.generateBtn.addEventListener("click", render);
  els.printBtn.addEventListener("click", () => window.print());
  render();
}

init();
