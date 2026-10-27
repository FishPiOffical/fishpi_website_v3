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

浏览器认证已迁移到 v3：访问令牌只保存在内存，通过 HttpOnly 刷新 Cookie 恢复，不再把凭据写入 localStorage。旧 apiKey 不能替代 Bearer，仍使用旧接口的功能正在分批迁移，当前覆盖与限制见 [v3迁移记录](docs/V3_MIGRATION.md)。开发脚本中的旧 apiKey 缓存仍仅适用于旧接口，不要放入 v3 访问令牌。

开发代理默认指向 `https://fishpi.cn`。若本地 Rhythm 在 `8080`，在 `.env.development` 设置：

```
VITE_API_TARGET=http://localhost:8080
VITE_SITE_ORIGIN=https://fishpi.cn
```

本站优先请求 Rhythm JSON，不抓取现网 HTML。文章列表、搜索、领域、标签、文章/评论读取与通知HTTP/实时订阅已改用 v3，合法空结果保留为空，错误不会回退到假帖子。其他尚未迁移模块仍需逐项清理旧接口与历史占位数据；[缺口清单](docs/MISSING_APIS.md)包含历史记录，以[v3迁移记录](docs/V3_MIGRATION.md)为当前状态。广告位仅保留入口，不拉素材。

### SEO / SSR

- 客户端：`@unhead/vue` 设置 title / description / og / canonical；帖子页输出 Article JSON-LD
- `public/robots.txt` 屏蔽登录态路由；`npm run sitemap` 拉近期帖生成站点地图
- 生产：`npm run build` 产出 `dist/client` + `dist/server`，`npm run preview` 走 Node SSR
- 公开内容路由（首页、帖子、用户主页、列表等）服务端 prefetch JSON 后 `renderToString`；聊天/设置等仅 CSR shell
- nginx：HTML 反代到 Node；`/api`、`/chat-room`、`/games/*`、`/activity/*`、`/cr/raw/*` 等仍指 Rhythm，完整规则见 [docs/nginx.example.conf](docs/nginx.example.conf)

## 已实现

- 顶栏 9 入口 / 首页三列 / 登录 / 聊天室
- 帖子列表、详情、评论、发帖/编辑、点赞/感谢、收藏/关注帖、打赏
- 标签、点赞列表、评论分页/删除、徽章
- 用户主页、关注/粉丝、签到/昨日活跃、通知分页、私信撤回
- 清风明月（可匿名）
- 资料编辑、头像/共享编辑器上传（v3票据 → RhyPic直传；其他旧上传入口仍待迁移）、表情包、积分转账与流水
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
- 首页随机帖 `GET /article/random/{size}`、公开日志；通知已改v3票据实时订阅，旧紧急广播与私信推送仍待迁移
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

表情设置与共享选择器已接入v3目录、分页分组/图片、组与成员增删、常用表情保存/默认恢复；实际范围及剩余旧链路见docs/V3_MIGRATION.md。

表情区域已追加组/成员名称排序编辑、快照分享码导入及本人旧云迁移；导入定位真实分页元数据，详见同一迁移文档。

资料的昵称/简介/网址、独立MBTI和头像（HTTPS地址或票据上传）已接v3；QQ/标签另有独立资源，现已接入，其他设置仍分批迁移。见docs/V3_MIGRATION.md及后端docs/api-v3-client-profile-work.md。

功能/显示、隐私与位置公开、语言时区及经典站点皮肤已追加v3偏好读写，按实际字段部分保存；这是偏好持久化，实际页面效果和剩余模块仍按迁移文档逐项验收。

QQ已接独立第一方本人GET/PUT，空值清除、1至12位数字保留前导0，资料页独立保存；不加入公开资料。标签已接独立本人GET/PUT，支持别名规范化、严格数量/长度、清空及独立重试；关联事务在后端统一提交。

本人勋章在账号设置接入v3分页、展示/隐藏与相邻移动，未知响应保留同次操作供重试；图片仍复用原页面会话/gen与文本回退。其他账号模块继续迁移，见docs/V3_MIGRATION.md与后端docs/api-v3-client-medals-work.md。

本人职业设置已接v3目录/进度、主职业/跳过、完整隐私及等级路线/贡献/90天经验分页；已选但无进度不伪造零级，排行和他人资料继续迁移。见后端docs/api-v3-client-professions-work.md。

职业排行与成长提示已接v3：目录/可见榜单分页，隐藏经验与真实0区分；排行和职业设置均可查来源/奖励概要。他人公开职业资料仍待迁移，见后端docs/api-v3-client-profession-ranking-work.md。

用户主页“职业资料”已接v3独立模块与经验省略规则，隐藏主职业仍可进入其他公开模块。基础主页资料、会员/徽章和部分列表仍未全迁移，见后端docs/api-v3-client-public-professions-work.md。

