# v1 / v3 双模式接入

2026-11-04 用户明确要求：现网v3尚未上线，保留现有v3并让全站分批支持旧接口，一键切换。本文件记录真实覆盖，不能把开关完成写成全站适配完成。

## 当前覆盖（第一批）

| 能力 | v1 | v3 |
| --- | --- | --- |
| 模式选择、HTTP代理、SSR请求隔离 | 已接 | 保留 |
| 登录、本人基础资料、退出 | 已接旧getKey/user，合成账号验证 | 保留，认证/导航回归验证 |
| 首页最新40、热议12、最近/热门专栏各8、标签24 | 已接现网真实JSON只读 | 保留原读取与SSR投影 |
| 需求反馈列表/提交/投票/管理 | 独立服务按旧key核验，合成身份验证 | 原Bearer核验保留 |
| 首页连签/在线榜单、最近注册、复读机读取及换一条 | 第三批已接真实快照 | 保留 |
| 清风列表与写入口 | 第五批已接；写入为本机夹具验收，真实CSRF/权限待验 | 保留 |
| 复读机投稿/点赞及其余榜单 | 待适配 | 保留 |
| 普通文章分类列表、详情和普通评论读取 | 第二批已接，未知总条数不显示 | 保留 |
| 专栏目录读取 | 第二批适配，实际旧接口部分目录为空且与元数据不一致时明确503 | 保留 |
| 搜索、标签/领域目录及其文章列表 | 第四批已接，搜索缺匿名元数据时无身份展示 | 保留 |
| 长篇列表与段评、内容互动 | 待适配 | 保留 |
| 通知列表/未读/已读及实时刷新 | 第六批已接；旧列表仅有限快照，合成身份验收 | 保留 |
| 私信会话/历史/发送/撤回/已读/未读 | 第七批聊天及第八批富编辑已接，本地合成账号验收；真实上传权限待验 | 保留 |
| 共享编辑器预览/上传/表情选择/@联想 | 第八批已接，上传仅本地夹具验收 | 保留 |
| 聊天室、在线/话题/特殊卡片 | 待适配 | 保留 |
| 用户公开六字段/悬浮卡基础资料 | 第五批已接旧公开JSON，其他用户栏目待适配 | 保留 |
| 关注/收藏、账号各类设置、财务/导出等 | 待适配 | 保留 |

未适配资源在v1中明确报501，不发送v3 HTTP/订阅，不自动降级、不恢复mock、不用空列表吞错。不会把旧响应伪装为具有v3的幂等/权限/费用保证。后续批次须逐资源核对实际旧接口、字段、分页及身份，缺少的能力明确列出，不恢复退役的page-auth桥接。

## 使用与部署

左侧设置 → 接口版本 → v1现网接口 / v3开发接口，点击刷新切换。只保存非敏感的`fp.apiMode`偏好Cookie，SSR与客户端使用同一模式；多标签页通过BroadcastChannel/重新聚焦检查同步刷新。Cookie无效时使用部署默认值。

```dotenv
VITE_API_MODE=v1
VITE_API_V1_TARGET=https://fishpi.cn
VITE_API_V3_TARGET=http://[::1]:8081
```

未配置模式时保留原v3默认，以免既有部署自动降级。v3后端未启动时明确503；不能把本机8080其他应用当作Rhythm。网站端口始终5173，反馈5174。Node运行时要求24.12及以上。

`/api/`由Node或Vite内的统一代理按固定配置目标转发，浏览器不能传入任意上游URL。SSR用AsyncLocalStorage隔离每次render的模式，不能用共享变量记录当前请求。生产nginx需采用本批配置，使`/api/`与`/api/v3/realtime`进入Node；其余经典页面接口仍保留原规则，后续迁移需分别核对。

v1使用独立内存apiKey，不复用/写入v3的Bearer槽；刷新后需要重新登录。v3仍使用内存Bearer和HttpOnly刷新Cookie。切换整页刷新，清除草稿、连接及未确认命令；切换前须完成或核实未确认操作，界面明确提示。v1代理不向旧服务器转发Authorization或`fp_v3_refresh`。没有自动失败回退，也没有将Bearer写入旧apiKey参数。

