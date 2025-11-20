#!/bin/bash
# 开发环境启动脚本 - 使用 Air 热重载

echo "🚀 启动 Go 后端热重载开发环境..."
echo ""

# 检查 Air 是否安装
if ! command -v air &> /dev/null && ! [ -f ~/go/bin/air ]; then
    echo "❌ Air 未安装，正在安装..."
    go install github.com/air-verse/air@latest
fi

# 创建 tmp 目录
mkdir -p tmp/air

# 启动 Air
if command -v air &> /dev/null; then
    air
else
    ~/go/bin/air
fi
