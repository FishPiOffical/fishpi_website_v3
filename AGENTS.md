# 开发与交接约定

本文件适用于整个仓库，记录已确认的开发要求与实现约束。
用户最新明确指令优先。已实现功能应维护和扩展，不要重复重做。
开始工作前读取 README.md、相关源码及当前 git diff，确认实际状态。

## 项目范围

- 项目为摸鱼派用户站，采用 Vue 3、TypeScript、Pinia、Vite 与 SSR。
- 后端继续使用 Rhythm，功能行为与接口参考 https://fishpi.cn。
- 管理后台不在重构范围，继续使用 Rhythm 的 /admin。
- /idle-talk 已明确不做，不自行增加该页面。
- 公共功能尽量抽为独立组件、composable 或 store，避免跨页面复制实现。

## 接口与认证

- main仅支持v3；v1/v3兼容实现备份在v1_v3分支。不恢复版本切换、旧apiKey认证或旧协议适配，不修改Rhythm。需求反馈独立服务改用服务端签发的独立访客Cookie，不核验Rhythm身份、不接受站点UID或Bearer授权；其/feedback-api/v1是反馈服务自身版本号。

- 通知中的操作人actor与目标文章/评论author含义不同；操作类通知缺少actor时保留无身份状态，不得回退为目标作者。普通内容通知的作者及匿名规则独立保留。

- 登录页的用户名记忆是可选存储，读写失败不能阻断登录；认证成功后路由失败须独立重试原目标，不能再次提交密码。Vue Router可能resolve失败对象，不能只catch异常。

- SSR收不到URL片段；登录回跳首屏先用无片段地址，挂载后再恢复完整fullPath。评论滚动须等加载分支结束、当前页DOM实际挂载，再校验目标/身份；测试不能无条件伪造getElementById成功。

- 优先使用 Rhythm JSON 接口，不在运行时抓取现网 HTML 拼装数据。
- 当前覆盖以docs/V3_MIGRATION.md为准；MISSING_APIS仅历史来源，不恢复已删mock或旧包装。
- 列表读取失败明确报错与重试，合法空结果单独展示，不以空列表吞错或模拟记录冒充。
- 用户悬浮卡片加载失败应展示错误状态，不回退到模拟用户资料。
- v3浏览器只用内存Bearer与HttpOnly刷新Cookie，不写localStorage；旧apiKey脚本已移至备份分支，禁止把Bearer传入旧apiKey参数。当前分批状态见docs/V3_MIGRATION.md。
- 不反复调用密码登录接口；不要把密码、API Key、Cookie 写入源码或日志。
- 用户能力只走既有v3认证；旧page-auth换Cookie桥接已退役，经典链接直接导航，由目标页面认证。
- 浏览器验证默认只读；不要为测试随意发帖、转账或修改真实账号资料。

- v3 内容适配分别保留作者用户名与昵称：Name 字段用于主页链接/回复寻址，Nickname 字段仅展示；SSR 二次白名单投影同步保留昵称，匿名不从旧别名恢复身份。背景头像统一用 utils/avatar.ts 的 avatarStyle 做 CSS 字符串转义，不能给签名 URL 重新编码。 文章列表/详情/作者卡、普通评论及长篇作者/段评使用共享VipNickname，匿名分支不得挂载身份样式组件。

- 响应头成功不代表正文完整；JSON/文本及私有SVG/ZIP统一处理正文断流，未确认命令保留原幂等键，不自动重发收费请求。
- 问答悬赏/已采纳取v3详情qna，缺字段显示未知，不能编造零悬赏；采纳确认经ArticleInteraction→CommentItem通知详情重新GET，回执不直接覆盖文章当前状态。

- 离线通知按请求调用时的身份版本及登录状态隔离，排队请求也不能借用新身份；普通令牌轮换仍视为同一身份。

## 首页布局

- 首页保持模块化，默认布局为三列，用户可自定义。
- 每个模块支持拖动：上下排序、左右移动、列内堆叠及新增行。
- 保留编辑模式与自动保存；当前持久化键为 fishpi.home.layout.v2。
- 模块定义、布局状态、拖动逻辑分别维护在：
  - src/home/modules.ts
  - src/stores/homeLayout.ts
  - src/home/useHomeDrag.ts
- 聊天室侧栏中可迁移的模块也可以加入首页。
- 今日收入作为聊天室侧栏模块，并可加入首页，默认展示。
- 新注册用户头像应较小且均匀排布，每行填满，避免右侧大片空白。
- 连续签到、在线时长排行榜应显示头像；缺失头像使用统一默认头像方案。
- 默认顶部三栏应协调高度和内容排布。
- 最新内容模块可拉开内容填满高度。
- 热议和专栏列表保持自然条目高度，允许底部留白，不强行拉开条目间距。

## 设置入口

- 设置入口参考 Bilibili-Evolved：左侧半透明隐藏入口，点击展开面板。
- 集中管理首页模块、聊天室侧栏与今日收入设置。
- 不恢复浮动的首页配置按钮或今日收入悬浮窗。
- 设置面板与状态分别维护在：
  - src/components/settings/SettingsDrawer.vue
  - src/stores/settingsDrawer.ts
- 新增聊天室侧栏模块需维护 modules 组件、registry.ts 及相关元数据。

