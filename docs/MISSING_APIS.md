# JSON 接口覆盖与缺口清单

> 历史旧接口盘点，不代表当前后端v3缺口。v3已提供多数对应资源，当前客户端迁移状态以[V3_MIGRATION.md](V3_MIGRATION.md)为准；不能继续按此表为已提供的功能制造占位数据。

本站优先走 Rhythm 真实 JSON；本清单记录已接入、缺失或需降级处理的能力。缺失项使用 `src/api/gaps.mock.ts` / `catalog.mock.json` 假数据或降级方案。
**禁止**用 HTML 抓取现网拼装运行时数据。后端补齐缺失接口后，删掉对应 mock 并改 `src/api/fishpi.ts` 调用。

| 状态 | 含义 |
|------|------|
| 已接入 | 已有可用 JSON，前端正常请求；保留 mock 作为异常兜底 |
| 缺失 | 无对应 JSON，SPA 用假数据 |
| 降级 | 有近似接口/页面态，但缺少专用 JSON |
| 故意不做 | 产品范围外或暂不接 |

---

## 1. 首页长篇专栏货架 — 已接入

| 建议契约 | 说明 |
|----------|------|
| `GET /api/columns/latest?size=12` | 首页「最近更新」专栏卡片 |
| `GET /api/columns/hot?size=12` | 首页「热门专栏」卡片 |

现网接口已提供专栏摘要与封面字段，首页从两个接口获取：

```json
{
  "columnId": "string",
  "columnTitle": "string",
  "columnArticleCount": 0,
  "columnCoverURL": "https://...",
  "latestChapter": {
    "articleId": "string",
    "articlePermalink": "/article/...",
    "chapterNo": 19,
    "articleTitle": "string"
  },
  "secondLatestChapter": { "...": "optional" }
}
```

| 现状 | `fetchHomeColumns()` 请求上述接口；请求失败时回退 `gaps.mock.ts` |
|------|--------------------------------------------------------------|

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

前端已对接以下路径，但匿名常 401 / 空。成功的空榜单原样展示，仅请求失败时连签/在线榜回退演示数据（页面有提示）：

| 接口 | 失败时 |
|------|--------|
| `GET /api/top/checkin` | `mockCheckin()` |
| `GET /api/top/online` | `mockOnline()` |
| `GET /api/top/donate`（鱼排续命师，含 `totalData.totalAmount/donateMakeDays`） | 空列表 |
| `GET /api/top/perfect`（优选榜） | 空列表 |
| `GET /api/top/invite`（邀请榜） | 空列表 |
| `GET /api/top/{game}`（游戏榜） | 空列表 |
| `GET /api/top/balance`、`/api/top/consumption` | 空列表（需登录） |

诉求：确认以上榜单的匿名可读性及返回结构（`data[]` / `users[]` 二选一统一），开放后删除连签/在线榜的演示数据。

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
| 匿名列表/详情、领域、连签/在线榜（仅请求失败时） | `src/api/catalog.mock.json`（既有） |

用户资料、搜索失败时直接报错，不使用假数据。

服务端仅保留 `POST /__fp/page-auth`（apiKey → `sym-ce` + csrf，供页面态 POST）。**不再**提供 HTML 抓取类 `__fp/*` 接口。

## 15. 账号安全提醒 — 缺失

现网首页会对未绑手机、管理组未开两步验证的账号弹窗。前端 `SystemAlertDialog` 读取 `GET /api/user` 的 `needBindPhone`、`need2fa`（布尔）；字段未提供前不弹窗。

2026-10-25补正：关注用户/粉丝已有v3分页接口，客户端两个既有路由已迁移至UserRelationsView；不再把这两项列作“缺JSON”。错误不会回退旧接口或mock，隐私按服务端403。关注写入及其他用户页模块继续按V3_MIGRATION.md逐项迁移。

2026-10-26：新增本人→指定用户的v3关注状态GET，客户端主页/悬浮卡片已接明确PUT/DELETE，无需遍历关注全集取得状态；其他关系与用户页缺口仍按V3_MIGRATION.md当前清单。

2026-10-26补正：关注标签、收藏文章、订阅文章已有v3资源，客户端三个member子路径及/stars已迁移，不再列为缺JSON；本人集合含不可读占位，公开列表不等于本人全部关系。关注动态和标签/收藏订阅写入仍按V3_MIGRATION.md继续。

2026-10-26补正：/watch三类动态已有v3聚合与本人关注清风资源，客户端已迁移，不再按旧/api/watch路径列作缺接口。仅关注动态读取，其他全站清风/侧栏/写操作仍按V3_MIGRATION.md。

全站清风、首页和侧栏已接既有v3读取/发布，主列表接本人编辑删除；不再依赖旧全站写入。城市筛选及用户个人清风仍待独立迁移，不以缺失字段伪造统计；详情见V3_MIGRATION.md。

标签页关注、普通/长篇文章收藏与订阅写入已接v3明确PUT/DELETE及单项GET状态，删除旧follow/article包装；未读目标占位的移除及其他互动不随之完成，参见V3_MIGRATION.md。

2026-10-26：首次登录恢复与SSR首帧差异属于客户端启动时序，已实现clientStartup协调及私有页恢复状态，不是新增接口缺口；最终浏览器/真实服务复核仍待完成。

2026-10-26：文章投票/感谢/打赏已有v3读写，普通/长篇客户端现已迁移；不再视为缺接口，评论感谢/采纳/reaction及其他写入继续按V3_MIGRATION.md处理，真实后端/浏览器验收仍待完成。

2026-10-26：评论三写/原文、长篇段落/平铺段评已有v3并已迁移，不能继续当作缺JSON。匿名评论的本人编辑/删除UI仍缺当前归属证明入口；评论其他互动、文章编辑、上传等继续按V3_MIGRATION.md，真实浏览器/服务验收未完成。

评论投票GET/PUT/DELETE已有且客户端普通/楼中楼/长篇已接，不再视为缺接口。感谢/采纳的写接口已有，本轮补齐GET /comments/{id}/thanks及/accept，客户端也已接当前状态/费用和POST；不能用旧列表缺省字段替代当前状态。文章/评论/聊天室表态已有目录及GET/PUT/DELETE且客户端已接，其余内容写入与聊天室主体继续迁移。

2026-10-26：表态目录与三类目标读写不是缺接口，V3ReactionBar已覆盖普通/长篇文章、根评论/楼中楼/段评、聊天室两布局。旧Socket仅失效适配，不表示v3票据/订阅、聊天主体和节点切换已完成；运行权限/浏览器仍待验。

2026-10-26：文章/评论revisions四GET已存在，客户端RevisionHistory也已接普通/长篇及评论/段评入口；不是缺接口。正文为清洗历史文本，不能当原始Markdown/发布编辑源码。真实权限与浏览器验收仍待完成；文章编辑/发布/上传和私信/聊天主体继续迁移。

2026-10-26：文章POST/PUT、本人source及草稿五读写入口已有v3，PostView主链已接，不是缺接口。Vditor预览仍旧markdown，上传/@/内部emoji/标签联想、本人专栏目录选择待迁移；不能把主表单接线当完整编辑器或真实权限/账款验收。文章删除/置顶客户端和私信/聊天主体继续。
