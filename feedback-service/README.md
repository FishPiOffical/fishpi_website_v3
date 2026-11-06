# 公测需求反馈服务

独立 Node.js/TypeScript/Express 服务，不写 Rhythm 数据库。身份只通过固定 Rhythm `/api/v3/me` 核验；没有自己的账号或刷新 Cookie。需要 Node.js >= 24.12（使用内建 `node:sqlite` 和 TypeScript 类型擦除）。运行时不需要编译器，`npm run check` 独立检查类型。

## 本地运行

```sh
cd feedback-service
npm ci
cp .env.example .env
# 修改 .env 的 RHYTHM_ORIGIN 和 FEEDBACK_ADMIN_IDS
npm start
```

网站 `.env.development` 增加：

```dotenv
VITE_FEEDBACK_ENABLED=true
FEEDBACK_TARGET=http://127.0.0.1:5174
```

网站仍 `npm run dev`，固定 `127.0.0.1:5173`；`dev:spa` 也支持同样代理。入口位于左侧设置 → 需求反馈，含提需求与查看列表；两者打开同一反馈弹窗，列表、详情、提交和管理在弹窗内切换，不改变当前网页地址。支持 Escape、遮罩及关闭按钮退出，草稿和未确认操作保留在内存。独立 /feedback 路由保留用于直接链接访问。默认不启用，开关不是运行中远程配置：修改后必须重启开发服务、重新构建生产前端并重启 SSR。

服务 `.env` 中 `FEEDBACK_ENABLED=true` 才接受请求。`RHYTHM_ORIGIN` 必须是部署人员信任的真实认证服务，不能来自浏览器；只允许 HTTPS 或本机 HTTP。`FEEDBACK_ADMIN_IDS` 是逗号分隔的稳定 ID，空值意味着没有管理员。服务不信任提交内容中的身份字段。

## 生产部署

1. 独立运行 `npm ci --omit=dev && npm start`，使用进程管理器，默认仅监听 127.0.0.1:5174。
2. `FEEDBACK_DB` 指向持久卷中的数据库绝对路径。数据库、WAL、SHM 需同目录可写，限制目录访问权限；不要放在网站 public 或静态目录。
3. 网站构建时设置 `VITE_FEEDBACK_ENABLED=true`，SSR 同样设置该开关和 `FEEDBACK_TARGET`。采用根仓库 `docs/nginx.example.conf` 的反馈 location，经 SSR 执行开关后转发，不进入 Rhythm。
4. HTTPS 在 nginx 终止，保留浏览器 Host/Origin；不做跨域部署，不启用 CORS。代理不带 Cookie，只带必要请求头。限流信任本机代理提供的客户端地址；服务端口不公开，nginx 应覆盖 X-Forwarded-For，不能信任浏览器伪造值。
5. 建议监控 `/feedback-api/v1/health` 的状态和延时，日志只记路径/状态/耗时，不记录 Authorization、Cookie 或请求正文。

服务每分钟 IP 180 请求、用户创建 10 次、其他本人操作 90 次，超限 429；当前为单实例内存限流，重启清零。SQLite 面向低流量公测，水平扩容前应迁移数据库和集中限流。身份核验每次执行，不缓存 Bearer；Rhythm 故障 503，与 401 分开。

## 接口与数据

全部接口位于 `/feedback-api/v1`。GET `/requests` 接受 `page`（1 起）、`size`（1～50）、`q`（最多100字）、`category`、`status`、`sort=latest|support`；返回 `{items,page,size,total,pageCount}`。未指定 size 默认20，page默认1。搜索标题与说明。最多支持按支持数排序，再按创建时间与 ID 稳定排序。无结果 pageCount=0，客户端单独显示空状态。

GET `/requests/:id` 返回公开详情及票数，隐藏内容404；GET `/requests/:id/me` 需 Bearer，返回 `{vote,canModerate}`，管理员额外得到 `moderation`，可对隐藏需求恢复公开。普通用户和游客看不到投票者身份。