## 用户头像与全局资料卡片

- 全局资料卡片保持独立模块，由 AppShell 挂载。
- 核心组件：src/components/user/UserHoverCard.vue。
- 所有有明确用户身份的头像都应接入，不局限于首页或聊天室。
- 用户名来自 data-user-card 或 /member/ 链接，不根据图片 alt 猜测。
- 卡片资料、昵称、勋章、角色、积分、城市、在线状态及操作参考现网。
- 私信与转账入口根据登录状态和当前用户身份显示。
- 保留加载、失败状态，以及打开和关闭延迟。
- 卡片位置应受视口边界约束，支持用户从头像移入卡片操作。
- 快速切换用户时旧请求不能覆盖当前资料。
- 路由切换、身份变化和卸载时清理状态；身份变化时清空资料缓存。
- 支持键盘聚焦与 Escape 关闭，卡片内部切换焦点不能误关闭。
- 触屏点击应避免误触发悬浮交互。
- 客户端浮层保留 mounted 条件保护，避免 Teleport 导致 SSR hydration 不匹配。
- 默认头像优先复用现有 src/utils/avatar.ts，避免各页面自行定义不同回退。

## VIP 昵称与外观包

- VIP 昵称复用共享组件及配置解析，避免各页面复制样式逻辑：
  - src/components/user/VipNickname.vue
  - src/composables/useVipNickname.ts
  - src/styles/vip-nickname.css
- 扩展接入时核对用户 ID 与用户名来源、懒加载、请求去重和缓存行为。
- 昵称缓存到期须删除响应式条目并重新观察可见节点；仅用 Date.now() 比较不会使已挂载的 computed 自动失效。退出/HMR须清理共享计时器及旧请求。
- 是否已完成全站接入以当前代码及验证结果为准，不依据旧交接状态推断。
- 外观包遵循 src/packs/README.md：
  每包使用 pack.json 与 style.css，不包含 JavaScript。
- 主题免费；非默认对话框和头像框按现有 VIP 权限约定处理。

## 404 与离线钓鱼玩法

- 404 和 offline 页使用 Canvas 可视化玩法。
- 图鉴与商城已有实现，应在现有实现上维护。
- 图鉴支持捕获解锁、进度存档和分页。
- 图鉴与商城采用紧凑面板，避免内容直接向下展开成长列表。
- 商城支持现有鱼饵、道具及游戏内购买流程。
- 场景为猫钓鱼，第一人称画面主要显示鱼竿与猫爪。
- 猫爪直接使用 /images/waitingFish/cat.png。
- 派派鱼直接使用 /images/waitingFish/fish.png。
- 上述品牌资产不重新描绘或额外加工。
- 鱼种维持原版五十多种的规模，图案需体现名称与物种特征，
  泥鳅等不能简单套用普通鱼的同一轮廓。
- 标题保持“摸鱼等待 · 钓鱼”。
- 界面不显示“第一人称”或“再伸爪，继续摸鱼”文案。
- 入口：src/views/NotFoundView.vue、src/views/OfflineView.vue。
- 实现目录：src/games/waitingFish/；
  重点文件为 WaitingFishGame.vue、canvasGame.ts、fishKinds.ts 和 fishArt.ts。

## 开发、验证与提交

- 使用简体中文沟通，按用户要求直接在代码中实现。
- 保留用户已有修改；不擅自回退、覆盖或扩大任务范围。
- 用户要求解释或诊断时，先给出证据，不自行扩展为功能修改。
- 按改动风险验证；代码变更通常运行 npx vue-tsc -b。
- npm run build 包含类型检查、客户端构建和服务端构建。
- 涉及界面交互或 SSR 时，补充浏览器验证；
  未做的验证应明确说明，不能仅凭编译成功宣称交互已验证。
- 纯文档修改核对内容与差异即可，不需要额外执行构建。
- 开发服务固定使用 127.0.0.1:5173；端口冲突时先确认进程归属，
  不擅自结束用户进程。
- 用户最新要求每次修复完成后提交本地 Git；与 Rhythm 分别提交，未经明确要求不推送远端。
- Git 提交禁止包含 Cursor 的 Co-authored-by 标记，
  包括 Co-authored-by: Cursor <cursoragent@cursor.com>。
- 提交后核对实际提交信息及工作区状态。

## 进一步参考

- 首页自动跳转由HomePreferenceRedirect/homeRedirect承载：仅挂载后当前登录身份、无query/hash首页读取functions，支持路由内replace；失败/不支持保留首页提示，不能导航旧站、持久化私有设置或让迟到响应劫持离页/新身份。

- OwnerPreferences/v3-preferences.ts管理功能/显示/隐私/位置/语言，目录来自服务端，读错不得补默认公开值。仅提交可见且改动字段，display模式与皮肤不得互相覆盖；chatImageBlur=true确为模糊处理。站点皮肤和本机AppearancePicker独立，locale保存不代表整站翻译完成。

- 本人资料/MBTI/头像由OwnerProfileSettings与v3-profile.ts读取保存，别从公开卡片或me凑编辑值；上传仅取v3票据，图床请求只票据/无Cookie，按实际格式命名file并中止旧身份上传。上传后设置失败保留URL和同内容key，不能重传文件或误报整体失败。QQ已接独立第一方本人资源，禁并入公开/第三方profile；标签已接独立GET/PUT，响应规范化值回填；不要仅写profile.userTags或在前端静默丢弃超限项。

