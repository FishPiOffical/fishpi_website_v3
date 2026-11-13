# 宠物固定预览站

用户要求后续宠物形象、动画等预览继续更新同一个 Sites 站点，不为每批素材新建站点。

- 名称：摸鱼派 · 宠物动画预览
- 唯一 `project_id`：`appgprj_6af681d53ea481918538a919f9137ece`
- 创建接口返回的预定地址：https://fishpi-pet-preview.singleforge.chatgpt.site
- 身份与导出源登记：[preview-site.json](preview-site.json)
- 当前源：荷小豚十个 256 × 256 透明 WebM 动作
- 访问范围：保留 Sites 创建时的仅本人访问；没有更改分享范围。

## 当前发布状态（2026-11-13）

**已创建站点，尚未发布成功。** `get_site` 复核 `latest_version_number=0`、`current_live_url=null`，预定地址不能作为已上线证明。

静态导出及浏览器检查已完成。发布被本机 Sites 源码同步兼容问题阻断：

1. Sites 创建及刷新源码凭据均返回 `auth_mode=codex_auth`，没有明文令牌。
2. 安装的 Sites 1.1.6 `site-workflow.mjs` 只接受 `work_proxy` 和 `http_extra_header`，拒绝当前返回的认证方式。
3. 使用返回的源码地址执行普通 `git ls-remote` 也返回 HTTP 400。没有读取或手工导出用户登录凭据，没有伪造其他认证方式。
4. 未同步源码，因此未调用保存版本或部署接口。后续修复本机插件/宿主兼容后，复用上面的 ID 继续同步和发布，不再调用 `create_site`。

本次独立导出目录：`/Users/ling/Documents/fishpi/website_v3-pet-next/.temp/sites/pet-preview`。其中 `.openai/hosting.json` 已原子写入固定站点 ID，目录内不包含网站运行配置、账号数据、测试数据或 `.host`。

已准备部署包：`/Users/ling/Documents/fishpi/website_v3-pet-next/.temp/sites/pet-preview.tar.gz`。它只用于本次预检查；真正发布前仍须将相同源码同步到 Sites，再重新打包并使用其完整提交 SHA。

## 后续更新

1. 读取此记录、`preview-site.json` 和独立站点的 `.openai/hosting.json`，确认 ID 一致。
2. 用 Sites `get_site` 读取当前站点及访问范围，获取同站点源码凭据；按插件流程打开已有源码，保留远端修改。
3. 生成新动画后维护原始预览页和素材清单；必要时更新 `preview-site.json` 的预览及素材路径，**保留 project_id 和站点地址**。
4. 从 website_v3 仓库运行：

   ```sh
   node tools/pet-preview-site-export.mjs /绝对路径/已打开的Sites源码目录
   PET_PREVIEW_SITE_DIR=/绝对路径/已打开的Sites源码目录 node tools/pet-animation-verify.mjs
   ```

   目前浏览器验证针对荷小豚十个动作；接入其他宠物时同步扩展验证清单，不能误报已覆盖新素材。

5. 用 Sites 源码工作流同步和打包，再按当前访问范围保存并部署同一个站点。只有部署成功返回的网址才作为上线结果交付。

导出脚本只复制清单列出的 WebM、WebP 和静态预览。媒体目录使用内容摘要；更换动作会生成新地址，避免用户继续播放旧缓存。默认只加载选中动作，点击全部对比才同时播放十个动作。

## 本次验证

- 10 个动作均可在 Chrome 播放、跳转和循环，透明像素检查通过。
- 390px 窄屏无横向溢出，128px 预览尺寸正确，动作切换及全部对比可用。
- 打包后的本地页面没有缺失资源和运行时异常。
- 视频总计 990040 字节；媒体加海报约 1.08 MiB。
- 线上播放因发布未完成尚未验证。未改变原站服务、Rhythm、宠物业务或正在运行的八小时检查。
