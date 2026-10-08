# 后端接口需求清单（website_v3）

前端 website_v3 已完成页面，以下接口需要后端新增或调整。  
通用约定：

- 返回统一信封：`{ "code": 0, "msg": "", "data": ... }`，`code !== 0` 视为失败。
- 需登录的接口通过 query `apiKey=` 鉴权。
- 分页参数统一 `p`（从 1 开始）、`size`。

| # | 优先级 | 类型 | 接口 | 说明 |
|---|--------|------|------|------|
| 1 | P0 | 新增 | `GET /api/reset-pwd/meta` | 重置密码校验码换 userId（当前功能不可用） |
| 2 | P0 | 新增 | `GET /api/user/bag` | 读取用户背包 |
| 3 | P1 | 调整 | `GET /activity/daily-checkin-api` / 新增 `GET /api/checkin/status` | 自动签到需要 JSON |
| 4 | P1 | 调整 | `GET /api/top/*` | 排行榜匿名可读 + 返回结构统一 |
| 5 | P1 | 新增 | `GET /api/columns/latest`、`GET /api/columns/hot` | 首页专栏货架 |
| 6 | P1 | 新增 | `GET /api/columns/{columnId}`、`GET /api/columns/{columnId}/articles` | 专栏详情 |
| 7 | P2 | 新增 | `GET /api/fish-games` | 鱼游已审核列表 |
| 8 | P2 | 新增 | `GET /api/user/points` | 积分流水 |
| 9 | P2 | 新增 | `GET /api/city/{cityName}` | 同城列表 |
| 10 | P2 | 调整 | `GET /api/articles/*`、`GET /api/article/{id}`、`GET /api/domains` | 游客匿名可读 |
| 11 | P1 | 新增 | `GET /api/user/{userName}/comments` 等 9 个 | 个人主页子页列表（现网仅 FTL） |
| 12 | P1 | 新增 | `GET /api/watch/tags/articles` 等 3 个 | 关注动态 `/watch*`（现网仅 FTL） |
| 13 | P1 | 新增 | `GET /api/columns/mine` | 长文章发帖选择已有专栏、`/column/manage` |
| 14 | P1 | 调整 | `POST /article/stick` | 置顶支持 apiKey（现网只认 Cookie 会话） |
| 15 | P2 | 调整 | `GET /api/article/{id}` | 补相关帖子、上一贴/下一贴 |
| 16 | P2 | 调整 | `GET /api/article/{id}` | 评论排序参数（现网固定正序） |
| 17 | P2 | 新增 | `GET /api/milestones`、`GET /api/statistic` | 大事记、数据统计（现网仅 FTL，前端暂交给 Rhythm 渲染） |
| 18 | P2 | 调整 | `GET /api/user` | 返回 `userGuideStep`，以便新用户跳 `/guide` |
| 19 | P2 | 调整 | `GET /api/breezemoons` | 返回原始 Markdown，支持编辑清风明月 |

---

## 1. 重置密码元数据（P0，新增）

**背景**：忘记密码短信验证后，现网 `GET /reset-pwd?code=` 通过 HTML 注入 `userId`，SPA 拿不到，导致 `POST /reset-pwd` 无法提交。

```
GET /api/reset-pwd/meta?code={code}
```

响应：

```json
{ "code": 0, "msg": "", "data": { "userId": "1630000000000", "code": "xxxx" } }
```

- 校验码无效/过期：`code` 非 0，`msg` 给出原因。
- 后续沿用已有 `POST /reset-pwd`（MD5 密码）。

前端替换点：`src/api/fishpi.ts` → `fetchResetPwdMeta()`。

---

## 2. 用户背包读取（P0，新增，需登录）

```
GET /api/user/bag?apiKey={apiKey}
```

响应 `data`（对齐现网 `sysBag`）：

```json
{
  "checkin1day": 0,
  "checkin2days": 0,
  "nameCard": 0,
  "metalTicket": 0,
  "patchCheckinCard": 0,
  "patchStart": "YYYY-MM-DD",
  "sysCheckinRemain": 0
}
```

使用道具沿用已有接口：`GET /bag/1dayCheckin`、`GET /bag/2dayCheckin`、`GET /bag/patchCheckin`、`POST /bag/nameCard { userName }`。若方便，希望这几个也支持 `apiKey` 鉴权并返回 JSON。