- README.md：启动、认证、SSR、功能范围与部署说明。
- docs/MISSING_APIS.md：现网接口缺口及替代方案。
- src/packs/README.md：外观包格式与稳定样式钩子。
- v3读取适配在src/api/v3-content.ts，由fishpi.ts保留旧调用签名后转发；领域/标签按真实ID，旧slug经目录解析，不伪装资源ID。未知计数不显示成0。身份切换须清除当前视图及缓存，旧异步请求不得重新写回；不能只监听已恒为null的legacy apiKey。

- v3通知见v3-notifications.ts/v3-realtime.ts与notices store：首帧票据、同源无query WS、ready/changed只失效后HTTP重读；身份/凭据变化同步清状态并关旧订阅，不回退user-channel。页用真实pagination，失败读操作保留key直至成功或凭据边界；AppShell认证导航必须mounted后显示以保持SSR一致。其余私信/紧急广播未随之迁移。

- v3表情适配见v3-emojis.ts：私有成员id用于编辑/删除、emojiId仅全局图片身份；签名URL不删query。Packs/Picker按accessToken隔离旧请求，写key同内容失败保留；常用目录来自服务端，不造图片回退。SettingsView认证模板同AppShell须挂载后显示。分享导入/旧云迁移已接线，须分页读取目标真实元数据，不能用sort=0占位；编辑器旧hint/上传发送仍另批迁移。

- 本人勋章由OwnerMedals/v3-medals.ts独立分页；展示为明确设置、移动保留原命令/key到结果确认，成功后读失败不能重复移动；有效列表不等于排序全集（过期也参与）。凭据边界清状态；MedalIcon的/gen仍旧页面会话，不可把Bearer传进图片URL。

- 本人职业OwnerProfessions/v3-professions.ts分离当前选择与已有进度、目录/进度/经验分别分页，不造零级。CUSTOM十模块完整发送，其余只preset；未知写保留原命令快照/key，草稿与迟到详情隔离。LEVEL_ONLY和PRIMARY_ONLY目前同为仅公开主职业，别自行按名字改语义；排行/公开资料另迁移。

- 职业榜ProfessionRanking与共享ProfessionGuide走v3；rank/可见人数取服务端，缺省经验不补0，不用top:jobs共享缓存。成长来源可重复，奖励仅概要。SideBar身份与本机布局模块须mounted后渲染，公共SSR仅加载态，避免已恢复客户端身份与游客SSR水合冲突。

- PublicProfessions/v3-profession-public.ts按模块/字段存在性展示，缺省不补空数组或0，SELECTED不造等级，公开页本人也不回退私有读取；换读者/目标清旧结果，不沿用隐藏名称。MemberView基础资料/SSR门禁仍旧链，不能称整个用户页已迁移或用v3摘要伪造缺失统计。

- /vips用OwnerMembership/v3-membership.ts：完整有界目录、不截断成功；支持字段看benefits的键存在而非真值，空旧配置不补false。开通确认冻结档位/券，同键恢复未知结果，后置GET失败不能重买；普通token刷新保留命令/草稿，context/actor变化才清旧状态与确认；资料/头像、偏好、职业、勋章设置同样以稳定身份保护读取、上传与未确认原key。资格与费用由服务端重验。共享昵称读取见下条。

- VipNickname/useVipNickname使用v3全量styles快照（用户ID+三展示字段configJson），后续version未变化不传list，不恢复userIds逐人请求；姓名仅必要时经v3摘要解析。内存快照/条件版本绑定凭据，失效拒旧回写；按服务端maxAgeMs清过期CSS，仅可见昵称触发共享校验，失败全局退避。null配置是未知，空样式不能推出非会员；匿名/SSR普通文本，不持久化名单。

- v3转账/邀请码由v3-finance.ts与v3Finance store承载，PointTransfer共享设置/主页；未知扣款命令/key跨SPA路由保留，正常非空token轮换保留，HTTP稳定身份版本或账号变化/退出清理。不能用token字符串变更清未确认扣款；恢复4xx也不证明此前未提交。仅内存、不跨整页刷新；后置余额读取失败不重买/重转。

- /points由v3-points.ts读本人真实记录/me余额，不能回用通知正文推金额或首条记录余额当当前余额。总分页服务端为准，两读独立错误；稳定身份版本/账号隔离旧读，正常token轮换保留页，SSR不读私有。descriptionHtml仅使用v3已清洗说明。

- 背包/四卡/积分改名用OwnerInventory/v3Inventory/v3-inventory，原mockUserBag和旧无消费者写已删。历史回执bag/名字不能回写当前状态，写后GET/me独立刷新；改名成功按ID/旧名失效昵称别名及旧资料缓存。未知消费key跨SPA、正常token刷新保留，身份边界清理；后置读取/缓存失败不再消费。

- 账号安全OwnerSecurity/v3-security当前密码原样、当前TOTP独立于新TOTP；新密码6..128 UTF16、不trim、Unicode且拒控制/坏代理。证明只内存/请求body摘要；敏感成功或未知结果须重新登录核实，不能沿用普通财务key恢复。MFA只本地资料、准备仅显式请求；身份/离页AbortSignal取消本人确认并清输入，极验helper代际隔离。APP码等仍另迁移。

