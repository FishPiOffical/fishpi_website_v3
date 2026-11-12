# new.fishpi.cn 部署（原 yui.fishpi.cn）

使用服务器既有 Caddy 自动申请 HTTPS，独立 Node 24.12+ 运行时 `/opt/fishpi/runtime`，不替换服务器其他项目的 Node。将 Caddyfile 中的新域名块追加到服务器既有配置，验证通过后 reload，不能覆盖其他站点。

网站和反馈服务使用各自 systemd 系统用户，仅监听 127.0.0.1:5173/5174。发布产物位于 `/opt/fishpi/releases/<版本>`，`/opt/fishpi/current` 指向当前发布；反馈数据库独立保存在 `/var/lib/fishpi-feedback`，不随发布替换。源码和构建包不得包含 `.host`、环境文件、node_modules、本地 SQLite 或测试账号数据。

构建环境：`VITE_BROWSER_API_ORIGIN=https://fishpi.cn VITE_API_TARGET=https://fishpi.cn VITE_SITE_ORIGIN=https://new.fishpi.cn VITE_FEEDBACK_ENABLED=true npm run build`。上传客户端/SSR构建、public、server.js、server/、package*.json、feedback-service/src及其package*.json；服务器两个目录分别 `npm ci`（网站运行时依赖vite的loadEnv，所以不能省devDependencies），使用独立运行时的PATH。

安装两个 `.service` 至 `/etc/systemd/system/`，创建对应系统用户并授予反馈用户数据库目录独占写权限。`/etc/fishpi-feedback.env` 由 root 管理、权限600。反馈审核权限来自 Rhythm 的 `/api/v3/me`，先上线 Rhythm 的 `isAdmin` 字段。启动 `systemctl enable --now fishpi-feedback fishpi-website`。

当前浏览器直连fishpi.cn的v3 HTTP/WebSocket，本站v3转发已关闭；SSR仍直接访问该站，必要经典资源保留代理。现网必须已部署v3且认可该域名的认证来源策略；404或来源拒绝不能靠回退旧API绕过。`/feedback-api/v1` 走网站开关代理至独立反馈服务，提交、投票仅核验本机访客 Cookie。只有审核路径转发 Bearer，反馈服务向固定 Rhythm 地址逐次核验权限，站点 Cookie 不转发。

检查：HTTPS首页、静态资源、`/feedback-api/v1/health`、公开需求列表和v3端点。没有访客Cookie的写请求应401。禁止为部署验证写入真实需求或账号数据。

回滚：将current重新链接到保留的旧release，重启两个服务；数据库不回滚。如需恢复Caddy，使用更改前的备份并先validate再reload。日志：`journalctl -u fishpi-website -u fishpi-feedback`。数据库在线备份/导出/恢复见feedback-service/README.md，运行命令时使用反馈服务用户和独立运行时，备份不应放在public中。

## 2026-11-06 首次部署验收

发布目录：`/opt/fishpi/releases/20261106-015cd9a`。两个systemd服务均active并启用开机启动，端口仅回环监听；Let's Encrypt证书已签发。既有站点Caddy配置备份：`/etc/caddy/Caddyfile.before-fishpi-20261106-131408`。

生产构建与类型检查通过。公网HTTPS首页及抽查静态CSS 200，HTTP跳HTTPS 308；反馈health 200、公开列表200且为空、未登录提交401（未写入测试数据）；旧API 410。浏览器确认设置→需求反馈→查看需求列表正常打开弹窗。fishpi.cn及本站代理的captcha-options均404，登录和真实用户写操作未验收，不代表网站部署失败；需现网v3上线后复验身份恢复、来源策略和实时连接。

## 2026-11-06 更新至 fd9bb2c

