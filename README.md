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

main 分支仅支持 Rhythm v3 接口，双版本代码已备份至本地 `v1_v3` 分支（`ce9e4dd`，包含最近两次 UI 调整）。版本切换、旧 apiKey 登录及 v1 适配器已移除；旧 `fp.apiMode` Cookie 不会改变请求目标，旧 `/api/` 端点返回 410。开发上游通过 `VITE_API_TARGET` 配置，须指向支持 v3 的 Rhythm，不自动回退现网旧接口。

浏览器访问令牌只保存在内存，通过 HttpOnly 刷新 Cookie 恢复。需求反馈服务使用独立访客 Cookie；`/feedback-api/v1` 是该独立服务自身的版本号，与已移除的网站 v1 无关。Node.js 要求 >=24.12。移除范围与验收见 [main 分支说明](docs/V3_ONLY.md)。

```sh
npm run test:v3  # 全部 v3、反馈与仅 v3 边界专项；本地夹具，不替代构建和浏览器验收
```

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
- 首页本机布局在水合完成后恢复，首帧使用 SSR 默认布局；存储不可用时仍能显示和调整模块。首页路由节点意外脱离 DOM 时，容器最多恢复一次，避免页面只剩导航和页脚；不会整页刷新或自动重试写操作。
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
- VIP 昵称样式使用全量会员展示快照（用户 ID + 仅三展示字段的 configJson），全页面共用一次读取；后续携带内容版本，未变化只返回版本确认，不再按页面用户查询。服务端共享缓存与客户端可见性校验最长 30 秒；失败退避 30 秒起、最高 5 分钟，不把失败记为非会员。退出或凭据变化清理快照与计时器。此协议需 Rhythm 对应 Java 更新先上线，不兼容旧 userIds 响应。
- 聊天室侧边栏模块化
- 帖子当前读取、评论分页/写入、修订历史、热度和表态均接 v3；权限变化不恢复旧缓存正文
- 复读机、举报、草稿、职业/会员/勋章、积分、表情、账号设置等用户能力已分批接 v3，具体源码与验收限制见 docs/V3_MIGRATION.md
- 首页五资源及领域/标签目录使用当前 v3 数据，独立错误和重试；目录按真实元数据分页
- 通知/私信/聊天室使用 v3 HTTP 与票据订阅；经典功能链接直接导航，目标页面可能要求独立登录
- 已移除网站内部旧 apiKey → sym-ce/CSRF 桥接及无调用旧包装，不再提供 POST /__fp/page-auth；已有集成改用 v3 登录

闲聊室 `/idle-talk` 现网 404，**明确不做**。管理后台不在本站范围（继续用 Rhythm FTL `/admin`）。
游戏入口：`/games`（官方小游戏跳转 Rhythm + 鱼游投稿）；VIP：`/vips`（v3 本人会员及原子积分开通）。
用户列表/内容读取失败明确显示错误和重试，合法空结果单独展示，不用 mock 冒充。
SSR 另 prefetch：`/domains`、`/tags`、`/breezemoons`、`/top`、`/repeater`。
补齐页面：`/download`、`/agreement`、`/privacy`、`/activity`、`/following`、`/settings/point`、`/member/:name/medals`、`/city/:city`、`/charge/point`、`/column/:id`。

新增侧边栏模块：在 `src/chat/sidebar/modules` 加组件，并登记到 `registry.ts`。

表情设置与共享选择器已接入v3目录、分页分组/图片、组与成员增删、常用表情保存/默认恢复；实际范围及剩余旧链路见docs/V3_MIGRATION.md。

表情区域已追加组/成员名称排序编辑、快照分享码导入及本人旧云迁移；导入定位真实分页元数据，详见同一迁移文档。

资料的昵称/简介/网址、独立MBTI和头像（HTTPS地址或票据上传）已接v3；QQ/标签另有独立资源，现已接入，其他设置仍分批迁移。见docs/V3_MIGRATION.md及后端docs/api-v3-client-profile-work.md。

功能/显示、隐私与位置公开、语言时区及经典站点皮肤已追加v3偏好读写，按实际字段部分保存；这是偏好持久化，实际页面效果和剩余模块仍按迁移文档逐项验收。

首页跳转设置已接入：登录恢复后打开不带查询/片段的首页，读取当前设置并跳到已支持页面；空值保持首页，失败或未支持目标显示提示与重试/设置入口，SSR不读私人设置。

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

注册/找回密码/重置页已接既有v3账号入口，按服务端注册选项与验证组件发起短信，验证码直接绑定手机号；结果不明时先登录核实，不自动重发或重复完成。移除假重置元数据；密码不裁剪并沿6至128字符规则。实际文件、人工步骤与真实短信/极验等未验项见[账号入口迁移记录](docs/api-v3-client-account-access-work.md)。

客户端边界静态审计：`node tools/v3-client-boundary-audit.mjs --json /tmp/v3-client-boundary.json`。检查src内API字面量和退役导入，动态调用单列；这不替代运行时、权限及全功能验收。孤立catalog/gaps假数据已删除。

## 独立公测需求反馈（可选）