/vips会员页已接v3完整档位、本人状态、支持字段展示配置和积分/优惠券开通，保留同次操作重试；当前状态和档位默认值分列。共享昵称及他人会员判断仍在后续范围，见后端docs/api-v3-client-membership-work.md。

共享VipNickname已改用v3批量三字段样式与必要的用户摘要ID解析，退出/换号清旧样式；匿名保留普通文本。其他手写昵称和会员身份徽章仍需单独迁移，见后端docs/api-v3-client-membership-styles-work.md。


积分转账（设置页/他人主页）与邀请码购买/状态已接既有v3；确认后按实际回执显示到账、费用和原码。未知结果保留原命令/key，可跨SPA页面恢复，正常令牌刷新保留，退出/换号清理；整页刷新不保留内存，需先核对原操作。unused不保证当前可注册，积分流水与其他模块仍待迁移。验证范围及完整人工步骤见Rhythm的docs/api-v3-client-finance-work.md。


本人积分流水页已接既有v3 points/me：真实金额/收支/交易后余额及总分页，余额与列表独立读取/重试，不再从通知正文猜金额或借记录余额当当前余额。普通token轮换保留页，换号/退出隔离；5组实际TS/Vue/SSR专项、财务7组回归、类型/双构建及本地夹具两页/独立错误恢复通过。真实后端账本、设备和全局反漏扫仍未验；完整文件/人工步骤见Rhythm docs/api-v3-client-points-work.md。其他用户积分等旧消费者未随之迁移。


账号页背包/四卡/积分改名已接v3：真实数量、确认与实际结果，历史回执不覆盖后来状态；未知消费/key跨SPA保留、普通token刷新保持，退出/换号清理。删旧mockUserBag与无消费者改名/卡片入口；免签增加剩余天数而非立即签到。6组专项、财务7/积分5回归、双构建及本地四卡/单次1000积分改名夹具通过，真实任务/事务/缓存/移动/风控未验。完整文件/步骤见Rhythm docs/api-v3-client-inventory-work.md；敏感账号设置/APP码/导出等仍待迁移。


账号安全（密码/MFA/手机/邮箱）已接既有v3九入口：每步当前证明、本地MFA手动准备及十分钟清理，成功/未知敏感变更重新登录核实。新密码6..128 UTF16、不trim、Unicode/无控制或无效代理，当前密码保持原样。删除旧敏感包装；确认可取消本人、极验初始化/成功回调隔离旧身份并支持脚本失败重试。7组真实TS/Vue、3组共享生命周期、财务7/背包6回归及双构建通过；IAB仅合成准备/非法手机/错误证明/未知改密重新登录。没有真实改密/极验/SMS/邮箱/TOTP操作，真实撤权/风控/设备仍需验收。完整文件与人工步骤见Rhythm docs/api-v3-client-security-work.md；APP扫码、导出、认证等未随之迁移。


数据页本人内容导出已接v3三路：完整本人内容/100分确认、同键恢复需新证明、任务只读查询及24h私有下载；不存证明或公开文件URL。ZIP先当前状态/授权，再类型/长度/hash校验，本地Blob交付并回收；失败不为下载重新收费。7组API/Pinia/模板、4组真实HTTP ZIP、安全7/财务7回归、双构建及IAB合成一次收费/恢复/下载通过。真实快照/账本/设备磁盘结果与全局风控未验；完整文件和人工步骤见Rhythm docs/api-v3-client-post-export-work.md。APP扫码、企业认证及其余模块继续迁移。


企业认证申请页已接既有v3三个本人接口：原始JPEG/PNG私有提交、本地预览、同图同key恢复，材料销毁与审核结论分别展示。七组专项、导出7/安全7回归及双构建通过；IAB合成材料单次提交/恢复/详情刷新通过，分页失败恢复浏览器验收仍缺。审核后台不在本批重建，真实材料/权限/设备/全局风控仍需验收。完整文件与人工链见Rhythm docs/api-v3-client-identity-work.md，APP扫码及其他模块继续迁移。


捐助页已接既有v3只读donation-page，移除旧客户端下单/支付QR，展示明确经典站点地址并提示独立网页登录。四组API/完整Vue/SSR专项、积分5/认证7回归、双构建及IAB读取失败恢复通过；未执行支付。另补齐认证分页错误返回首页及末页浏览器验证。完整文件/人工链见Rhythm docs/api-v3-client-donation-work.md；真实服务/设备/经典登录/全局反漏扫仍待验。


