#!/usr/bin/env bash
# 汉字 Fun - 一键打包桌面版
# 产出：release/ 目录下的安装包 + 绿色版
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(pwd)"

echo ""
echo "=============================================="
echo "  汉字 Fun - 桌面版打包"
echo "=============================================="
echo ""

# Step 1: 安装依赖
if [ ! -d "node_modules" ]; then
  echo "[1/4] 安装 npm 依赖..."
  npm install
else
  echo "[1/4] 已有 node_modules，跳过安装"
fi

# Step 2: 离线构建（CDN_BASE="" 让所有资源走本地）
echo "[2/4] 离线构建（资源全走本地，不依赖 CDN）..."
npm run build:offline

# Step 3: 验证构建产物
if [ ! -d "dist" ]; then
  echo "❌ 构建失败：dist/ 目录不存在"
  exit 1
fi

DIST_SIZE=$(du -sh dist/ | cut -f1)
ZIP_COUNT=$(ls dist/data/*.zip 2>/dev/null | wc -l)
echo "    ✓ dist/ 构建成功，大小 ${DIST_SIZE}，包含 ${ZIP_COUNT} 个笔顺 ZIP 包"

# Step 4: Electron 打包
echo "[3/4] 打包桌面应用..."
echo "    💡 注意：只能在对应系统上打包对应平台"
echo "       Windows 包 → 在 Windows 或 Linux 上跑"
echo "       macOS 包   → 只能在 macOS 上跑"
echo "       Linux 包   → 在 Linux 上跑"
echo ""

npx electron-builder --win --mac --linux 2>&1 || {
  echo ""
  echo "⚠️  跨平台打包失败（正常）。请只打包当前平台："
  echo ""
  echo "    Windows:  npm run dist:win"
  echo "    macOS:    npm run dist:mac"
  echo "    Linux:    npm run dist:linux"
  echo ""
}

echo "[4/4] 打包完成！"
echo ""
if [ -d "release" ]; then
  echo "产物目录：$(pwd)/release/"
  echo ""
  echo "内容："
  ls -lh release/
  echo ""
  echo "----------------------------------------"
  echo "  Windows 用户拿这个文件："
  echo "  - HanZiFun-*-win-x64.exe     ← 安装包（.exe Setup）"
  echo "  - HanZiFun-*-win-x64.exe     ← 绿色版（portable，同名但路径不同）"
  echo ""
  echo "  macOS 用户拿这个文件："
  echo "  - HanZiFun-*.dmg             ← 拖到 Applications"
  echo ""
  echo "  Linux 用户拿这个文件："
  echo "  - HanZiFun-*.AppImage      ← 双击运行"
  echo "  - HanZiFun-*.deb            ← dpkg 安装"
  echo "----------------------------------------"
else
  echo "❌ release/ 目录不存在，打包可能失败了"
fi
echo ""