反馈服务分别配置`RHYTHM_V1_ORIGIN`和`RHYTHM_ORIGIN`（v3）。v1客户端明确携带`X-FP-API-Mode:v1`与专用`X-FP-Legacy-Key`，仅服务端固定GET`/api/user?apiKey=...`验证；拒绝同时夹带Bearer，不记录URL/凭据。v3仍只向`/api/v3/me`发送Authorization。反馈数据库继续独立，不写Rhythm。已有同一稳定用户ID的需求/票保持关联。

旧首页时间字符串按站点Asia/Shanghai规范转换ISO，昵称仅展示、用户名用于寻址，匿名分支抹去身份；缺字段报错，不以假0或缺省作者补齐。v1标签保留真实旧URI，不伪造为v3资源ID。

## 后续批次顺序

1. 首页余项和公共内容：榜单/最近注册/复读机/清风、文章目录与详情、评论读取、专栏完整目录和段评。
2. 聊天与提醒：主聊天室历史/实时、上下文/引用、在线、话题、特殊消息；通知、私信及悬浮聊天。
3. 内容写入及关系：编辑器预览/表情/上传/@、发帖/评论、赞踩/收藏/关注与个人公开页。
4. 本人设置与消费：资料/偏好、勋章/职业/会员、背包/转账/积分、账号安全/导出。逐项区分旧接口有无能力与未知写入恢复，不能照搬v3收费重试保证。

每批补充API/状态/浏览器验收和本地Git提交，Rhythm不随客户端回退，不推送远端。

## 第一批验证

- `node tools/api-modes-test.mjs`：真实双上游HTTP代理/凭据隔离/明确未适配、切换偏好及实际Pinia双协议登录与退出；所有登录是合成凭据。
- 反馈服务`npm run check && npm test`：新增本机v1身份HTTP核验、v1创建反馈、拒绝混入Bearer；原双用户票/管理等回归。
- 原v3的HTTP正文断流、私有ZIP、离线身份、财务、首页、目录、SSR载荷、启动及登录导航专项回归；测试适配器明确选择v3。
- 类型检查与完整双构建；浏览器只读核对v1首页五资源和v1→v3→v1切换。实际v3后端8081未启动，因此不宣称真实v3网络联调通过。
- 没有向现网调用密码登录、发反馈或修改业务数据。真实v1账号登录、生产nginx/刷新Cookie与全站业务仍需后续验收。

## 第二批：公共文章与专栏读取

已接旧`/api/articles/recent`及hot/good/reply、qna/perfect分类路径、`/api/article/:id?p=`详情及其普通评论。只投影当前所需字段，作者昵称与用户名分开，匿名评论不携带真实ID/头像。旧详情HTML沿既有正文渲染链展示，不作为原Markdown或编辑源码；不根据读取猜测感谢/投票/管理资格。旧收费正文仅在当前rewarded明确为true时投影。

旧文章分页通常只有pageCount，没有recordCount；ArticleListing.total仅v1允许null，页面不显示“共0篇”或空数字，页数与翻页仍取真实元数据。v3保留数字total及严格分页校验。

专栏`/api/columns/:id`和`/articles?p=&size=20`已适配。详情按真实分页完整核对章节数，限制500页，不把摘要两章当完整目录。现网只读核对部分专栏元数据有5或68章而章节接口返回空数组、recordCount=0，此时明确目录不一致503，不能以适配完成宣称现网目录已正常。独立章节页可展示其合法空结果；目录与元数据一致的21章/两页夹具测试验证首章和末章正确。

第二批验证：`node tools/legacy-content-test.mjs`覆盖匿名白名单、不可见收费内容、未知total、v3仍拒绝null、真实分页/零值、错误目标与21章完整目录/空目录不一致；原v3内容/列表/专栏/SSR等专项回归及双构建。浏览器只读看到现网最新列表及普通文章正文、8条评论/回复；未做真实账号评论写入，长篇段评/互动/原文/实时与其他模块仍未随本批完成。

