# Sites 本地认证兼容修复

## 已完成的脚本修复

用户授权修复本机 Sites 插件的源码同步兼容问题。本次修改安装目录 `sites/1.1.6/scripts/site-workflow.mjs`，没有修改或重签名 ChatGPT 应用，没有更改全局 Git 配置、登录状态和分享范围。

- 接受服务端实际返回的无令牌 `codex_auth`。
- 该模式保留宿主 `credential.helper`；`work_proxy` 和 `http_extra_header` 继续清除本机助手，防止误带其他凭据。
- `codex_auth` 仅允许当前 `https://chatgpt.com/backend-api/codex/sites/git/<project_id>` 仓库。
- 保留 HTTPS、禁止内嵌凭据/query/hash、过期检查、禁止重定向和网络 trace 清理。
- 错误输出支持无令牌模式，并清洗 Bearer、Basic 和传入的源码令牌。

本机安装原文的 SHA-256：`21a6404d0e3f5beeff4b95ca0f3bfc77cf2744806f4674a6893fd2a38dfef834`。

原文备份保存在独立工作区 `.temp/sites-auth-compat/site-workflow.original.mjs`。未删除原有注释或格式化其他代码。

## 复用补丁与验证

仓库保留补丁而不复制插件全部源码：

```sh
node tools/sites-auth-compat.mjs /Users/ling/.codex/plugins/cache/openai-curated-remote/sites/1.1.6
node tools/sites-auth-compat-test.mjs /Users/ling/.codex/plugins/cache/openai-curated-remote/sites/1.1.6/scripts/site-workflow.mjs
```

应用器检查版本、备份原文件，重复执行不会重复修改。插件更新后如果补丁不匹配，应检查新版实现，不能强制套用；缓存更新也可能覆盖本地补丁。

18 项回归在临时仓库完成，远端操作全部由本地 Git 包装夹具截获，包括源码提交、推送回执、HEAD 核对和静态打包。另验证补丁首次应用、重复运行、原文备份及与实际安装版本一致。

## 仍未解决的宿主认证

实际同步目前返回：

```json
{"detail":{"type":"missing_account_user_id","message":"Unable to determine account user id."}}
```

HTTP 状态为 400，没有 `WWW-Authenticate` 头。本机只发现系统 `osxkeychain` helper，没有 Sites 专用 helper；插件服务端的凭据说明要求由宿主提供该助手。当前桌面宿主内嵌 CLI 版本是 `0.167.0-alpha.4.1`。

这与原来的脚本拒绝 `auth_mode` 是独立问题。不能通过给请求随便填入用户 ID、清理现有登录、手工提取 Cookie/令牌或改成假 `work_proxy` 来解决。宿主补齐认证支持之前，不能宣称源码已同步或站点已发布，也不能用未推送的本地 SHA 保存版本。

固定站点和已验证素材保持不变。恢复时先取得同一个站点的源码凭据、打开现有源码，再同步打包和部署；见 [固定预览站](preview-site.md)。
