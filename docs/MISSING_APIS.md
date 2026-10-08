# 缺失 / 未开放 JSON 接口清单

本站优先走 Rhythm 真实 JSON；下列能力在现网**没有可用的公开 JSON**（或仅 HTML 页注入），前端用 `src/api/gaps.mock.ts` / `catalog.mock.json` 假数据或降级方案。  
**禁止**再用 HTML 抓取现网补数据。后端补齐后，删掉对应 mock 并改 `src/api/fishpi.ts` 调用。

| 状态 | 含义 |
|------|------|
| 缺失 | 无对应 JSON，SPA 用假数据 |
| 降级 | 有近似接口/页面态，但缺少专用 JSON |
| 故意不做 | 产品范围外或暂不接 |

---

## 1. 首页长篇专栏货架 — 缺失

| 建议契约 | 说明 |
|----------|------|
| `GET /api/columns/latest?size=12` | 首页「最近更新」专栏卡片 |
| `GET /api/columns/hot?size=12` | 首页「热门专栏」卡片 |

建议每条字段（与现网 FTL `hotLongColumns` / `latestLongColumns` 对齐）：

```json
{
  "columnId": "string",
  "columnTitle": "string",
  "columnArticleCount": 0,
  "latestChapter": {
    "articleId": "string",
    "articlePermalink": "/article/...",
    "chapterNo": 19,
    "articleTitle": "string"
  },
  "secondLatestChapter": { "...": "optional" }
}
```

| 现状 | `fetchHomeColumns()` → `gaps.mock.ts` 假数据 |
|------|-----------------------------------------------|

---

## 2. 用户背包 — 缺失

| 建议契约 | 说明 |
|----------|------|
| `GET /api/user/bag` 或 `GET /api/bag/me`（需 apiKey） | 返回 `sysBag` |

建议字段：

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

写入已有页面态（需 CSRF，可继续用）：

- `GET /bag/1dayCheckin`
- `GET /bag/2dayCheckin`
- `GET /bag/patchCheckin`
- `POST /bag/nameCard` `{ userName }`

| 现状 | 读：`fetchUserBag()` 假数据；写：仍打真实 `/bag/*` |
|------|-----------------------------------------------------|

---

## 3. 重置密码校验元数据 — 缺失

忘记密码短信成功后，现网靠 `GET /reset-pwd?code=` **HTML** 注入 `userId`。SPA 需要 JSON：

| 建议契约 | 说明 |
|----------|------|
| `GET /api/reset-pwd/meta?code=` | `{ userId, code }`，无效码非 0 |

已有写入：`POST /forget-pwd`、`POST /reset-pwd`（MD5 密码）。

| 现状 | `fetchResetPwdMeta()` 返回假 `userId`（仅通 UI；提交现网会失败） |
|------|------------------------------------------------------------------|

---

## 4. 专栏详情页 — 缺失 / 降级

| 建议契约 | 说明 |
|----------|------|
| `GET /api/columns/{columnId}` | 专栏信息 + 章节列表分页 |
| `GET /api/columns/{columnId}/articles?p=&size=` | 章节文章列表 |

现网 `GET /column/{id}` 为登录 HTML（常 401）。SPA 首页卡片链到最新章节帖或 `/column` 长篇列表。

| 现状 | SPA `/column/:id`：`fetchHomeColumns` + 长篇列表近似章节；无专用 JSON |
|------|---------------------------------------------------------------------|

---

## 5. 同城页 — 缺失

| 建议契约 | 说明 |
|----------|------|
| `GET /api/city/{cityName}?p=&size=` | 同城帖/动态列表 |

| 现状 | `CityView` 用清风明月按城市字段过滤近似 |
|------|------------------------------------------|

---

## 6. 积分流水专用接口 — 降级

| 建议契约 | 说明 |
|----------|------|
| `GET /api/user/points?p=&size=`（apiKey） | 积分流水 |

| 现状 | `GET /api/getNotifications?type=point` 近似 |
|------|---------------------------------------------|

---