## 第三批：发现模块

旧榜单`/api/top/checkin|online`每次返回有限完整快照，服务端忽略p/size；客户端按该真实快照分页，rank按原序号、total只表示快照条数，首页各取8条。积分财富/支出按同一适配器的真实字段读取，其他榜单缺少已核对字段时明确失败，不补0。现网只读HTTP与SSR看到连签42条/在线64条快照，首页预览各8条。

最近注册`/api/user/recentReg`只有用户名和昵称，没有ID、头像；新增仅此资源的可选ID类型，用用户名作为列表稳定key，头像沿默认方案。不伪造ID，不修改其他v3用户资源的严格ID契约。当前20项真实列表已HTTP/SSR及浏览器核对。

复读机`/api/repeater/items`、`/api/repeater/next`转为现有公共展示模型，类型/内容纯文本/作者/票数白名单，next必须符合指定类型且不等于排除ID。只携带独立旧key，不混入Bearer。列表按实际返回、首页前12，随机项可离榜。旧点赞toggle不具备v3明确幂等设置保证，本批只适配读取，不宣称投稿/点赞已完成。

随机发现`/article/random/:size`已接独立旧响应，去除当前文章、拒绝重复，不回退首页或模拟文章。

验证：新增`tools/legacy-discovery-test.mjs`真实适配器专项覆盖榜单有限分页/缺值拒绝、复读机纯文本/0/next排除ID、最近注册缺ID投影及v3仍拒绝无ID；原复读/榜单/发现/首页/SSR专项回归与双构建通过。浏览器可见首页8+8排名、20个最近注册和复读内容，未进行现网写入或密码登录。清风、其他待办继续，不能据此标记整个首页或全站完成。

## 第四批：搜索与标签/领域

`/api/domains`返回有限领域快照，客户端按快照分页，保留真实domainURI；`/api/tags?p=&size=50`按服务端total和pageCount分页，不用最近50条冒充全集。目录图标验证协议、拒绝脚本URL，SSR投影保留真实URI与可用计数。页面链接分别编码一次，读取文章`/api/articles/tag/:uri`及`/domain/:uri`时不二次decode，也不将旧slug伪装成v3 ID。

搜索使用旧`/api/search?key=&p=&size=20`，保留服务端有限搜索总量与分页。实际旧搜索摘要缺articleAnonymous，却带完整嵌套articleAuthor，不能据该别名恢复可能匿名的身份：新增articleIdentityUnavailable，仅v1投影允许，作者ID/名称/头像均清空，列表标为“作者信息未提供”；详情仍依据明确匿名标记显示。原v3摘要严格匿名契约不变，不接受此未知分支。旧CST字符串显式按中国+08:00解析，避免JS误作北美中央时间。

验证：legacy-content专项增加真实tag URI单次编码、目录末页/空结果/数量错误、危险图标、SSR重投影、搜索未知身份与v3拒绝该分支、中国CST时区；7组v3相关脚本、类型及双构建通过。浏览器只读实测领域7项、标签2526项/51页、搜索真实结果与作者缺失提示。全站目标仍进行中，清风/聊天/通知/私信及写能力尚未完成，本批无真实密码登录和现网写入。

## 第五批：清风与公开用户资料

公共资料使用SDK现有`GET /user/:name`，严格转换到现有六字段公开模型，校验目标用户名，禁止带入旧角色/积分/勋章/联系方式或完整对象。服务端代理增加该精确路径与清风写路径的模式路由，v1仍剥离Bearer。现网仅只读核对公开JSON；未用公开资料拼本人编辑表单。

清风共享入口按模式选择两个实现，原v3面板保留为V3BreezemoonPanel，v1主列表/首页/侧栏复用LegacyBreezemoonPanel和既有BreezemoonList。旧`GET /api/breezemoons`没有总数/页数，只保留请求页和列表，不伪装BreezemoonPage的完整分页。显示“接口未提供总条数与总页数”，按显式“读取下一页”查询；合法空页与失败分别展示。

