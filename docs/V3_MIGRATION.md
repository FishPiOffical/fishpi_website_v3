# v3 客户端迁移（2026-10-25）

## 当前实际状态

客户端位于本仓库，后端位于 /Users/ling/Documents/GitHub/rhythm。此前后端文档只确认“当前后端仓库没有客户端文件”，不能据此推定客户端不可用。保留已有登录/专栏六个未提交文件改动后继续迁移，未提交、推送或发布。

已接线：登录、Cookie刷新恢复、退出、本人资料与会员状态；文章列表/各分类、搜索、领域、标签、文章详情及独立评论分页。专栏读取继续原有v3接线。旧调用方参数位置暂保留，但上述功能不把apiKey写入URL或请求体，由共享transport发送内存Bearer。

已追加通知列表、真实分页、未读数、本类/全部已读及notifications.changed实时失效订阅。

尚未完成：文章/评论写操作及其他互动、旧文章Socket、思绪回放、长篇详情的完整专栏上下文，以及设置/私信/聊天室/用户页/排行等其余模块。通知删除、单条已读及旧紧急广播/私信推送尚未接UI。旧apiKey保持null，禁止把Bearer塞进旧接口冒充完成。部分旧UI操作仍依赖它，不能据本轮读取通过声称整站可用或已迁移。

## 实际修改文件

- src/api/http.ts：内存token同步订阅，401并发刷新合并，旧请求不复活新身份；login/refresh/logout的Cookie写操作串行，认证端点不递归刷新，SSR与外部/旧URL不携带Bearer。明确401的匿名恢复结果会记住，公开导航不会不断刷新；临时网络/服务失败可后续重试。
- src/stores/auth.ts、src/router/index.ts：同步安装token再取me，restore去重、登录/登出版本检查及旧慢响应隔离；会员读取仅当前本人v3资源；凭据不写localStorage。
- src/api/fishpi.ts、src/api/v3-content.ts：六个读取helper、严格DTO适配，移除这些链路的mock/旧接口回退；目录ID/旧slug解析及付费/匿名/私密内容投影。hot映射month-comments，good映射原有hot热度，qna/perfect使用新增type。
- src/utils/swr.ts、src/views/HomeView.vue、ArticleListView.vue、ArticleView.vue、DomainView.vue：清缓存同时废弃旧请求，监听实际accessToken；当前页面的私人正文/列表在身份变化时清除，过期响应不写回。接口未给的点赞/收藏/领域文章数不伪装成0，移除已迁移读取页的旧mock提示。不修改CSS或样式源码。
- scripts/tests/v3-auth-transport.mjs、scripts/tests/v3-cache-identity.mjs、tools/v3-content-test.mjs：真实TS逻辑配合隔离fetch/数据夹具测试，非生产调用。
- README.md、AGENTS.md、docs/MISSING_APIS.md、本文：纠正旧apiKey及缺口记录。

## 执行证据

根执行认证12组、缓存3组与内容适配专项通过；日志分别为 /tmp/rhythm-v3-client-auth-final.log、工具控制台及内容专项控制台。认证测试用真实transport/store及Pinia，fetch、验证码UI、登录包装和缓存清理边界明确适配；缓存专项运行实际SWR工具，验证身份清理后的旧请求不应用、不重新缓存。

执行corepack yarn run build，通过vue-tsc、客户端及SSR两份构建；未改package.json/lockfile。生成的dist产物由构建管理，未直接改css/min.js。

浏览器使用独立127.0.0.1数据夹具，不连接实际Rhythm或生产写入。IAB窄视口实际验证：recent列表→文章详情正文/空评论，search?q=empty为空，search?q=error显示错误，domains→domain/812读取文章。没有把夹具测试当真实数据库或服务端验收。临时服务与浏览器页已关闭；截图 /tmp/rhythm-v3-client-read-proof.png。当前可用浏览器没有宽视口控制能力，桌面宽屏及真实移动设备尚未验证。

本轮构建的dist/client/assets定向扫描未发现sourceMappingURL或已检查的Vue版本头；这不是全站CDN扫描、目录配置或全部库指纹验证。现有旧公网资源、下载/图床返回路径与Before黑名单、验证码解封仍未运行验收。

## 完整人工链

1. 独立开发库完成后端已有迁移，IDEA重新编译/重启并明确确认；客户端目标设置为该开发服务，启动127.0.0.1:5173，不把新源码测试指向尚未重启的旧服务。
2. 从recent进入文章，验证标题、正文、匿名身份、真实浏览/回帖、评论分页；进入qna/perfect，确认优选长篇存在；热议只包含近一个自然月且置顶优先，好评仍按热度。对不可读/隐藏/讨论/停用作者目标验证不被列表或详情绕过。
3. 从领域/标签目录进入文章，核对ID路径和旧slug链接；搜索正常、空结果和错误均真实展示，无模拟帖子。错误响应、断网、404及越界分页不得变成其他分类的假数据。
4. 在真实开发账号登录，首个me请求立即带Bearer，刷新页面用Cookie恢复。并发过期请求只刷新一次，失败不递归。登出期间延迟旧请求、接着登录另一个账号，旧正文/付费区/列表不得回写或串账号；Cookie/apiKey不能替代v3Bearer。不要为测试重复调用生产密码登录。
5. 在桌面宽屏、窄屏和真实移动端回归SSR首屏与路由切换；检查XSS文本、私密评论、未购买付费区、访问控制、黑名单/test及验证码。其余未迁移功能仍按下一批逐项完成，不能以本轮的编译/局部页面通过代替整站验收。


## 付费置顶读取衔接（2026-10-24）

后端新增付费置顶POST与stick元数据，用户已批准recent有效置顶优先、永久最先。客户端fishpi.ts增加ArticleStickState，v3-content.ts投影active/permanent/expiresAt，ArticleFeed.vue两种列表与ArticleView.vue详情显示状态；不将布尔状态伪装为旧时间戳。tools/v3-content-test.mjs补永久null/损坏类型与安全整数断言。corepack yarn run build通过；IAB实际宽视口使用独立本地夹具验证列表徽标→详情“永久置顶”，截图/tmp/rhythm-v3-stick-proof.png，未做真实扣费。临时页/服务已关。前轮窄视口+本轮宽视口均仅夹具，真实设备、后端重启和本人写操作仍待验；付费核心及人工链见后端docs/api-v3-article-stick-work.md。

## 通知HTTP与实时订阅（2026-10-25）

新增src/api/v3-notifications.ts，严格适配DTO、受限内容不回填、匿名作者不复原、历史未知类型整数可归其他，精确站点/配置后端来源转本地路由；真实pagination决定下一页，不以数组长度猜测；私人通知页不缓存旧成功数据，刷新失败明确显示错误。未读categories与total均校验，失败显示错误/未读数不可用，不以空数组或0冒充成功。本类/全部已读POST保存失败操作key直到成功或凭据边界，已读回执changed为数量。

新增src/api/v3-realtime.ts，只POST签票、查询无凭据的同源/api/v3/realtime、首帧authenticate；ready和notifications.changed触发HTTP重读，心跳、重连新票及身份变化/卸载清理。票据不进URL/持久存储。src/stores/notices.ts从内存token同步清空状态，晚到旧请求不能回写；不再用legacy user-channel推送冒充v3通知，也不因此迁移私信推送或紧急广播。src/views/NotificationsView.vue、components/notifications/NoticeIcon.vue补other分类、真实分页和身份边界，保持原style源码。

AppShell移除旧apiKey通知连接生命周期，由notice store管理；登录导航挂载后才显示，修复router恢复认证早于hydrate导致SSR节点不一致。server.js、vite.config.ts补开发WS代理，docs/nginx.example.conf补生产示例路径；未改实际nginx配置。fishpi.ts保留旧签名作适配桥，不发送旧apiKey，其他未迁移功能仍按本文件范围处理。

