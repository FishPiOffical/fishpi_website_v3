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

浏览器登录后 apiKey 存 `localStorage.fp.apiKey`，刷新只调 `/api/user` 恢复，不再走 `/api/getKey`。脚本请复用缓存，勿反复密码登录：

```bash
# 把有效 apiKey 写入（或设 FP_API_KEY）
mkdir -p .fp-cache && echo '你的apiKey' > .fp-cache/api-key
npm run auth:check          # 只校验缓存，不调用 getKey
# FP_USER=x FP_PASS=y npm run auth:login   # 仅缓存失效时才密码登录一次
```

开发代理默认指向 `https://fishpi.cn`。若本地 Rhythm 在 `8080`，在 `.env.development` 设置：

```
VITE_API_TARGET=http://localhost:8080
VITE_SITE_ORIGIN=https://fishpi.cn
```

本站优先请求 Rhythm JSON；匿名列表/详情/搜索/领域若 401 或 404，回退到 `src/api/catalog.mock.json`。  
现网缺失的专用 JSON（首页专栏、背包读取、重置密码 meta 等）用 `src/api/gaps.mock.ts` 假数据，**不抓取现网 HTML**。清单见 [docs/MISSING_APIS.md](docs/MISSING_APIS.md)。广告位仅保留入口，不拉素材。

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
- 资料编辑、头像/发帖图片上传（RhyPic：`POST /api/rhypic/upload-ticket` → 直传图床）、表情包、积分转账与流水
- 我的收藏、聊天室多类型红包/领取明细/撤回/@ 补全
- 主题、对话框、头像框：`src/packs` 目录包
- 广告位：仅保留 `AdSlot` 入口（`home.top` / `home.sidebar` / `footer.sponsors`），暂不拉取素材
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
- 首页长篇双货架（最近更新 / 热门专栏）与社区清风明月发布（`POST /breezemoon` + page-auth CSRF）
- 搜索对齐现网 `GET /api/search?key=`；路由别名 `/column`、`/recent`、`/top/checkin|online|balance|consumption`
- 开发代理 SPA bypass：`/activity`、`/following`、`/breezemoons`、`/settings` 页面不再被 API 前缀吃掉
- 设置页侧栏对齐现网（资料/个性化/头像/账号/功能/积分/隐私/职业）；密码、地理位置、功能偏好走 page-auth CSRF
- 聊天室 UI：上方输入区（话题/红包/弹幕/清屏）+ 下方消息流；游客可浏览历史/在线

闲聊室 `/idle-talk` 现网 404，**明确不做**。管理后台不在本站范围（继续用 Rhythm FTL `/admin`）。
游戏入口：`/games`（官方小游戏跳转 Rhythm + 鱼游投稿）；VIP：`/vips`（积分开通 `/api/membership/*`）。
用户发帖列表 / 收藏 / 关注粉丝 / 通知 / 私信：接口失败时返回空列表（不再塞 mock）。
SSR 另 prefetch：`/domains`、`/tags`、`/breezemoons`、`/top`、`/repeater`。
补齐页面：`/download`、`/agreement`、`/privacy`、`/activity`、`/following`、`/settings/point`、`/member/:name/medals`、`/city/:city`、`/charge/point`、`/column/:id`。

新增侧边栏模块：在 `src/chat/sidebar/modules` 加组件，并登记到 `registry.ts`。
