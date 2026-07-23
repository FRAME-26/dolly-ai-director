# Dolly AI 引擎实施 Roadmap（最严苛版）

对齐：`DOLLY_JULY23_FINAL_LOCK.md` + repo `FRAME-26/dolly-ai-director` 现状
生成：2026-07-23 · 附带一套**已通过端到端冒烟测试**的 `dolly-engine/` 代码

---

## 现状诊断（诚实版）

repo 语言统计是 **Shell 100%**——意味着除了目录骨架和文档，引擎的 Python 代码基本还不存在。README 里自己记录了三个 scaffold 冲突。这不是坏消息：**空骨架 + 清晰合同**恰好是最容易正确起步的状态。本包里的代码就是按 README 目录结构逐文件填空的，直接放进 `dolly-engine/` 即可。

代码已在无 GPU 环境验证过完整闭环（heuristic 模式 + mock 后端）：
拉帧 2FPS×3 路 → 打分 → EMA → decision → WS → 安全层拒绝(低置信度/hold) → **真实切换指令**。
这意味着今晚 Ceaser 拿到 4060 后，唯一的新增变量只有 YOLO——链路其余部分已经证明能跑。

---

## Step 0 · 立刻做（30 分钟，任何编码之前）

按 README 里自己列的三个冲突逐一处死，不留悬案：

1. `backend/app/decision_engine.py` → **删除**。打分/状态机逻辑由本包 `scoring.py` + `decision.py` 取代（在引擎侧）。后端只留 `safety.py`（hold 2500 / cooldown 1500 / margin 0.12 / confidence 0.65 / health）。
2. `client/camera_capture.py` → **删除**。cv2 直开摄像头违反 Lock §4"OBS 独占 UVC"。`client/` 目录整个清空或归档到 `attic/`。
3. `frontend/` 的 `/ws/voice`、`/export/*` → 今天**不碰**。在 README 标记"V2 设计稿，与 v1.0 合同不符，7/26 之后再说"。Console 本周只消费 `GET /api/v1/state` + `WS /ws/v1/ui`。

规则：冲突代码不迁移、不"先留着"。留着的每一行都是明天 debug 时的假线索。

---

## 今天（7/23）· 目标 = Lock 的 EOD gate

**Ceaser（4060 笔记本，预算 3 小时）**

1. `git pull` 后把本包 `dolly-engine/` 放进 repo 根目录（结构与 README 一致）。
2. `pip install -r requirements.txt`（先不装 ultralytics）。
3. 双终端自测（5 分钟看到闭环，不依赖 Nero）：
   `uvicorn tools.mock_backend:app --port 8000` ＋ `python main.py --heuristic`
   看到 `*** OBS SWITCH ***` 即链路通。
4. 装 CUDA 版 torch + `ultralytics`，跑 `python -c "from perception import Perception; Perception()"` 确认模型加载 + 预热无报错。装不上也不慌——L1 heuristic 就是为此存在的，**今晚 gate 不依赖 YOLO**。
5. 对着 Nero 的真后端换掉 mock：`DOLLY_BACKEND_HOST=<OBS笔记本IP> python main.py`。发出 hello + 心跳 + 一条真 decision → Ceaser 今日五项任务全绿。

**Nero**：mock_backend.py 里的 WS 裁决逻辑（≈40 行）就是 `safety.py` 的最小参考实现——拒绝原因字符串格式可以直接抄进真后端，Console 显示会很好看。

**今晚 gate 判定不变**：mock JSON → 后端 → 真 OBS 切换 → UI → 日志。引擎这边其实已经超额：发的不是 mock JSON 而是真 JSON（heuristic 打分也是真帧真分）。

---

## 7/24 · 中午 gate + EOD 冻结

上午：4060 上切 model 模式，用真实机位帧对拍 heuristic vs YOLO 的分数差异；只允许调 `config.py` 里的权重/阈值，**不允许改代码结构**。
中午 gate：真帧 → YOLO 分 → JSON → 后端 → OBS 切换 → UI。
下午：录一段 3 机位排练素材存成 `frames/cam_*/NNNN.jpg`，从此 `python replay.py frames/` 就是回归测试——每次调参跑一遍，切换点位不对齐就回滚参数。
EOD gate：10 分钟连续运行，运行中零改码。**过线后引擎功能冻结**，只剩 config 调参和 bug 修复。

## 7/25 · 只做三件事

20 分钟压力跑；三次完整彩排（会场噪音 / 断外网 / 杀掉引擎进程验证 5 秒回广角 + 重连）；录备份 demo。第三项彩排就是本包 L1-L3 降级阶梯的实弹验收。

## 7/26 · 跑 tag 版本，什么都不更新

Railway 归档 + Vercel 回放页**只在** 20 分钟稳定跑达成且备份 demo 录完之后才动工（各 ≤2 小时，做不完就放弃，零损失）。

---

## 严苛条款（违反即回滚）

一、`config.py` CONTRACT 区任何改名 = 三人同意 + 群里通知，否则 revert。
二、引擎永远不直连 OBS、不直开摄像头、不在实时环里调 LLM。
三、任何 P0 红灯期间，所有人只修 P0 路径——README 的冲突 3（frontend V2 合同）明确属于"红灯期间禁止触碰"。
四、调参只改 `config.py`，每次调参必跑一次 `replay.py` 回归。
五、7/24 EOD 之后新增任何 .py 文件都要回答一个问题："这个文件不存在，demo 会失败吗？"答案不是"会"就不写。

---

## 本包文件清单

```
dolly-engine/
├── main.py         入口：fetcher tasks + 决策循环 + WS 客户端
├── config.py       v1.0 冻结合同 + 全部可调参数（唯一允许日常改动的文件）
├── fetcher.py      每路异步拉帧、帧龄、freshness、invalid
├── perception.py   YOLO 加载/预热/推理，失败→DegradeToHeuristic
├── heuristic.py    L1 降级打分（纯 OpenCV/CPU）
├── scoring.py      四子分 + 稳定性滑窗 + EMA + role bonus
├── decision.py     去抖 + reason 枚举 + director.decision 组装
├── ws_client.py    hello/heartbeat/decision + 指数退避重连 + 断线弃旧决策
├── replay.py       离线回放回归测试
├── tools/mock_backend.py   Nero 后端的 mock（合成帧 + WS 安全裁决）
├── ROADMAP.md      本文件
└── requirements.txt
```

已验证：语法全通过；heuristic 模式端到端闭环（含低置信度拒绝、hold、真实切换、断线重连路径均触发过）。model 模式代码路径相同，仅需在 4060 上装 ultralytics 后验证。