tools/v3-notifications-test.mjs六组通过（真实TS adapter/realtime与Pinia store，fetch/socket/timer边界适配），认证12组和缓存3组回归通过；corepack yarn run build通过类型、客户端及SSR构建。日志/tmp/rhythm-v3-client-notifications-{tests,auth,cache,build}.log。IAB本地HTTP+WS夹具加载实际SSR应用，验证12未读/2页、不可读内容无泄漏、已读归零、错误页与退出清空，且WS经真实开发代理认证；SSR修复后新页hydration日志为空。截图/tmp/rhythm-v3-client-notifications-proof.png。所有临时页/自己启动的IPv4服务已关；另一项目IPv6:5173进程未动。真实Rhythm、Cookie风控与移动设备未验，不把夹具当真实服务。

标准JS版本审计扫描本次生成产物发现一项既有旧表情兜底引用vditor@3.8.7（src/api/fishpi.ts的mockEmotions）；本批未改该未迁移模块，下一批需以真实v3常用表情读取替换。不能宣称整个客户端静态版本清理通过；没有直接修改dist/CSS/min.js。完整文件、反漏扫和人工链见后端docs/api-v3-client-notifications-work.md。

## 常用表情与图片分组（2026-10-25）

已接入真实v3常用别名/目录、分组与成员分页、创建/删除自定义组、添加/移除图片、保存/恢复常用表情。入口为/settings/function的表情包区域及共享EmojiPicker；其余功能设置仍是旧链路。新适配src/api/v3-emojis.ts区分私有成员id和全局emojiId，保留签名URL；失败不回退旧接口或伪造图片。fishpi保留调用参数位置而不把Bearer作为apiKey。

EmojiPacks与EmojiPicker按内存accessToken清状态、废弃旧身份响应；写操作保留未确认结果的同内容幂等键，成功或凭据变化清理。EmojiPacks源码SCSS经构建生成，移除父功能卡片内的重复卡片容器。SettingsView的认证分支仅挂载后显示，修复提前恢复token时的SSR水合不一致。移除了mockEmotions中的旧带版本Vditor图片URL；Vditor自己的旧emoji hint、上传及发送链路未随选择器完成迁移。

实际测试：tools/v3-emojis-test.mjs六组，通知六组、认证十二组回归，corepack yarn run build（类型/客户端/SSR）通过。生成assets扫描62个JS，js-version-audit零命中；不代表外部CDN/编辑器运行加载资源全部通过。IAB实际页面仅连接独立本地HTTP/WS夹具：分组51条分页、新建自定义组、添加带查询参数HTTPS图片、移除成员、删除分组、恢复默认、重复别名拒绝，以及文章编辑器选择常用表情并插入正文，未发布评论。初次浏览发现SettingsView水合警告，修复后新页面Hydration日志为空。示例外部images.example不能加载图片是预期，像素夹具正常；真实图床未验。截图/tmp/rhythm-v3-client-emojis-proof.png。

文件清单、鉴权/反漏扫结论与完整人工链见后端docs/api-v3-client-emojis-work.md。此处为首批状态，下批补全见下。

## 表情编辑、分享与迁移补全（2026-10-25）

同一表情区域补齐：自定义组名称/排序编辑，私有成员名称/排序编辑，非空自定义组生成快照码、小写码规范后导入独立新组、迁移本人旧云表情。仅调用既有v3资源；后端260路保持。分享码和编辑/结果状态在凭据变化清除，失败未知结果保留同内容key。导入/迁移后按真实分页定位目标，读取实际名称/排序/type，不用sort=0占位；目标已删除或超预算明确报错。

修改src/api/v3-emojis.ts、src/components/EmojiPacks.vue、tools/v3-emojis-test.mjs及文档。成员编辑使用private itemId，URL不可借编辑替换。分享说明持码登录者可导入，来源组删除不撤销；迁移只请求本人的历史数据，没有任意cloud键/上传JSON入口。实际9组专项、类型/客户端/SSR构建通过。IAB本地夹具走通组/成员编辑、来源组删除后导入快照、最后页元数据及迁移反馈；Hydration日志空，无生产写入。截图/tmp/rhythm-v3-client-emoji-transfer-proof.png。真实Rhythm、数据库整批回滚、移动设备及旧编辑器hint/上传/发送仍须运行验收；完整步骤见后端同一工作记录补全节。

## 本人资料、MBTI与头像（2026-10-25）

src/api/v3-profile.ts与src/components/settings/OwnerProfileSettings.vue替换SettingsView原先apiKey为null便静默不保存的profile/avatar链；只读本人设置，不用公开卡片/me填充编辑值。昵称/简介/网址与MBTI分表单保存，独立结果和幂等key；头像允许合法HTTPS完整URL，也可JPEG/PNG/GIF取v3票据后命名file直传，上传只票据、无账户Bearer/Cookie、禁重定向。上传成功但设置失败保留URL和原key重试，不重传图片；token边界清状态、中止上传、旧响应不触发新保存。SCSS经构建，资料用户名链接挂载后显示修水合。

5组实际TS/Vue专项、类型/双构建通过；生成62个JS审计零命中。IAB本地夹具实际走通资料保存/新页保持、MBTI错误/规范化、签名头像URL、合成PNG票据上传和非法HTTP头像拒绝；新页Hydration日志为空。日志/tmp/rhythm-v3-client-profile-tests.log与profile-build.log，截图/tmp/rhythm-v3-client-profile-proof.png、avatar-proof.png。没有真实图床/后端或生产写入；真实CORS/代理/大小格式限制、移动设备和反漏扫链未验。完整文件/人工链见后端docs/api-v3-client-profile-work.md。

QQ与标签不在现有v3资料白名单，已询问是否纳入及规则；当前没有新保存能力，旧数据库值不变。其余功能/隐私/语言/职业/敏感设置仍待迁移，旧编辑器uploadFiles也未随头像上传自动切换；不能称整站设置完成。

## 功能、显示、隐私与语言偏好（2026-10-25）

上一段的功能/隐私/语言待迁移项现已补上偏好读写：新增src/api/v3-preferences.ts、src/components/settings/OwnerPreferences.vue、tools/v3-preferences-test.mjs，SettingsView接五类资源与真实目录。functions、display两模式、privacy13项、publicLocation、locale、display两皮肤分表单；只提交改动键、不覆盖同资源其他字段。读错不显示假默认或允许保存；独立结果/key，未知ACK同内容重试、未确认字段改回也提交，凭据边界清状态并隔离旧读写。SCSS经构建，显式控件名称。

核对旧PC/mobile模板后，将误标的“聊天室显示图片”改为准确的“模糊处理聊天室图片”；布尔值本身不反转。皮肤仅控制经典站点桌面/移动，本机AppearancePicker保留；locale持久化不代表已完成全站翻译和所有时间格式应用。

7组专项、类型/client/SSR构建、生成62个JS审计零命中通过。IAB本地夹具走通六表单保存；请求记录只有改动键，皮肤保存后评论模式保持，模拟站外跳转失败明确显示且重读保持原值，Hydration日志空。无生产写入。日志/tmp/rhythm-v3-client-preferences-tests.log、preferences-build.log；截图/tmp/rhythm-v3-client-preferences-proof.png。实际文件/完整人工链/安全边界见后端docs/api-v3-client-preferences-work.md。真实后端、隐私实际效果、经典皮肤、语言呈现、移动设备与全链反漏扫未验。

职业/敏感账号设置、勋章会员、内容写入互动、私信聊天室和编辑器旧上传发送等仍待迁移。QQ/标签规则保持待答；不是整个设置页或完整v3完成。

## 本人私有QQ（2026-10-25）

用户已确认QQ与标签纳入及严格规则，前面“待答”为历史记录。QQ已新增后端独立GET/PUT /api/v3/me/settings/qq，仅当前第一方本人；客户端v3-profile.ts与OwnerProfileSettings.vue增加独立读写/结果/key/换号清理，不并入公开profile/me。去首尾空白、空清除、1..12位ASCII数字保留前导0；旧不合规则值可读，写入必须修正。资料专项现6组及类型/client/SSR构建通过，本地夹具验证前导0保存/重读、1e3拒绝、清除，Hydration日志空。截图/tmp/rhythm-v3-client-qq-proof.png。后端QQ五组与实际Latke日志过滤测试通过，未代表真实后端/MySQL/设备验收；完整文件与步骤见后端docs/api-v3-qq-settings-work.md。标签规则已确认、尚待标签/关联/统计/回执同事务实现，不是假定只写userTags。


