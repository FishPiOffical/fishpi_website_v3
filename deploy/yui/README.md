# yui.fishpi.cn 部署

使用服务器既有 Caddy 自动申请 HTTPS，独立 Node 24.12+ 运行时 `/opt/fishpi/runtime`，不替换服务器其他项目的 Node。将 Caddyfile 中的新域名块追加到服务器既有配置，验证通过后 reload，不能覆盖其他站点。

网站和反馈服务使用各自 systemd 系统用户，仅监听 127.0.0.1:5173/5174。发布产物位于 `/opt/fishpi/releases/<版本>`，`/opt/fishpi/current` 指向当前发布；反馈数据库独立保存在 `/var/lib/fishpi-feedback`，不随发布替换。源码和构建包不得包含 `.host`、环境文件、node_modules、本地 SQLite 或测试账号数据。

构建环境：`VITE_API_TARGET=https://fishpi.cn VITE_SITE_ORIGIN=https://yui.fishpi.cn VITE_FEEDBACK_ENABLED=true npm run build`。上传客户端/SSR构建、public、server.js、server/、package*.json、feedback-service/src及其package*.json；服务器两个目录分别 `npm ci`（网站运行时依赖vite的loadEnv，所以不能省devDependencies），使用独立运行时的PATH。

安装两个 `.service` 至 `/etc/systemd/system/`，创建对应系统用户并授予反馈用户数据库目录独占写权限。`/etc/fishpi-feedback.env` 由 root 管理、权限600，设置 `FEEDBACK_ADMIN_IDS=稳定用户ID列表`；未设置时不开放管理权限，不自行指定管理员。启动 `systemctl enable --now fishpi-feedback fishpi-website`。

Caddy `/api/v3` HTTP/WebSocket 和必要经典资源均反代 HTTPS fishpi.cn，SSR同样直接访问该站，上游Host为fishpi.cn以匹配其虚拟主机，实际浏览器域名由X-Forwarded-Host保留，Origin/Referer原样传递，不伪造第一方来源。现网必须已部署v3且认可该域名的认证来源策略；404或来源拒绝不能靠回退旧API绕过。`/feedback-api/v1` 走网站开关代理至独立反馈服务，反馈仅以Bearer核验 fishpi.cn/api/v3/me，不转发Cookie。

检查：HTTPS首页、静态资源、`/feedback-api/v1/health`、公开需求列表和v3端点。未登录POST应401。禁止为部署验证写入真实需求或账号数据。

回滚：将current重新链接到保留的旧release，重启两个服务；数据库不回滚。如需恢复Caddy，使用更改前的备份并先validate再reload。日志：`journalctl -u fishpi-website -u fishpi-feedback`。数据库在线备份/导出/恢复见feedback-service/README.md，运行命令时使用反馈服务用户和独立运行时，备份不应放在public中。

## 2026-11-06 首次部署验收

发布目录：`/opt/fishpi/releases/20261106-015cd9a`。两个systemd服务均active并启用开机启动，端口仅回环监听；Let's Encrypt证书已签发。既有站点Caddy配置备份：`/etc/caddy/Caddyfile.before-fishpi-20261106-131408`。

生产构建与类型检查通过。公网HTTPS首页及抽查静态CSS 200，HTTP跳HTTPS 308；反馈health 200、公开列表200且为空、未登录提交401（未写入测试数据）；旧API 410。浏览器确认设置→需求反馈→查看需求列表正常打开弹窗。fishpi.cn及本站代理的captcha-options均404，登录和真实用户写操作未验收，不代表网站部署失败；需现网v3上线后复验身份恢复、来源策略和实时连接。