旧清风只有作者用户名，读取时以有界4并发、单次列表内去重请求公开六字段以核对真实ID，不造ID、不建立跨身份资料缓存；个人编辑/删除按钮只在当前ID匹配时显示。失败或换号拒绝旧列表与用户回写。原文来自明确的breezemoonContentRaw，HTML来自既有服务端清洗字段，不互相猜测。

POST `/breezemoon`采用现有官方SDK的apiKey+breezemoonContent；PUT/DELETE `/breezemoon/:id`保持已有经典路由及明确旧key，不恢复page-auth/sym-ce/CSRF桥接。真实服务拒绝权限或CSRF时显式展示错误，不绕过。v1写入没有原子幂等回执，因此独立Pinia状态在网络/5xx/HTTP成功但损坏正文时锁定未确认操作，不提供自动重发；用户先重新读列表或核对经典站点，明确解除锁定只改本机状态。成功才重读，读失败不重写；草稿仅匹配原提交时清除，退出/换号清理。删除确认在离页/换号取消。

验证：新增legacy-breezemoons 6组实际模块与Pinia专项，涵盖分页/去重/身份、三个写方法、私有字段剔除、未知结果锁定/解除不发请求、迟到成功、损坏回执；双代理专项增加user和breezemoon路径。原v3清风/用户卡/首页/SSR/关注动态回归及类型、双构建通过。浏览器只读看到现网清风与分页，未使用真实账号发布、修改或删除；真实旧写入权限/CSRF仍需单独验收，不能据本机夹具宣称线上已通过。

接口源码参考：官方SDK发布包fishpi 0.1.31（https://registry.npmjs.org/fishpi/-/fishpi-0.1.31.tgz）及Dart官方文档（https://pub.dev/documentation/fishpi/latest/fishpi/Breezemoon-class.html）。只读取SDK源码，没有安装或执行其代码。


## 第六批：通知及双模式实时代理

通知入口复用现有页面，按模式分别调用`/api/getNotifications?type=`、`/notifications/unread/count`及`/notifications/make-read/:type|all-read`；v3资源与幂等键处理保留。旧列表没有服务端历史分页契约，因此仅对本次返回的有限快照分页，并在页面标注范围，不宣称覆盖全部历史。合法空数组与损坏/失败响应分开，未读总数必须存在，缺少的分类计数不补造。已读使用旧明确设置接口，不将v3幂等键塞进旧接口。

旧通知仅白名单内容/链接/真实ID/时间；目标author/commentAuthor等别名不作为操作人，只有明确actor才投影身份，未提供身份保持普通消息图标。不可访问内容移除正文、标题、链接与身份，头像保持签名URL并拒绝凭据URL。通知读取失败在页面与顶栏可访问标签中明确提示，不伪装成功的0。

新增独立旧key变化订阅及共享user-channel，只读取旧apiKey，不读取Bearer。首连与有效command帧只使HTTP数据失效后重读，不把WS正文写进通知；重复失效合并，断线退避重连，最后一个消费者离开/退出/HMR清理，旧身份迟到响应不能回写。私信未读适配器已准备，但私信面板/入口尚未接入，不据此标记私信完成。

WebSocket升级代理提取到server/api-mode.ts，由SSR开发、Node生产与Vite SPA共用，nginx对应通道转Node按固定模式上游选择，避免生产绕过模式选择。v1剥离Bearer及v3刷新Cookie，v3实时URL拒绝query凭据；处理两端关闭和升级超时。Vite原重复通道代理移除，避免一次升级双重转发。回归同时发现并收紧HTTP凭据代理的精确认证路径，只有login/refresh/logout保留浏览器authority，其余API使用上游Host。