## 本人个人标签补全（2026-10-25）

前面的标签待实现为历史状态。src/api/v3-profile.ts、OwnerProfileSettings.vue与tools/v3-profile-test.mjs新增独立GET/PUT /api/v3/me/settings/tags；从本人读取，保存以响应规范化值回填，失败保留输入及同内容key，身份变化清状态、忽略旧响应。没有向普通profile加入userTags，也不在前端截断或丢弃非法项目。最多4项/普通12字符/原始及结果128，别名、白名单例外、内容审核由服务端严格处理；空值清除。

最终资料专项七组、类型/client/SSR构建通过，生成62个JS审计零命中。IAB本地合成夹具走通JS；ES、JavaScript规范化为JavaScript,Elasticsearch、五项拒绝后重读旧值、清空及再次保存；Hydration日志空。截图/tmp/rhythm-v3-client-profile-tags-proof.png；测试日志profile-tests.log与profile-build.log。后端实际MySQL隔离及并发范围、全部修改文件与人工链见后端docs/api-v3-profile-tags-work.md。真实Rhythm/IoC、移动设备、实际内容审核、缓存及全局反漏扫尚未验收；整体v3仍有后续模块。


## 本人勋章（2026-10-25）

新增src/api/v3-medals.ts、src/components/settings/OwnerMedals.vue、tools/v3-medals-test.mjs，SettingsView账号页替换原apiKey依赖的勋章列表/切换/排序。实际v3分页、隐藏有效勋章、明确displayed与上下相邻move；未知结果保留原目标/命令/key重试并互斥，成功后列表刷新失败不反转成功或重发move。凭据切换清列表/待确认命令、隔离旧响应；末页缩小重读实际末页。列表有效项与全部排序范围不同，过期也参与排序。图片仍复用MedalIcon原/gen会话通道及名称回退，不声称渲染已全迁v3。

6组实际TS/Vue专项、类型/client/SSR构建通过，62个生成JS版本审计零命中；IAB本地HTTP/WS合成夹具验证21枚两页、展示隐藏、移动已提交后503/同键恢复只一次、第二页隐藏成功，Hydration日志空。截图/tmp/rhythm-v3-client-medals-proof.png。无生产写入，真实后端/移动设备/完整权限与反漏扫未验。全部修改文件与人工完整链见后端docs/api-v3-client-medals-work.md。后端264路保持，职业/敏感设置/背包改名/其他内容写入与私信聊天室等仍在后续范围。


## 本人职业设置与详情（2026-10-25）

新增src/api/v3-professions.ts、src/components/settings/OwnerProfessions.vue、tools/v3-professions-test.mjs；SettingsView职业页替换旧apiKey依赖。接既有目录/本人进度分页、详情/经验记录、primary/onboarding/privacy三写，完整CUSTOM十模块与六预设，真实当前选择和已有经验分离。目录第二页可选择无进度职业，不造零级；跳过明确清除主职业而保留经验和隐私。未知结果原命令快照/key重试、成功写后GET失败不反转成功；草稿/详情/记录及身份边界隔离。详情聚焦和定位避开固定顶栏。

7组实际TS/Vue专项、类型/client/SSR构建、62个生成JS审计零命中；IAB本地合成HTTP/WS夹具验证两页目录、十模块/预设及同键恢复、无进度选择、跳过/重选、等级路线/贡献/正负经验与记录第二页，Hydration日志空。截图/tmp/rhythm-v3-client-professions-proof.png与/tmp/rhythm-v3-client-profession-detail-proof.png。无生产写入，真实Rhythm/设备/公开隐私效果/全局反漏扫未验。完整文件与人工链见后端docs/api-v3-client-professions-work.md；后端仍264路。成长提示、排行、他人公开职业、敏感账号与其他内容写入/私信聊天室等仍在后续范围。


## 职业排行与成长提示（2026-10-25）

扩展src/api/v3-professions.ts，新增components/profession/ProfessionRanking.vue与ProfessionGuide.vue及tools/v3-profession-ranking-test.mjs；TopView替换旧职业API/共享job缓存，OwnerProfessions目录接共享提示。目录/榜单分别分页，rank/可见人数采用返回值，缺省经验显示未公开、真0保持0。重复成长来源与奖励概要按原顺序，不推断等级、勋章或触发保证；身份/目标切换清结果，提示聚焦定位。

浏览器发现共享SideBar在SSR游客与客户端已恢复身份间水合不一致，模块改为挂载后渲染，SSR保留一致加载态，原本机配置仍生效。新专项7组+本人职业7组回归、类型/client/SSR构建通过，生成JS定向审计通过。IAB本地HTTP/WS夹具验证隐藏/0经验、第二页rank21、空可见榜、重复成长来源/积分勋章概要及设置入口，修复后新页Hydration日志空。截图/tmp/rhythm-v3-client-profession-ranking-proof.png、profession-guide-proof.png与settings-profession-guide-proof.png。无生产写入，真实后端/隐私筛选/移动/全局反漏扫和其他侧栏使用页仍需回归；完整文件/人工链见后端docs/api-v3-client-profession-ranking-work.md。后端264路保持，他人公开职业资料与其他v3模块仍在后续范围。

## 用户公开职业面板（2026-10-25）

新增src/api/v3-profession-public.ts、components/profession/PublicProfessions.vue与tools/v3-public-professions-test.mjs；MemberView移除旧职业读取和面板，职业入口不再依赖primary可见。结果模块分别按存在性显示，经验/rarity独立省略，SELECTED不造等级；无旧职业缓存或本人私有回退，身份/目标切换清结果、阻止迟到数据，SSR不请求当前读者结果。

7组实际TS/完整Vue模板/状态/SSR专项、类型/client/SSR构建、63个生成JS审计零命中通过。IAB本地HTTP/WS夹具验证登录八模块但经验隐藏、退出匿名只见贡献、无主职业入口仍可用、SELECTED、404与503区分、HTML按文本及Hydration空；无生产写入。截图/tmp/rhythm-v3-client-public-professions-proof.png及public-professions-anonymous-proof.png，完整文件/人工链见后端docs/api-v3-client-public-professions-work.md。后端264路保持。基础主页旧userinfo/SSR门禁、会员/徽章/部分列表仍待迁移，父级失败可能阻止子面板挂载；不能用v3摘要填假统计绕过。真实隐私算法/来源可读性/设备/全局反漏扫未验。

## 本人会员页面（2026-10-25）

新增src/api/v3-membership.ts、components/settings/OwnerMembership.vue、tools/v3-membership-test.mjs，VipView仅保留SEO和新模块。既有v3四类入口：完整有界分页目录、本人状态、部分展示配置和积分开通；不按月年假分组或推算节省，真实周期/天数/价格和已知权益展示。支持字段看键存在，空配置不补false，只有改动展示字段可写；精确VIP4效果。确认冻结档位/优惠券，未知结果同键恢复，成功后读失败不重买，凭据边界清状态与迟到确认。

8组TS/实际Vue/确认专项、类型/client/SSR构建通过，64个生成JS定向审计零命中。IAB本地夹具无效券422余额10000不变，正常券实际扣800后503/同键恢复仅一次COMMIT，余额9200；颜色/加粗/下划线分别只发单字段，已有有效会员禁重复，Hydration空。截图/tmp/rhythm-v3-client-membership-proof.png；无真实账号/生产扣费。完整文件/人工链/价格时序与适配边界见后端docs/api-v3-client-membership-work.md。后端264路保持。共享昵称渲染/他人会员判断仍有旧读取，真实服务/账款礼包/设备/反漏扫仍未验，不代表整站会员全迁v3。

## 共享昵称样式（2026-10-25）