- 私有导出OwnerPostExport/v3PostExport只在Pinia存key/元数据，恢复需重新填写当前证明；不是敏感改密的自动重登录策略。http.requestZip复用现有401/风控、限制体预算，不把JSON当文件；下载先当前状态再长度/hash，Blob地址本地交付后/离页/换号回收。当前余额读错不能再创建，旧公开export包装已删。

- 企业认证OwnerIdentityApplication/v3Identity原始图片仅私有闭包，Pinia不序列化原图或Blob URL；未知提交跨SPA固定字节/MIME/key，退出清理。异步读图前后绑定身份；提交历史回执不能替代当前状态，已读销毁仍可pending，不能同键恢复材料。旧公开图床提交已删，审核后台另处维护。

- 捐助ChargePointView/v3-donation仅读取服务端配置经典页链接，显式新页打开、不带凭据、不创建订单；不能改写回SPA同路径或假设经典Cookie已登录。旧pay/wechat客户端下单已移除，真实支付另验。

- 本人匿贴/匿回用AnonymousContentView独立原/member路径，不依赖公开userinfo或SSR预取；路径用户名必须当前本人，否则不请求/me并明确限制。列表仅元数据、评论ID/私密标记及所属文章链接，不假称定位任意页评论；身份/目标/kind变化清列表，普通token刷新保留页，无私有缓存。

- 关注/粉丝列表独立UserRelationsView/v3-user-relations，不依赖MemberView旧userinfo或SSR资料；实际pagination和403/空结果分开，读者/目标/kind边界清理且拒迟到响应，正常token轮换保留页。两个读取页之外，主页/悬浮卡片关注写入现用UserFollowButton/v3UserFollow；未知明确命令同key跨SPA保留，成功后GET当前状态，历史receipt不代表现状。标签收藏写入/卡片基础资料仍旧链，禁止宣称整关注模块完成。异步按钮须保持DOM节点与焦点，用aria-disabled/busy和处理函数阻止重复操作，避免弹层自动失焦关闭。

- 保存内容读取在SavedContentView/v3-saved-content：本人/me集合保留available=false ID占位，他人仅公开路径，403不回退本人；/stars同视图。占位不投影标题/作者/正文，无假链接；标签ID链接、描述纯文本。共享v3摘要须保留articleAnonymous，ArticleFeed不得对匿名作者生成主页链接/头像/简介。标签/文章关系写入仍另迁移；/watch动态现已接v3-following-feed。

- 关注动态WatchView/v3-following-feed固定当前账号与source，真实pageCount而非短页长度；清风只呈现既有服务端清洗的contentHtml，BreezemoonList复用decodeV3RelationUser公开白名单，不回退源文HTML/全站数据。读者/分类代际清理，SSR准备态；全站清风/侧栏写入仍旧链。

- 清风主列表/首页/侧栏用BreezemoonPanel与v3Breezemoons，未知写命令原key跨组件恢复，completed通知清除原提交草稿；成功后仅重读，列表失败不重写。SSR载荷必须由每个app的SSR_PAYLOAD_KEY提供，不用进程global；客户端initial state仍一次消费。个人清风旧读取另迁移，首页签到/复读既有hydration差异不冒充清风验收通过。

- ContentRelationButton/v3ContentRelations按kind+ID共享明确命令，覆盖标签/普通文章/长篇阅读器，未知原key恢复，receipt后GET当前状态。跨组件完成通知必须废弃在途旧GET再重读，不能因loading丢通知；UserFollowButton同样处理。旧followArticle/watchArticle包装已删，禁止回用详情缺省isFollowing/isWatching推状态。

- 首次路由在 mount 前不恢复认证，entry 挂载后交 clientStartup；SSR/客户端私有占位一致且当前 auth.isLoggedIn 才挂子页。保留后续 SPA 守卫和迟到启动不覆盖新导航，不能用 startup.ready 替代真实认证。

- 文章投票/感谢/打赏共ArticleInteraction与v3ArticleInteractions：明确命令与原key恢复，确认后GET，不用历史receipt计数或授权正文；付费正文仅当前合法详情，离页取消本人费用确认，换号清命令/正文，余额错误独立。

- 评论三写共CommentComposer/v3Comments；原Markdown不trim、编辑默认省visible，未知固定原article/id/input/key，成功强制重读而非receipt正文，迟到/确认按身份及回复目标隔离。长篇取paragraphs锚点HTML、平铺段评分页，匿名本人不得凭用户名推断归属，仍缺本人管理证明入口。

- ArticleInteraction的resource默认articles，comments支持vote/thanks/accept；API/命令/完成通知/读身份均按资源隔离，禁止同ID串状态。CommentItem和长篇段评共用该组件，当前状态和费用必须GET，未知原choice/key恢复；异步保留按钮节点并由处理函数阻止重复，不能仅靠aria属性。

- 评论感谢/采纳由当前GET给费用/基本资格，POST回执不替代当前状态；anonymous费用0，canThank/canAccept不保证提交时余额或权限。任何comments/accept完成须重读全部挂载采纳候选；其他资源/种类仍精确目标隔离。

