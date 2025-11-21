#!/bin/bash
# Docker 构建脚本 - 注入版本信息

set -e

# 获取版本信息
VERSION=${VERSION:-"$(git describe --tags --always --dirty 2>/dev/null || echo 'dev')"}
GIT_COMMIT=${GIT_COMMIT:-"$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"}
BUILD_TIME=${BUILD_TIME:-"$(date -u '+%Y-%m-%d %H:%M:%S UTC')"}

echo "🐳 构建 Docker 镜像"
echo "📦 Version: $VERSION"
echo "🔖 Git Commit: $GIT_COMMIT"
echo "🕐 Build Time: $BUILD_TIME"
echo ""

# 构建 Docker 镜像
docker build \
  --build-arg VERSION="${VERSION}" \
  --build-arg GIT_COMMIT="${GIT_COMMIT}" \
  --build-arg BUILD_TIME="${BUILD_TIME}" \
  -t relay-pulse-monitor:${VERSION} \
  -t relay-pulse-monitor:latest \
  .

echo ""
echo "✅ Docker 镜像构建完成"
echo "   relay-pulse-monitor:${VERSION}"
echo "   relay-pulse-monitor:latest"
echo ""
echo "运行方式:"
echo "  docker run -p 8080:8080 -v ./config.yaml:/app/config.yaml:ro relay-pulse-monitor:latest"