前端替换点：`fetchUserBag()`。

---

## 3. 自动签到（P1，调整）

**背景**：首页改为「活跃度达标自动签到」，已调用：

- `GET /user/liveness` → `{ liveness }`
- `GET /activity/daily-checkin-api` → 现网可能返回非 JSON
- `GET /api/activity/is-collected-liveness`、`GET /activity/yesterday-liveness-reward-api`（昨日活跃奖励，正常）

**诉求**（二选一）：

A. `GET /activity/daily-checkin-api?apiKey=` 保证返回 JSON：

```json
{ "code": 0, "msg": "", "data": { "checkedIn": true, "sum": 15 } }
```

B. 新增状态接口，前端不再硬编码阈值：

```
GET /api/checkin/status?apiKey={apiKey}
```

```json
{
  "code": 0,
  "data": { "checkedIn": false, "liveness": 8.5, "threshold": 10, "streak": 12 }
}
```

前端替换点：`dailyCheckin()`、`CheckinPanel`。

---

## 4. 排行榜（P1，调整）

前端已对接以下路径，匿名访问常 401 或空，失败时回退演示数据：

| 接口 | 榜单 |
|------|------|
| `GET /api/top/checkin?p=1` | 签到榜 |
| `GET /api/top/online?p=1` | 在线榜 |
| `GET /api/top/donate?p=1` | 鱼排续命师（需 `totalData.totalAmount`、`totalData.donateMakeDays`） |
| `GET /api/top/perfect?p=1` | 优选榜 |
| `GET /api/top/invite?p=1` | 邀请榜 |
| `GET /api/top/{game}?p=1` | 游戏榜 |
| `GET /api/top/balance?p=1` | 财富榜 |
| `GET /api/top/consumption?p=1` | 消费榜 |

**诉求**：

1. 确认每个榜单是否允许匿名读取（财富/消费若只对登录用户开放请明确）。
2. 统一返回结构，建议：

```json
{
  "code": 0,
  "data": {
    "list": [
      { "rank": 1, "value": 2333, "count": 16, "profile": { "userName": "", "userNickname": "", "userAvatarURL": "", "userNo": 1, "userIntro": "" } }
    ],
    "totalData": { "totalAmount": 0, "donateMakeDays": 0 }
  }
}
```

目前前端同时兼容 `data[]`、`data.users[]`、`data.data[]`，统一后可删除兼容逻辑和演示数据。

---

## 5. 首页专栏货架（P1，新增）

```
GET /api/columns/latest?size=12
GET /api/columns/hot?size=12
```

`data` 为数组，字段对齐现网 FTL `latestLongColumns` / `hotLongColumns`：

```json
[
  {
    "columnId": "string",
    "columnTitle": "string",
    "columnArticleCount": 19,
    "latestChapter": { "articleId": "string", "articlePermalink": "/article/xxx", "chapterNo": 19, "articleTitle": "string" },
    "secondLatestChapter": { "articleId": "string", "articlePermalink": "/article/xxx", "chapterNo": 18, "articleTitle": "string" }
  }
]
```

前端替换点：`fetchHomeColumns()`。

---

## 6. 专栏详情（P1，新增）

现网 `GET /column/{id}` 为登录 HTML。

```
GET /api/columns/{columnId}
GET /api/columns/{columnId}/articles?p=1&size=20
```

详情 `data`：

```json
{
  "columnId": "string",
  "columnTitle": "string",
  "columnDescription": "string",
  "columnArticleCount": 19,
  "author": { "userName": "", "userNickname": "", "userAvatarURL": "" }
}
```

章节列表 `data`：

```json
{
  "articles": [ { "articleId": "", "articlePermalink": "", "chapterNo": 1, "articleTitle": "", "articleCreateTime": "" } ],
  "pagination": { "paginationPageCount": 1, "paginationRecordCount": 19 }
}
```

---

## 7. 鱼游已审核列表（P2，新增）

已有：`POST /api/fish-games`、`GET /api/fish-games/{id}/comments`、投票/评论写接口。审核列表仅 FTL `/activities` 注入。

```
GET /api/fish-games?status=approved&p=1&size=20
```

```json
[
  { "id": "", "name": "", "description": "", "url": "", "iconURL": "", "authorName": "", "upCount": 0, "downCount": 0, "createTime": "" }
]
```

