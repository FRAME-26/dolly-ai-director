#!/usr/bin/env bash
#
# update_server.sh — 部署/更新 Dolly 后端服务 (systemd)
#
# 用法:
#   ./update_server.sh
#   DEPLOY_DIR=/srv/dolly/backend ./update_server.sh
#
set -euo pipefail

# ===== 可配置项 =====
DEPLOY_DIR="${DEPLOY_DIR:-/opt/dolly/backend}"            # 服务器上的后端目录
VENV_DIR="${VENV_DIR:-$DEPLOY_DIR/.venv}"                 # 虚拟环境路径
SERVICE_NAME="${SERVICE_NAME:-dolly-backend}"             # systemd 服务名
BRANCH="${BRANCH:-main}"                                  # 拉取的分支
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8000/health}"  # 健康检查地址

log() { echo "==> [$(date +'%F %T')] $*"; }

log "开始更新 Dolly 后端"

# 1. 进入部署目录
if [ ! -d "$DEPLOY_DIR" ]; then
  echo "错误: 部署目录不存在: $DEPLOY_DIR" >&2
  exit 1
fi
cd "$DEPLOY_DIR"

# 2. 拉取最新代码
log "拉取分支 $BRANCH ..."
git pull --ff-only origin "$BRANCH"

# 3. 安装/更新依赖
log "更新 Python 依赖 ..."
if [ -d "$VENV_DIR" ]; then
  # shellcheck disable=SC1091
  source "$VENV_DIR/bin/activate"
else
  echo "警告: 虚拟环境不存在 ($VENV_DIR)，将使用系统 Python" >&2
fi
pip install --upgrade -r requirements.txt

# 4. 重启服务
log "重启 systemd 服务: $SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME" --no-pager || true

# 5. 健康检查
log "等待服务启动并健康检查 ($HEALTH_URL) ..."
for _ in $(seq 1 15); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    log "服务健康 ✓"
    break
  fi
  sleep 2
done

log "更新完成"