## 7. 聊天室节点列表 — 已有（勿当缺失）

`GET /chat-room/node/get?apiKey=` 已返回 `data` / `msg` / `avaliable[]` / `apiKey`。SPA 已对接，无需假数据。

---

## 8. 广告素材 — 故意不做

广告仅 `AdSlot` 入口；不拉现网/假素材。若以后要做：`GET /api/ads?slot=`。

---

## 9. 闲聊室 — 故意不做

现网 `/idle-talk` 404。本站不接闲聊室，主聊天走 `/cr`。

---

## 10. 鱼游公开列表 — 缺失

已有：`POST /api/fish-games`（投稿）、`GET /api/fish-games/{id}/comments`、投票/评论写接口。  
审批列表仅注入 FTL `/activities`（`fishGameQueryService.getApproved()`），无公开 JSON。

| 建议契约 | 说明 |
|----------|------|
| `GET /api/fish-games?status=approved` | 已通过鱼游列表（名称/简介/URL/图标/赞踩） |

| 现状 | SPA `/games` 提供官方游戏入口 + 投稿表单；列表待后端 |
|------|-----------------------------------------------------|

---

## 11. 捐助页 — 已有支付口

`GET /pay/wechat?total_amount=&note=`（页面会话）返回 `QRcode_url`。SPA `/charge/point` 已对接。

---

## 12. VIP — 已有（勿当缺失）

- `GET /api/membership/levels`
- `GET /api/membership/{userId}`
- `POST /api/membership/open`（积分开通，body 可带 `apiKey` / `couponCode`）

SPA `/vips` 已对接。管理端 VIP 不在本站范围。

---

## 13. 排行榜匿名读取 — 降级

前端已对接以下路径，但匿名常 401 / 空，失败时部分榜单回退演示数据：

| 接口 | 失败时 |
|------|--------|
| `GET /api/top/checkin` | `mockCheckin()` |
| `GET /api/top/online` | `mockOnline()` |
| `GET /api/top/donate`（鱼排续命师，含 `totalData.totalAmount/donateMakeDays`） | 内置演示数据 |
| `GET /api/top/perfect`（优选榜） | 内置演示数据 |
| `GET /api/top/invite`（邀请榜） | 内置演示数据 |
| `GET /api/top/{game}`（游戏榜） | 内置演示数据 |
| `GET /api/top/balance`、`/api/top/consumption` | 空列表（需登录） |

诉求：确认以上榜单的匿名可读性及返回结构（`data[]` / `users[]` 二选一统一），开放后删除 `fishpi.ts` 内演示数据。

---

## 14. 自动签到 — 降级

首页改为「活跃度达标自动签到」，依赖：

- `GET /user/liveness` — 当前活跃度
- `GET /activity/daily-checkin-api` — 签到领取（现网可能返回非 JSON，失败再试 `/user/checkin`）
- `GET /api/activity/is-collected-liveness`、`GET /activity/yesterday-liveness-reward-api` — 昨日活跃奖励

诉求：确认 `daily-checkin-api` 返回 JSON（含是否已签到、获得积分），或提供 `GET /api/checkin/status` 返回 `{ checkedIn, liveness, threshold }`，避免前端硬编码达标阈值。

---

## 前端假数据入口

| 能力 | 代码 |
|------|------|
| 首页专栏 | `src/api/gaps.mock.ts` → `mockHomeColumns` |
| 背包读取 | `src/api/gaps.mock.ts` → `mockUserBag` |
| 重置密码 meta | `src/api/gaps.mock.ts` → `mockResetPwdMeta` |
| 匿名列表/详情等 | `src/api/catalog.mock.json`（既有） |
| 榜单演示数据 | `src/api/fishpi.ts` → `fetchDonateRank` / `fetchPerfectRank` / `fetchInviteRank` / `fetchGameRank` |

服务端仅保留 `POST /__fp/page-auth`（apiKey → `sym-ce` + csrf，供页面态 POST）。**不再**提供 HTML 抓取类 `__fp/*` 接口。