验证：legacy-notifications实际模块/共享通道/状态专项覆盖快照分页、身份白名单、缺字段失败、已读语义、共享连接、换号同步清理与迟到拒绝；dual-websocket实际本机HTTP升级验证双目标与凭据隔离。原v3通知、私信21组、凭据代理、退役桥接、IPv4/IPv6升级、模式/SSR隔离回归通过；类型与双构建通过。浏览器只读核对游客访问通知正确跳转登录并保留回跳地址；登录态通知和真实现网已读/实时尚未用账号验收，未进行真实密码登录或通知写入。


## 第七批：私信基础聊天

完整页和悬浮窗统一通过PrivateMessages按模式选取实现，原V3PrivateMessages及其HTTP明确命令/幂等恢复保持。v1用独立legacy/messages、message-channel、legacyMessages及legacyPrivateInboxState；共享选中联系人、输入草稿与一条当前会话连接，两个面板同时挂载不会重复连接，离开完整页而悬浮窗仍打开时保留连接，最后一个消费者卸载才关闭并清除正文。身份变化同步清空旧正文、待核对操作和草稿，迟到历史不能恢复旧数据。完整页链接同时保留用户名和真实ID，两个列表按共同选择同步高亮。

核对官方ChatProcessor源码后修正旧私信协议：HTTP使用result而非通知的code，has-unread的result为未读数且必须与实际data长度一致；逐行核对toId属于当前账号，再按fromId生成会话未读数。撤回/当前已读/全部已读分别调用chat/revoke、mark-as-read、mark-all-as-read，不存在的HTTP send不使用。撤回与已读只在明确result=0后重读，失败或不完整响应可能发生在写入之后，保留原命令并让用户先核对，解除锁定只修改本机状态，不自动重放。

get-list的receiverUserName固定表示另一位联系人，不按最后一条消息的方向猜测senderUserName；根据真实参与者ID核验，白名单仅留联系人/预览/时间，不保留user_session等内部字段。会话列表为旧有限快照，客户端每20项分页；历史按真实page/pageSize读取，不补造总数，只有精确的“没有更多消息了”result=-1视为结束，其他失败明确展示。新消息或撤回后重读已展开页，按真实ID去重、排序，防止页码移动时旧正文残留；读取不自动标已读。文件传输助手使用既有FileTransfer名称和固定内建ID。

旧发送只能向chat-channel写原文本，没有幂等键或请求关联ID。模块不在重连时重发；冻结目标和原文，只有看到匹配本人/目标/原文的新消息ID且当前HTTP历史再次确认该条时才解除发送锁定并清匹配草稿。这是当前消息可见性的核对，不声称旧协议有v3原子回执；超时、连接断开、服务端过滤导致原文不匹配或读失败时保留原文，用户核对后显式解除锁定。每次发送至多写一次当前连接。通道支持旧p心跳及退避重连，收到的HTML不直接写入历史，只有当前HTTP读取投影可进入正文。

全局user-channel与通知共用已有单订阅，以失效后HTTP重读驱动顶部、左侧入口和弹窗内头像橙色圆点，不从事件count/preview拼私信内容。小窗口根据弹窗宽度压缩为头像列表与textarea+发送；联系人/连接状态移到紧凑标题，输入区固定在可见区域。v1目前允许输入文本/Markdown，Vditor预览、表情和图床上传仍待共享编辑器批次，不能据基础聊天完成声称富编辑全功能已适配。

验证：legacy-messages实际API/连接/Pinia专项涵盖参与者/顺序/白名单、result和结束哨兵、会话姓名方向、真实未读归属、共享连接、当前HTTP确认、未知结果防重发、变更失败锁定、后置读失败不再写、换号/迟到隔离、SSR零私有请求及定时器清理。原v3私信21组、通知、双模式/SSR、共享WS代理回归、类型及双构建通过。浏览器使用只在内存中运行的本地HTTP/WS合成账号夹具，实际完成登录回跳、发送/输入清除、弹窗与完整页同步切人、B聊天时A通知、离开/chat后发送、全部已读与最小窗口圆点/输入布局；没有使用真实密码或向现网用户发送消息。测试结束已停止夹具并恢复127.0.0.1:5173指向现网v1的开发服务。

