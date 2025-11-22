#!/bin/bash
# 构建脚本 - 注入版本信息

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载统一的版本信息
source "${SCRIPT_DIR}/version.sh"

echo "🔨 构建 Relay Pulse Monitor"
echo "📦 Version: $VERSION"
echo "🔖 Git Commit: $GIT_COMMIT"
echo "🕐 Build Time: $BUILD_TIME"
echo ""

# 构建二进制文件
go build \
  -ldflags="-s -w \
  -X monitor/internal/buildinfo.Version=${VERSION} \
  -X monitor/internal/buildinfo.GitCommit=${GIT_COMMIT} \
  -X 'monitor/internal/buildinfo.BuildTime=${BUILD_TIME}'" \
  -o monitor \
  ./cmd/server

echo ""
echo "✅ 构建完成: ./monitor"
echo ""
echo "运行方式:"
echo "  ./monitor [config.yaml]"
