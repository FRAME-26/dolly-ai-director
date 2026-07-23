# 赛后云部署：Railway（归档）+ Vercel（展示/回放）— 非实时

> ⚠️ **范围说明**：本文件**只覆盖赛后非实时的云端部分**。
> 实时 demo 链路（后端 + AI 引擎 + Director Console）**全部跑在局域网的两台笔记本上**，
> 不上云、断网照跑。实时链路的本地部署见 `README.md` 的「本地实时部署」。
> 这里的 Railway / Vercel 只用于**归档、展示、只读回放**，挂了不影响 demo。

## 架构里云端的角色

| 云端 | 放什么 | 实时？ |
|---|---|---|
| Railway | `POST /archive/session` 上传 events.jsonl + 摘要；给 Vercel 回放页的只读 API | ❌ |
| Vercel | 项目展示页 / 提交材料页 / **只读** Session Replay（读 Railway） | ❌ |

本地 Director Console（React）由 OBS 笔记本**本地服务**，不部署在 Vercel——否则断网 Console 死，违反 Lock。
Vercel 上的是它的"只读回放兄弟页"（只消费日志，不碰直播）。

## Railway（归档 API）

1. 新建 Project → Deploy from GitHub → Root Directory = `backend/`。
2. Nixpacks 自动 `pip install -r requirements.txt`。
3. 启动命令（已有 `Procfile`）：`uvicorn app.main:app --host 0.0.0.0 --port $PORT`。
4. 仅实现归档相关路由（`/archive/session`、`/sessions/{id}`）。实时路由（帧中继 / `/ws/v1/engine`）
   在云端实例中不会收到局域网调用——可只暴露归档路由，或仅内部使用。
5. 生成域名，记下来给 Vercel 用。

> 注意：Railway 实例与现场 OBS 笔记本是**两个不同后端**。现场后端跑实时；Railway 后端只跑归档。
> 代码可共用 `backend/`，但路由职责不同。

## Vercel（展示 + 只读回放）

1. Import 仓库 → Root Directory = `frontend/`。
2. Framework = Vite，Build = `pnpm build`，Output = `dist`。
3. 环境变量 `VITE_DOLLY_API` = Railway 域名（仅回放页读 Railway 数据时需要；实时 Console 走本地）。
4. Deploy。绑定自定义域名可选。

## 与 systemd 方案关系

`deploy/dolly-backend.service` + `update_server.sh` 是**自托管 Linux** 备选，不是现场路径，也不是 Railway 路径。
Railway 在 git push 时自动部署。
