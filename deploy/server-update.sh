#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/var/www/tongqu-growth-web"
APP_NAME="tongqu-growth-web"

echo "==> 进入项目目录"
cd "$APP_DIR"

echo "==> 同步 GitHub 最新代码"
git fetch origin
git checkout main
git pull --ff-only origin main

echo "==> 安装或更新依赖"
npm install

echo "==> 构建生产版本"
npm run build

echo "==> 重启 PM2 服务"
pm2 restart "$APP_NAME"
pm2 save

echo "==> 本机健康检查"
curl -fsS "http://127.0.0.1:3000/api/health" || true

echo
echo "部署完成。"
