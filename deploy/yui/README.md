# yui.fishpi.cn 部署

使用服务器既有 Caddy 自动申请 HTTPS，独立 Node 24.12+ 运行时 `/opt/fishpi/runtime`，不替换服务器其他项目的 Node。将 Caddyfile 中的新域名块追加到服务器既有配置，验证通过后 reload，不能覆盖其他站点。

网站和反馈服务使用各自 systemd 系统用户，仅监听 127.0.0.1:5173/5174。发布产物位于 `/opt/fishpi/releases/<版本>`，`/opt/fishpi/current` 指向当前发布；反馈数据库独立保存在 `/var/lib/fishpi-feedback`，不随发布替换。源码和构建包不得包含 `.host`、环境文件、node_modules、本地 SQLite 或测试账号数据。

构建环境：`VITE_BROWSER_API_ORIGIN=https://fishpi.cn VITE_API_TARGET=https://fishpi.cn VITE_SITE_ORIGIN=https://yui.fishpi.cn VITE_FEEDBACK_ENABLED=true npm run build`。上传客户端/SSR构建、public、server.js、server/、package*.json、feedback-service/src及其package*.json；服务器两个目录分别 `npm ci`（网站运行时依赖vite的loadEnv，所以不能省devDependencies），使用独立运行时的PATH。

安装两个 `.service` 至 `/etc/systemd/system/`，创建对应系统用户并授予反馈用户数据库目录独占写权限。`/etc/fishpi-feedback.env` 由 root 管理、权限600，设置 `FEEDBACK_ADMIN_IDS=guest:开头的独立访客ID列表`；未设置时不开放管理权限，不自行指定管理员。启动 `systemctl enable --now fishpi-feedback fishpi-website`。

当前浏览器直连fishpi.cn的v3 HTTP/WebSocket，本站v3转发已关闭；SSR仍直接访问该站，必要经典资源保留代理。现网必须已部署v3且认可该域名的认证来源策略；404或来源拒绝不能靠回退旧API绕过。`/feedback-api/v1` 走网站开关代理至独立反馈服务，反馈仅核验本机签发的访客Cookie，不调用Rhythm；代理只转发fp_feedback_visitor，不转发站点Cookie或Bearer。

检查：HTTPS首页、静态资源、`/feedback-api/v1/health`、公开需求列表和v3端点。没有访客Cookie的写请求应401。禁止为部署验证写入真实需求或账号数据。

回滚：将current重新链接到保留的旧release，重启两个服务；数据库不回滚。如需恢复Caddy，使用更改前的备份并先validate再reload。日志：`journalctl -u fishpi-website -u fishpi-feedback`。数据库在线备份/导出/恢复见feedback-service/README.md，运行命令时使用反馈服务用户和独立运行时，备份不应放在public中。

## 2026-11-06 首次部署验收

发布目录：`/opt/fishpi/releases/20261106-015cd9a`。两个systemd服务均active并启用开机启动，端口仅回环监听；Let's Encrypt证书已签发。既有站点Caddy配置备份：`/etc/caddy/Caddyfile.before-fishpi-20261106-131408`。

生产构建与类型检查通过。公网HTTPS首页及抽查静态CSS 200，HTTP跳HTTPS 308；反馈health 200、公开列表200且为空、未登录提交401（未写入测试数据）；旧API 410。浏览器确认设置→需求反馈→查看需求列表正常打开弹窗。fishpi.cn及本站代理的captcha-options均404，登录和真实用户写操作未验收，不代表网站部署失败；需现网v3上线后复验身份恢复、来源策略和实时连接。

## 2026-11-06 更新至 fd9bb2c

当前发布目录切换为 `/opt/fishpi/releases/20261106-fd9bb2c`，保留上一版 `20261106-015cd9a` 供回滚，两个systemd服务均已重启并确认active。切换前在线备份为 `/var/lib/fishpi-feedback/backups/pre-fd9bb2c-20261106-140810.sqlite`，数据库路径及服务器管理员环境配置保持不变。上一版assets补入新发布以兼容已打开的旧页面。