当前发布目录切换为 `/opt/fishpi/releases/20261106-fd9bb2c`，保留上一版 `20261106-015cd9a` 供回滚，两个systemd服务均已重启并确认active。切换前在线备份为 `/var/lib/fishpi-feedback/backups/pre-fd9bb2c-20261106-140810.sqlite`，数据库路径及服务器管理员环境配置保持不变。上一版assets补入新发布以兼容已打开的旧页面。

生产完整构建通过；公网反馈health/公开列表及反馈页面200，抽查线上入口JS、共享chunk及HTTP模块与本地产物字节一致。浏览器确认新版分类页签、筛选区及设置内反馈弹窗；当前真实站点v3仍存在不可用情况并触发离线页，未执行登录、真实提交或投票。Caddy、上游fishpi.cn和证书配置未变；部署包排除.host和本地环境/数据库。

## 浏览器直连 Rhythm

生产构建设置 `VITE_BROWSER_API_ORIGIN=https://fishpi.cn`，浏览器HTTP和实时WebSocket直连fishpi.cn，不经过yui服务器v3代理；未设置时保留本地同源开发。SSR的读取仍使用VITE_API_TARGET，反馈浏览器API仍同源/feedback-api/v1，访客身份由反馈服务器本地执行。上传图床维持专用票据链路。需要fishpi.cn精确允许https://new.fishpi.cn的CORS/OPTIONS、credentials及实际Authorization/Content-Type/Idempotency-Key等请求头，并允许WebSocket Origin；不使用no-cors、不伪造Origin、不将令牌放入URL。生产站点不再提供v3转发，旧缓存客户端访问本站/api/v3返回410提示刷新。

2026-11-06 直连版本 `03c8ddb` 已发布到 `/opt/fishpi/releases/20261106-03c8ddb`；前版fd9bb2c保留，反馈数据库在线备份pre-03c8ddb-20261106-152021.sqlite。Caddy原配置备份为/etc/caddy/Caddyfile.before-direct-03c8ddb，本站v3入口已验证410，反馈health 200。HTTP/刷新/重连/实时直连专项及既有离线身份、正文断流、通知、文章实时专项通过，完整构建通过。上线直连HTTP模块与本地字节一致。浏览器登录页/重连仍失败；现网captcha-options虽200 JSON但无Access-Control-Allow-Origin，登录OPTIONS 404，跨域尚未放行，登录及真实写未验收。反馈/me服务器核验仍受服务器到fishpi.cn网络可达性限制，未改变信任模型。

## 独立访客模式更新

需求服务改用本地访客Cookie，已移除Rhythm身份网络依赖。更新包含数据库迁移2（仅新增visitor_sessions表），旧需求与投票保留，不按昵称认领。生产FEEDBACK_COOKIE_SECURE=true；FEEDBACK_ADMIN_IDS需guest:开头的本地访客ID，旧站点UID不会获得权限。发布前使用旧版storage.ts在线备份，再切换current、安装新版feedback unit并重启两个服务。SSR代理现在只转发fp_feedback_visitor Cookie及其Set-Cookie，不转发Rhythm Bearer/Cookie。

后端类型检查及2组真实HTTP集成通过；前端API/Pinia和真实SSR访客Cookie代理通过；全量101专项通过，后续补测迟到401不影响新访客。完整构建通过。本机临时库浏览器验收未登录提交→详情→支持→刷新保留→改反对→撤销通过，未向线上写入测试需求。

2026-11-06 已发布访客版 `1d12de6` 至 `/opt/fishpi/releases/20261106-1d12de6`，前版03c8ddb保留。迁移前在线备份：`/var/lib/fishpi-feedback/backups/pre-1d12de6-20261106-161831.sqlite`；feedback unit已安装新版，两个服务active。公网/session建立与Cookie复用通过，Secure/HttpOnly/路径属性检查通过；空表单返回422而不是身份503，表明本地身份链路通过，未向生产创建测试需求。公开列表200，新版浏览器表单展示访客提示且无需登录。数据库迁移版本2、integrity_check正常。