新增src/api/v3-membership-styles.ts与tools/v3-membership-styles-test.mjs，useVipNickname移除旧会员/用户详情读取，VipNickname移除本地旧config兜底。样式只三字段、指定ID按100分批/重复合并，姓名经v3摘要验证；缓存/队列绑定凭据与目标，修改配置失效后旧回写拒绝，匿名/SSR普通文本，不据空对象推断非会员。TTL约束后续读取，没有已挂载项自动实时同步承诺。

8组API/实际helper/编译Vue模板专项+会员页面8组回归、类型/client/SSR构建、64个生成JS定向审计零命中通过。IAB本地HTTP/WS夹具验证姓名摘要→ID100→蓝色/下划线，退出清class/style且没有新样式请求，Hydration空；截图/tmp/rhythm-v3-client-membership-styles-proof.png与membership-styles-logout-proof.png。无真实账号/生产写入，完整文件/人工链见后端docs/api-v3-client-membership-styles-work.md。后端264路保持；其他会员身份判断/聊天室手写昵称及真实权限/设备/反漏扫仍未验或待迁移。


积分转账（设置页/他人主页）与邀请码购买/状态已接既有v3；确认后按实际回执显示到账、费用和原码。未知结果保留原命令/key，可跨SPA页面恢复，正常令牌刷新保留，退出/换号清理；整页刷新不保留内存，需先核对原操作。unused不保证当前可注册，积分流水与其他模块仍待迁移。验证范围及完整人工步骤见Rhythm的docs/api-v3-client-finance-work.md。


本人积分流水页已接既有v3 points/me：真实金额/收支/交易后余额及总分页，余额与列表独立读取/重试，不再从通知正文猜金额或借记录余额当当前余额。普通token轮换保留页，换号/退出隔离；5组实际TS/Vue/SSR专项、财务7组回归、类型/双构建及本地夹具两页/独立错误恢复通过。真实后端账本、设备和全局反漏扫仍未验；完整文件/人工步骤见Rhythm docs/api-v3-client-points-work.md。其他用户积分等旧消费者未随之迁移。


账号页背包/四卡/积分改名已接v3：真实数量、确认与实际结果，历史回执不覆盖后来状态；未知消费/key跨SPA保留、普通token刷新保持，退出/换号清理。删旧mockUserBag与无消费者改名/卡片入口；免签增加剩余天数而非立即签到。6组专项、财务7/积分5回归、双构建及本地四卡/单次1000积分改名夹具通过，真实任务/事务/缓存/移动/风控未验。完整文件/步骤见Rhythm docs/api-v3-client-inventory-work.md；敏感账号设置/APP码/导出等仍待迁移。


账号安全（密码/MFA/手机/邮箱）已接既有v3九入口：每步当前证明、本地MFA手动准备及十分钟清理，成功/未知敏感变更重新登录核实。新密码6..128 UTF16、不trim、Unicode/无控制或无效代理，当前密码保持原样。删除旧敏感包装；确认可取消本人、极验初始化/成功回调隔离旧身份并支持脚本失败重试。7组真实TS/Vue、3组共享生命周期、财务7/背包6回归及双构建通过；IAB仅合成准备/非法手机/错误证明/未知改密重新登录。没有真实改密/极验/SMS/邮箱/TOTP操作，真实撤权/风控/设备仍需验收。完整文件与人工步骤见Rhythm docs/api-v3-client-security-work.md；APP扫码、导出、认证等未随之迁移。


数据页本人内容导出已接v3三路：完整本人内容/100分确认、同键恢复需新证明、任务只读查询及24h私有下载；不存证明或公开文件URL。ZIP先当前状态/授权，再类型/长度/hash校验，本地Blob交付并回收；失败不为下载重新收费。7组API/Pinia/模板、4组真实HTTP ZIP、安全7/财务7回归、双构建及IAB合成一次收费/恢复/下载通过。真实快照/账本/设备磁盘结果与全局风控未验；完整文件和人工步骤见Rhythm docs/api-v3-client-post-export-work.md。APP扫码、企业认证及其余模块继续迁移。


企业认证申请页已接既有v3三个本人接口：原始JPEG/PNG私有提交、本地预览、同图同key恢复，材料销毁与审核结论分别展示。七组专项、导出7/安全7回归及双构建通过；IAB合成材料单次提交/恢复/详情刷新通过，分页失败恢复浏览器验收仍缺。审核后台不在本批重建，真实材料/权限/设备/全局风控仍需验收。完整文件与人工链见Rhythm docs/api-v3-client-identity-work.md，APP扫码及其他模块继续迁移。


捐助页已接既有v3只读donation-page，移除旧客户端下单/支付QR，展示明确经典站点地址并提示独立网页登录。四组API/完整Vue/SSR专项、积分5/认证7回归、双构建及IAB读取失败恢复通过；未执行支付。另补齐认证分页错误返回首页及末页浏览器验证。完整文件/人工链见Rhythm docs/api-v3-client-donation-work.md；真实服务/设备/经典登录/全局反漏扫仍待验。


本人匿名创作已接既有v3两GET，原/member/本人/articles/anonymous与comments/anonymous独立加载，不再依赖旧公开userinfo；数据设置页增加入口，匿名评论明确ID/普通私密及所属文章。真实分页、错误重试、身份/目标/SSR隔离，不输出正文或匿名作者ID。五组专项、公开职业7/导出7回归、双构建与IAB分页503恢复/末页/他人路径零查询通过；真实权限/业务库/设备/风控仍待验。完整文件与人工链见Rhythm docs/api-v3-client-anonymous-content-work.md。其余主页、写入互动/私信/聊天室继续迁移。

## 关注用户与粉丝列表

现有/member/:userName/following/users及/member/:userName/followers改由UserRelationsView独立渲染，走已有v3用户关系分页，不再等待旧userinfo成功或把错误显示成“缺少JSON接口”。旧MemberView列表分支及fishpi旧读取包装已删；主页的关注/取消关注操作、标签/收藏列表及用户基础资料仍待迁移，不能把本批两个读取页称为整个关注模块完成。

新增src/api/v3-user-relations.ts投影公开用户白名单、严格验证分页，src/views/UserRelationsView.vue显示真实总数/末页/重试、403与空列表分开；共享头像与VipNickname复用。读者/目标/类型切换同步清除列表并拒绝迟到响应，正常token轮换保留页；SSR只呈准备态，不复用私有结果或取旧资料。src/router/index.ts接原路由，src/api/fishpi.ts与src/views/MemberView.vue移除旧链；tools/v3-user-relations-test.mjs新增五组实际TS/Vue/SSR测试。

专项五组、本人匿名读取五组和昵称样式八组回归通过；corepack yarn run build完成类型检查、client/SSR构建，67个生成JS定向版本/map扫描零命中。IAB本地合成数据实际验证21条/第二页503→同页重试→2/2禁下一页、昵称标签为纯文本、private粉丝403、empty粉丝合法空列表；Hydration日志为空。截图/tmp/rhythm-v3-client-relations-proof.png。当前窄视口435px，不是桌面宽屏或真实移动设备验收。未调用生产账户关注操作；所有fixture数据仅本地。完整文件与人工链见Rhythm docs/api-v3-client-user-relations-work.md。

## 用户关注操作（2026-10-26）

主页和悬浮卡片共用UserFollowButton：先v3摘要解析目标ID，再读取新增单项本人关系GET；PUT/DELETE为明确设置，未知结果在v3UserFollow Pinia保留原key/intent，正常token轮换和SPA重挂载可恢复，退出/换号清除。成功后GET当前关系，历史receipt不覆盖后来的状态；后置读取失败只重读。按钮保持同一节点，aria-disabled/busy期间阻止重复操作并保焦点，避免卡片在异步状态变化时意外关闭。

新增src/api/v3-user-follow.ts、src/stores/v3UserFollow.ts、src/components/user/UserFollowButton.vue和tools/v3-user-follow-test.mjs；修改MemberView/UserHoverCard，删除fishpi旧followUser/unfollowUser。六组实际TS/Pinia/Vue/SSR专项、关系5/样式8回归，corepack yarn run build与66生成JS版本/map定向扫描通过。本地IAB主页及键盘资料卡验证提交丢响应→同key恢复、取消成功后GET503→仅重读，修复按钮DOM替换失焦；1280/390两viewport正常、Hydration空。