生产完整构建通过；公网反馈health/公开列表及反馈页面200，抽查线上入口JS、共享chunk及HTTP模块与本地产物字节一致。浏览器确认新版分类页签、筛选区及设置内反馈弹窗；当前真实站点v3仍存在不可用情况并触发离线页，未执行登录、真实提交或投票。Caddy、上游fishpi.cn和证书配置未变；部署包排除.host和本地环境/数据库。

## 浏览器直连 Rhythm

生产构建设置 `VITE_BROWSER_API_ORIGIN=https://fishpi.cn`，浏览器HTTP和实时WebSocket直连fishpi.cn，不经过yui服务器v3代理；未设置时保留本地同源开发。SSR的读取仍使用VITE_API_TARGET，反馈浏览器API仍同源/feedback-api/v1，访客身份由反馈服务器本地执行。上传图床维持专用票据链路。需要fishpi.cn精确允许https://yui.fishpi.cn的CORS/OPTIONS、credentials及实际Authorization/Content-Type/Idempotency-Key等请求头，并允许WebSocket Origin；不使用no-cors、不伪造Origin、不将令牌放入URL。生产站点不再提供v3转发，旧缓存客户端访问本站/api/v3返回410提示刷新。

2026-11-06 直连版本 `03c8ddb` 已发布到 `/opt/fishpi/releases/20261106-03c8ddb`；前版fd9bb2c保留，反馈数据库在线备份pre-03c8ddb-20261106-152021.sqlite。Caddy原配置备份为/etc/caddy/Caddyfile.before-direct-03c8ddb，本站v3入口已验证410，反馈health 200。HTTP/刷新/重连/实时直连专项及既有离线身份、正文断流、通知、文章实时专项通过，完整构建通过。上线直连HTTP模块与本地字节一致。浏览器登录页/重连仍失败；现网captcha-options虽200 JSON但无Access-Control-Allow-Origin，登录OPTIONS 404，跨域尚未放行，登录及真实写未验收。反馈/me服务器核验仍受服务器到fishpi.cn网络可达性限制，未改变信任模型。

## 独立访客模式更新

需求服务改用本地访客Cookie，已移除Rhythm身份网络依赖。更新包含数据库迁移2（仅新增visitor_sessions表），旧需求与投票保留，不按昵称认领。生产FEEDBACK_COOKIE_SECURE=true；FEEDBACK_ADMIN_IDS需guest:开头的本地访客ID，旧站点UID不会获得权限。发布前使用旧版storage.ts在线备份，再切换current、安装新版feedback unit并重启两个服务。SSR代理现在只转发fp_feedback_visitor Cookie及其Set-Cookie，不转发Rhythm Bearer/Cookie。

后端类型检查及2组真实HTTP集成通过；前端API/Pinia和真实SSR访客Cookie代理通过；全量101专项通过，后续补测迟到401不影响新访客。完整构建通过。本机临时库浏览器验收未登录提交→详情→支持→刷新保留→改反对→撤销通过，未向线上写入测试需求。

2026-11-06 已发布访客版 `1d12de6` 至 `/opt/fishpi/releases/20261106-1d12de6`，前版03c8ddb保留。迁移前在线备份：`/var/lib/fishpi-feedback/backups/pre-1d12de6-20261106-161831.sqlite`；feedback unit已安装新版，两个服务active。公网/session建立与Cookie复用通过，Secure/HttpOnly/路径属性检查通过；空表单返回422而不是身份503，表明本地身份链路通过，未向生产创建测试需求。公开列表200，新版浏览器表单展示访客提示且无需登录。数据库迁移版本2、integrity_check正常。

2026-11-06 UI更新 `e6c66bf` 已发布至 `/opt/fishpi/releases/20261106-e6c66bf`，包含排行榜、主页、会员及信息流样式。生产完整构建通过，线上TopView CSS和入口JS等4项资源与本地字节一致，浏览器总榜分类及卡片展示正常。两个Node服务及Caddy active，反馈health 200，数据库integrity_check正常；上线前备份`/var/lib/fishpi-feedback/backups/pre-e6c66bf-20261106-163537.sqlite`，前版1d12de6保留用于回滚，访客数据和管理员配置不变。未改动上游、认证或SSR网络配置，未提交生产测试需求。