- 表态统一V3ReactionBar/v3Reactions/v3-reactions，目录无硬编码兜底，article/comment/chat+ID隔离原choice/key；回执不回填、事件仅失效后GET，不合并他人actorReaction。认证恢复前零请求，游客显式读且事件不扇出，chat需认证；迟到目录/状态也按身份废弃。旧ReactionBar未接线，不要重新接回旧toggle/快照。消息添加入口仅emoji（保留aria-label），palette挂载后Teleport到body并用v-show保留节点，选择/外部/Escape/滚动关闭，不能破坏原键恢复。

- 历史统一RevisionHistory/v3-revisions，惰性当前GET、列表/详情各自序号与重试；current仅取列表，评论time=null未知，清洗content只能作文本不能当原Markdown/HTML预览或编辑。ArticleView以getAuthContextVersion+有无token+owner管理读取，正常token轮换不能关闭历史；换身份仍清正文。

- PostView/v3Posts/v3-posts：source原Markdown，PATCH仅变更，匿名/元数据不改；已启用打赏不以0关闭，发布draftId交原核心消费勿另删稿。metadata不清正文，未知op/id/input/key跨SPA；确认后导航失败防重发，编辑续写需当前source。Vditor预览/上传/工具栏表情/@及文章标签联想已接v3；draft隐藏thoughtContent/历史type4不能丢。

- MarkdownEditor预览由markdownPreview适配器：同步transform空串阻止Vditor本地回退，parse异步Bearer预览；正文/身份/卸载清旧结果，失败文本+按钮重试。不可恢复旧url:/markdown或把异步函数直接塞入同步transform；高亮/公式等异步后处理尚需联调。

- 共享编辑器上传用v3-uploads/editorUpload：唯一file名称对应多文件部分结果，图床仅专用票据/omit Cookie/禁重定向；外部正文/身份/卸载取消旧插入。Vditor insertValue走HTML模板，原Markdown统一insertMD，目的地转义括号；不能把合法HTTP成功误当实际图片可加载。其他旧上传消费者仍待迁移。

- Editor工具栏自定义v3-emoji复用EmojiPicker，Lute本地Unicode只显示且过滤HTML/URL；MarkdownEditor经emoji-labels事件同步给ChatComposer下方选择器，选择仍插服务端别名。Picker authContext/owner隔离而非token字符串，普通轮换保留；below/隐藏trigger用于工具栏。@联想已接suggestions/users，规则和限制见后端user-suggestions工作记录。

- @联想用v3-user-suggestions/mentionHints，取消时立即结算旧promise，防Vditor迟到genHTML覆盖新候选；在根input.capture清提示，勿放延迟options.input。原生hint会自行追加冒号项，不要给toolbar元素加emoji别名。客户端API10条/64位，当前CDN UI自身显示8条/触发31位。

- PostView现有专栏用AuthorColumnPicker与v3-author-columns本人分页；只显式选择更新id/title，不自动清章节/封面或选首项；源ID未在本页保留，不视作当前有效证明。标签联想已实现，见后端tag-suggestions工作记录。

- TagInput/v3-tag-suggestions按原分隔符及光标定位，只替换当前token，其他原文不变；IME组合期不查、选择不造目录，旧响应/光标变更/身份切换拒回填。空前缀取真实热门，GET失败保留手输，文章提交规范化仍由原服务执行。

- 客户端本人文章操作ArticleOwnerActions/v3ArticleOwner惰性source仅留id/status，匿名不猜ID；未知kind/id/key跨SPA、退出清空，非持久队列。置顶回执非当前stick、成功后GET失败只重读；删除清正文且导航失败不重发。普通/长文共享入口，私有source不得回显。

- ArticleView文章实时统一subscribeArticleChanges，精确票据/ready/articleId，首帧传票，article.changed仅提示与失效，HTTP显式重读；新事件revision不可被旧读清除。热度用v3 GET显示本节点近似连接，失败不造0，游客不查；普通/全屏长文共用live-status，旧article-channel正文禁止接回。

- 独立/chat页由V3PrivateMessages/v3Messages管理，用户ID绑定、历史before游标，读取不自动已读；未知原kind/target/body/key跨SPA，成功当前GET而非回执拼正文。普通token轮换保草稿，watch多目标须稳定序列化身份，不能新数组触发重置；messages.changed仅失效。独立页/抽屉共面板，privateInbox单订阅/当前未读及入口不存正文；查询合并、失败未知非0。旧whispers已删，聊天室仍独立待迁移。

- 聊天室原文/引用由useChatMessageSource→v3-chat-messages当前详情；只传id，不采旧列表HTML/作者。卡片仅公开摘要、unavailable清正文，普通Markdown/HTML分列，作者转义、多行逐行引用；取消/身份隔离与独立rawOpen。普通发送已接v3ChatPublication，主历史/实时已接v3ChatTimeline。

- ChatStyle/appearance首帧统一SSR默认，AppShell挂载后restoreStyle/restore；不要在store初始化读本地布局/主题改变服务端首帧结构或选中类，避免现代布局/浅色偏好水合不一致。

- 普通聊天室send→v3ChatPublication，原content/client/key跨SPA；confirmation_required明确确认原键，成功只metadata后当前GET，读取失败不重发。Chatroom/抽屉输入匹配才清，当前详情投影去重。旧特殊按钮走独立legacy临时链，禁止普通正文隐式回退旧语法执行器；消息历史/实时已接v3ChatTimeline；在线已接v3ChatOnline，其他剩余链另迁移。

