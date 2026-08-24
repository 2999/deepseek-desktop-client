#!/bin/bash
# DeepSeek macOS 客户端一键构建脚本：打包 → ad-hoc 签名 → 安装到 /Applications
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="DeepSeek"
APP_PATH="dist/mac-arm64/${APP_NAME}.app"
DEST="/Applications/${APP_NAME}.app"

echo "==> 1/4 清理旧构建产物"
rm -rf dist

echo "==> 2/4 打包 .app"
npx electron-builder --mac dir

echo "==> 3/4 ad-hoc 签名"
codesign --force --deep --sign - "${APP_PATH}"
codesign --verify --deep --strict "${APP_PATH}"
echo "    签名验证通过 (adhoc)"

echo "==> 4/4 安装到 /Applications"
rm -rf "${DEST}"
cp -R "${APP_PATH}" "${DEST}"
echo "    已安装到 ${DEST}"

echo ""
echo "完成。启动方式：open -a ${APP_NAME}"
