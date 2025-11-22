#!/bin/bash
# Docker 构建脚本 - 注入版本信息

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载统一的版本信息
source "${SCRIPT_DIR}/version.sh"

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
  -t relay-pulse-monitor:${IMAGE_TAG} \
  -t relay-pulse-monitor:latest \
  .

echo ""
echo "✅ Docker 镜像构建完成"
echo "   relay-pulse-monitor:${IMAGE_TAG}"
echo "   relay-pulse-monitor:latest"
echo ""
echo "镜像信息:"
echo "   Version: ${VERSION}"
echo "   Commit: ${GIT_COMMIT}"
echo "   Built: ${BUILD_TIME}"
echo ""
echo "运行方式:"
echo "  docker run -p 8080:8080 -v ./config.yaml:/app/config.yaml:ro relay-pulse-monitor:latest"