---

## 8. 积分流水（P2，新增，需登录）

当前用 `GET /api/getNotifications?type=point` 近似。

```
GET /api/user/points?apiKey={apiKey}&p=1&size=20
```

```json
{
  "list": [ { "oId": "", "type": "string", "typeName": "签到奖励", "sum": 15, "balance": 1024, "memo": "", "time": 1696752000000 } ],
  "pagination": { "paginationPageCount": 1 }
}
```

---

## 9. 同城（P2，新增）

当前用清风明月按城市字段过滤近似。

```
GET /api/city/{cityName}?p=1&size=20
```

返回同城清风明月/帖子列表，字段与 `GET /api/breezemoons` 一致即可。

---

## 10. 游客匿名读取（P2，调整）

以下接口游客访问失败时前端回退 `src/api/catalog.mock.json` 假数据，希望游客可读：

- `GET /api/articles/recent`、`/recent/hot`、`/recent/long`、`/recent/good`
- `GET /api/articles/qna`、`/api/articles/perfect`
- `GET /api/articles/tag/{tag}`、`/api/articles/domain/{domain}`
- `GET /api/article/{id}`
- `GET /api/domains`
- `GET /user/{userName}`

---

## 11. 个人主页子页列表（P1，新增）

前端已按现网补齐 `/member/{userName}/...` 子路由，以下列表现网只有 FTL 页面（`UserProcessor.showHome*`），没有 JSON。页面目前显示「等待后端开放」。

| 现网页面 | 建议接口 | 返回 |
|----------|----------|------|
| `/member/{u}/comments` | `GET /api/user/{u}/comments?p=&size=` | 回帖列表：`commentContent`、`commentCreateTime`、所属帖子 `articleId/articleTitle` |
| `/member/{u}/comments/anonymous` | `GET /api/user/{u}/comments/anonymous?p=&size=` | 同上（仅本人可见） |
| `/member/{u}/articles/anonymous` | `GET /api/user/{u}/articles/anonymous?p=&size=` | 同 `/api/user/{u}/articles`（仅本人可见） |
| `/member/{u}/long` | `GET /api/user/{u}/long?p=&size=` | 同 `/api/user/{u}/articles`，仅长文章 |
| `/member/{u}/watching/articles` | `GET /api/user/{u}/watching/articles?p=&size=` | 帖子列表 |
| `/member/{u}/following/articles` | `GET /api/user/{u}/following/articles?p=&size=` | 帖子列表（收藏） |
| `/member/{u}/following/tags` | `GET /api/user/{u}/following/tags?p=&size=` | `tagTitle`、`tagURI`、`tagIconPath`、`tagReferenceCount` |
| `/member/{u}/following/users` | `GET /api/user/{u}/following/users?p=&size=` | `userName`、`userNickname`、`userAvatarURL`、`userIntro` |
| `/member/{u}/followers` | `GET /api/user/{u}/followers?p=&size=` | 同上 |
| `/member/{u}/points` | `GET /api/user/{u}/points?p=&size=` | 同第 8 节积分流水 |

分页统一返回 `pagination: { paginationPageCount, paginationRecordCount }`；隐私设置不允许查看时返回 `code != 0` 及原因。

前端接入点：`src/views/MemberView.vue` 的 `PENDING_API`，以及 `fetchFollowingUsers` / `fetchFollowers`（当前调用的 `/api/user/{u}/following`、`/follow/users` 在现网均不存在）。

---

## 12. 关注动态（P1，新增，需登录）

现网 `/watch`、`/watch/users`、`/watch/breezemoons` 由 `IndexProcessor.showWatch` / `BreezemoonProcessor.showWatchBreezemoon` 渲染 FTL，没有 JSON。前端 `WatchView` 目前显示「等待后端开放」。注意 `/api/user/following/articles` 现网不存在（会被 `/api/user/{userName}` 匹配成用户名 `following`，返回「用户不存在」）。

| 页面 | 建议接口 | 数据来源 |
|------|----------|----------|
| `/watch` | `GET /api/watch/tags/articles?p=&size=` | `articleQueryService.getFollowingTagArticles` |
| `/watch/users` | `GET /api/watch/users/articles?p=&size=` | `articleQueryService.getFollowingUserArticles` |
| `/watch/breezemoons` | `GET /api/watch/breezemoons?p=&size=` | `showWatchBreezemoon` 里的关注用户清风明月 |

