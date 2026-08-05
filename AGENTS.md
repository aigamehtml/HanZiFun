# HanZiFun Agent Notes

## Project Context

HanZiFun is a static, offline-first Chinese handwriting practice workbook generator for children. The current implementation is a pure HTML/CSS/JavaScript application with an npm-only build toolchain.

Use this directory as the project root for future work:

```text
/Users/rickytan/Code/HanZiFun
```

## Current Implementation

- Entry point: `index.html`
- Styles: `style.css`
- App logic: `app.js`
- Core bundled stroke data: `data/strokes.js`
- On-demand stroke index: `data/stroke-index.js`
- Generated stroke chunks: `data/characters/`
- Content presets: `data/content-templates.js`
- Data/build scripts: `scripts/`
- Production output: `dist/` (ignored by Git)
- Product requirements: `README.md`
- Design philosophy and visual rules: `DESIGN.md`
- Data attribution: `NOTICE.md`

The app preloads 28 core characters and supports all 3500 first-level common characters through 70 on-demand chunks.

Templates currently implemented:

- Tianzi grid tracing
- Mizi grid tracing
- Stroke-order breakdown
- Blank Tianzi/Mizi practice paper

## Technical Direction

- Keep the app static and offline-capable.
- Avoid CDN/runtime network dependencies.
- Prefer SVG for character strokes, grids, arrows, and print-safe rendering.
- Keep print layout accurate in millimeters.
- Support paper sizes A5, A4, A3, and Letter.
- Support portrait and landscape orientation.
- All settings should update the preview immediately. The app should be WYSIWYG.
- Persist settings and optionally input text in `localStorage` with a `settingsVersion`.
- Treat mobile as a first-class responsive target: scaled paper preview, no page-level horizontal scrolling, touch-friendly controls.
- Support PWA installation with a manifest, service worker, app icons, standalone display, and basic offline caching.
- Stroke data comes from `hanzi-writer-data`, derived from Make Me A Hanzi. Preserve attribution and license notes when expanding data.

## Product Decisions

- Target users: both parents and teachers.
- Target character coverage: 3500 common Chinese characters.
- Do not bundle all 3500 characters into the main payload. A rough `hanzi-writer-data@2.0.1` estimate showed a 3500-character gzip sample around 3.95MB, above the 200KB direct-bundle threshold.
- Preferred data strategy: keep a tiny built-in demo set, load character JSON on demand, cache loaded data locally, and support a full offline data folder/package.
- Required formal templates: Tianzi grid tracing, Mizi grid tracing, stroke-order breakdown, and blank practice paper.
- Blank practice paper does not require input text or stroke data. It should generate printable Tianzi or Mizi grid pages directly from layout settings.
- Stroke order is for print, not animation-first. Prioritize static clarity: numbers, start dots, direction arrows, and step breakdowns.
- Header information should be template-driven and optional: blank, simple title, homework, class, and teacher-style variants.
- Content should come from both manual input and built-in templates. Initial template categories: Tang poems, San Zi Jing sections, elementary common character groups, basic character structures, and common words.
- Built-in content template insertion should support replacing current input by default and appending as an option.

## Local Run And Build

Install dependencies once:

```bash
npm install
```

The app can be opened directly:

```text
open index.html
```

For local HTTP and PWA testing:

```bash
npm run dev
```

Then visit:

```text
http://localhost:8765/
```

## Deployment

GitHub repository:

```text
https://github.com/rickytan/HanZiFun
```

GitHub Pages URL:

```text
https://rickytan.cn/HanZiFun/
```

GitHub Actions runs `npm ci` and `npm run build`, uploads `dist/`, and deploys it to Pages. The repository must use GitHub Actions as its Pages build source.

## Validation Checklist

Before committing meaningful changes:

```bash
npm run check
npm run build
```

For static serving checks:

```bash
npm run dev
curl -I http://localhost:8765/
curl -I http://localhost:8765/data/stroke-index.js
```

For render sanity, verify all four templates, on-demand loading, local persistence, A5/A4/A3/Letter portrait and landscape, and mobile settings drawer behavior. The default baseline remains:

```text
10 characters, 2 pages, 70 SVG cells
```

## Git Notes

- Default branch: `main`
- Current remote: `git@github.com:rickytan/HanZiFun.git`
- Last known requirements commit: `8b5c599 Add content templates and mobile PWA requirements`

Keep changes scoped and commit intentionally. Do not remove bundled data attribution.
Read `DESIGN.md` before making substantial UI changes.