后端新增只读状态GET、Java SQL/真实HTTP四组及实际MySQL四组通过；真实8080需IDEA重编译/重启后验收。未改写原后端关注事务核心，卡片/主页基础资料与统计、标签/收藏/订阅和其他模块仍继续迁移，不能称整用户页已完成。完整文件、人工链及安全/未验边界见Rhythm docs/api-v3-client-user-follow-work.md。

## 标签关注、收藏和订阅读取（2026-10-26）

/member/:userName/following/tags、following/articles、watching/articles三个原路径改为SavedContentView，不等待旧userinfo，也不再显示“暂无JSON接口”。/stars共用同一视图；本人使用/me/follows/tags、collections、subscriptions，文章保留不可读ID占位；他人走公开三个资源，不回退本人接口。真实分页、错误/隐私/合法空状态分开，身份/目标/kind边界拒迟到数据；SSR准备态、普通token刷新保留页。标签使用真实ID链接和纯文本描述。

新增src/api/v3-saved-content.ts、src/views/SavedContentView.vue、tools/v3-saved-content-test.mjs；CollectionsView改包装，router/MemberView接线并删缺口，fishpi删旧collected helper。共享v3-content/ArticleSummary保留匿名标志，ArticleFeed屏蔽匿名作者头像/链接/简介并显示文本匿名，修复假匿名主页链接；compact/full均覆盖。

七组实际API/Vue/Feed/SSR专项，内容/关系5/关注6回归、corepack yarn run build通过；正式js-version-audit扫描68生成JS零命中。本地IAB合成21条收藏/第二页503恢复到末页、本人订阅不可读占位/匿名、标签文本与0计数、他人403和合法空，1280/390视口正常、Hydration空。没有真实业务账号操作；真实后端权限/全局风控/真机未验。后端契约和276总数保持。保存/取消标签关注、文章收藏订阅、/watch动态及其余模块仍待迁移，完整文件/人工链见Rhythm docs/api-v3-client-saved-content-work.md。

## 关注动态（2026-10-26）

/watch、/watch/users、/watch/breezemoons接v3-following-feed，标签/用户使用当前账号watching聚合及固定source，清风使用/me/watching/breezemoons。原auth路由及/following别名保留；真实total/pageCount、错误/403/空状态分列，短页不猜末页，分类切换/读者边界清列表，正常token轮换保留页，SSR只准备态。

新增src/api/v3-following-feed.ts、src/components/breezemoons/BreezemoonList.vue和tools/v3-following-feed-test.mjs；WatchView重写占位，v3-user-relations提取公开作者白名单共享decoder。清风仅渲染服务端contentHtml，不把原文作为HTML或兜底全站列表，作者昵称纯文本/真实ID、头像和样式复用现有组件。原SideBar与全站清风/发布删除仍独立旧链。

六组实际API/Vue/文章/清风/SSR专项、关系5/保存7回归及corepack yarn run build通过；正式js-version-audit扫描68生成JS零命中、无map。IAB合成短页total21翻页/503恢复末页、用户403→合法空、清风格式化HTML/文本昵称，1280/390两viewport和Hydration空。不是实际后端内容权限/HTML清洗/全局风控/真机验证。后端276保持，完整文件与人工链见Rhythm docs/api-v3-client-following-feed-work.md；关系写入、全站清风、其他内容互动/私信/聊天室继续。

## 全站清风明月（2026-10-26）

全站列表、首页模块、通用侧栏由BreezemoonPanel复用v3读取和发布，本人按ID编辑/删除。共享Pinia明确命令及幂等key，未知结果跨面板恢复，原草稿在确认后清除；写成功后GET失败仅重读。严格Unicode/Java trim/512UTF16，HTML仅contentHtml。SSR公共预取global/home分列，每Vue app提供载荷，挂载后当前读者重读，无私有列表共享缓存。

8组清风、SSR4、关注6/保存7/认证12回归及类型/client/SSR构建通过；正式68生成JS审计零命中/无map。IAB合成主面板发布丢ACK→侧栏同key恢复、原草稿清空，编辑后GET失败只重读、分页失败恢复、删除取消、1280/390无横溢出。实际删除只由隔离组件测试覆盖。首页旧签到/复读登录态仍有hydration差异，不能称全首页SSR通过。城市/个人用户清风仍旧链；后端276不变，真实后端/风控/权限/清洗/DB与设备待验收。完整文件及人工链见Rhythm docs/api-v3-client-breezemoons-work.md。

## 标签关注、文章收藏和订阅（2026-10-26）

ContentRelationButton/v3-content-relations/v3ContentRelations在标签页标题、普通文章尾部与长篇更多菜单接既有明确PUT/DELETE，三个新增单项GET返回当前关系。标签slug复用v3目录解析，不冒充ID；未知命令按kind+ID保存原key，跨SPA和正常token轮换保留，退出/换号清理。成功仅事件失效再GET；读失败不重写，历史receipt不当现状。另一组件提交时会废弃在途旧GET再读取；UserFollowButton同步修正该竞态。

前端9组真实TS/Pinia/Vue专项，用户关注7/保存7/内容适配/认证12回归、类型及client/SSR构建通过；后端6组SQLite/HTTP及一次性MySQL另见Rhythm记录。IAB仅合成：收藏丢ACK原key恢复、取消成功后GET失败仅重读、订阅独立、标签403后可重新发起、长篇更多菜单、1280/390布局。实际服务器权限/通知/原子写、全局风控和真机未验。文章页既有登录态/分享链接/编辑器hydration差异仍在，不能称整页SSR通过。后端279注册入口；完整文件/人工链见Rhythm docs/api-v3-client-content-relations-work.md。

## 首次挂载与认证恢复（2026-10-26）

初始路由保留游客SSR树，entry在mount后由每应用clientStartup恢复，私有页当前认证成立才挂载；确定游客带原路径跳登录、临时失败可重试，后续SPA仍用守卫，迟到启动不覆盖新导航。已登录登录页恢复后保留redirect。启动9组、认证12/缓存3/SSR4/内容关系9/关注7/保存7、类型及client/SSR构建通过；5路本地HTTP SSR合成验证通过，69 JS版本审计零命中/无map。最终浏览器发现无可用会话，点击恢复及移动布局/长篇hydration仍须人工复核，不能称整站SSR验收。后端279不变，APP未改；完整文件和人工链见Rhythm docs/api-v3-client-startup-work.md。

## 文章赞踩、感谢和打赏（2026-10-26）

普通尾部/长篇更多共ArticleInteraction，打赏复用槽也接v3；状态与计数只读GET，明确up/down/DELETE，感谢/打赏按当前费用确认。未知原命令/key跨SPA保留，确认后GET，后续读失败只重读；另一组件提交废弃旧读，退出/换号清正文和命令，离页取消本人确认。打赏回执不授权正文，另取当前合法详情；余额刷新失败独立提示，删除三旧包装。

15组实际TS/Pinia/完整Vue专项、启动9/关系9/内容适配/认证12/ZIP4/共享生命周期3回归、类型及client/SSR构建通过；普通/长篇完整本地HTTP SSR游客付费区与无私有请求/写入日志通过，69生成JS版本审计0命中/无map。浏览器无可用会话，实际点击、双视口/真机及真实权限/账款/全局风控仍待验；不是文章整个模块完成。评论写入/reaction/采纳/编辑/旧Socket等继续，后端279保持，APP未改。完整文件/人工链见Rhythm docs/api-v3-client-article-interactions-work.md。

## 评论写入及长篇段评（2026-10-26）

CommentComposer/v3Comments接既有POST/PUT/DELETE/原文，支持匿名、私密、回复/段评；正文原样不trim，编辑默认省visible保留现状。原目标/输入/key未知恢复跨SPA，初次确定4xx可新发，恢复4xx不丢key；退出/换号清状态，离页/切回复目标取消本人确认。成功强制当前GET，失败只重读，余额刷新错误独立。普通作者控制仅公开ID，匿名本人编辑删除仍需本人管理证明入口，不恢复真实匿名ID。

