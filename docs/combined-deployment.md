# 前台与管理后台联合部署

2026-11-15：用户授权将独立 Backend 项目部署到 `https://new.fishpi.cn/manage/`。管理后台仍在独立仓库维护，本站不复制其业务代码。

## 发布结构

- 前台：main `94e8a70`（PR #1 合并，含凭据队列身份复核修复）。
- 后台：`/Users/ling/Documents/GitHub/backend`，`e7e54e2`。
- 当前发布：`/opt/fishpi/releases/20261115-94e8a70-admin-e7e54e2`。
- `/opt/fishpi/current` 一次切换两个产物；前台仍由 fishpi-website 服务运行，后台 dist 放在发布目录的 manage/，由 Caddy 提供。
- 后台构建：`VITE_BASE_PATH=/manage/ VITE_API_BASE_URL=https://fishpi.cn npm run build`。
- 前台构建：`VITE_BROWSER_API_ORIGIN=https://fishpi.cn VITE_API_TARGET=https://fishpi.cn VITE_SITE_ORIGIN=https://new.fishpi.cn VITE_FEEDBACK_ENABLED=true npm run build`。
- 发布只包含 dist、public、server.js、server、package.json、package-lock.json 和后台 manage；不上传凭据或开发环境文件。npm ci 使用服务器既有 Node24 运行时。
- 保留旧前台哈希资源及 feedback-service，反馈服务未重启。后续更新还应合并旧 manage/assets，避免已打开后台的懒加载资源失效。

## Caddy 路由

只在 new.fishpi.cn 站点增加下列路由，保留其他域名及现有 API、上传、验证码规则：

```caddy
redir /manage /manage/ 308
handle_path /manage/* {
    root * /opt/fishpi/current/manage
    @assets path /assets/*
    handle @assets {
        header Cache-Control "public, max-age=31536000, immutable"
        file_server
    }
    handle {
        header Cache-Control "no-cache"
        try_files {path} /index.html
        file_server
    }
}
```

管理 API 继续浏览器直连 fishpi.cn，由原后端验证身份和权限；本站 `/api/v3/*` 仍返回410。上线静态页面不意味着授予管理权限。

## 验证与限制

- 前后台构建通过；后台 configuration、asset-recovery 两项测试通过。
- 首页、/manage/、/manage/workbench 返回200；/manage返回308；缺失后台JS返回404。线上后台入口JS/CSS与本地构建逐字节相同。
- fishpi-website、fishpi-feedback、caddy 均 active，前台重启日志无启动异常。
- Chrome 显示后台登录页；390×844 浏览器登录页无横向溢出；前台首页内容正常渲染。
- 尚未登录管理员验收权限矩阵、真实管理数据和写操作；不据此宣称所有后台功能可用。
- PR相关专项通过；全量仍有17个与原main共现的失败文件，见 v3-captcha-flow.md。真实极验验收、线上登录互通与真实WebSocket本次未重跑。

## 回滚

上一发布 `/opt/fishpi/releases/20261114-df3b93b`，Caddy备份 `/etc/caddy/Caddyfile.before-combined-20261115`。将 current 原子切回上一目录、恢复该Caddy备份并校验、重启 fishpi-website、reload caddy。首次部署后台的回滚会撤下 /manage/；不重启或改写反馈数据。