返回结构与 `GET /api/articles/recent` / `GET /api/breezemoons` 一致。

## 13. 我的专栏（P1，新增，需登录）

长文章发帖页的「所属专栏」下拉，现网由 `fillLongArticleColumnRequisite` 在 FTL 里注入 `longArticleColumns`，没有 JSON。前端目前只能让用户手填专栏 ID。

- `GET /api/columns/mine?size=100` → `longArticleColumnQueryService.getUserColumns(userId, size)`，字段：`oId`、`columnTitle`、`columnArticleCount`、`columnCoverURL`、`columnHasCover`。
- `/column/manage`（`LongArticleColumnProcessor.showManage`）同样需要这份列表，外加重命名/排序/删除接口；现网只有 `POST /api/columns/{columnId}/cover`。

## 14. 置顶支持 apiKey（P1，调整）

`POST /article/stick` 的 `stickArticle` 用 `Sessions.getUser()` 取当前用户，apiKey 客户端拿到的是 `null`，直接 403。请改为与其它接口一致：优先 `context.attr(User.USER)`（`loginCheck` 已按 apiKey 填好）。前端目前只展示「置顶中 · 剩余 N 分钟」（`articleStickRemains`），不提供置顶按钮。

## 15. 帖子详情补相关帖与上下贴（P2，调整）

`article.ftl` 用到的 `sideRelevantArticles`、`articlePrevious`、`articleNext` 只在 FTL 数据模型里，`GET /api/article/{id}` 没返回。请在 `data` 层加：

- `relevantArticles`：`[{ oId, articleTitle, articleTitleEmoj, articlePermalink, articleAuthorName, articleAuthorThumbnailURL20 }]`
- `previous` / `next`：`{ oId, articleTitle, articleTitleEmojUnicode, articlePermalink }`

长文章的上一章/下一章已由 `longArticleColumnView.previous/next` 提供，前端已接入。随机帖子用的是现有 `GET /article/random/{size}`。

## 16. 评论排序参数（P2，调整）

`showArticleApi` 里 `cmtViewMode` 写死为 `0`（传统正序）。请支持 `?m=0|1`（正序/实时倒序），与网页端用户设置 `userCommentViewMode` 一致。另外 `pagination` 在 `data` 层而不在 `article` 里，前端已适配，无需调整。

## 17. 大事记与数据统计 JSON（P2，新增）

`/milestones`、`/milestones/submit`、`/statistic`、`/guide` 现网都只有 FTL，且 `loginCheck` 只认 Cookie 会话。前端目前的做法：点击时先用 apiKey 换页面会话（`/__fp/page-auth`），再整页跳到 Rhythm 渲染的页面；部署时这些路径要转发到 Rhythm（见 `docs/nginx.example.conf`）。如需做成 SPA 页面，请提供：

- `GET /api/milestones?p=&size=`：`[{ oId, milestoneTitle, milestoneContent, milestoneDate, milestoneImage, milestoneLink }]`
- `POST /api/milestones`：提交大事记（现网 `submitMilestone` 用 `Sessions.getUser()`，apiKey 拿不到用户）
- `GET /api/statistic`：`statistic.ftl` 用到的按日/按月注册、发帖、回帖序列

## 18. 新人引导状态（P2，调整）

现网列表页对 `!UserExt.finishedGuide(user)` 的用户重定向到 `/guide`。`GET /api/user` 没有 `userGuideStep`，SPA 无法判断。请在返回里加 `userGuideStep`；`POST /guide/next` 同样需要支持 apiKey。

## 19. 清风明月原文（P2，调整）

`GET /api/breezemoons` 只返回渲染后的 `breezemoonContent`（HTML），编辑时无法还原 Markdown。请增加 `breezemoonContentRaw`（或 `?raw=1`）。前端目前只提供删除，不提供编辑。

---

## 不需要改动（已对接）

- 聊天室节点 `GET /chat-room/node/get`
- VIP：`GET /api/membership/levels`、`GET /api/membership/{userId}`、`POST /api/membership/open`
- 捐助：`GET /pay/wechat`
- 鱼游投稿/评论/投票
