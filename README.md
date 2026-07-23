# dolly-ai-director

> AI director project — team: Ceaser, Nero, Jeboy

## Structure

```
dolly-ai-director/
├── backend/            # ⭐ Server runs only this folder
│   ├── app/
│   │   ├── main.py          # FastAPI entrypoint
│   │   ├── decision_engine.py  # MCDA scoring + state machine
│   │   ├── watchdog.py      # Watchdog
│   │   └── models.py        # Pydantic data models (interface contract)
│   ├── requirements.txt     # Server deps (fastapi/uvicorn/websockets...)
│   ├── .env.example         # Env var template
│   └── Dockerfile           # (optional) containerized deploy
├── client/             # Local laptop (Nero + Jeboy)
│   ├── perception/
│   │   ├── camera_capture.py   # cv2 read Pocket 4
│   │   └── yolo_inference.py   # YOLOv8n + feature extraction
│   ├── obs_bridge/
│   │   └── obs_controller.py   # obs-websocket-py control OBS
│   └── requirements.txt    # Local deps (ultralytics, opencv, gradio...)
├── ui/                 # Jeboy's Gradio dashboard (dev/ops console)
│   ├── dashboard.py
│   └── requirements.txt
├── frontend/           # React 19 web UI (Dolly V2) — 通过 VITE_DOLLY_API 连后端
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   ├── .env.example    # VITE_DOLLY_API → 后端地址
│   └── vercel.json     # Vercel 静态部署
├── docs/               # All PDFs / docs
├── deploy/             # 服务器部署文件 (systemd unit)
│   └── dolly-backend.service
├── update_server.sh    # 一键部署/更新脚本 (systemd)
├── .gitignore
└── README.md
```

## Quick start

### Backend (server)
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # then fill in values
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Client (local laptop)
```bash
cd client
pip install -r requirements.txt
python perception/camera_capture.py
```

### UI dashboard
```bash
cd ui
python dashboard.py
```

## Deployment (Linux 服务器, systemd)

1. **准备服务文件**（仓库内的 `deploy/dolly-backend.service`）：
   ```bash
   sudo cp deploy/dolly-backend.service /etc/systemd/system/dolly-backend.service
   sudo systemctl daemon-reload
   sudo systemctl enable dolly-backend   # 开机自启
   ```
   按需修改里面的 `User` / `Group` / 资源限制（`CPUQuota` / `MemoryMax`）。

2. **在服务器上初始化一次**：
   ```bash
   sudo mkdir -p /opt/dolly/backend
   # 把仓库 clone / 拷贝到 /opt/dolly/backend
   cd /opt/dolly/backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env   # 填写真实配置
   sudo systemctl start dolly-backend
   ```

3. **以后每次更新**：直接跑仓库根的脚本（拉代码 → 装依赖 → 重启 → 健康检查）：
   ```bash
   ./update_server.sh
   # 或用环境变量覆盖：DEPLOY_DIR=/srv/dolly/backend ./update_server.sh
   ```

## Frontend (React web UI)

`frontend/` 是 Dolly V2 的网页端（React 19 + Vite + TS + Tailwind + XState），
从 Figma 设计稿 1:1 实现。它**只**通过 `VITE_DOLLY_API` 连我们的 FastAPI 后端，
不直接碰 OBS / 相机。不连后端时跑“诚实的 demo 模式”（mock 相机 + 浏览器语音）。

```bash
cd frontend
pnpm install          # 需要 pnpm@11
pnpm dev              # http://localhost:5173
pnpm build            # 产物在 dist/，可丢 Vercel（vercel.json 已配）
```

后端要实现的接口（含 voice WebSocket / CORS / /health）见
[`backend/API_CONTRACT.md`](backend/API_CONTRACT.md)。核心三件事：

| 方法 | 路径 | 说明 |
|------|------|------|
| WS | `/ws/voice` | 后端 → 前端推送语音识别事件 |
| POST | `/export/otio` | 导出 OpenTimelineIO（送 Resolve） |
| POST | `/export/publish` | 发布到社交平台 |

前端通过 `frontend/.env` 的 `VITE_DOLLY_API` 指后端；本地默认 `http://localhost:8000`。