本人匿名创作已接既有v3两GET，原/member/本人/articles/anonymous与comments/anonymous独立加载，不再依赖旧公开userinfo；数据设置页增加入口，匿名评论明确ID/普通私密及所属文章。真实分页、错误重试、身份/目标/SSR隔离，不输出正文或匿名作者ID。五组专项、公开职业7/导出7回归、双构建与IAB分页503恢复/末页/他人路径零查询通过；真实权限/业务库/设备/风控仍待验。完整文件与人工链见Rhythm docs/api-v3-client-anonymous-content-work.md。其余主页、写入互动/私信/聊天室继续迁移。

用户关注/粉丝两个列表页已改用既有v3分页，独立显示隐私拒绝、错误重试和合法空列表，不再依赖旧主页userinfo。关注/取消关注写入及其余用户页功能仍分批迁移，详见docs/V3_MIGRATION.md。

用户主页与悬浮卡片关注操作已接v3明确PUT/DELETE及单项状态读取；未知结果保留同一次操作，成功后重读当前关系。卡片异步操作保留焦点，基础资料及其他互动仍单独迁移。完整范围见docs/V3_MIGRATION.md。

用户关注标签、收藏文章、订阅文章及/stars已接v3真实分页；本人保留不可读条目占位，他人遵循公开范围。错误重试与隐私拒绝独立显示，匿名摘要不产生假用户主页链接。其他关注动态和写入继续迁移，见docs/V3_MIGRATION.md。

“关注”三类动态已接已有v3标签/用户文章聚合和本人关注清风资源，真实分页及错误/隐私/空结果独立处理。清风保留服务端渲染格式；全站清风、侧栏及写操作继续单独迁移，见docs/V3_MIGRATION.md。

全站清风明月、首页模块及侧栏已接既有v3读写；本人编辑/删除、同次操作恢复及确认后重读共用实现。SSR载荷按应用隔离；城市/个人清风和整首页旧组件hydration仍另处理，见docs/V3_MIGRATION.md。

标签页关注、普通文章和长篇阅读器收藏/订阅已接v3明确设置与当前状态读取，支持原操作恢复与确认后重读。其余文章互动继续迁移，见docs/V3_MIGRATION.md。

首次加载在 SSR 挂载后恢复登录，私有页面保持恢复占位并支持临时失败重试；其余 SPA 守卫保留。启动专项9组及本地HTTP SSR已验，最终浏览器/真机尚待复核，见 docs/V3_MIGRATION.md。

普通/长篇文章的赞踩、感谢及打赏已接既有v3：当前状态、费用确认、原操作恢复及成功后重读；付费正文仅从当前合法详情读取。评论写入/其他互动仍继续迁移，详见docs/V3_MIGRATION.md。

普通评论与长篇段评的发布、回复、公开作者本人编辑/删除已接既有v3，长篇使用当前锚点与真实段评分页；原请求恢复、默认保留编辑可见范围及成功后重读共用实现。匿名本人管理证明入口、其他评论互动与上传仍待迁移，见docs/V3_MIGRATION.md。

评论赞踩已接既有v3，覆盖普通/楼中楼/长篇段评；明确赞踩/清除、原键恢复及当前GET，文章与评论资源隔离。12组专项与相关回归/双构建通过；真实浏览器和后端权限/通知仍待验。详情见Rhythm docs/api-v3-client-comment-votes-work.md；评论感谢/采纳/reaction仍待迁移。

评论感谢/采纳现已接v3当前状态与费用读取、既有POST、确认/同键恢复及当前GET；采纳完成刷新其余候选。11组客户端及5组Java/SQL/实际路由专项（SQLite和临时MySQL）通过，浏览器/真实账款待验。文件及人工链见Rhythm docs/api-v3-client-comment-rewards-work.md；reaction及其他待办继续。

文章/评论/长篇段评及聊天室经典/现代表态共用v3目录与GET/PUT/DELETE，原键恢复、当前GET、事件只失效；游客按需读，登录后自动读。16组专项、相关回归与双构建通过；浏览器和真实Socket/节点仍待验，聊天室主体/文章编辑等继续。完整文件与人工验收见Rhythm docs/api-v3-client-reactions-work.md。

文章与评论历史已接既有v3四GET，覆盖普通/长篇、根评论/楼中楼/段评，真实分页与独立重试、历史文本、当前版本及私有状态清理；正常同账号令牌轮换保留面板。14组专项、评论17组整页联动与相关回归/双构建通过；真实权限/浏览器和长篇交互待验。详见Rhythm docs/api-v3-client-revisions-work.md。

发帖/本人编辑/草稿主链已接v3，含typed部分PATCH、原付费源码、草稿分页、原key恢复及draftId消费；27组实际API/Pinia/完整表单与双构建通过。真实Vditor/账款/权限/事务和浏览器仍待验，预览/上传/@/标签联想另迁移。详见Rhythm docs/api-v3-client-posts-work.md。