长篇详情先取paragraphs includeContent当前锚点HTML；统计完整分页校验、缺项/变化明确失败，段评平铺分页并校验归属，不伪造旧根层次。侧栏可回复与当前公开作者本人编辑/删除/恢复；未知统计不假0。CommentItem无公开ID不生成假链接，不可见正文提示，源码读取失败不填假文本。

16组实际TS/Pinia/完整Vue及普通文章组件全链联动、互动15/关系9/内容/SSR4/认证12/启动9/生命周期3回归、类型及client/SSR构建通过。普通/长篇本地HTTP SSR与无私有写/源码/Authorization日志通过，71 JS版本审计0命中/无map；浏览器发现无会话，长篇侧栏实际DOM、双视口/真机及真实服务权限/账款/风控未验。后端279保持，APP未改；其他评论互动/文章编辑/旧Socket/上传/私信聊天室仍在队列，完整文件/人工链见Rhythm docs/api-v3-client-comments-work.md。


## 2026-10-26 评论赞踩

CommentItem与长篇段评共ArticleInteraction resource=comments/kind=vote，GET当前、PUT明确up/down、DELETE清除。资源参与API、命令/通知/读取身份，同ID文章/评论不串；未知原choice/key跨SPA/正常轮换恢复，成功GET，读错只重读，身份变化废弃迟到结果。删除旧voteComment包装与消费者；异步保留按钮DOM并拒重复，评论互动不放悬浮头部。

12组实际API/Pinia/完整Vue及CommentItem专项、文章互动15/评论16/认证12/启动9/生命周期3回归、类型与client/SSR构建通过；71生成JS版本审计0命中/无map，普通/长篇整页合成SSR含公开/匿名私密评论及零私有请求日志通过。浏览器无会话，长篇侧栏完整DOM/双视口/真机、真实权限/账款/通知/风控未验；后端279保持，APP未改。完整文件/人工链见Rhythm docs/api-v3-client-comment-votes-work.md；感谢/采纳/reaction与文章编辑/上传/私信聊天室继续。


## 2026-10-26 评论感谢与采纳

普通评论/楼中楼/长篇段评共ArticleInteraction comments/thanks及comments/accept，当前GET取费用、本人状态与基本资格，POST费用确认及原键未知恢复，完成后当前GET、余额错误独立。本人/已感谢不重复请求；采纳成功刷新所有挂载候选，隐藏过期资格。默认文章三类行为保持，删除thankComment/acceptComment旧包装和处理。

后端新增两GET，注册281（280HTTP+1WS），GET139/POST71/PUT46/DELETE24/WS1；5组Java/生产SQL/真实Dispatcher鉴权专项分别在SQLite及临时MySQL通过，11组客户端真实API/Pinia/完整Vue/CommentItem专项及赞踩12/评论16/文章互动15回归、类型与双构建通过。浏览器无会话，真实权限/账款/通知、长篇侧栏完整DOM与双视口仍待验；APP未动。详情见Rhythm docs/api-v3-client-comment-rewards-work.md；reaction/文章编辑/上传/私信聊天室继续。


## 2026-10-26 统一表态

V3ReactionBar/v3Reactions接既有目录、article/comment/chat GET/PUT/DELETE，明确设置/清除，原choice/key按类型+ID未知恢复、正常轮换保留，完成只GET；退出/换号废弃迟到目录和状态。普通/长篇文章、评论/楼中楼/段评和聊天室经典/现代布局均接。旧Article/Chat事件仅失效，不能采summary/他人actorReaction作本人选择；旧toggle/应用快照包装、chat.react与历史reaction投影已删。登录后自动读，游客等认证恢复后显式读，事件不替游客扇出；SSR无目录或私有读，面板保DOM防重复。

16组实际TS/Pinia/完整Vue/CommentItem/生产chat onmessage专项，评论16/赞踩12/感谢11/文章互动15/认证12/启动9/生命周期3回归，类型与client/SSR构建通过；71生成JS版本0命中、无map/sourceMappingURL/sourceURL，普通/长篇整页合成SSR公开/私密及零reaction/auth/write请求通过。浏览器无会话，长篇/聊天整页DOM、双视口/焦点/真机与真实权限/Socket/节点未验；后端281，APP未改。不是聊天室或v3 Socket主体完成；文章编辑/历史/上传、私信/聊天主体继续。详情见Rhythm docs/api-v3-client-reactions-work.md。


## 2026-10-26 文章与评论历史

RevisionHistory/v3-revisions接既有四GET，普通/长篇文章旧按钮转新面板，根评论/楼中楼/段评可惰性读取。严格分页/index/current/详情绑定，列表/正文错误独立重试；评论current.time=null不造时间。清洗历史文本以纯文字展示，删除旧fetchArticleRevision(s)/previewMarkdown包装及旧类型。收起/换身份/目标/选择废弃迟到正文；ArticleView稳定viewerIdentity防正常token刷新卸载整页，跨身份仍重读。

14组真实API/完整Vue历史专项、评论17含真实ArticleView+History/API/ref链路及正常轮换/退出，reaction16/赞踩12/感谢11/文章互动15/认证12/启动9/生命周期3、类型与client/SSR构建通过；71 JS版本0命中/无map/sourceURL，普通长篇完整合成SSR及无历史/旧预览/auth/write日志通过。浏览器无会话，真实历史权限、长篇菜单/段评侧栏完整DOM、双视口/焦点/真机/全局风控未验；后端281，APP未改。完整文件/人工链见Rhythm docs/api-v3-client-revisions-work.md，文章编辑/发布/上传、匿名本人管理和私信/聊天主体继续。


## 2026-10-26 文章发布编辑与草稿主链

PostView/v3Posts/v3-posts接source、发布/部分编辑及草稿分页/读取/保存/删除。source失败无假表单，原文/付费正文不取公开HTML；PATCH仅变化，打赏折叠不关闭，原章节/只读字段不误发。发布draftId交同事务消费，客户端无额外DELETE；metadata不清正文，新增后PUT，hidden thought/type4范围保持不新增思绪。原op/id/input/key确认/未知恢复、身份/迟到隔离，余额/列表/导航失败不重付；确认后显式新文章或重读source防重复。

27组生产API/Pinia/完整PostView、评论17/历史14/reaction16/赞踩12/感谢11/互动15/认证12/启动9/生命周期3回归、类型双构建通过；71 JS版本0/无map/sourceURL，四条作者页HTTP SSR无本人source/draft/auth/write。浏览器无会话，真实Vditor/事务/账款/权限/双视口/风控未验。后端281，APP未改。预览markdown、upload/@/内置emoji/标签联想及专栏选择另迁移；文章删除/置顶、匿名本人管理、私信/聊天主体继续。完整文件/人工链见Rhythm docs/api-v3-client-posts-work.md。

## 第六十二轮：共享编辑器预览

MarkdownEditor改接POST /api/v3/markdown/preview，使用当前Bearer；Vditor同步本地回退被清空，再由parse异步写服务端清洗HTML。正文/身份/卸载取消并清除旧结果，错误纯文本与显式重试。7组专项、文章27/评论17回归、类型双构建、71 JS版本0/无map通过。真实CDN Vditor配合合成后端完成输入→预览及503重试，并观测Bearer请求；不等于Java真实服务或双视口验收。上传/@/内置表情/标签联想/专栏选择仍待迁移；高亮/公式等异步后处理待联调。Java变更后需IDEA重新编译/重启。

## 第六十三轮：共享编辑器上传

MarkdownEditor去旧apiKey上传门禁，接既有v3票据与专用票据直传；重复文件名唯一映射，部分成功仅插成功项并提示，身份/正文替换/卸载取消旧结果。真实Vditor发现并修复尖括号目的地截成https:，桌面/390×844移动文件选择复验，移动图片naturalWidth=32；合成后端只返回既有公开图片，非真实图床验收。9组上传、文章27/评论17/预览7/资料7、类型双构建、71JS版本0/无map通过。真实RhyPic格式/大小/生产代理、拖拽/粘贴/录音、上传后发布回读仍需验收；其他旧上传消费者和内部emoji/@继续。

