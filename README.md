# 摸鱼派用户站（Vue 重构）

用户站 SPA，不含管理后台。后端仍为 [Rhythm](https://github.com/FishPiOffical/rhythm)。

```bash
npm install
npm run dev          # Express + Vite SSR（推荐）
npm run dev:spa      # 纯 CSR（无服务端渲染）
npm run build && npm run preview
npm run sitemap      # 生成 public/sitemap.xml
```

开发服务器固定 `http://127.0.0.1:5173`，占用时请先结束旧进程，不会自动换端口。

开发代理默认指向 `https://fishpi.cn`。若本地 Rhythm 在 `8080`，在 `.env.development` 设置：

```
VITE_API_TARGET=http://localhost:8080
VITE_SITE_ORIGIN=https://fishpi.cn
```

本站优先请求 Rhythm JSON；匿名列表/详情/搜索/领域/广告若 401 或 404，回退到 `src/api/catalog.mock.json` / `ads.mock.json`（字段与正式接口对齐）。登录后仍走真实 API。

### SEO / SSR

- 客户端：`@unhead/vue` 设置 title / description / og / canonical；帖子页输出 Article JSON-LD
- `public/robots.txt` 屏蔽登录态路由；`npm run sitemap` 拉近期帖生成站点地图
- 生产：`npm run build` 产出 `dist/client` + `dist/server`，`npm run preview` 走 Node SSR
- 公开内容路由（首页、帖子、用户主页、列表等）服务端 prefetch JSON 后 `renderToString`；聊天/设置等仅 CSR shell
- nginx：HTML 反代到 Node；`/api`、`/chat-room` 等仍指 Rhythm

## 已实现

- 顶栏 9 入口 / 首页三列 / 登录 / 聊天室
- 帖子列表、详情、评论、发帖/编辑、点赞/感谢、收藏/关注帖、打赏
- 标签、点赞列表、评论分页/删除、徽章
- 用户主页、关注/粉丝、签到/昨日活跃、通知分页、私信撤回
- 清风明月（可匿名）
- 资料编辑、头像/发帖图片上传、表情包、积分转账与流水
- 我的收藏、聊天室多类型红包/领取明细/撤回/@ 补全
- 主题、对话框、头像框：`src/packs` 目录包
- 广告位：`GET /api/ads` 映射现网 `headerBanner`→`home.top`、`sideFull`→`home.sidebar`（wwads），页脚赞助链仍用 mock
- 聊天室侧边栏模块化
- 帖子热度 `GET /api/article/heat/{id}` 与 `article-channel` 实时在看/新评
- 举报 `POST /report`（帖子/评论/用户）
- 复读机 `GET /api/repeater/items`、点赞
- 表情反应（帖子/评论/聊天室）`POST /article/reaction` 等
- 发帖草稿 `GET/POST/DELETE /api/article-drafts`
- 评论编辑/问答采纳、标签联想、Markdown 预览
- 首页随机帖 `GET /article/random/{size}`、公开日志、通知 `user-channel`
- 评论楼中楼、聊天室附近消息、公开职业/勋章列表
- 职业成长榜、最近注册、弹幕花费、聊天室消息原文
- 设置页表情分组（GET 列表，增删走现网 JSON，验证时不提交）
- 匿名可读：帖子列表/详情/搜索/领域/标签墙/问答 `GET /api/articles/qna`、优选 `GET /api/articles/perfect`
- 帖子正文目录（从正文 h1–h3 生成）
- 帖子修订历史 `GET /article/{id}/revisions/list|/{revisionId}`（需登录）
- 设置页职业主职/隐私 UI → `POST /api/profession/me/primary|privacy`（读 `GET /api/profession/me`；写操作经 `POST /__fp/page-auth` 换取 `sym-ce` + `csrfToken`）
- 积分余额 `GET /user/:name/point`；流水走 `GET /api/getNotifications?type=point`（现网无 apiKey 独立流水 JSON，OpenID 除外）
- 聊天室进房前预拉 `GET /chat-room/online-users`（在线列表/话题）
- 用户主页清风明月 `GET /api/user/{name}/breezemoons`（需登录）

闲聊室 `/idle-talk` 在现网 Rhythm 返回 404，暂不接页面。
用户发帖列表 / 收藏 / 关注粉丝 / 通知 / 私信：接口失败时返回空列表（不再塞 mock）。
SSR 另 prefetch：`/domains`、`/tags`、`/breezemoons`、`/top`、`/repeater`。
补齐页面：`/download`、`/agreement`、`/privacy`、`/activity`、`/following`、`/settings/point`、`/member/:name/medals`、`/city/:city`。

新增侧边栏模块：在 `src/chat/sidebar/modules` 加组件，并登记到 `registry.ts`。
