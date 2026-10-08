# 待后端开放的接口

截至 2026-10-08 逐个探测现网，以下接口仍不存在（返回 HTML 或 404）。前端页面都已就位，目前显示「等待后端开放」或用替代方案。字段、返回结构等细节见 [`BACKEND_API_REQUESTS.md`](./BACKEND_API_REQUESTS.md) 对应章节。

通用约定：信封 `{ code, msg, data }`，登录用 `?apiKey=`，分页 `p`（从 1 开始）+ `size`。

## P0

| 接口 | 用在哪 | 现在的情况 | 章节 |
|------|--------|------------|------|
| `GET /api/reset-pwd/meta?code=` | 忘记密码 → 重置密码 | 拿不到 `userId`，重置密码无法提交 | §1 |
| `GET /api/user/bag` | 背包 | 假数据 | §2 |

## P1

| 接口 | 用在哪 | 现在的情况 | 章节 |
|------|--------|------------|------|
| `GET /api/checkin/status`（或让 `/activity/daily-checkin-api` 返回 JSON） | 自动签到 | 签到状态不可靠 | §3 |
| `GET /api/top/*` 匿名可读、结构统一 | 排行榜 | 仅签到榜 `/api/top/checkin` 可用，其余部分假数据 | §4 |
| `GET /api/columns/latest`、`GET /api/columns/hot` | 首页专栏货架 | 假数据 | §5 |
| `GET /api/columns/{id}`、`GET /api/columns/{id}/articles` | 专栏详情 `/column/{id}` | 假数据 | §6 |
| `GET /api/user/{u}/comments`<br>`GET /api/user/{u}/comments/anonymous`<br>`GET /api/user/{u}/articles/anonymous`<br>`GET /api/user/{u}/long`<br>`GET /api/user/{u}/watching/articles`<br>`GET /api/user/{u}/following/articles`<br>`GET /api/user/{u}/following/tags`<br>`GET /api/user/{u}/following/users`<br>`GET /api/user/{u}/followers`<br>`GET /api/user/{u}/points` | 个人主页 10 个子页 | 显示「等待后端开放」 | §11 |
| `GET /api/watch/tags/articles`<br>`GET /api/watch/users/articles`<br>`GET /api/watch/breezemoons` | 关注动态 `/watch*` | 显示「等待后端开放」 | §12 |
| `GET /api/columns/mine` + 专栏重命名/排序/删除 | 长文章发帖选专栏、`/column/manage` | 只能手填专栏 ID；专栏管理未做 | §13 |
| `POST /article/stick` 支持 apiKey | 帖子置顶 | 只读显示剩余时间，无置顶按钮 | §14 |

## P2

| 接口 | 用在哪 | 现在的情况 | 章节 |
|------|--------|------------|------|
| `GET /api/fish-games?status=approved` | 鱼游列表 | 跳到 Rhythm 渲染的 `/activities` | §7 |
| `GET /api/user/points` | 积分流水 | 用积分通知近似 | §8 |
| `GET /api/city/{cityName}` | 同城 | 假数据 | §9 |
| `/api/articles/*`、`/api/article/{id}`、`/api/domains` 游客可读 | 未登录浏览 | 部分列表需登录 | §10 |
| `GET /api/article/{id}` 补 `relevantArticles`、`previous`/`next` | 帖子详情侧栏、上下贴 | 只有长文章的上下章 | §15 |
| `GET /api/article/{id}?m=0\|1` | 评论排序 | 固定正序 | §16 |
| `GET /api/milestones`、`POST /api/milestones`、`GET /api/statistic` | 大事记、数据统计 | 跳到 Rhythm 渲染的页面 | §17 |
| `GET /api/user` 返回 `userGuideStep`；`POST /guide/next` 支持 apiKey | 新人引导 | 无法自动跳 `/guide` | §18 |
| `GET /api/breezemoons` 返回 Markdown 原文 | 编辑清风明月 | 只能删除，不能编辑 | §19 |

## 接口上线后前端要改的地方

- 个人主页子页：`src/views/MemberView.vue` 的 `PENDING_API`
- 关注动态：`src/views/WatchView.vue`
- 专栏、背包、积分、同城、排行榜假数据：`src/api/gaps.mock.ts` 及 `src/api/fishpi.ts` 中引用它的 `fetch*`
- 大事记 / 数据统计 / 引导：目前是 `openRhythmPage` 整页跳转，改成 SPA 页面后去掉开发代理和 nginx 里的转发