## 第六十四轮：编辑器工具栏表情

旧fetchVditorEmoji与按apiKey缓存移除，工具栏自定义菜单打开现有v3常用/图片组选择器；Unicode映射仅本地显示，插入仍为服务端别名，token普通轮换保持、换人清空。图片名/目的地转义并统一使用Vditor insertMD，明确前轮截断源于insertValue先走HTML模板。7组完整Editor/Picker专项、表情9/上传9及相关回归、类型双构建通过；实际CDN Vditor桌面插入→源码和上传、390×844移动图标弹层已验，仍是合成HTTP。真实权限/发布回读、触屏/焦点等未验。@联想已确认profile.read、ASCII用户名大小写不敏感前缀1..64/有效账号/最多10/四个公开字段、空前缀空列表，尚待实现，不重复问规则。

## 第六十五轮：@用户名联想

共享Editor改接GET /api/v3/suggestions/users，profile.read；只用户名ASCII前缀、大小写不敏感、当前有效账号，空前缀不取管理员/participants。后端283注册，4组SQLite+4组临时MySQL与7组客户端专项、相关回归/类型双构建通过；真实Vditor桌面方向键回车及390×844移动原生坐标点击验收。原生input.capture取消旧请求并立即结算旧promise，延迟input不清新列表；失败给可手动输入提示。API最多10条/64位，CDN Vditor本地UI仍8条/31位。Java改动需IDEA重新编译/重启，合成HTTP不代表真实权限/查询计划与完整防扫描验收。标签联想/专栏选择及其余任务继续。

## 第六十六轮：长文本人专栏选择

已有专栏改从me/columns本人分页选择，GET错误/翻页保留绑定，选择回填id和对应标题，章节/封面沿source；原有独立长文和新建专栏入口保留。7组选择器专项、文章28含父选择→PUT/草稿字段、评论17/联想7/表情7及类型双构建通过；IAB第二页503/重试/末页选择/存草稿合成回执与390×844移动选择布局已验。真实权限/归属变更、写入回读和全局风控未验；无Java/接口契约变化。标签联想规则已确认，下一批直接实现。

## 第六十七轮：文章标签联想

新增suggestions/tags并由TagInput消费，content.read、trim/现有字符表/64、最多7、有效且仍实际关联文章，空前缀热门。当前token替换保留其他输入，支持光标/IME/键盘、取消与身份隔离，失败仍可手输；不改提交规范化。4组SQLite+4组临时MySQL、客户端9、文章29及相关回归/类型双构建通过；IAB中间C+替换、草稿字段、键盘与390×844中文选择已验，仅合成HTTP。Java需IDEA重新编译/重启，真实权限/全局风控/生产SQL计划/回读仍未验；后端284。

## 第六十八轮：本人文章删除与付费置顶

第六十八轮（2026-10-27）：客户端本人文章管理接既有source/DELETE/stick，惰性私有证明仅留id/status，匿名不猜作者；100积分与不可恢复确认、未知原目标/键跨SPA恢复、身份取消隔离。成功回执与当前GET分开，读失败只GET，删除先清正文且导航失败不重删；长文移动菜单独占行。12组owner/18组comments/29组posts/15组interactions与类型双构建通过，浏览器合成HTTP桌面/390px菜单和取消确认通过，无真实扣费/删除/权限或全局防扫描运行验收。284注册不变，无Java/FTL/SQL/Maven/APP/提交推送；见[本人文章管理记录](api-v3-client-article-owner-work.md)。

## 第六十九轮：文章实时订阅与热度

第六十九轮（2026-10-27）：文章页移除旧article-channel正文追加及旧热度GET，改已有v3票据/绑定ready和article.changed；明确读取当前HTTP、失败可重试、权限丢失清正文，读取中较新事件保留，正常token轮换重新取票。热度精确目标/非负整数/失败非0、本节点近似连接口径，游客不查鉴权热度或订阅。固定全屏长文live-status同步移动。实时6/通知6/评论20/owner12/reaction16与类型双构建通过；真实浏览器+合成WS/HTTP验证首帧、提示→HTTP正文及390px长文，无真实Java权限/过期/风控运行验收。284保持，无Java/SQL/Maven/APP/提交推送；随机文章旧链仍保留，见[文章实时记录](api-v3-client-article-realtime-work.md)。

## 第七十轮：独立私信主链

第七十轮（2026-10-27）：独立/chat页接V3PrivateMessages/v3Messages/v3-messages，严格用户ID/参与者/游标、会话分页/历史/未读/解析、发送/撤回/显式已读全主链。未知kind/target/body/key跨SPA恢复、成功后当前GET、身份清除及正常轮换保留草稿，既有ChatComposer/MarkdownEditor工具保留。messages实时共用首帧协议，只提示/重新查询不拼正文。私信15/实时7/通知6/评论20及类型双构建通过；合成HTTP浏览器保存后503→同键恢复→当前正文和390px真实编辑器发送通过，无真实账号消息。284保持，无Java/SQL/Maven/APP/提交推送。抽屉私信/全局旧未读与聊天室仍待迁移；详见[独立私信记录](api-v3-client-private-messages-work.md)。

## 第七十一轮：抽屉私信和共享未读

第七十一轮（2026-10-27）：抽屉复用V3PrivateMessages，共享privateInbox管理messages订阅/未读/入口，不存正文；主页面/抽屉/顶栏共当前计数，查询在途+尾随合并、失败未知非0，换身份清目标与窗口、正常轮换保草稿并重取票。删旧whispers及私信API包装/用户名正文拼接/自动已读。21组私信（含实际Drawer→Panel→ChatComposer）、通知6/实时7/启动9及类型双构建通过；浏览器合成HTTP+WS验证抽屉503→关闭→全页同键恢复、未读503与全局恢复、390px移动。真实Java权限/事务/风控和拖动缩放仍未验；284保持，无Java/SQL/Maven/APP/提交推送，聊天室主链仍待迁移。见[抽屉与未读记录](api-v3-client-private-inbox-work.md)。

## 第七十二轮：聊天室原文与引用读取

第七十二轮（2026-10-27）：聊天室原文/引用读取接既有v3详情，严格DTO/目标与卡片公开投影，Bearer入口，当前清洗预览不采旧列表HTML；独立弹窗打开/错误、请求序号/取消及身份清理，多行引用/作者转义。13组专项+表态16/启动9与类型双构建通过；布局/外观统一SSR默认并挂载后恢复偏好，复验warn/error空。完整ChatroomView合成HTTP桌面现代原文、当前预览及390px经典通过，无发送操作。主历史/普通发送/撤回/实时/特殊能力仍旧链，完整引用发送未验；284保持，无Java/SQL/Maven/APP/提交推送。见[聊天室原文记录](api-v3-client-chat-source-work.md)。

## 第七十三轮：聊天室普通发送与引用发送

第七十三轮（2026-10-27）：普通聊天室发送/引用→v3 POST→当前详情GET联通，v3ChatPublication原content/client/key跨SPA，平台confirmation_required明确确认原键，未知恢复4xx保原命令；成功/当前读取分开，GET失败不重发。主页面与抽屉成功且输入仍匹配才清草稿，当前GET投影去重，普通发送不依赖旧apiKey/WS；旧特殊能力显式分开待迁移。发送15/私信21/原文13/表态16与类型双构建通过；完整浏览器合成HTTP验证引用+正文保存后503→原键恢复→详情503→GET恢复及390px经典，warn/error空，无真实发信。284保持，无Java/SQL/Maven/APP/提交推送；历史/实时/撤回/在线/特殊能力继续，见[普通发送记录](api-v3-client-chat-publication-work.md)。

## 第七十四轮：聊天室历史与实时

