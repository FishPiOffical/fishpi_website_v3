# 新版 API 文档反馈（2026-10）

对照后端提供的新版 `API.md` 与前端需求清单 [`BACKEND_API_REQUESTS.md`](./BACKEND_API_REQUESTS.md) 逐条核对后，仍需后端修改或确认的事项。已满足的需求不在此列。

## 一、需要修改

### 1. 同城缺少帖子列表

- 文档只有 `GET /api/city/{cityName}`，返回同城**用户**。
- 现网 `/city/{city}`、`/city/{city}/articles` 默认展示同城**帖子**（`CityProcessor.showCityArticles`），`/city/{city}/users` 才是用户。
- 需要补充：

```
GET /api/city/{cityName}/articles?p=1&size=20
```

返回结构与 `GET /api/articles/recent` 一致（`data.articles` + `data.pagination`）。

### 2. `/api/user/{u}/following/articles` 语义与现网不一致

- 文档描述为「关注用户发布的帖子」。
- 现网 `/member/{u}/following/articles` 调用 `followQueryService.getFollowingArticles(userId)`，含义是**该用户收藏的帖子**（`FOLLOWING_TYPE_C_ARTICLE`）。
- 请确认实际实现；前端个人主页「收藏」子页需要的是后者。「关注用户发布的帖子」已由 `GET /api/watch/users/articles` 提供。

### 3. 缺少 `/api/user/{u}/watching/articles`

- 文档提供的 `GET /api/user/{u}/watching` 是关注动态聚合（`followingUserArticles` + `followingTagArticles`），与 `/api/watch/*` 重复。
- 现网 `/member/{u}/watching/articles` 调用 `followQueryService.getWatchingArticles(userId)`，含义是**该用户关注（watch）的帖子**。
- 需要补充：

```
GET /api/user/{userName}/watching/articles?p=1&size=20
```

返回 `data.articles` + `data.pagination`，隐私规则同其它子列表。

### 4. 背包缺字段

`GET /api/user/bag` 及 `/api/bag/*` 返回的背包快照请补充：

| 字段 | 用途 |
|------|------|
| `metalTicket` | 周年勋章领取券数量（设置页展示） |
| `patchStart` | 补签起始日期 `YYYY-MM-DD`（补签确认提示「补签后签到记录将提前至 X」） |

### 5. 数据统计缺时间序列，大事记缺提交接口

- `GET /api/statistic` 目前只有汇总数。统计页（对齐现网 `statistic.ftl`）需要按日 / 按月的注册数、发帖数、回帖数序列，例如：

```json
{
  "daily":   { "dates": ["2026-10-01"], "users": [12], "articles": [34], "comments": [560] },
  "monthly": { "months": ["2026-10"],   "users": [300], "articles": [900], "comments": [12000] }
}
```

- 大事记只有 `GET /api/milestones`，缺少提交接口 `POST /api/milestones`（现网 `submitMilestone` 用 `Sessions.getUser()`，apiKey 取不到用户）。

### 6. 两个写接口需支持 apiKey

| 接口 | 现状 | 诉求 |
|------|------|------|
| `POST /guide/next` | 文档未说明 | 支持 apiKey，配合 `/api/user` 的 `userGuideStep` 实现新人引导 |
| `PUT /breezemoon/{id}` | 挂 `csrfMidware`，apiKey 客户端无法调用 | 支持 apiKey（或提供 `PUT /api/breezemoon/{id}`）；`breezemoonContentRaw` 已返回，但没有编辑接口仍无法编辑 |

## 二、需要补充说明

### 7. 排行榜 `data.list` 单项字段

文档只写了 `data.list` / `data.totalData` / `data.type`，未说明 `list` 中每一项的字段。请补充：

- 是否为建议的 `{ rank, value, count, profile: { userName, userNickname, userAvatarURL, userNo, userIntro } }`，还是沿用原用户字段（`userName`、`userPoint`、`userCurrentCheckinStreak`、`onlineMinute` 等）？
- 游戏榜（`adr`、`mofish`、`evolve?type=`、`xiaoice?type=` 等）各子榜的字段是否一致？

确定后前端才能删除现有多结构兼容逻辑和演示数据。

### 8. 用户评论列表单项字段

`GET /api/user/{u}/comments` 只写了 `data.comments`。请说明每条评论的字段，至少需要：`oId`、`commentContent`（HTML）、`commentCreateTime`、所属帖子的 `articleId` / `articleTitle` / `articlePermalink`。

### 9. 活跃度限流

- `GET /user/liveness` 文档写「至少 10 分钟」，后端代码为 `SimpleCurrentLimiter(60 * 9, 1)`（9 分钟），以哪个为准？
- `GET /api/checkin/status` 返回的 `liveness` 是否受同一限流？若不受，前端将只调用该接口，不再单独请求 `/user/liveness`。

### 10. 「单接口 1 次 / 30 秒」是否适用于网页前端

文档注意事项写「对单个接口的访问频率必须控制在最低 1 次/30 秒，否则 IP 可能进入小黑屋」。

website_v3 由用户浏览器直接带 apiKey 调用这些接口，切换页面时会重新请求（先展示缓存再刷新）。请确认该限制是否针对网页前端；若适用，请告知具体哪些接口会被拦截，前端会为这些接口加最小刷新间隔。

### 11. 文档自相矛盾之处

| 位置 | 问题 |
|------|------|
| 鱼游 | 「获取已审核鱼游列表」写 `GET /api/fish-games`，文末「获取鱼游列表」写 `GET /activities`，以哪个为准？ |
| 积分流水 | 需求中的 `GET /api/user/points` 改为 `GET /api/user/{u}/points`（仅本人），确认前者不再提供 |
| 专栏详情 | `columnDescription` 标注「暂不支持」，是否有计划支持？ |

## 三、无需后端处理（前端待接入）

以下接口文档已满足需求，前端将在上线后接入：

- `GET /api/reset-pwd/meta`
- `GET /api/user/bag`、`/api/bag/1dayCheckin|2dayCheckin|patchCheckin`、`POST /api/bag/nameCard`
- `GET /api/checkin/status`
- `GET /api/top/*`（`data.list` 新结构）
- `GET /api/columns/latest|hot|mine`、`GET /api/columns/{id}`、`GET /api/columns/{id}/articles`、专栏重命名 / 排序 / 删除
- `GET /api/fish-games`
- `GET /api/user/{u}/points`、`/comments`、`/comments/anonymous`、`/articles/anonymous`、`/long`、`/following/tags`、`/following/users`、`/followers`
- `GET /api/watch/tags/articles`、`/api/watch/users/articles`、`/api/watch/breezemoons`
- `POST /api/article/stick`
- `GET /api/article/{id}` 的 `relevantArticles`、`previousArticle`、`nextArticle`、`?m=0|1`
- `GET /api/user` 的 `userGuideStep`
- `GET /api/breezemoons` 的 `breezemoonContentRaw`
- `GET /api/milestones`
- 帖子列表、帖子详情、领域、标签、搜索的游客匿名读取
