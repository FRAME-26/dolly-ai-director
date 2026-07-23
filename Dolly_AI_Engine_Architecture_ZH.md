# Dolly AI 引擎架构设计

AdventureX 2026 · Team FRAME-26 · 对齐 `DOLLY_JULY23_FINAL_LOCK.md`
部署目标：Vercel + Railway + 本地 RTX 4060 笔记本
撰写日期：2026-07-23

---

## 0. 一条最重要的原则（先说清楚）

July 23 Final Lock 已经锁死：**"Everything required for the live demo runs on the Windows OBS laptop or local network. Internet failure must not stop the demo."**

所以 Vercel 和 Railway **绝对不能出现在实时决策链路里**。正确的分工是：

| 位置 | 跑什么 | 是否在实时链路 |
|---|---|---|
| Windows OBS 笔记本 | OBS、Nero 的 FastAPI 后端、帧中继、OBS WebSocket 桥、events.jsonl、本地 Director Console | ✅ 是 |
| **4060 笔记本（局域网）** | **Ceaser 的 AI 引擎：模型推理 + 打分 + director.decision** | ✅ 是 |
| Railway | 赛后日志归档 API、会话摘要存储（events.jsonl 上传）、给评委看的回放数据源 | ❌ 否 |
| Vercel | 项目展示页 / 提交材料页 / 只读的 Session Replay 页面（读 Railway 数据） | ❌ 否 |

一句话：**现场断网，demo 照跑；Railway/Vercel 挂了，没人会发现。** 这也正好是加分项——评委问"网断了怎么办"，答案是"AI 大脑就在这台 4060 上"。

---

## 1. 实时链路总览（局域网内）

```text
OBS 笔记本                                4060 笔记本
─────────────────────────────           ─────────────────────────────
OBS (独占 UVC 摄像头)                    AI Engine (Ceaser)
  │ 截图/源缓存                            │
  ▼                                       │ ① HTTP 拉帧
FastAPI 帧中继                  ◄─────────┤ GET /api/v1/frames/{cam}.jpg
  640x360 JPEG · 每路 2 FPS               │ (cam_track / cam_wide / cam_side)
                                          ▼
                                     ② Perception 层
                                        YOLO 人体检测 (GPU)
                                          ▼
                                     ③ Feature/Scoring 层
                                        可见性/构图/稳定性/清晰度
                                          ▼
                                     ④ Decision 层
                                        每路分数 + 选择 + 置信度 + reason
                                          │
  Nero 后端安全层                          │ ⑤ WS 推送
  hold/cooldown/margin/health   ◄─────────┘ WS /ws/v1/engine
  │                                         (engine.hello / heartbeat /
  ▼                                          director.decision)
OBS WebSocket 切换 + Console + events.jsonl
```

引擎**只提议，不执行**。confidence、hold、cooldown、margin 的最终裁决权在 Nero 的后端（Lock §6），引擎不直接碰 OBS。这条边界是合同版本 v1.0 的一部分，不许越过。

---

## 2. 引擎内部四层设计

### 2.1 帧获取层（Frame Fetcher）

用 `httpx.AsyncClient` 对三个已锁定的端点轮询，每路 2 FPS（Lock §4 规定的起始采样率）。要点：

- 每路独立的 asyncio task，互不阻塞；单路拉帧超时 400 ms 直接丢弃这一帧。
- 每帧记录 `fetch_ts`；如果某路连续 2 秒（约 4 帧）拉不到或返回错误，把该路标记为 `invalid`，在分数里体现（visibility=0），让后端触发回 `CAM_WIDE` 的逻辑。
- **绝不**用 OpenCV 直接打开摄像头——OBS 独占 UVC，这是 Lock §4 的硬规则。

### 2.2 感知层（Perception）

4060 上 6 次推理/秒（3 路 × 2 FPS）是非常轻的负载，选型按"稳"不按"炫"：

