# Notices

This project includes generated character stroke-data chunks from `hanzi-writer-data@2.0.1`.

`hanzi-writer-data` is derived from the Make Me A Hanzi project. The character data is distributed under the Arphic Public License. See the upstream project for the complete license text and full data set:

- https://github.com/chanind/hanzi-writer-data
- https://github.com/skishore/makemeahanzi

The application code in this repository is separate from the bundled character data.

The base 3500-character build list follows the first-level character table from the
2013 Table of General Standard Chinese Characters. The machine-readable list used
by the build script was transcribed and published here:

- https://gist.github.com/Elypha/641901465d639292e18670a5b159c3d8

The production build expands that base list to all single-codepoint character data
available in `hanzi-writer-data`, sorted by Unicode code point after the base list.

Basic pinyin data is generated at build time with `pinyin-pro`, distributed under the
MIT License:

- https://github.com/zh-lx/pinyin-pro

ZIP creation uses zip.js, distributed under the BSD 3-Clause License. A copy of
its license is included with the generated dependency notices:

- https://github.com/gildas-lormeau/zip.js
- `vendor/zip.LICENSE`

Browser-side ZIP extraction uses fflate, distributed under the MIT License:

- https://github.com/101arrowz/fflate
- `vendor/fflate.LICENSE`

Direct vector PDF export uses jsPDF, distributed under the MIT License. A copy
of its license is included with the vendored runtime:

- https://github.com/parallax/jsPDF
- `vendor/jspdf.LICENSE`

Built-in classic text templates are generated from the `chinese-poetry` data set,
distributed under the MIT License:

- https://github.com/chinese-poetry/chinese-poetry
- https://www.npmjs.com/package/chinese-poetry
- `data/chinese-poetry.LICENSE`

The embedded Kai (楷体) typeface is AR PL UKai CN (文鼎楷体, 简体正楷), distributed
under the Arphic Public License. The font is subsetted at build time to all
~9600 characters with stroke data plus punctuation/digits/Latin/pinyin, and
further subsetted at PDF export time to only the characters used on the page:

- https://www.freedesktop.org/wiki/Software/CJKUnifonts/
- `vendor/kai.LICENSE`

Runtime font subsetting uses the HarfBuzz `hb-subset` WASM build (harfbuzzjs),
distributed under the MIT License:

- https://github.com/harfbuzz/harfbuzzjs
- `vendor/hb-subset.LICENSE`
