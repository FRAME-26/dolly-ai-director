# dolly-ai-director

> AI director project — team: Ceaser, Nero, Jeboy
> 实时架构对齐 `Dolly_AI_Engine_Architecture_ZH.md`（July 23 Final Lock）

## ⚠️ 架构铁律：AI 引擎 ≠ 后端

现场 demo 跑在**局域网**内，断网也必须能跑。所以 Vercel / Railway **绝不进实时决策链路**。

| 位置 | 跑什么 | 实时链路 |
|---|---|---|
| **Windows OBS 笔记本** | **后端 (Nero)**：帧中继 + 安全裁决层(hold/cooldown/margin/health) + OBS WebSocket 桥 + events.jsonl + 本地 Director Console | ✅ 是 |
| **4060 笔记本 (局域网)** | **AI 引擎 (Ceaser)**：拉帧 + YOLO 感知 + 四子分打分 + director.decision | ✅ 是 |
| Railway | 赛后归档 API（上传 events.jsonl、会话摘要），**非实时** | ❌ 否 |
| Vercel | 展示/提交材料页 + **只读** Session Replay（读 Railway），**非实时** | ❌ 否 |

**关键边界**：AI 引擎**只提议，不执行**。最终裁决权（hold/cooldown/margin/health）在 Nero 的后端；引擎作为 **WS 客户端**连后端 `WS /ws/v1/engine`，不直接碰 OBS。引擎侧的「打分 + 决策」(`decision_engine`) 属于 AI 引擎，**不属于后端**。

## Structure

```
dolly-ai-director/
├── backend/            # Nero 的后端 — 跑在 Windows OBS 笔记本（本地局域网, 实时）
│   ├── app/
│   │   ├── main.py          # FastAPI: 帧中继 + WS 服务(/ws/v1/engine) + OBS 桥 + events.jsonl
│   │   ├── safety.py        # 安全裁决层: hold/cooldown/margin/health (取代 decision_engine.py)
│   │   ├── watchdog.py      # 看门狗
│   │   └── models.py        # Pydantic 数据模型 (v1.0 合同, 冻结)
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile           # (可选) 自托管
├── dolly-engine/        # Ceaser 的 AI 引擎 — 跑在 4060 笔记本（局域网, 实时, WS 客户端）
│   ├── main.py          # asyncio: fetcher tasks + decision loop + ws client
│   ├── config.py        # 端点/权重/阈值/camera IDs (v1.0 冻结, 禁改名)
│   ├── fetcher.py       # 每路拉帧(HTTP)、帧龄、invalid 标记
│   ├── perception.py    # YOLO 加载/预热/推理, 失败→DegradeToHeuristic
│   ├── heuristic.py     # L1 降级打分 (纯 OpenCV/CPU)
│   ├── scoring.py       # 四子分 + EMA + confidence
│   ├── decision.py      # 候选比较/reason 枚举/去抖
│   ├── ws_client.py     # hello/heartbeat/decision + 重连退避
│   ├── replay.py        # 离线回放(测试用)
│   └── requirements.txt
├── client/              # ⚠️ 与架构冲突, 待重构 (见下)
├── ui/                  # Jeboy 的 Gradio 操作台 (本地)
├── frontend/            # 本地 Director Console (React) — OBS 笔记本本地服务; Vercel 只放只读回放兄弟页
├── docs/
├── deploy/              # 部署文件(systemd 单元 + 云部署指南)
├── update_server.sh     # (可选) 自托管 Linux 后端用; 现场不用
├── Dolly_AI_Engine_Architecture_ZH.md  # 官方 AI 引擎架构
├── .gitignore
└── README.md
```

## ⚠️ 与早期 scaffold 的冲突（待团队确认）

1. **`backend/app/decision_engine.py` 放错了位置**：MCDA 打分 + 状态机属于 **AI 引擎**（`dolly-engine/scoring.py` + `decision.py`），不属于后端。后端的职责是 **安全裁决层**（`safety.py`：hold/cooldown/margin/health）对引擎提议做最终裁决。建议把 `decision_engine.py` 的逻辑迁到 `dolly-engine/`，后端改为 `safety.py`。
2. **`client/` 当前内容冲突**：架构里 `camera_capture.py`(cv2 直开摄像头) 违反 "OBS 独占 UVC，引擎绝不直开摄像头"；YOLO 推理在 `dolly-engine/perception.py`；OBS 控制在后端。建议 `client/` 重构或清空，相关代码并入 `dolly-engine/`(感知) 与 `backend/`(OBS 桥)。
3. **`frontend/` 的 API 契约与锁定合同不一致**：前端设计稿用 `/ws/voice`、`/export/otio`、`/export/publish`，但锁定合同是 `WS /ws/v1/engine` + `GET /api/v1/frames/{cam}.jpg`。需确认 `frontend/` 是否就是本地 Director Console，并把它对齐到 v1.0 合同（或明确它是另一套 V2 UI）。

## Quick start

### 后端 (Nero) — OBS 笔记本 (Windows, 本地)
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### AI 引擎 (Ceaser) — 4060 笔记本 (局域网)
```bash
cd dolly-engine
pip install -r requirements.txt
python main.py                    # WS 客户端连后端 /ws/v1/engine
```

### 前端 Director Console — OBS 笔记本本地
```bash
cd frontend
pnpm install && pnpm dev          # http://localhost:5173 (本地服务, 断网可用)
```

## 本地实时部署（现场 demo 路径）

1. OBS 笔记本：起 `backend/`（帧中继 + WS + 安全裁决 + OBS 桥）。
2. 4060 笔记本：起 `dolly-engine/`，连 `ws://<OBS笔记本IP>:8000/ws/v1/engine`。
3. OBS 笔记本：本地起 `frontend/`（Director Console），OBS 通过 WebSocket 被后端控制切换。
4. 全程只走局域网，断网照跑。

> `deploy/dolly-backend.service` + `update_server.sh`（systemd）是**自托管 Linux** 的备选，不是现场路径。

## 赛后云部署（非实时）— Railway + Vercel

仅用于归档与展示，**不在实时链路**：详见 [`deploy/VERCEL_RAILWAY.md`](deploy/VERCEL_RAILWAY.md)。

- **Railway**：`POST /archive/session` 上传 events.jsonl + 摘要；给 Vercel 回放页提供只读 API。
- **Vercel**：展示页 + 只读 Session Replay 页（读 Railway）。`frontend/` 的"回放兄弟页"可部署到这里；**实时 Director Console 不部署到 Vercel**。

## Frontend (React web UI)

`frontend/` 是 Dolly 的网页端（React 19 + Vite + TS + Tailwind + XState）。
现场 = **本地 Director Console**（OBS 笔记本 serve，断网可用）；
云端 = **只读回放兄弟页**（Vercel，读 Railway 数据，零风险加分项）。

后端实时接口（帧中继 + 引擎 WS）以 `Dolly_AI_Engine_Architecture_ZH.md` 的 v1.0 合同为准；
早期 `backend/API_CONTRACT.md` 的 `/ws/voice`、`/export/*` 来自前端设计稿，需与锁定合同对齐（见上方冲突 3）。