| 任务 | 首选 | 说明 |
|---|---|---|
| 人体检测 | YOLOv8n 或 YOLO11n，640 输入，FP16 | 4060 上单帧约 4–8 ms，绰绰有余 |
| 人脸检测（可选增强） | OpenCV YuNet（CPU 也够） | 用来判断"是否面向镜头"，P0 不强依赖 |
| 追踪 | 不需要 ByteTrack | 2 FPS 下按"最大人体框"或 IoU 匹配上一帧即可 |

初始化时预热一次（跑 3 帧 dummy 输入），避免第一次真实决策时的 CUDA 冷启动延迟。模型加载失败 → 自动降级到启发式模式（见 §4）。

### 2.3 特征与打分层（Scoring）

每路每帧产出四个 0–1 的子分，全部是可解释的确定性规则（Lock §6：reason 必须 deterministic、truthful，实时环里不用 LLM）：

```text
score = 0.40·visibility + 0.25·framing + 0.20·stability + 0.15·sharpness
```

| 子分 | 计算方式 |
|---|---|
| visibility | 有无人体框；框面积占画面比例映射到 0–1（太小或被裁切扣分）；帧 invalid 直接 0 |
| framing | 人体框中心相对三分线的偏移 + headroom 是否合理 + 框是否顶到画面边缘 |
| stability | 最近 6 帧（3 秒滑窗）框中心的抖动标准差，越稳越高 |
| sharpness | 人体框区域的拉普拉斯方差归一化（低于阈值判失焦/糊） |

再做一次 EMA 平滑（α≈0.4）防止单帧噪声引起分数跳变。`cam_track` 可以配一个小的角色加成（+0.03），因为 Link 2 Pro 本身在物理追踪，中近景天然更值得给——但加成必须写进 reason，不藏。

置信度定义为：`confidence = 榜首平滑分 × 数据新鲜度系数`（帧龄 > 1.5 s 时衰减），这样"分数高但数据旧"不会骗过后端。

### 2.4 决策层（Decision Emitter）

每 500 ms 产出一次候选决策（与 2 FPS 对齐）。引擎侧只做一个门槛：榜首与当前机位的分差 ≥ 0.05 才发新 decision，减少无意义消息；真正的 margin 0.12、hold 2500 ms、cooldown 1500 ms 由后端裁决（Lock §6）。

reason 从固定枚举生成，例如：`"cam_track: subject visible, stable framing, score 0.81 vs cam_wide 0.62"`。枚举包括 `subject_entered` / `subject_lost` / `better_framing` / `feed_invalid` / `fallback_heuristic`。

---

## 3. WebSocket 协议（v = "1.0"，字段冻结）

连接 `WS /ws/v1/engine`，消息与 Lock §5 的合同对齐：

```jsonc
// 连接后第一条
{ "v": "1.0", "type": "engine.hello",
  "engine": "dolly-engine", "build": "2026-07-23", "mode": "model" }

// 每 1 秒
{ "v": "1.0", "type": "engine.heartbeat", "ts": 1753257600123,
  "fps": { "cam_track": 2.0, "cam_wide": 2.0, "cam_side": 1.8 },
  "gpu_ok": true, "mode": "model" }

// 决策
{ "v": "1.0", "type": "director.decision", "ts": 1753257600623,
  "selected": "cam_track", "confidence": 0.81,
  "scores": { "cam_track": 0.81, "cam_wide": 0.62, "cam_side": 0.44 },
  "reason": "subject visible, stable framing",
  "mode": "model" }
```

心跳节奏必须严格 1 s，因为后端的失效判定是"3 秒没心跳→保持当前镜头，5 秒→切广角"（Lock §6）。断线重连用指数退避（0.5 s 起，上限 5 s），重连成功后先重发 `engine.hello` 再恢复决策流；重连期间引擎继续本地打分但不缓存积压决策——旧决策过期即弃。

---

## 4. 降级阶梯（必须全部实现，这是 P0）

```text
L0 正常：GPU 模型打分            → mode = "model"
L1 模型/GPU 故障：启发式打分     → mode = "heuristic"
     (帧差运动量 + 亮度 + 中心区域占比，纯 OpenCV/CPU)
L2 某路帧失效：该路 visibility=0 → 后端自然回落 CAM_WIDE
L3 引擎整体崩溃：心跳消失        → 后端 5 秒规则切广角（不归引擎管，但要演练）
```

