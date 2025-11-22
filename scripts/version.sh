#!/bin/bash
# 版本信息获取脚本
# 可被其他构建脚本 source，提供统一的版本号来源

# 获取版本号 (优先使用 Git tag，fallback 到 commit hash)
# 支持环境变量覆盖，用于 CI/CD 环境
if [ -z "$VERSION" ]; then
    if git describe --tags --match "v*" --always --dirty >/dev/null 2>&1; then
        VERSION=$(git describe --tags --match "v*" --always --dirty 2>/dev/null)
    else
        VERSION="dev"
    fi
fi

# 获取 Git commit hash (短格式)
if [ -z "$GIT_COMMIT" ]; then
    if git rev-parse --short HEAD >/dev/null 2>&1; then
        GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null)
    else
        GIT_COMMIT="unknown"
    fi
fi

# 获取构建时间 (RFC 3339 格式，无空格)
if [ -z "$BUILD_TIME" ]; then
    BUILD_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
fi

# 导出变量供其他脚本使用
export VERSION
export GIT_COMMIT
export BUILD_TIME

# 生成镜像标签 (移除 v 前缀，替换特殊字符)
IMAGE_TAG="${VERSION#v}"
IMAGE_TAG="${IMAGE_TAG//\//-}"  # 替换 / 为 -
export IMAGE_TAG

# 如果作为独立脚本运行，打印版本信息
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
    echo "VERSION=$VERSION"
    echo "GIT_COMMIT=$GIT_COMMIT"
    echo "BUILD_TIME=$BUILD_TIME"
    echo "IMAGE_TAG=$IMAGE_TAG"
fi