POST `/requests` 接受 `{title,category,description}`，标题5～100、说明10～5000字符；`category=feature|bug|experience`。正文保留换行、纯文本展示。PATCH `/requests/:id/moderation` 仅管理员，完整提交 `{status,note,hidden}`，note最多2000字符；`status=pending|planned|in_progress|done|declined`。

创建与管理必须带 `Idempotency-Key`（8～128位字母、数字、下划线或连字符）。按账号+key 唯一，固定方法/路径/内容指纹，重放返回原 `{id}`，内容变更409。命令和业务修改同事务保存。回执不是当前状态，客户端成功后GET。422在提交前验证，可修正文案；网络失败等不明结果保留原操作和键跨SPA恢复，退出清理，不跨整页刷新持久化。

PUT `/requests/:id/vote` 接受 `{choice:support|oppose|none}`，按用户ID唯一，明确设置而非toggle；票数当前查询，不维护容易漂移的缓存计数。所有写入需 Bearer，公开读取不带身份。错误为HTTP非2xx与 `{error}`；响应禁止缓存。

迁移由 `src/db.ts` 中版本表管理，首版为1。需求作者稳定ID保存在私有数据库，公开仅投影用户名/昵称快照，不代表当前资料。管理日志保留操作人ID、输入与时间；数据库和导出含身份数据，按私有数据管理。

## 备份、恢复、导出

在服务目录运行，存储工具不自动读 `.env`，请显式设置 `FEEDBACK_DB`。备份使用 SQLite 在线 backup，包含已提交的WAL数据；不能只复制正在运行的主库。备份目标使用新文件名。

```sh
FEEDBACK_DB=/srv/feedback/feedback.sqlite npm run backup -- /private/backup/feedback-2026-11-04.sqlite
FEEDBACK_DB=/srv/feedback/feedback.sqlite npm run export -- /private/backup/feedback.json
```

恢复：先停止服务，将旧数据库及同目录 `-wal/-shm` 移入备份目录，再恢复到不存在的目标（父目录需存在）。恢复工具验证备份完整性并拒绝覆盖。恢复后启动服务核对 health/列表/管理员权限。

```sh
FEEDBACK_DB=/srv/feedback/feedback.sqlite npm run restore -- /private/backup/feedback-2026-11-04.sqlite
```

JSON export 含版本、需求、投票和管理记录，不含Bearer/Cookie；幂等记录保留在数据库备份中，JSON仅用于业务迁移。迁入Rhythm时可保留公开API与稳定用户ID，替换前端 `src/feedback/api.ts` 的传输实现；不得把Bearer写进旧apiKey参数。

## 关闭和移除

同时关闭网站与服务开关并重启/重建：设置栏目消失、页面提示未启用、代理503。完整移除时删除反馈路由、设置栏目、`src/feedback`、反馈代理和本目录，先私下备份数据；不涉及Rhythm功能或数据。

## 验证

```sh
npm run check
npm test
```

测试只使用本机身份HTTP夹具与内存数据库，覆盖身份核验、Cookie不转发、伪造作者、幂等冲突、双用户改/撤票、并发唯一约束、分页筛选、管理权限、隐藏及恢复、限流和关闭。前端身份/幂等专项运行根目录 `node tools/feedback-test.mjs`；网站另运行根目录 `npx vue-tsc -b` 和 `npm run build`；真实部署的网络、账号、进程管理与持久卷需上线前核验。

本次本地验收：后端真实HTTP夹具专项、前端真实API/Pinia模块4组身份与恢复专项、类型检查及客户端/SSR双构建通过；浏览器验证设置两个入口、列表/详情、模拟账号提交、支持/反对/撤销、处理说明保存及关闭提示。后续改为弹窗后另验列表→详情→提交成功全过程地址不变、Escape关闭和入口焦点恢复。SQLite备份/恢复/导出命令及SPA代理启用/关闭均已实测。所有写入为本机内存库，没有真实账号或Rhythm业务写入；真实线上身份服务/权限、生产nginx与持久卷尚需部署验收。