L1 的意义：就算 CUDA 当场抽风，demo 里的自动切换依然成立，只是 reason 会诚实地写 `fallback_heuristic`。Console 上 mode 字段会显示出来——这本身就是"explains every decision"故事的一部分。

---

## 5. Railway 与 Vercel 到底放什么

### Railway（一个小 FastAPI + Postgres/SQLite 即可）

赛后价值层，全部异步、非实时：

1. `POST /archive/session` —— demo 结束后，OBS 笔记本把 `events.jsonl` + 关键截图一键上传。
2. `GET /sessions/{id}` —— 返回结构化的会话摘要（切换次数、每路在播时长、平均置信度、手动接管次数）。
3. 给 Vercel 回放页提供只读 API。

### Vercel（Next.js 静态为主）

1. 项目展示 / 提交材料页（配合小红书链接、GitHub、demo 视频）。
2. **Session Replay 页面**：读 Railway 的 events 数据，把 demo 里那 2–3 分钟的决策时间线可视化重放——评委扫码就能看"Dolly 当时为什么切了这一刀"。这是零风险的加分项，因为它只消费日志，不碰直播。

注意：本地 Director Console（React）仍然由 OBS 笔记本本地服务，不部署在 Vercel——否则断网时 Console 就死了，违反 Lock。Vercel 上的是它的"只读回放兄弟"。

---

## 6. 性能预算（4060 完全够用）

| 环节 | 预算 | 预期实际 |
|---|---|---|
| 拉帧（局域网 HTTP，640×360 JPEG） | < 80 ms | 10–30 ms |
| YOLO 推理（单帧 FP16） | < 30 ms | 4–8 ms |
| 打分 + 平滑 | < 5 ms | ~1 ms |
| WS 发送到后端 | < 20 ms | ~2 ms |
| **引擎侧端到端** | **< 250 ms** | **~50 ms** |

后端裁决 + OBS 切换再加 100–200 ms，总体远低于 500 ms 的观感阈值。GPU 占用预计 < 15%，笔记本插电、关闭 Windows 自动更新和睡眠（Lock §9 July 26 规则提前执行）。

---

## 7. 代码结构建议

```text
dolly-engine/
├── main.py              # asyncio 入口：fetcher tasks + decision loop + ws client
├── config.py            # 端点、权重、阈值、camera IDs（与 v1.0 合同一致，禁改名）
├── fetcher.py           # 每路拉帧、帧龄、invalid 标记
├── perception.py        # YOLO 加载/预热/推理，失败抛 DegradeToHeuristic
├── heuristic.py         # L1 降级打分
├── scoring.py           # 四子分 + EMA + confidence
├── decision.py          # 候选比较、reason 枚举、去抖
├── ws_client.py         # hello/heartbeat/decision、重连退避
└── replay.py            # 离线回放：喂一目录截图跑整条链路（测试用）
```

`replay.py` 很关键：July 24 中午的 gate 之前，Ceaser 可以不依赖 Nero 的现场环境，用录好的帧目录验证整条打分→决策链路。

---

## 8. 与 7 月 23–24 gate 的对应关系

| Lock 里的今日任务 | 本架构对应物 |
|---|---|
| 确认 v1 合同与 ID | `config.py` 冻结常量 |
| 打通三个帧端点 | `fetcher.py` |
| 每路至少打分一张真实帧 | `perception.py` + `scoring.py` 冒烟测试 |
| 连上 `/ws/v1/engine` | `ws_client.py` |
| 发 hello、心跳、一条真实 decision | `main.py` 主循环 |

明天（7/24）中午 gate "real frame → score → JSON → backend → OBS switch → UI" 需要的所有引擎侧组件都在上表里；Railway/Vercel 的归档与回放属于 P1/P2，**在 20 分钟稳定运行达成之前一行都不写**——这与 Lock §3 的 scope freeze 完全一致。

---

*Many lenses. One intelligence. One story. —— 而这个 intelligence 就住在那台 4060 上。*