- 聊天室消息统一v3ChatTimeline游标/首帧chat事件；WS仅ID/revision，当前GET合并，旧响应/旧页不覆盖更新或复活删除，401/403清授权并拒迟到投影。ready/sync重读窗口，清屏不自动重灌；Home/SSR不取旧chat正文，节点密钥链已从消息消费者移除。在线已接v3ChatOnline；mutes/特殊写等仍单独迁移。

- 在线名单统一v3ChatOnline/ChatOnlineList；total不可用users.length替代，错误未知与0区分，筛选仅本页。保留采样范围限制与原页重试，换身份清除/轮换当前页重读，SSR不取旧online载荷。

- website_v3撤回用v3ChatRevoke/ChatRevokeAction/Recovery；作者ID认领，确认后DELETE，未知原ID/key跨SPA、恢复4xx不清命令，换身份清理；成功经timeline.removeConfirmed保留删除集合阻止迟到历史/详情/发送复活，不能回接旧撤回wrapper。

- website_v3消息上下文用useChatContext/ChatContextPanel与/cr#chatroom{id}；窗口独立于最新timeline，前后翻页替换，失败原方向重试，权限/404清正文。timeline.changeHint仅元数据，使相关/在途成员失效；初次登录恢复不得抹掉hash，返回最新清hash并重读主窗。

- website_v3话题修改用v3ChatTopic/ChatTopicEditor/Recovery；原text/key跨SPA未知恢复，confirmation_required明确确认，当前值只GET不以回执覆盖，GET失败不再付费。timeline.readTopic可主动无订阅读取且保留身份/代数隔离；旧setDiscuss包装已删。

- v3客户端弹幕使用v3ChatBarrage/v3ChatBarragePrice，原content/color/key恢复且回执不补播；认证chat.barrager白名单→timeline独立ref→AppShell唯一ChatBarrageOverlay，纯文本/有界去重/定时清理，不进历史或上下文。详见docs/api-v3-client-chat-barrage-work.md。

- v3客户端音乐发送在v3ChatMusic：冻结四字段/key，成功仅当前详情GET后入timeline，回执不充正文；ChatCard数字ID走网易云链接，显式媒体播放有乱序和错误处理。见docs/api-v3-client-chat-music-work.md。

- v3客户端天气发送在v3ChatWeather，固定五天客户端数据，UTC完整年份日历/20代码/整数温度白名单；表单不默认伪造预报，成功仅当前GET后入timeline，原city/description/days/key恢复。见docs/api-v3-client-chat-weather-work.md。

- website_v3红包由v3ChatRedPackets统一创建/详情/领取及原键恢复；卡片只GET，风险领取须显式确认，猜拳手势独立选择。metadata不作当前正文，旧历史404不回退旧领取器；见docs/api-v3-client-chat-red-packets-work.md。

- v3思过崖GET /api/v3/chat/mutes要求content.read，按用户ID读实际未到期sys-mute及有效账号，不读si:guo用户名快照；五公开字段/分页，坏状态或预算超限503。客户端v3ChatMutes按需共享读取，失败人数未知，见docs/api-v3-chat-mutes-work.md。

- website_v3涂鸦PaintPanel共用v3-uploads，具名PNG只插草稿不自动发；上传冻结绘制，失败保画布，关闭/身份变化拒迟到结果，同账号轮换保留。旧uploadFiles已移除，见docs/api-v3-client-chat-paint-work.md。

- website_v3举报统一ReportDialog/v3Reports，目录GET无本地兜底，四目标理由分列/聊天室仅49；原type/id/reason/memo/key跨SPA恢复，AppShell唯一ReportRecovery只显编号不显备注。旧reportContent已删，见docs/api-v3-client-reports-work.md。

- website_v3复读机由v3-repeater/useRepeaterFeed/v3Repeater接列表、服务端next及原键写恢复；榜单仅前12，写回执仅编号，成功GET当前榜单，随机项可离榜。Home/SSR明确joke，纯文本不stripHTML；见docs/api-v3-client-repeater-work.md。

- website_v3鱼游在v3-fish-games/useFishGames/v3FishGames：默认votes分页、详情/评论独立读、明确三态投票，五字段投稿/编辑含OAuth必填；回执不写当前公开内容，未知原键跨SPA恢复。官方游戏只导航经典站点，见docs/api-v3-client-fish-games-work.md。

- website_v3同城用v3-cities/useCityFeed双资源真分页，访客沿现有optional scope，独立错误/原页重试；Vue Router城市参数已解码，禁止再decodeURIComponent，API仅编码一次。移除近50条清风过滤，见docs/api-v3-client-cities-work.md。

- website_v3大事记由v3-milestones/useMilestones/v3Milestones提供公开SSR时间线及本人状态；本人content是历史HTML或原文，必须经现有preview清洗后展示，失败禁止原文回退。投稿回执pending不代替当前GET审核状态，原键跨SPA恢复；见docs/api-v3-client-milestones-work.md。

