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

## 不需要改动（已对接）

- 聊天室节点 `GET /chat-room/node/get`
- VIP：`GET /api/membership/levels`、`GET /api/membership/{userId}`、`POST /api/membership/open`
- 捐助：`GET /pay/wechat`
- 鱼游投稿/评论/投票