左侧设置面板可开启“需求反馈”弹窗，提供提交、列表、支持/反对及管理员处理，弹窗内切换不跳转当前页面。数据由独立 Node.js 服务保存，不进入 Rhythm；使用服务端生成的独立访客身份，无需站点登录；昵称仅展示，不代表站点认证。默认关闭。启动、功能开关、代理、管理员 ID、备份恢复与移除方式见 [反馈服务说明](feedback-service/README.md)。


## 内页 UI 规范

普通内页共用 `src/styles/inner-pages.css`，由 app 入口同时接入客户端与 SSR。容器分普通 1040px、宽内容 1200px、阅读 760px、账号表单 440px；普通标题24px（窄屏21px）、卡片圆角10px、内边距20px（窄屏16px）、标准控件36px。使用 `fp-page`/宽度变体、`fp-ui`、`fp-card`/`fp-surface`、`fp-page-title`、`fp-tabs`、`fp-pagination` 和 `fp-state` 标记接入；原生控件显式加 `fp-control`，不全局覆盖Vditor、阅读正文、气泡或悬浮窗口内部。

主操作与普通选中状态使用主题绿色，未读/提醒继续橙色，错误使用主题danger。页签窄屏横向滚动，反馈筛选窄屏两列并将搜索框独占一行；分页只统一外观，不改变真实页数、游标、授权或请求恢复语义。下载、专栏、长篇阅读、聊天室和404钓鱼保留专用布局。外层AppShell的main样式限定为直接子节点，避免再次覆盖内页自己的容器。

本轮 `npm run test:v3` 98个文件通过，新增实际编译组件的关注/粉丝、收藏、匿名内容首页读取失败重试；完整构建及类型检查通过。浏览器查看了普通列表/设置/榜单/账号表单/反馈、390px窄屏、深浅色和下载页特色，反馈公开列表使用本机后端。当前v3上游不可用，授权数据填充后的页面主要由既有组件专项覆盖，未执行真实账号写入、支付或短信；不能将加载/错误态截图当作全站真实数据验收。

接口离线处理：浏览器连接/正文断流、HTTP 502/504 或非 JSON 503 会跳转 `/offline`，保留原路径（含查询和片段）；并发失败只导航一次，旧身份请求不触发新身份跳转。JSON 503 及权限、业务错误保留当前页提示，不自动重发写操作。重新连接须收到 captcha-options 完整成功 v3 JSON 后才返回，网关响应、HTML 和断流均不算恢复。

生产浏览器可通过构建变量 `VITE_BROWSER_API_ORIGIN=https://fishpi.cn` 直连 Rhythm HTTP 与实时 WebSocket；留空仍支持本地同源开发代理。刷新Cookie继续credentials=include、Bearer仅内存，需求反馈仍请求本站/feedback-api/v1。直连必须由fishpi.cn允许本站Origin的CORS/预检及WebSocket来源；前端不绕过跨域限制。SSR仍为服务端直读，反馈身份独立本地核验，网络可达性独立验证。详见deploy/yui/README.md。

个人主页统一栏目由 `components/member/MemberTabs.vue` 在 AppShell 的 /member/:userName 路由范围挂载，帖子、回帖、勋章、关注、收藏及匿名子页共用完整导航，错误/隐私状态不移除导航。窄屏横向滚动，清风详情归属清风Tab；本人匿名与积分入口仅客户端认证后显示。/member/:userName/points 用 MemberPointsView 校验当前本人后挂载既有 PointsView，不能读取他人路径下的本人积分。/points、/stars 原独立入口保留。此次浏览器用本地503夹具验证跨子页切换与返回，真实账号私有栏目未浏览器登录验收；对应协议及身份隔离由专项覆盖。

总榜入口 `/top` 按社区活跃、创作与贡献、游戏挑战分组，16项均使用原路由；入口页不请求排行榜数据。详情页为桌面分类侧栏、窄屏横向分类，复用RankingBoard/ProfessionRanking原数据与分页逻辑。此次完整构建、排行榜及职业榜专项通过，桌面/390px入口与进入榜单后返回已浏览器验证；接口错误态使用本地503夹具，未据此宣称现网榜单数据可用。

全站时间展示统一使用 `src/utils/time.ts`：绝对时间按 Asia/Shanghai 输出 YYYY-MM-DD HH:mm:ss，日期输出 YYYY-MM-DD；无时区的既有日期字符串按北京时间解释，合法ISO偏移先换算，相对时间保留，缺失/无效时间显示“时间未知”。永久有效、纯日历日期、天气日期、上下班倒计时与在线时长保留各自语义；不修改API原始时间、排序、费用到期判断或SEO/机器可读ISO。覆盖文章/回帖/长篇、清风、聊天/私信/通知、专栏/用户主页、积分/反馈、日志及设置中的到期与操作记录。

时间专项验证UTC、纽约和上海进程输出一致，支持ISO/毫秒/既有北京时间及明确CST/UTC日志格式并拒绝坏日期。103项专项及完整构建通过；浏览器用明确标识的本机清风夹具验证UTC08:30:45在主列表/侧栏/刷新后均显示16:30:45，未写入真实站点数据。data:编译组件测试通过tools/ui-test-imports.mjs解析真实共享显示函数；单独运行这些测试时使用node --import ./tools/ui-test-imports.mjs tools/<测试文件>，全量test:v3已自动加载。