- website_v3统计/statistic用v3-statistics/useStatistics仅投影九项非负安全整数，错误清快照不填零；公开SSR按请求提供并一次消费，当前登录/凭据轮换重新读，拒迟到。仅统计快照，不宣称全站去重在线；见docs/api-v3-client-statistics-work.md。

- website_v3账号页OwnerAppLogin只接既有网页扫码三POST，qrcode本地矩阵绘SVG；旧apiKey/外部QR包装已删。仅APP确认后明确批准，未知写先查状态，consumed才完成；到期/离页/身份边界清码，同账号轮换重验原issuer，不自动升级。APP源码不改；见docs/api-v3-client-app-login-work.md。

- website_v3普通榜单共用v3-rankings/useRankingBoard/RankingBoard，十五类及游戏子类均有限快照分页；首页独立size8，不进旧Home缓存或mock兜底。HTTP嵌套pagination与SSR投影平页分别校验，初始只首挂复用；职业仍独立。见docs/api-v3-client-rankings-work.md。

- website_v3游戏存档在OwnerGameSaves/v3GameSaves：仅evolve-save，原文/版本/键冻结跨SPA恢复，GET核验UTF8/hash；读取不覆盖草稿，历史metadata不回写当前版，409须重读后明确决定。正文只入textarea，全局不显原文；见docs/api-v3-client-game-saves-work.md。

- v3昨日奖励可选expectedDate进幂等请求，锁本人后服务器日期不符拒fresh，已提交旧键先回放；旧{}保持。CheckinPanel/useActivityStatus读真实状态与门槛，v3Activity原date/key跨SPA恢复，日期变化仅在回执未命中时释放原命令；不把旧回执当当前可领状态。见docs/api-v3-client-activity-work.md。

- website_v3用户悬浮卡用v3-public-user公开白名单（原六字段及cardBg/userPoint/onlineMinute），重开/轮换读当前资料，不补旧角色/在线/积分。已知公开ID传UserFollowButton.userId绑定关系目标，旧仅用户名调用保持；主页/徽章页旧消费者另迁移。见docs/api-v3-client-user-card-work.md。

- v3公开勋章页使用既有用户名分页GET与usePublicMedals身份边界；历史重复授予不按定义ID去重，公开契约无图片URL，不回退旧完整用户或生成图片接口。MemberView已独立迁移公开六字段和当前栏目v3列表。

- 用户主页useMemberPage将公开资料与当前栏目独立读取；SSR仅fetchPublicUser白名单并消费时重投影，不缓存旧完整用户。公开文章/回帖需署名作者匹配，清风深链接直接GET并复核归属，禁止从最近列表推断删除。

- 注册/找回三页共用AccountAccessForm和v3-account-access；注册SMS快照绑定邀请信息，完成无幂等回执，未知结果先登录核实而非自动重发。手机号/验证码不放URL或storage；useGeetest4新增可选服务端captchaId，旧默认调用保持。构建必须单独核验退出码，不能让后续命令成功掩盖失败。

- 公开专栏四GET由ApiV3PublicColumnQueryService按当前可见署名长篇SQL投影，先过滤再计数/分页，作者绑定所有者及0/3状态；卡片最近章/数量/时间不能回用旧存储值。客户端usePublicColumn独立资料/分页及身份边界，原章号保留，空/失败封面用CSS占位；旧经典读取未同步改造。

- v3发现三GET由ApiV3DiscoveryExtrasQueryService只读SQL：recent-members仅status0公开四字段；random静态注册先于articleId，当前0/3作者/可列出/游客可读与匿名DTO；日志BINARY固定类别先过滤计数，只选oId/key1/key3，禁止回退旧data/key2。客户端最近用户SSR独立消费、不入Home旧缓存，三资源失败清旧/原页重试。

- v3勋章图片在ApiV3MedalImageQueryService/Service及ApiV3MedalSvg：profile.read、指定本人/公开owner、当前有效grant/定义前后核对，固定renderer无重定向、SVG白名单后仅图片响应。Latke路由前解码会拆开编码斜杠，图片medalId须用查询参数、保留原128单位键且不重复解码；客户端V3MedalImage只用Bearer Blob img/释放与身份隔离，不再建/gen Cookie。复杂CSS/外部资源不保留，实际renderer需联调。

- website_v3列表由v3-article-list/useArticleListing按真实分页读取：文章20/专栏12，专栏只取当前选择目录，不从文章猜作品或作者。SSR articleListing按kind/extra/order绑定且白名单一次消费；身份/目标变更清旧、失败保原页重试，不用SWR回退。Home旧feed/聚合缓存未在此批整体改造。

- Home五资源读取在`v3-home-reads`/`useHomeRead`，SSR失败null与合法[]分开，每应用消费/白名单，不能恢复聚合SWR或文章伪造专栏；复读机用ready区分未知。聊天室草稿身份边界用context/是否登录/actor，普通Token轮换须保留。

- 领域/标签目录页共用`v3-directory`/`useDirectory`，固定50项真实分页、SSR kind/第一页绑定和响应白名单；条目链接使用数字ID，不二次解码名称。不能恢复目录整库聚合SWR或按条数猜下一页。

