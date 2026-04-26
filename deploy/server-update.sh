#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/var/www/tongqu-growth-web"
APP_NAME="tongqu-growth-web"
SERVICE_NAME="tongqu-growth-web.service"
HEALTH_PATHS=(
  "/"
  "/children"
  "/adventure"
  "/adventure?theme=habit"
  "/adventure?theme=food"
  "/parents"
  "/teachers"
  "/api/health"
)

echo "==> 进入项目目录"
cd "$APP_DIR"

echo "==> 同步 GitHub 最新代码"
git fetch origin
git checkout main
git pull --ff-only origin main

echo "==> 安装或更新依赖"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "==> 构建生产版本"
npm run build

echo "==> 重启挂载服务"
if systemctl list-unit-files "$SERVICE_NAME" | grep -q "^$SERVICE_NAME"; then
  sudo systemctl restart "$SERVICE_NAME"
  systemctl --no-pager --full status "$SERVICE_NAME" | head -40
elif command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME"
  else
    pm2 start ecosystem.config.cjs
  fi
  pm2 save
  sleep 3
  if ! pm2 status "$APP_NAME" | grep -q "online"; then
    echo "PM2 app $APP_NAME is not online after restart" >&2
    pm2 logs "$APP_NAME" --lines 80 --nostream || true
    exit 1
  fi
else
  echo "No systemd service or PM2 runtime found for $APP_NAME" >&2
  exit 1
fi

echo "==> 等待服务就绪"
for attempt in {1..20}; do
  if curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 20 ]; then
    echo "Service did not become ready on port 3000" >&2
    exit 1
  fi
  sleep 1
done

echo "==> 核心路由健康检查"
for path in "${HEALTH_PATHS[@]}"; do
  status_code="$(curl -o /dev/null -sS -w "%{http_code}" "http://127.0.0.1:3000${path}")"
  echo "$status_code $path"
  if [ "$status_code" != "200" ]; then
    echo "Health check failed for $path" >&2
    exit 1
  fi
done

echo
echo "部署完成。"
