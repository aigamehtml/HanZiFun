# HanZiFun Agent Notes

## Project Context

HanZiFun is a static, offline-first Chinese handwriting practice workbook generator for children. The current MVP is a pure HTML/CSS/JavaScript demo that renders A4 printable practice pages with stroke-order hints.

Use this directory as the project root for future work:

```text
/Users/rickytan/Code/HanZiFun
```

## Current Demo

- Entry point: `index.html`
- Styles: `style.css`
- App logic: `app.js`
- Bundled stroke data: `data/strokes.js`
- Product requirements: `README.md`
- Data attribution: `NOTICE.md`

The demo currently supports 10 built-in characters:

```text
人 口 日 月 水 火 山 田 木 永
```

Templates currently implemented:

- Tianzi grid tracing
- Mizi grid tracing
- Stroke-order breakdown

## Technical Direction

- Keep the app static and offline-capable.
- Avoid CDN/runtime network dependencies.
- Prefer SVG for character strokes, grids, arrows, and print-safe rendering.
- Keep A4 print layout accurate in millimeters.
- Stroke data comes from `hanzi-writer-data`, derived from Make Me A Hanzi. Preserve attribution and license notes when expanding data.

## Local Run

The app can be opened directly:

```text
open index.html
```

For local HTTP testing:

```bash
python3 -m http.server 8765
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

Pages is configured from the `main` branch root directory. The repo was made public because the current GitHub plan did not support Pages for a private repo.

## Validation Checklist

Before committing meaningful changes:

```bash
node --check app.js
```

For static serving checks:

```bash
python3 -m http.server 8765
curl -I http://localhost:8765/
curl -I http://localhost:8765/data/strokes.js
```

For render sanity, verify that default input generates pages and SVG cells. The previous MVP baseline generated:

```text
10 characters, 2 pages, 70 SVG cells
```

## Git Notes

- Default branch: `main`
- Current remote: `git@github.com:rickytan/HanZiFun.git`
- Last known MVP commit: `4d00344 Add offline handwriting demo`

Keep changes scoped and commit intentionally. Do not remove bundled data attribution.
