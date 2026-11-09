# 公测需求反馈服务

独立 Node.js + TypeScript + Express + SQLite 服务，不写 Rhythm 数据库。提交与投票使用服务端生成的独立访客身份，审核由 Rhythm 授权。需要 Node.js >=24.12，运行时使用内建 node:sqlite 和 TypeScript 类型擦除。

## 运行和部署

```sh
cd feedback-service
npm ci
cp .env.example .env
npm start
```

本机 HTTP 开发设置 `FEEDBACK_COOKIE_SECURE=false`；生产 HTTPS 必须 true，默认 true。服务仅监听127.0.0.1:5174，`FEEDBACK_DB` 指向持久数据库绝对路径，目录权限限制为服务用户可读写。网站构建及SSR设置 `VITE_FEEDBACK_ENABLED=true`、`FEEDBACK_TARGET=http://127.0.0.1:5174`。设置→需求反馈打开弹窗，独立/feedback路由也保留。开关改变后需重启和重新构建，不启用时反馈API返回503。

反向代理保留真实Host、Origin和受信任客户端地址；所有写入必须有与本站Host匹配的Origin。代理仅转发独立 fp_feedback_visitor Cookie，站点 Cookie 不转发；只有审核接口允许转发 Authorization。响应只允许独立访客 Cookie 回传。SSR及SPA开发代理均已适配。服务端口不公开，TLS在Caddy/nginx终止。部署见deploy/yui/README.md。

## 访客身份及权限

首次提交或读取本人投票时POST `/feedback-api/v1/session`，服务端生成256位随机凭据，数据库只存SHA-256哈希。Cookie名fp_feedback_visitor，HttpOnly、SameSite=Strict、生产Secure，Path=/feedback-api/v1，有效期180天，不写localStorage。返回独立guest: ID和自动生成的展示昵称，不返回凭据正文。

同浏览器沿用同一Cookie投票，支持/反对互斥，可切换、撤销。清除Cookie、到期或更换浏览器会成为新访客，无法恢复原投票所有权；这是浏览器访客去重，不是实名或一人一票防作弊。会话创建、IP和用户写入限流仍生效。

自填displayName最多40字，仅作展示，未经站点身份认证，不影响真实作者ID、幂等主体或管理权限。站点登录/退出不影响访客草稿；访客401会清除旧身份未确认命令，新身份不能重放旧命令，草稿保留以便用户明确重新提交。普通网络失败保留冻结正文和幂等键，不自动重发写请求。

审核仅面向通过 Rhythm `GET https://fishpi.cn/api/v3/me` 核验的管理员。审核入口位于反馈弹窗，支持公开/隐藏筛选、处理状态、说明及隐藏/恢复。审核读写逐次向固定 Rhythm 地址核验第一方 Bearer，记录审核者为 `rhythm:<用户ID>`。公开读取、提交和投票沿用原访客模式；旧访客审核白名单不再授权。发布前先升级 Rhythm，再发布网站代理与反馈服务。

## 接口

统一前缀 `/feedback-api/v1`（独立服务版本号）。

| 方法和路径 | 用途 |
| --- | --- |
| POST /session | 建立或返回本浏览器访客身份 |
| GET /health | 数据库健康检查 |
| GET /requests | 公开分页、搜索、分类、状态、排序 |
| GET /requests/:id | 公开详情，隐藏需求404 |
| GET /requests/:id/me | 本访客投票，需访客 Cookie |
| POST /requests | 新建，需访客Cookie及幂等键 |
| PUT /requests/:id/vote | 明确设置support/oppose/none，需访客Cookie |
| GET /moderation/access | 核验当前审核权限，需站点 Bearer |
| GET /moderation/requests | 审核列表，支持 visibility=all/visible/hidden，需站点 Bearer |
| GET /moderation/requests/:id | 审核详情，含隐藏需求，需站点 Bearer |
| PATCH /moderation/requests/:id | 修改状态、说明和可见性，需站点 Bearer 及幂等键 |

列表page从1开始，size 1～50（默认20），q最多100字，category=feature/bug/experience，status=pending/planned/in_progress/done/declined，sort=latest/support。返回items/page/size/total/pageCount；合法空结果pageCount=0。

新建body包含title 5～100字、description 10～5000字、category以及可选displayName。正文纯文本，保留换行。管理完整提交status、note最多2000字及布尔hidden，记录审计。投票不公开投票者名单。创建和管理原内容重试使用原Idempotency-Key，改变正文同键返回409，事务保证命令及票数一致。

## 数据迁移、备份和恢复

当前迁移仅新增visitor_sessions表和migrations版本2，不删除旧需求、作者或投票；旧数据不会按昵称绑定到新访客。原始凭据不进数据库和日志，日志也不得记录Cookie、Authorization或提交正文。

```sh
FEEDBACK_DB=/var/lib/fishpi-feedback/feedback.sqlite npm run backup -- /private/backup/new-file.sqlite
FEEDBACK_DB=/var/lib/fishpi-feedback/feedback.sqlite npm run export -- /private/backup/export.json
```

备份使用SQLite在线backup，包含WAL已提交数据，目标必须不存在；不可只复制运行中的主库。完整数据库备份包含会话哈希、幂等记录和业务记录，恢复后可延续原Cookie。JSON导出仅含需求、投票和管理记录，不含会话哈希或Cookie，只用于业务迁移。

恢复先停服务，移走旧数据库及WAL/SHM，再执行（工具检查备份完整性且拒绝覆盖）：

```sh
FEEDBACK_DB=/var/lib/fishpi-feedback/feedback.sqlite npm run restore -- /private/backup/new-file.sqlite
```

迁入Rhythm时guest: ID不得当作真实站点UID导入，必须显式关联，不能按昵称推断。移除反馈时删除前端feedback目录、路由、设置入口、代理与服务，私下保留备份，不涉及Rhythm数据。

## 验证

`npm run check`、`npm test`覆盖本机真实HTTP及内存库：访客Cookie、伪造身份、两访客改票/撤票、并发去重、幂等恢复、分页、管理员权限、隐藏、会话到期、限流与关闭。根目录`node tools/feedback-test.mjs`检查实际API/Pinia，`node tools/v3-feedback-visitor-proxy-test.mjs`检查真实SSR代理只转发访客Cookie。完整构建和专项测试须顺序执行，测试启动生产SSR时依赖dist，不能与清理dist的构建并行。
