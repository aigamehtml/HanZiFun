# Notices

This project includes generated character stroke-data chunks from `hanzi-writer-data@2.0.1`.

`hanzi-writer-data` is derived from the Make Me A Hanzi project. The character data is distributed under the Arphic Public License. See the upstream project for the complete license text and full data set:

- https://github.com/chanind/hanzi-writer-data
- https://github.com/skishore/makemeahanzi

The application code in this repository is separate from the bundled character data.

The 3500-character build list follows the first-level character table from the 2013
Table of General Standard Chinese Characters. The machine-readable list used by the
build script was transcribed and published here:

- https://gist.github.com/Elypha/641901465d639292e18670a5b159c3d8

Basic pinyin data is generated at build time with `pinyin-pro`, distributed under the
MIT License:

- https://github.com/zh-lx/pinyin-pro

ZIP creation and browser-side selective extraction use zip.js, distributed under the
BSD 3-Clause License. A copy of its license is included with the vendored runtime:

- https://github.com/gildas-lormeau/zip.js
- `vendor/zip.LICENSE`