协议参考：[官方ChatProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ChatProcessor.java)、[官方ChatChannel](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/channel/ChatChannel.java)，与先前官方SDK交叉核对。源码只读下载至临时目录，没有运行第三方源码。


## 第八批：共享编辑器与私信富编辑

共享编辑器保持同一Vditor与原v3传输，增加editor-session按当前模式读取编辑工作所需凭据/身份边界，实际API仍由各协议适配器分别选择凭据。v1 key变化立即取消预览/上传/联想，正常v3令牌轮换保持同一身份，不把旧key当Bearer。新增editor-emojis/editor-suggestions门面只覆盖编辑器读取，表情管理写入与个人设置没有因此自动宣称完成。

预览v1使用POST /markdown的markdownText与code=0/data字符串，空白正文的特殊code=0/html空串响应也按真实契约返回空预览，其他正文不回退该字段。公共参数边界仍走现有校验；同步transform继续返回空串阻止未验证的本地HTML回退，只有当前正文/身份匹配的异步预览可以写入。现网只读HTTP核对该响应为字符串，失败明确显示并可重试，不抓取网页HTML。

上传v1取POST /api/rhypic/upload-ticket?apiKey，读取专用ticket和uploadURL基址（保留可信服务配置的路径前缀）后追加api/v1/files；共用原多文件命名、部分结果、URL/Markdown转义和中止处理。v3票据字段仍严格要求Bearer/file。图床请求只带专用上传票据、credentials=omit、redirect=error，旧key与站点Bearer均不进入文件请求；pic.fishpi.cn仍走现有同源/rhypic-upload代理，覆盖选择文件和剪贴板图片。换号后迟到票据不得触发文件传输，迟到文件结果不得插入；网络结果未知不自动重复上传。

@联想v1用POST /users/names，按原name前缀校验返回用户名并白名单头像/可选昵称，不为旧列表没有的用户ID补值；V3UserSuggestion的严格ID契约保持。现网只读HTTP实际返回userName和头像字段、没有ID/昵称，与适配一致。共享提示仍立即结算被替换promise，防止旧候选覆盖当前列表，展示HTML转义，插入只用用户名。

表情选择读取/users/emotions与/api/emoji/groups、group/emojis；常用表情以服务端别名插入，实际Unicode或图片只作展示，不加入硬编码图案。图片组保留私有成员oId与emojiId的差别，签名URL不重新编码；旧列表没有分页元数据，只按真实有限快照分50项显示，不发明服务器总量或使用云存档兜底。原表情管理写资源仍另批适配。

v1私信正常宽度接回ChatComposer的精简Vditor，窄窗保持自定义textarea+发送。ResizeObserver观察的是私信面板宽度，缩放前读取当前编辑缓冲区，切换编辑器仍共用原草稿；上传在编辑器卸载时中止。没有改变原v3私信组件的发送语义。

验证：legacy-editor专项运行实际双模式API/身份模块/共享上传与提示辅助器，覆盖旧预览响应、Unicode、专用票据/代理/部分文件、嵌套基址、危险URL、换号迟到票据/文件、无ID联想、转义/过期候选、真实有限表情分页与成员ID。原v3预览7组、上传9组、联想7组、编辑器/表情/涂鸦/私信专项回归、类型及客户端/SSR构建通过。浏览器使用本地HTTP/WS/图床夹具和合成账号，实际验证精简工具栏、表情插入并发送、文件选择上传、剪贴板PNG上传、@候选选择、缩小时保留完整Markdown草稿、放大后恢复Vditor。没有向现网账号发送消息、上传文件或反复密码登录；真实图床权限/大小限制/票据联调仍待账号验收。测试结束已关闭合成账号页面、停止夹具，并恢复127.0.0.1:5173现网v1开发服务。

协议参考：[ArticleProcessor.markdown2HTML](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ArticleProcessor.java)、[RhypicProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/RhypicProcessor.java)、[UserProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/UserProcessor.java)、[EmojiQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/EmojiQueryService.java)。仅只读参考源码，未执行外部源码。