2026-11-06 UI更新 `e6c66bf` 已发布至 `/opt/fishpi/releases/20261106-e6c66bf`，包含排行榜、主页、会员及信息流样式。生产完整构建通过，线上TopView CSS和入口JS等4项资源与本地字节一致，浏览器总榜分类及卡片展示正常。两个Node服务及Caddy active，反馈health 200，数据库integrity_check正常；上线前备份`/var/lib/fishpi-feedback/backups/pre-e6c66bf-20261106-163537.sqlite`，前版1d12de6保留用于回滚，访客数据和管理员配置不变。未改动上游、认证或SSR网络配置，未提交生产测试需求。

2026-11-06 最新 UI `0d5f39b` 已发布至 `/opt/fishpi/releases/20261106-0d5f39b`，包含紧凑积分流水、收支标识、轻量刷新按钮及此前聊天界面调整。完整生产构建通过，积分页 JS/CSS 公网字节与本地产物一致，`/points` 和反馈 health 均 200，两个服务 active。切换前已在线备份反馈数据库（`backups/pre-20261106-0d5f39b-*.sqlite`），保留前版 e6c66bf 与旧 assets。未修改 Caddy、认证或防火墙；此前部署机访问 fishpi.cn 超时的 SSR 上游网络问题仍需独立处理，不能视为本次部署已修复。未执行生产账号或需求写入。

2026-11-07 已发布 `d7aa1ca` 至 `/opt/fishpi/releases/20261107-d7aa1ca`，包含精简签到、个人中心共用资料卡，以及 cardBg/userPoint/onlineMinute 的客户端与 SSR 适配。完整生产构建通过，公网签到和个人页 JS/CSS、包含共用资料卡的入口 JS 均与本地产物一致；`/points`、`/member/xysheep/medals` 和反馈 health 返回 200，两个服务 active。切换前已在线备份反馈数据库（`backups/pre-20261107-d7aa1ca-*.sqlite`），前版 20261106-0d5f39b 和旧 assets 保留。发布时 fishpi.cn 公开资料仍为原六字段，真实背景及公开统计需 Rhythm 对应更新上线；本次发布目标为 yui 网站与反馈服务。

## 2026-11-07 更新至 29559aa

已发布至 `/opt/fishpi/releases/20261107-29559aa`，包含首页五分钟公开数据缓存、统一清风侧栏、个人中心子页精简、鱼游改版及设置页统一排版。按本文生产变量完整构建，反馈服务类型检查通过；发布前的全量 106 项本机专项通过。网站与需求反馈服务分别安装锁定依赖并重启，Caddy 配置及上游保持不变，浏览器继续直连 fishpi.cn v3。

切换前反馈数据库在线备份为 `/var/lib/fishpi-feedback/backups/pre-20261107-29559aa-1793988294.sqlite`；当前数据库 `integrity_check` 为 ok，前版 `20261107-d7aa1ca` 和旧静态资源保留供回滚及旧页面使用。数据库、管理员环境配置与访客数据未替换，部署包未包含 `.host`。

公网首页、`/games`、`/settings`、`/member/Yui/medals`、反馈 health 及公开列表均返回 200。入口 JS、SettingsView 与 GamesView 的 JS/CSS 共五项资源与本地字节一致；浏览器确认新版设置分组、鱼游引导区、十个经典入口和二十条首屏社区卡片，无运行警告或错误。网站、反馈及 Caddy 均 active。服务器直读 SSR 已能返回内容，连续缓存命中样本约 0.03 秒；不代表所有用户访问时延保证。未执行真实账号登录、投票、提交需求或其他生产写入。

## 2026-11-07 前端更新至 a85489f

