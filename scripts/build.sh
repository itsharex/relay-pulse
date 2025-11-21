#!/bin/bash
# 构建脚本 - 注入版本信息

set -e

# 获取版本信息
VERSION=${VERSION:-"$(git describe --tags --always --dirty 2>/dev/null || echo 'dev')"}
GIT_COMMIT=${GIT_COMMIT:-"$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"}
BUILD_TIME=${BUILD_TIME:-"$(date -u '+%Y-%m-%d %H:%M:%S UTC')"}

echo "🔨 构建 Relay Pulse Monitor"
echo "📦 Version: $VERSION"
echo "🔖 Git Commit: $GIT_COMMIT"
echo "🕐 Build Time: $BUILD_TIME"
echo ""

# 构建二进制文件
go build \
  -ldflags="-s -w \
  -X main.Version=${VERSION} \
  -X main.GitCommit=${GIT_COMMIT} \
  -X 'main.BuildTime=${BUILD_TIME}' \
  -X monitor/internal/api.Version=${VERSION} \
  -X monitor/internal/api.GitCommit=${GIT_COMMIT} \
  -X 'monitor/internal/api.BuildTime=${BUILD_TIME}'" \
  -o monitor \
  ./cmd/server

echo ""
echo "✅ 构建完成: ./monitor"
echo ""
echo "运行方式:"
echo "  ./monitor [config.yaml]"