第七十四轮（2026-10-27）：v3ChatTimeline接消息游标/详情/topic与chat首帧实时，ID/revision白名单、ready状态、同步重读、串行目标队列/迟到与删除竞争隔离、401/403清授权。主chat facade删除旧正文WS/节点凭据/历史页数，Home/SSR删除旧聊天正文与快照来源，首页发送复用v3；浮动/完整/首页共享，SCSS移动内容填满、输入置底。Timeline15/实时9/发送15/原文13/私信21/表态16/通知6/启动9，共104组及类型双构建通过；浏览器合成HTTP+实际WS验证before503重试、更新GET、删除404、sync当前窗口、清屏恢复、390px抽屉与首页摘要，warn/error空。284保持，无Java/SQL/Maven/APP/提交推送；在线/mutes/上下文/撤回/特殊能力与真实全局风控等仍待，见[历史实时记录](api-v3-client-chat-timeline-work.md)。


第七十五轮（2026-10-27）：聊天室在线名单接已有v3可见用户分页，完整页双布局/侧栏/Home共用；total区别本页条数，失败未知/原页重试、采样范围说明、身份迟到隔离和同账号轮换当前页刷新。删除旧online wrapper/SSR载荷，首页当前话题响应共享状态。在线13及相关回归共117组、类型双构建、70JS版本0/无map通过；IAB合成HTTP+实际WS完成20/21→第二页503→原页1/21重试、390px展开、简约和首页，warn/error空。284保持，无Java/SQL/Maven/APP/提交推送；真实隐私/多节点/全局风控及禁言/上下文/撤回/特殊写继续，见[在线名单记录](api-v3-client-chat-online-work.md)。


第七十六轮（2026-10-27）：聊天室本人撤回接既有v3 DELETE，经典/简约/浮窗按作者ID认领，确认费用后提交，原id/key跨SPA恢复、未知重试4xx不丢命令，退出隔离。成功清共享timeline及表态，删除集合阻止旧历史/详情/发送投影复活。撤回11及相关共129组、类型双构建、72JS版本0/无map通过；IAB合成服务提交后503→首页浮窗同键恢复→完整/390px经典成功成本32，warn/error空，无真实撤回扣款。284保持，无Java/SQL/Maven/APP/提交推送；禁言/上下文/特殊写及真实事务/全局风控仍待，见[撤回记录](api-v3-client-chat-revoke-work.md)。


第七十七轮（2026-10-27）：消息上下文接既有v3 GET，独立窗口/前后游标/定位高亮，经典/简约按钮与hash引用深链接、登录恢复及返回最新消息联通。失败原方向重试，权限/404清正文，changeHint使相关窗口/在途页失效，不另开WS或污染最新窗口。上下文13及相关共142组、类型双构建、72JS版本0/无map通过；IAB合成HTTP+实际WS验证最近窗口外深链接、前页503保留/重试/边缘、390px后页与返回最新清hash，warn/error空。284保持，无Java/SQL/Maven/APP/提交推送；禁言/特殊写及真实可见性/全局风控仍待，见[上下文记录](api-v3-client-chat-context-work.md)。


第七十八轮（2026-10-27）：话题修改接既有v3 PUT，经典/简约/侧栏共用编辑与恢复，16积分确认、原text/key未知恢复、平台二次确认及身份隔离；成功GET当前值，失败只重读不重付，匹配原输入清理。timeline主动话题读不依赖chat订阅，删除旧setDiscuss包装。话题13及相关共155组、类型双构建、72JS版本0/无map通过；IAB合成HTTP验证提交后503同键恢复→GET503→当前值后改、390px简约成功关闭及侧栏共用，warn/error空，无真实话题/扣款。284保持，无Java/SQL/Maven/APP/提交推送；弹幕/禁言/其他特殊写和真实风控仍待，见[话题记录](api-v3-client-chat-topic-work.md)。


第七十九轮（2026-10-27）：弹幕价格/独立发送接既有v3，经典/简约/侧栏共用费用确认与原content/color/key恢复；未知价格阻止新发，成功回执不补播，匹配原输入才清理。认证chat.barrager白名单DTO经timeline独立ref→AppShell唯一纯文本瞬时层，最多5条/8秒/有界去重，身份/断连清理，不改历史/上下文。弹幕13及相关共170组、类型双构建、72JS版本0/无map通过；当前无浏览器工具，双视口及真实费用/广播/风控未验，不能算运行验收。284保持，无Java/SQL/Maven/APP/提交推送；禁言/其他特殊写和真实全链继续，见[弹幕记录](api-v3-client-chat-barrage-work.md)。


第八十轮（2026-10-27）：音乐卡片接既有v3独立POST，经典/简约共享四字段编辑/原key恢复/二次确认，成功GET当前消息后合并timeline，读取失败只GET重试，身份及旧详情隔离。数字ID安全跳转网易云，HTTPS显式播放、保留历史安全HTTP，失败提示和Promise乱序保护；无普通消息命令。音乐16及相关共186组、类型双构建、72JS版本0/无map通过；无浏览器工具，双视口/真实发信与音源/风控未验。284保持，无Java/SQL/Maven/APP/提交推送；思过崖新口径待确认，天气/红包及真实全链继续，见[音乐卡片记录](api-v3-client-chat-music-work.md)。


第八十一轮（2026-10-27）：天气卡片接既有v3独立POST，经典/简约共享首日生成五天、空天气/温度必填、严格代码/日历/整数范围；原city/description/days/key恢复与二次确认，成功GET当前消息后入timeline，失败只重读，身份/旧详情隔离。天气16及相关共202组、类型双构建、72JS版本0/无map通过；无浏览器工具，真实控件/双视口/发言资格/风控未验。284保持，无Java/SQL/Maven/APP/提交推送；思过崖口径待确认，红包和真实全链继续，见[天气卡片记录](api-v3-client-chat-weather-work.md)。


第八十二轮（2026-10-27）：五类红包创建/详情/领取接既有v3，经典/简约/隐藏会话/浮窗共享状态；明确费用及风险确认，猜拳手势必选，原命令/key跨SPA恢复，成功回执与当前GET独立，旧历史不自动转换。红包23及相关共225组、类型双构建、72JS版本0/无map通过；无浏览器工具，真实扣款/守恒/并发/权限/风控及双视口未验。284保持，无Java/SQL/Maven/APP/提交推送；思过崖口径已确认待实施，见[红包记录](api-v3-client-chat-red-packets-work.md)。


第八十三轮（2026-10-27）：思过崖新增GET /api/v3/chat/mutes/content.read，实际ID禁言与当前有效账号、未到期筛选、五公开字段及分页，不读旧用户名快照。独立侧栏按需共享读取、错误未知/原页重试/身份隔离，双布局通用；旧fetchMutes删除。SQLite/MySQL各5组、客户端11及相关共236组、类型双构建、72JS版本0/无map通过。285条（284HTTP+1WS）；Java已提醒IDEA重编/重启，无Maven/迁移/APP/提交推送；真实服务/浏览器/全局风控待验，见[思过崖记录](api-v3-chat-mutes-work.md)。


第八十四轮（2026-10-27）：聊天室涂鸦接既有v3票据与共享具名PNG上传，经典/简约同组件；只插入草稿，不自动发布。上传冻结编辑，失败保画布，关闭/离页/换人/退出取消迟到结果，同账号轮换保留；删无消费者旧uploadFiles链。涂鸦13、上传9及相关236共258组、类型双构建、72JS版本0/无map通过；无浏览器工具，真实像素/触屏/图床/发送与风控待验。285保持，无Java/SQL/Maven/APP/提交推送，见[涂鸦记录](api-v3-client-chat-paint-work.md)。


第八十五轮（2026-10-27）：举报四目标接既有v3目录/提交，文章/长文/评论/用户及聊天室两布局共用；真实分类无兜底、备注可空、按ID识别他人，原target/type/reason/memo/key跨SPA未知恢复，平台明确确认、身份隔离、全局仅编号回执。删旧reportContent。举报19及相关共323组、类型双构建、72JS版本0/无map通过；无浏览器工具，真实权限/DB去重/风控及双视口待验。285保持，无Java/SQL/Maven/APP/提交推送，见[举报记录](api-v3-client-reports-work.md)。