- 文章实时票据当前明确403/404须停止重连并清绑定读者/目标的正文、目录和放大图，拒绝在途回填；验证码/503不能假称资源删除。
- ArticleView正文/评论不进通用SWR；所有来源当前401/403/404清内容与引用，确认写入后503仅GET重试。普通Token轮换重读须保留挂载评论草稿/历史，卸载与页号迟到检查不可移除；v3Article须核对详情ID/逐条comment.articleId/页与size20并拒重复，参数先验后发请求；评论后页缩减为0页仍须保留返回第一页入口。

- 客户端边界复核用website_v3的`tools/v3-client-boundary-audit.mjs`，仅AST字面量/静态导入，动态表达式单列，不当运行覆盖。DomainItem在content-types，catalog/gaps假数据已删；离线ping只用v3，须完整成功的captcha-options JSON才算恢复；502/504及非JSON 503触发离线，JSON资源503仍原页报错。

- Rhythm注册/文档核对用`tools/api-v3-contract-audit.mjs`，从Router.requestMapping追本类辅助注册；条件/重载歧义需复核。通过仅证明固定源码形式与API.md一致，不当作IoC/HTTP或业务完成。
- 本机联调使用5173→Rhythm 8081，`.env.development.local`只保存本地目标，8080是其他项目。Vite对login/refresh/logout须保留浏览器Host/Origin/真实Referer，不可合成来源证明；真实代理回归用`tools/v3-credential-proxy-test.mjs`。实际首批证据见docs/api-v3-live-integration-work.md，不能用隔离测试替代业务验收。

- MarkdownEditor输入回调可能延迟；PostView/ChatComposer冻结写命令、判断未保存内容、收起/切换布局或追加话题/涂鸦前须flush实时缓冲，未加载应拒绝；未修改的编辑器规范化值不能覆盖精确原文。

- 长篇上下文由独立ArticleColumnNavigation读取articles/{id}/column，仅摘要/前后章；目录按需分页，不可用旧longArticleColumnView推造全目录；导航错误不吞为无关联，文章/凭据边界清旧响应。

- 长篇阅读登记由ArticleReadRegistration在实际正文挂载后显式POST；SSR/预览/游客/本人不发，不因普通token刷新重发，不持久化正文/凭据。服务端6小时去重；错误独立于正文、仅显式重试，文章与身份变化丢弃迟到反馈，不能将记录接口当奖励结算。

- 跨仓库路由核对先由Rhythm生成当前contract audit JSON，再用tools/v3-route-parity-audit.mjs及v3-route-builder-probe.mjs的--routes读取；未知转发和pattern候选不计运行通过，builder probe只允许截停transport，禁止改为真实请求执行敏感/收费样例。

- EmojiPacks读取/变更恢复以context+actor绑定，普通token刷新保留未确认命令key及草稿；退出/新登录才清旧。分享导入后按真实分页找到组元数据，不能用回执伪造排序；外部删除当前组须显示错误并允许重新选择。

- NotificationsView分类/全部已读的未知命令key绑定context+actor，普通token轮换保留页码与原key；换身份/卸载清旧，迟到结果不得invalidate新页。恢复成功后只当前GET回读，不把旧回执当当前未读数。ProfessionRanking同身份刷新须保留所选职业/提示和独立请求页码（包括未完成p2），同时重做当前GET；换身份才清旧。

- 评论深链用v3-comment-location/commentLink及ArticleCommentLocation，当前位置由后端确定，不从时间/哈希猜页。当前文章、身份、页数据及DOM均绑定后再滚动；长篇沿active/orphaned分组，失位显式重查，不能回退经典站或翻扫全部分页。

- 个人中心背景与统计来自v3公开资料cardBg/userPoint/onlineMinute，兼容旧服务端缺字段但不补零；SSR同一decodePublicUser二次投影，背景复用avatarStyle保留签名URL。cardBg为空才用头像封面，不能把自定义背景模糊掉。

- 聊天外观由v3ChatAppearance保存本人ID对；共享ChatMessageMgmtService在消息写入事务固化appearance，ChatBubble/Home按消息快照渲染，禁止当前用户外观或逐作者查询覆盖历史。v1目录/CSS保持稳定，升级先迁移Rhythm独立偏好表，见docs/chat-appearance-sync-plan.md。

- 用户站不展示文章/评论/长篇段评修订历史入口，也不展示文章实时变更的“读取最新内容”提示。历史API权限保持Rhythm既有规则，不收紧为仅管理员；管理操作仍走/admin，不因前端隐藏而更改后端授权。

- 私信打开会话后由V3PrivateMessages在当前历史成功显示时显式发送read；非当前/遮挡/失败不误标，未知原键恢复。GET历史仍只读，未读数只从成功后的当前GET刷新，不能乐观清零或循环自动写。

- 首页默认classic，SSR/首帧一致，已保存compact/classic选择与各自布局不覆盖。网络故障时AppShell仅对当前已有data-public-content=ready的公开内容保留页内提示；首次无内容仍offline，401/403/身份边界继续清授权。fp:retry-public只触发当前挂载公开读取，禁止重发写操作。http仅合并同凭据参数的并发公共列表GET，不缓存完成结果或合并私有/可取消请求。

- 个人主页职业与勋章由 MemberProfileBadges 放在资料卡，旧子路由定位到对应区域。主职业摘要单独读取，展开才加载职业详情；公开勋章图片走 v3 SVG，可供游客读取，私有勋章图片仍需登录。