仅发布 website 至 `/opt/fishpi/releases/20261107-a85489f`，current 已切换，保留前版 `20261107-a4abefd` 与旧 assets 供回滚及已打开页面使用。按生产直连变量完成类型检查及客户端/SSR构建，仅重启 fishpi-website；feedback-service 从线上前版原样复制，反馈进程 PID 保持不变，数据库与环境配置未修改。未部署 Rhythm、未执行其数据库迁移。部署包未包含 .host 或环境文件。

公网首页、/cr、/games 与反馈 health 均为200；入口JS及三个共享模块与本地产物字节一致。浏览器确认新版紧凑首页、真实文章和排行正常显示。聊天外观新接口仍需 Rhythm 对应版本上线后才能保存，升级前历史无快照显示默认；未执行生产账号写入测试。

## 2026-11-07 前端更新至 1da4c4c

发布至 `/opt/fishpi/releases/20261107-1da4c4c`，包含经典首页默认布局、公共页面网络故障保留与重试、并发公共列表GET合并、聊天室输入区收起、专栏排版/本地阅读进度，以及此前私信窗口、自动已读、标题移除与游戏原图标修复。生产变量保持浏览器直连 https://fishpi.cn v3；完整类型/客户端/SSR构建通过。

只重启 fishpi-website；反馈服务从前版原样保留，进程PID未变，health正常，数据库与环境未修改；未部署Rhythm或执行其迁移。前版 `/opt/fishpi/releases/20261107-a85489f` 和旧assets保留可回滚。包内不包含.host或本地环境文件。

公网首页、/games、/column、/chat、反馈health均200；入口/共享模块及GamesView、ArticleListView、HomeView和两项原游戏图标共7项资源与本地字节一致。原始首页HTML确认经典默认，浏览器加载后显示60条文章链接、无读取告警或控制台错误；游戏10个原图标全部加载且保持新标签页。未执行生产登录、私信已读/发送、领取、投票或需求写入。


## 2026-11-12 发布 main 并迁移域名

main 应用提交 `0a16bc3` 已按新域名生产变量构建并发布至 `/opt/fishpi/releases/20261112-0a16bc3-new`。前版 `/opt/fishpi/releases/20261112-693ff3e` 及旧 assets 保留。只重启网站，反馈目录从前版原样复制，反馈进程 PID 1209600 未变，数据库与环境文件未修改；未部署 pet 分支或 Rhythm。

Caddy 主站改为 `new.fishpi.cn`，旧 `yui.fishpi.cn` 以 301 保留路径/查询跳转新域名。其他站点配置保持；Caddy validate 通过，Let's Encrypt 证书已签发。网站 systemd 的 VITE_SITE_ORIGIN 同步更新。备份分别为 `/etc/caddy/Caddyfile.before-new-20261112-0a16bc3` 和 `/etc/systemd/system/fishpi-website.service.before-new-20261112-0a16bc3`。

公网首页、登录、聊天室和反馈 health 为 200；首页 canonical 为 https://new.fishpi.cn/，入口 JS、两项共享模块及 v3-realtime 模块与本地产物字节一致。桌面 Chrome 与 iPhone 13 尺寸模拟均显示 72 个文章链接，无 pageerror；浏览器带 credentials 的跨域 captcha-options 返回 200/code 0，刷新预检允许新 Origin。网站、反馈与 Caddy 均 active。未登录真实账号，未验证新域名上的认证 WebSocket/付费/写入操作，也未进行手机真机验收。

完整生产构建通过。服务器 npm ci 的 jsdom/w3c-xmlserializer 测试依赖提示 Node 24.12 低于其 24.15 要求；网站运行检查正常，本次没有扩大范围升级共享服务器运行时。


### 旧域名退役

2026-11-12 用户确认旧域名 DNS 已删除，随后从服务器和部署模板移除 `yui.fishpi.cn` 站点/301跳转块，仅保留 `new.fishpi.cn`。Caddy 配置验证及 reload 成功，新域名首页 200；未修改 DNS 平台记录。更改前配置备份为 `/etc/caddy/Caddyfile.before-remove-yui-20261112`。
