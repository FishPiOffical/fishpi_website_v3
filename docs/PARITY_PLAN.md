# 与现网 Rhythm 差异及开发计划

对比基准：Rhythm 经典皮肤 `skins/classic/pc/*.ftl` 与 Java 路由，对照本站 `src/router/index.ts` 和各 View。  
范围外（不做）：管理后台 `admin/*`、闲聊室 `/idle-talk`、广告素材。  
依赖后端的部分见 `docs/BACKEND_API_REQUESTS.md`。

---

## 一、缺失页面（现网有路由，本站没有）

| 现网路径 | 模板 | 说明 | 计划阶段 |
|----------|------|------|----------|
| `/member/{u}/comments`、`/comments/anonymous` | `home/comments.ftl` | 用户评论列表 | P0 |
| `/member/{u}/breezemoons` | `home/breezemoons.ftl` | 用户清风明月（本站仅主页 tab 内嵌） | P0 |
| `/member/{u}/following/users`、`/following/tags`、`/following/articles` | `home/following-*.ftl` | 关注的人 / 标签 / 帖子 | P0 |
| `/member/{u}/watching/articles` | `home/watching-articles.ftl` | 关注中的帖子 | P0 |
| `/member/{u}/articles/anonymous` | `home/home.ftl` | 匿名帖 | P1 |
| `/member/{u}/long` | `home/home.ftl` | 用户长篇 | P1 |
| `/member/{u}/points` | `home/points.ftl` | 公开积分记录 | P1 |
| `/member/{u}/profession` | `home/profession.ftl` | 职业页（本站仅 tab） | P1 |
| `/activities`（鱼游） | `home/activities.ftl`、`fish-game.ftl` | 鱼游列表 | P2（等后端） |
| `/column/manage` | `home/column-manage.ftl` | 专栏管理（封面/章节） | P1 |
| `/breezemoon/{id}` | `breezemoon.ftl` | 单条清风明月详情 | P0 |
| `/forward?goto=` | `forward.ftl` | 外链跳转确认页 | P0 |
| `/cr/raw/{id}` | `raw.ftl` | 聊天消息原文 | P0 |
| `/watch`、`/watch/users`、`/watch/breezemoons` | `watch.ftl` | 关注动态流 | P1 |
| `/recent/reply` | `recent.ftl` | 最近回复排序 | P1 |
| `/recent/hot`、`/recent/good` | `recent.ftl` | 本站为 `/hot`、`/good`，需加别名 | P0 |
| `/pre-post` | `home/pre-post.ftl` | 发帖前选择类型 | P1 |
| `/milestones`、`/milestones/submit` | `milestones.ftl` | 里程碑 | P2 |
| `/shop` | `shop/index.ftl` | 商城 | P2 |
| `/statistic` | `statistic.ftl` | 数据统计 | P2 |
| `/guide` | `verify/guide.ftl` | 新用户引导 | P2 |
| 错误页 401 / 403 / 500 | `error/*.ftl` | 本站只有 404 | P1 |
| ~~`/activity/1A0001`、`/activity/2048`~~ | `activity/*.ftl` | 现网路由已注释或不存在，不做 | — |

---

## 二、已有页面的功能缺口

### 发帖 `PostView`（P0，差距最大）

- 编辑器只是 `<textarea>`，现网使用 Vditor：实时预览、粘贴/拖拽上传、`@` 用户补全、表情、全屏。
- 缺少字段：`articleRewardContent` / `articleRewardPoint`（打赏内容）、`articleAnonymous`（匿名）、`articleNotifyFollowers`、`articleShowInList`、`articleCommentable`、`articleStatement`（声明）。
- 缺少长篇发帖（`long-article-post.ftl`：章节、封面、段落）。

### 帖子详情 `ArticleView`（P1）

已有：目录、修订历史、打赏、感谢、收藏、关注、举报、采纳、表情回应、热度。  
缺少：

- 评论排序（`commentSort`）与评论分页
- 相关帖子 / 随机帖子侧栏
- 上一篇 / 下一篇导航（`article-adjacent-nav.ftl`）
- 长篇章节导航
- 分享
- 音频朗读（`articleAudioURL`）
- 置顶操作（`Article.stick`）
- 评论框只是 `<textarea>`，缺少编辑器、表情面板、`@` 补全

### 首页 `HomeView`（P1）

- 缺少昨日活跃奖励图（`yesterday`）、签到状态（`checkedInStatus`）、夜间提示（`nightTips`）、排行列（`indexRankCol`）。
- 专栏货架为假数据（等后端）。

### 个人主页 `MemberView`（P0）

只有 4 个 tab（帖子、清风明月、勋章、职业）。需按现网补齐子路由导航：评论、关注、粉丝、关注标签、关注帖子、长篇、积分、匿名，并改成可直达的 URL。

### 其他

| 页面 | 缺口 | 阶段 |
|------|------|------|
| `BreezemoonView` | 缺少单条详情、删除、评论链接 | P0 |
| `NotificationsView` | 7 类通知已覆盖；需核对各类型富文本渲染与跳转 | P1 |
| `WhisperView` | 只有发送；缺少图片、表情、撤回、已读状态 | P1 |
| `GamesView` | 通过 `window.location` 跳转到 `/games/*`、`/activity/*`，本站部署时**需要反向代理到 Rhythm**，否则会 404 | P0 |
| `ActivityView` | 内容较少，需对齐现网活动页 | P2 |

---

## 三、开发计划

### 第 1 期（P0）：补齐断点和高频路径 — 已完成

1. ✅ 路由别名：`/recent/hot`、`/recent/good`。
2. ⛔ `/forward`：现网 `Router.java` 已注释停用，不做。
   ✅ 单条清风明月：现网路径为 `/member/{u}/breezemoons/{id}`，并入个人主页（定位并高亮）。
   ✅ `/cr/raw/{id}`：现网即 Rhythm 页面，开发代理已转发，生产见 `docs/nginx.example.conf`。
3. ✅ 部署代理方案：`docs/nginx.example.conf`（游戏、活动、原文、WebSocket 等）。
4. ✅ `MemberView` 改为路由驱动，按现网分「发布 / 关注 / 积分」三组共 12 个子页；无 JSON 的子页显示待开放提示，接口需求见 `BACKEND_API_REQUESTS.md` 第 11 节。旧 `/member/{u}/following` 重定向到 `/following/users`，删除 `PeopleView`。
5. ✅ `PostView` 接入 Vditor（与现网同 CDN，失败回退 textarea），补齐类型（帖子/机要/同城广播/问答）、打赏内容与积分、匿名、在列表展示、允许回帖、通知关注者、创作声明。
   顺带修复：编辑帖子时 `/api/article/md` 实为纯文本导致加载失败；更新帖子会把回帖/匿名/打赏设置重置为默认值。

### 第 2 期（P1）：详情页和互动体验 — 已完成（部分等后端）

1. `ArticleView`
   - ✅ 评论分页：原先页数读错位置（`pagination` 在接口 `data` 层），分页从未显示；翻页不再清空正文。
   - ✅ 长文章专栏链接、第 N/M 章、上一章/下一章（`longArticleColumnView`）。
   - ✅ 类型/悬赏/置顶剩余标记、创作声明、音频、分享（复制带 `?r=` 链接、微博、Twitter）、「随便看看」随机帖。
   - ✅ 评论框换成 Vditor（`@` 提示、上传、Ctrl+Enter），关闭回帖时显示提示；编辑器跟随暗色主题。
   - ⏳ 评论排序、相关帖子、普通帖上一贴/下一贴、置顶操作：现网接口不支持，见 `BACKEND_API_REQUESTS.md` 第 14–16 节。
2. ✅ `/pre-post` 类型选择（顶栏「发帖」改到这里）；✅ `/post/long` 长文章发帖（专栏：独立 / 已有专栏 ID / 新建 + 章节号，编辑和草稿都能回填）。⏳ 专栏下拉和 `/column/manage` 等「我的专栏」接口（第 13 节）。
3. ✅ `/recent/reply` 及「默认 / 热议 / 好评 / 最近回帖」切换；⏳ `/watch*` 页面已就位，数据等接口（第 12 节）。原 `/following` 调用的接口现网不存在，已重定向到 `/watch`。
4. ✅ 首页：签到状态、活跃度、昨日奖励、排行列此前已有（`CheckinPanel`）；现网 `nightTips` 无脚本填充，不做。
5. ✅ 个人主页子页第 1 期已路由化，长篇/积分/匿名等列表等接口（第 11 节）。
6. ✅ 私信：Vditor 精简工具栏（表情、链接、上传）、Ctrl+Enter；修复已读标记参数（`fromUser`）；撤回原本已有。
7. ✅ 错误页 401 / 403 / 404 / 500，SSR 返回真实状态码，生产环境出错不再把堆栈返回给浏览器。⛔ 1A0001、2048：现网路由已注释或不存在，不做。

顺带修复：开发服务器（Vite middleware 模式）不代理 WebSocket，私信、帖子热度、用户频道在本地一直连不上，`server.js` 已补升级隧道；生产 SSR 产物因 `hookable` 版本冲突启动即崩溃，已在 `vite.config.ts` 打包进产物。

### 第 3 期（P2，约 1 周 + 等后端）

1. 里程碑、商城、数据统计、新用户引导。
2. 后端接口就绪后替换假数据：专栏货架和详情、背包、重置密码、鱼游列表、积分流水、同城、排行榜。
3. 整站视觉逐页对照现网截图验收（PC + 移动端）。

---

## 验收方式

- 每个页面与现网同路径并排截图对比（PC 1440 和移动端 390 宽度）。
- 现网所有非管理端路由在本站都能访问，或有明确的跳转或代理。
- 去掉所有 `mock-` 数据提示后，页面仍能正常显示。
