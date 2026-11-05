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
| 复读机投稿/点赞切换 | 第二十批已接；旧切换与投稿无幂等恢复，合成身份验收 | 保留 |
| 十五类普通榜单及进化/小冰子榜 | 第二十一批已接；职业榜见第三十五批 | 保留 |
| 普通文章分类列表、详情和普通评论读取 | 第二批已接，未知总条数不显示 | 保留 |
| 专栏目录读取 | 第二批适配，实际旧接口部分目录为空且与元数据不一致时明确503 | 保留 |
| 搜索、标签/领域目录及其文章列表 | 第四批已接，搜索缺匿名元数据时无身份展示 | 保留 |
| 长篇列表、当前段评统计/顶层分页、章节导航 | 第十八批已接；完整回复/孤立段评定位仍待适配 | 保留 |
| 普通评论/回复/段评发布 | 第十九批已接；合成身份验收，旧协议无幂等恢复 | 保留 |
| 评论编辑/删除及其余文章互动 | 编辑/删除受旧页面会话限制，仍待适配；表态见第十七批 | 保留 |
| 通知列表/未读/已读及实时刷新 | 第六批已接；旧列表仅有限快照，合成身份验收 | 保留 |
| 私信会话/历史/发送/撤回/已读/未读 | 第七批聊天及第八批富编辑已接，本地合成账号验收；真实上传权限待验 | 保留 |
| 共享编辑器预览/上传/表情选择/@联想 | 第八批已接，上传仅本地夹具验收 | 保留 |
| 聊天室历史/实时/普通发送/在线名单与话题读取 | 第九批已接现代节点；本地合成节点验收 | 保留 |
| 聊天室原文、引用、消息上下文 | 第十批已接独立原文和双向上下文读取 | 保留 |
| 本人聊天室撤回、话题修改 | 第十一批已接；无幂等恢复，合成账号验收 | 保留 |
| 聊天室音乐/天气发送 | 第十二批已接；本地合成账号验收 | 保留 |
| 聊天室弹幕价格/发送/实时显示 | 第十三批已接；本地合成节点验收 | 保留 |
| 聊天室五类红包创建、详情与领取 | 第十四批已接；本地合成账号验收，非幂等旧结算 | 保留 |
| 思过崖旧快照、涂鸦上传与插入 | 第十五批已接；旧快照不等价于实时禁言资源 | 保留 |
| 举报（文章/评论/用户/聊天室） | 第十六批已接；旧协议无编号与幂等恢复，本机合成身份验收 | 保留 |
| 文章/评论/聊天室表态 | 第十七批已接；旧切换无幂等恢复，本机合成身份验收 | 保留 |
| 用户公开勋章 | 第三十四批已接当前启用快照；无历史授予/永久有效证明 | 保留真实授予分页 |
| 本人资料/头像设置读取 | 第四十一批已接本人白名单；编辑处理器依赖Session，QQ/标签/MBTI缺独立本人读取，仍待后端协议支持 | 保留完整编辑/上传 |
| 会员档位/本人状态/开通/昵称配置 | 第四十批已接旧JSON；无效券可能加价、全配置保存及未知锁定与v3分离 | 保留原规则与原键恢复 |
| 本人勋章读取/展示/相邻排序 | 第三十九批已接；重复定义ID条目保留且禁止歧义写，无幂等恢复 | 保留授予ID分页与原键写入 |
| 积分转账 | 第三十八批已接旧apiKey POST及当前余额；仅成功确认，无费用/到账/编号回执，无幂等重放 | 保留详细回执/原键恢复 |
| 本人背包/四卡使用 | 第三十七批已接旧JSON读取、三种消耗GET及改名卡POST；无幂等重放，积分改名另受页面会话限制 | 保留原接口/原键恢复 |
| 本人职业状态/隐私/等级/成长提示/流水 | 第三十六批已接读取；写入被经典CSRF协议限制，未恢复Cookie桥接 | 保留原读写 |
| 职业排行 | 第三十五批已接旧经验前20名可见快照；无完整分页/人数 | 保留 |
| 用户公开职业资料 | 第三十三批已接旧等级快照与可见模块；本人管理/职业榜另迁移 | 保留 |
| 用户公开六字段/悬浮卡基础资料 | 第五批已接旧公开JSON | 保留 |
| 用户文章/长文/公开回帖/清风列表 | 第二十二批已接；私密正文与清风单条读取受旧契约限制 | 保留 |
| 关注/粉丝、关注标签与收藏列表读取 | 第二十三批已接；旧订阅列表缺独立JSON，删除记录可能省略 | 保留 |
| 用户关注/取消关注 | 第二十四批已接，旧响应无幂等回执，合成身份验收 | 保留 |
| 本人积分流水与当前余额 | 第二十五批已接；旧说明按文本显示，合成身份验收 | 保留 |
| 社区九项统计 | 第二十六批已接，现网公开JSON/SSR/刷新只读验证 | 保留 |
| 同城用户分页 | 第二十七批已接；旧总人数未知、文章JSON仍缺失 | 保留双资源分页与排序 |
| 大事记公开时间线/详情 | 第二十八批已接；旧快照分页，投稿与本人审核状态仍缺少apiKey契约 | 保留 |
| 鱼游目录/详情/评论读取 | 第二十九批已接；有界旧目录与评论快照、本机分页 | 保留 |
| 鱼游投稿/编辑申请/投票切换/评论 | 第三十批已接；四字段旧投稿，未知结果无自动重发 | 保留五字段及同键恢复 |
| VIP 昵称公开样式 | 第三十一批已接，v1 限四处展示，游客可读 | 保留原批量与认证边界 |
| 签到状态/昨日奖励状态及领取 | 第三十二批已接；旧领取为确认后的有副作用GET，无日期/金额预览与同键恢复 | 保留 |
| 标签关注/收藏/订阅写入、账号各类设置、财务/导出等 | 待适配，关系写入仍受旧页面会话限制 | 保留 |

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


## 第九批：聊天室主链路、首页预览和在线名单

useChatStore按模式选择独立legacyChatState，v3时间线/发送/在线三个store仍只在v3分支构造；外观样式状态提为共用初始化，SSR继续经典默认，挂载后恢复本机偏好。主聊天室、首页简易聊天室和悬浮聊天室沿用同一个store，悬浮窗使用时离开页面不关闭连接。v1普通发送、历史读取和状态恢复不借用v3命令或幂等回执。

旧GET chat-room/more按固定25项真实页码读取，清洗HTML白名单、消息ID、作者/昵称/头像、时间和公开勋章分离，不拷贝完整对象或反应回执。数字作者ID必须是安全整数，不造不存在的ID；旧CST时间显式转ISO。初始及翻页重新读取当前已展开页，去重按ID排序，空列表与读取失败分开。游客只在客户端读取既有公开历史快照/在线/话题，最多两页，不在SSR读取旧消息，也不以定时轮询伪装实时；登录后才取得节点并实时订阅。

核对官方源码发现旧chat-room-channel在现代节点可用时已经停用，因此不能固定连接该旧地址。v1由GET chat-room/node/get取得服务端当前推荐节点、目录和派生临时key，校验推荐/切换目标均在目录，再直接按官方协议连接该节点；不自行回退过期频道、不将站点Bearer或旧主key拼到节点URL。只有服务端明确分配的故障转移节点才使用该路径。临时key仅在连接闭包中，Pinia节点选项不含query凭据。重连重新分配票据，心跳-hb-，错误退避；401/403不循环尝试旧授权。没有开放可由浏览器任意指定上游的服务端WS代理。

msg事件只按ID读取当前GET chat-room/getMessage(mode=0,size=0,type=html)投影，不从WS正文插入；revoke事件同步保留删除集合，旧历史/详情不能复活；重连不覆盖用户清屏，新事件才继续显示。401/403清除已授权正文、旧订阅及在途投影，换身份才能重新授权。积压事件去重、超过预算仅重读当前窗口。在线/话题事件仅触发当前online-users重读，名单不从WS字段拼接。

在线接口的onlineChatCnt必须真实且与本次users列表一致，源码异常回退99999不得显示成正常人数。旧目录没有用户ID，只按服务端用户名展示/链接，不造ID；按有限快照20项分页，筛选只针对当前页，失败为未知而非0。v3在线页保留为V3ChatOnlineList，公共入口按模式选择，不削弱其采样与分页契约。

普通POST chat-room/send只发送旧apiKey/content/client，不附加v3幂等键；原文和4096字符限制保留，先拒绝旧特殊收费语法（包括前置空白），避免普通输入隐式执行红包/弹幕/话题等写入。code=0后只重读，不从回执造消息ID/正文；后置读失败不重发。网络/损坏响应/不明确业务失败保留原文并锁定发送，用户先读当前消息核对、明确解除锁定仅改本机状态。待核对命令跨SPA保留，离开页面不把发送busy永久卡住，换号清除。不存在15秒聊天室拉取定时器。

音乐/天气仅投影既有公开卡片字段，未知JSON不作为HTML/完整对象回显；红包只保留“红包消息”占位，领取/详情/特殊发送、原文引用、上下文、本人撤回和话题修改仍在下一批。不能因主链路接通就称整个聊天室或全站已完成。首页已有布局hydration warning也未在本批解决，不能拿本次SSR零私有请求测试冒充整页水合验收。

验证：legacy-chat实际API/现代节点连接/公共Pinia门面测试覆盖作者ID精度/时间/勋章白名单、危险卡片不回显、旧发送凭据与特殊语法、真实25项分页、当前HTTP重读、并发历史不能复活撤回、清屏后重连、未知发送无重放、离页发送busy清理、401/403与身份边界、SSR零HTTP/WS及定时器清理。原v3发送15组、消息源13组、在线12组、首页18组、私信/时间线等回归、类型及双构建通过。浏览器仅用内存合成账号和本地HTTP/现代节点夹具，实际验证完整版发送、在线2人/话题、悬浮窗共享、切页后发送、首页发送同步到浮窗。未向真实聊天室发言、修改话题、领取红包或调用密码登录；真实节点派生票据/生产连通性仍待账号联调。公开只读HTTP核对现网历史25项/字段和online-users真实契约，测试后已停夹具、恢复127.0.0.1:5173现网v1开发服务。

协议来源：[ChatroomProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ChatroomProcessor.java)、[ChatroomChannel](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/channel/ChatroomChannel.java)、[ChatMsgAddValidationMidware](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/middleware/validate/ChatMsgAddValidationMidware.java)。仅只读源码，未运行外部实现。


## 第十批：聊天室原文、引用及上下文

`chat-reading.ts`按模式选择独立读取适配器，v3原有消息API不变、不回退旧站。v1使用已认证`GET /chat-room/getMessage`，读取原文时并行取得`type=md`与`type=html`的精确单条；ID、作者和时间须一致。原Markdown保留换行，引用作者用用户名寻址并转义，预览只用服务端清洗HTML，不从历史HTML反推原文或访问`/cr/raw`页面。红包仅返回公开卡片类型，音乐/天气仅白名单摘要；未知卡片不可读，不显示私有接收人或完整传输对象。

上下文继续复用`ChatContextPanel`与独立窗口，不混入最新时间线。旧mode=0取两侧11条作为各10条的边界探针；mode=1/2为包含游标的查询，适配器去掉游标并多读一条判断下一页，不根据固定页长编造更多数据。验证锚点存在、严格顺序、方向、大小；权限/404清正文，其他错误保留原窗口并按原方向重试。主门面仅暴露ID/version变化提示，msg/revoke、断连或身份变化使上下文失效，在途成员发生变化也不能提交旧窗口。v1上下文不构造v3时间线，SSR不读私有资源。

原文与引用状态按当前身份/旧key隔离，关闭/取消中止两个读取，迟到结果不能重新打开弹窗；v3普通token轮换仍保留同身份请求。完整版两种布局均开放旧认证对应按钮，深链接等待当前登录恢复、返回最新清hash。公开时间线、本人撤回、特殊消息发送/领取等其他能力各自维护，不能用本次只读兼容声称全站完成。

验证：`legacy-chat-reading-test.mjs`实际适配器及composable四组覆盖双原文/HTML、模式隔离、两侧边界与双向游标、重复/乱序/缺失锚点、跨读作者不一致、私有卡片过滤、身份/事件/关闭时序、授权错误恢复和SSR零私有请求。v3原文13组、上下文13组及聊天主链回归通过。浏览器本地合成账号验证经典/简约两布局原文、多行Markdown、引用预览、上下文定位与返回最新；没有向现网发送或撤回消息。完整构建/类型检查通过。测试后关闭夹具并恢复现网v1开发服务。真实旧账号权限与生产上下文尚未联调。


## 第十一批：本人聊天室撤回及话题修改

四个公共编辑/操作/恢复组件按当前模式挂载独立实现，原v3组件完整保留在V3ChatTopicEditor/Recovery与V3ChatRevokeAction/Recovery；v1不构造v3写入store。侧栏与两种聊天室布局共用同一入口，悬浮聊天室沿用共享撤回组件。`legacyChatActions`跨SPA保存未知操作，串行阻止重复收费，换身份/旧key清理；SSR和非v1模式不能提交旧写入。

话题先验证1～64个UTF-16单位与旧过滤允许字符，拒绝控制字符、内部换行、坏代理及会被旧过滤丢掉的字符，确认后才发送`POST /chat-room/send`的`[setdiscuss]文本[/setdiscuss]`。请求只有旧apiKey/content/client，无Bearer或伪造幂等键；成功仅通知原提交草稿完成并GET online-users读取当前话题，回执不覆盖当前值。每次16积分依据既有旧协议，正文相同仍是新收费操作，UI明确确认。

撤回入口仅给作者ID与本人稳定ID相符的消息。提交前再次GET精确当前HTML消息，验证ID/当前作者/可读状态并拒绝红包，再`DELETE /chat-room/revoke/:id`，body只带旧apiKey；不依据用户名猜作者，也不增加管理员代删入口。预检读取失败没有发出DELETE，单独显示错误并允许重新发起。code=0才调用共享门面的removeConfirmed，删除集合与上下文变化提示阻止迟到历史/详情复活。旧回执无结构化费用，因此只提示已撤回，不解析提示字符串、猜测当天次数或编造0积分费用。

两项旧写入均没有v3幂等保证。网络失败、损坏响应及可能已扣费的业务错误保留原kind/文本或消息ID并锁定新写；恢复UI仅允许重读当前状态及用户明确核对后解除本机锁定，没有自动重发或“同key恢复”。成功后重读失败仍视为写入已确认，不能再收费；确认窗口在离开/换号时取消，已发送请求的迟到结果按原身份丢弃。

验证：`legacy-chat-actions-test.mjs`九组实际API/Pinia/编译Vue组件与模式包装测试覆盖旧语法/DELETE body、先验证再收费、本人及红包预检、未知冻结/无重放、预检错误、成功后读失败、换号迟到、取消/确认、原草稿完成、只读恢复UI与SSR/模式限制。原v3话题13组、撤回11组以及其他聊天室、原文/上下文、首页/私信和代理回归通过；类型及完整构建通过。浏览器仅对本机HTTP/WS夹具合成账号验证侧栏话题收费确认、成功后当前话题重读、本人撤回确认与列表即时移除；未对现网修改话题、撤回消息或扣分。测试后停夹具、恢复现网v1开发服务。真实账号收费、服务端权限及生产节点仍待联调，红包/弹幕/音乐/天气等特殊能力继续下一批。

协议来源：[ChatroomProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ChatroomProcessor.java)、[LoginCheckMidware](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/middleware/LoginCheckMidware.java)。读取官方源码核对JSON旧key认证，不恢复Cookie桥接。


## 第十二批：音乐及天气卡片发送

音乐/天气公共编辑与恢复入口按模式挂载，原v3实现保留在V3ChatMusicEditor/Recovery、V3ChatWeatherEditor/Recovery，不改变其幂等确认、当前消息读取和重试逻辑。旧实现复用相同四字段音乐与五日天气的纯校验函数，不调用v3传输；v1在`legacy/chat-media.ts`明确POST旧send，只有apiKey/content/client，正文为`[music]{...}[/music]`或`[weather]{...}[/weather]`。天气将显式填写的五个日期、代码、最低/最高温度组成逗号分隔旧字段date/weatherCode/min/max，city/description映射t/st，不查询天气、不补默认预报。序列化后连同标签总长不得超过旧接口4096单位限制。

旧卡片发送共用legacyChatActions串行锁，与话题/撤回互斥；保存规范化白名单字段的独立快照，天气days深拷贝，不接受外部字段。code=0只表示本次操作已确认，旧响应没有可靠ID；成功后仅重读当前时间线，不猜ID、不以回执或本机草稿拼接卡片正文。读取失败不改变已确认状态，不再次发送。新操作清理旧完成状态；未知响应固定原kind/input跨SPA保留并冻结输入，恢复区仅显示原卡片字段、重读当前消息及明确核对后解除本机锁定，不能伪装v3同键重发。退出/换号/旧key变化清理并拒迟到响应，SSR/非v1不能发旧写。

共享ChatCard继续渲染当前GET投影，数字歌曲ID只提供网易云链接，不作为相对音频地址自动请求；HTTPS音频只在显式播放时访问。天气保留完整年份并分别显示五日天气和温度。原文/引用仍仅白名单公开摘要，不回显卡片运输对象。

验证：`legacy-chat-media-test.mjs`六组实际API/Pinia/编译Vue与模式包装覆盖两种旧语法和旧凭据、五日字段、危险URL/HTML/Unicode与超长序列化拒绝、无假ID/正文、成功后读失败、并发锁/嵌套草稿冻结、换key、真实编辑器空预报与提交清理、只读恢复及SSR/模式限制。v3音乐16组、天气16组及其余聊天室、首页/私信和代理回归通过；类型及完整构建通过。浏览器仅用本机HTTP/现代节点夹具合成账号，验证简约布局音乐发送/卡片/网易云链接，经典布局手填五日天气发送及日期/温度显示、完成后关闭表单。未向现网分享音乐/天气，未实际播放远程音频；生产节点、权限与风控仍待联调。夹具已停止，127.0.0.1:5173恢复现网v1开发服务。弹幕/红包及其他全站功能仍继续适配。

协议来源：[ChatroomProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ChatroomProcessor.java)、[旧聊天室天气字段与渲染](https://github.com/FishPiOffical/rhythm/blob/master/src/main/resources/js/chat-room.js)。只读源码核对，不运行外部脚本。


## 第十三批：弹幕价格、发送及实时显示

公共ChatBarrageEditor/Price/Recovery/Overlay按模式挂载独立实现，原v3组件保留在V3前缀组件，票据订阅、结构化价格/费用与幂等恢复不变。v1价格GET旧`/chat-room/barrager/get?apiKey=...`，严格拆解真实“非负整数+单位”字符串，0与未知/错误分开，不以本地默认5积分兜底。发送前重新GET价格并显示实际价格确认，读取失败不能收费；离页、换号、旧key变化取消待确认UI和迟到价格。

弹幕先验证1～32个UTF-16单位纯文本/有效Unicode及六位十六进制颜色，拒绝HTML/内部换行/控制字符，再POST旧send的`[barrager]{content,color}[/barrager]`，仅旧apiKey/content/client。沿用legacyChatActions串行锁，原正文/颜色未知结果跨SPA保留，阻止重发和其他待核对写入。旧回执不含可靠ID/费用，成功只报告已确认，不造免费回执、不把读取价格冒充实际费用、不从本地原文补播。未知恢复仅允许核对积分后解除本机锁定；弹幕没有历史，不能用历史空列表判定“未发送”。

v1现代节点的barrager事件经独立白名单校验进入useChatStore.barrage，仅取正文/颜色/公开用户名昵称，不投影凭据、头像、费用或伪造用户ID。只接受已登录且连接就绪的事件，常见HTML实体使用纯字符串解码后仍以文本插值显示，不解析或插入HTML。弹幕事件不读详情/历史、不失效上下文、不成为普通消息。AppShell继续仅挂一个公共Overlay；旧事件没有稳定事件ID，显示键只是本机递增序号，不能冒充服务端UUID去重保证。最多5行、8秒自动移除，断连/退出/换key/卸载清理全部计时器，不拦截页面点击。

验证：`legacy-chat-barrage-test.mjs`九组实际API/Pinia/编译Vue和模式包装覆盖精确旧格式/凭据、价格坏数据与真实0、正文/颜色校验、事件白名单与纯文本、未知冻结/无重发、迟到价格/身份、确认取消、价格失败禁POST、离页迟到价格/批准、无回执补播、5行/8秒及断连/卸载清理、SSR/模式限制。legacy-chat实际共享门面补充现代节点barrager事件不读历史/不插正文与坏事件拒绝；v3弹幕13组、其余聊天室及首页/私信/代理回归通过；类型和完整构建通过。浏览器仅对本机HTTP/现代节点夹具合成账号验证真实7积分读取、发送前确认、实时浮层、发送表单关闭及历史保持原消息；未向现网发送弹幕或扣费。测试后停夹具并恢复127.0.0.1:5173现网v1开发服务。生产收费、节点转发和风控仍待真实账号联调；红包及其他全站模块继续适配。

协议来源：[ChatroomProcessor旧价格/特殊发送](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ChatroomProcessor.java)。没有复活固定过期频道、Cookie桥接或15秒轮询。旧聊天室的普通/媒体/话题/撤回/弹幕写入均显式禁用共享HTTP的风控验证后自动重发；实际传输测试证明302只发一次且内部标记不进入fetch参数，普通GET的既有验证后重试仍保留。


## 第十四批：旧聊天室红包创建、只读详情和领取

ChatRedPacketEditor/Card/Dialog/Recovery按模式挂载独立实现，原V3组件完整保留，不把旧回执伪装为v3的支付、税额、消息ID或幂等保证。v1支持现有拼手气、普通、专属、心跳、猜拳五类；已停用的骰子模式不恢复。创建前校验金额/份数/留言/出拳，旧接口还要求份数不超过money字段，提前拒绝。专属输入为用户名，逐个公开JSON核验真实ID、拒绝本人/重复并取服务端准确用户名，避免大小写导致无法领取；旧recivers须为JSON数组字符串。POST send仅带旧key/content/client和redpacket特殊语法，支付确认说明税后金额由服务器结算；心跳/猜拳须显式接受风险，猜拳出拳不默认选择。创建无可靠ID和结构化费用，成功只重读当前时间线，不拼卡片或假装知道原扣款/税额。

旧red-packet/open会直接领取，绝不用于详情。只读GET getMessage精确单条后验证红包类型、发送者ID、数量、领取数组长度/唯一用户/时间及金额；卡片只投影type/money/count/got/msg/senderId，不携带接收人名单/出拳/领取者传输对象。详情仅给发送者显示专属名单，未结束猜拳仅发送者可见自己的出拳；本人领取按稳定ID识别，负积分与真实0均保留，不推原税额、猜拳退款或费用。公开称“红包显示金额”，不把普通每份金额冒充总奖池。

领取与查看分离，先确认普通或心跳/猜拳风险，猜拳必须另选手势，再以当前GET重新核验类型、是否已领、剩余份数、专属资格和猜拳本人限制，才POST open。POST只带旧key/目标ID/必要手势，没有本机伪造作者或风险结算字段。旧返回who/info不直接覆盖当前详情，也不保证确已领取；成功后GET当前领取记录，界面明确请求完成与当前到账状态不同。redPacketStatus仅按ID失效并GET，不用事件got/count覆盖当前卡片；相同变化使当前详情重读，在途旧响应不能恢复取消/换号后的内容。

创建/领取共用legacyChatActions串行锁，未知原输入/红包ID/类型/风险和手势跨SPA保留，禁用HTTP风控后的自动重发，不提供危险的旧同键恢复。预检失败没有写请求，独立报错；写已确认后读取失败不重付。读取可单独重试，未知写仅核对当前记录和积分后解除本机锁定。SSR和非v1分支不请求本人旧资源，身份/旧key变化清理读取、确认和迟到结果。

验证：`legacy-chat-packets-test.mjs`八组实际API/Pinia/编译Vue和模式包装覆盖五类型创建字段、接收人规范化/核验、精确只读GET不领取、公开摘要与隐私、负积分/已领取、独立POST和风险/手势、未知原操作锁、成功后读失败、取消/换号迟到、确认UI与恢复区无重放、SSR/模式边界。原v3红包23组及全部聊天室/旧主链/首页/私信/代理回归、类型及完整构建通过。浏览器仅用本机HTTP/现代节点夹具合成账号，验证创建金额确认、当前GET卡片、详情0/2不自动领、单独确认领取后当前GET显示1/2和本人15；恶意事件计数999未覆盖实际当前值。未在现网创建、领取或扣积分。夹具已停止、127.0.0.1:5173恢复现网v1开发服务。真实税务/扣款/并发领取/节点风控仍需真实账号联调，不能由本机夹具证明生产事务正确；全站剩余模块继续适配。

协议来源：[ChatroomProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ChatroomProcessor.java)。旧getMessage读取与open有副作用的区别按源码核对，不抓页面、不恢复Cookie桥接。

## 第十五批：思过崖快照与涂鸦入口

MutesModule按模式选择LegacyMutesModule或原V3MutesModule；v3仍用有效禁言、稳定用户ID和服务端分页，不回退si:guo。v1只读公开JSON GET /chat-room/si-guo-list，不附加Bearer或旧key。投影用户名、昵称、头像、到期时间，保留签名URL；拒坏时间、重复用户名和超过1000条预算，按读取时刻过滤过期记录并排序，不造用户ID或实际权限状态。

界面明确标注旧名单快照及读取时间，20条本机分页，翻页重读完整快照，非服务端分页。错误、未知人数、合法空结果分别显示；只称本次快照为空。旧服务器内部异常也可能返回成功空数组，客户端无法据此区分遗漏，不能宣称它是当前完整禁言名单。共享store按消费者计数、焦点刷新、最后卸载清理；身份变化拒迟到响应，SSR及非v1不发旧请求。头像与用户名链接仍接公共资料卡。

PaintPanel上传适配器此前已支持双模式，本批补齐登录与上传证明选择。v1使用内存旧key，v3使用Bearer存在性；旧key变更取消上传并清绘制，v3正常token轮换保留绘制与上传。复用实际旧专用票据、具名PNG、无Cookie直传、签名URL及Markdown转义。只插入当前草稿，不直接发送聊天消息；失败保画布，关闭、卸载或换号拒迟到URL。

验证：legacy-chat-mutes-test五组实际API/Pinia/编译Vue及模式包装覆盖白名单、过期、无假ID、分页、消费者、错误/空、焦点与身份/SSR边界；legacy-chat-paint-test十三组实际旧票据/共享上传及Canvas组件覆盖绘制、PNG、专用票据无Cookie、失败保留、关闭/身份取消和只插草稿。原v3思过崖11组、涂鸦13组及全部聊天室、首页、私信、代理回归，类型与完整构建通过。

浏览器仅使用本机HTTP/WS夹具合成账号，验证25条快照的第二页、画布绘制后上传并插入编辑器，未点击聊天发送。临时开启的思过崖模块已恢复关闭，夹具已停并恢复现网v1开发服务。现网仅只读核对空快照；真实非空名单、图床权限及用户画作上传未验。举报、表态及全站其他模块继续适配。

协议来源：[ChatroomProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ChatroomProcessor.java)、[ChatRoomBot快照维护](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/bot/ChatRoomBot.java)。仅核对源码和公开JSON。

## 第十六批：文章、评论、用户和聊天室举报

公共ReportDialog/ReportRecovery按模式挂载独立实现，原v3组件保留在V3ReportDialog/V3ReportRecovery，继续使用服务端分类目录、编号回执及原幂等键恢复。v1没有分类GET，单独使用官方Report.java的经典协议常量，四类目标分别提供对应理由，聊天室仅49（其他）；不把旧SDK中的8当作其他，不在v3目录失败时回退本地分类。

v1 POST /report仅带旧apiKey、reportDataId、reportDataType、reportType、reportMemo，不发送Bearer、客户端作者身份或v3幂等头。备注按原文传输，界面纯文本；旧服务端会trim但没有承诺清洗HTML。成功只有code=0，不造举报编号或审核结果。明确禁止共享HTTP风控后的自动重发；断流、格式不完整或未确认业务结果保留原目标/理由/备注的本机锁，跨SPA阻止重复提交，仅允许用户核对后解除，不能用重试伪装幂等恢复。全局提示只显示目标编号，不回显备注。旧key/账号/认证上下文变化清理并拒迟到结果，SSR/非v1/游客不能执行旧写。

两种聊天室布局的举报入口都使用当前模式凭据，文章、评论和用户入口继续复用公共组件。SSR开发服务、SPA共用代理及nginx明确转发POST /report，并保留旧凭据与v3刷新Cookie隔离。

验证：legacy-reports-test六组覆盖实际API/Pinia/编译Vue、四类分类、原文/Unicode/大小约束、精确旧字段、无假回执、未知结果跨组件锁定、无重发、全局备注保密、换key迟到、账号/模式/SSR/游客及公共包装隔离；原v3举报19组、模式/代理、聊天室共享门面和v3时间线回归、类型及完整构建通过。浏览器只用本机HTTP/WS夹具合成账号，验证聊天室举报入口、其他理由、备注、提交后关闭表单及无编号成功提示；夹具已停止并恢复127.0.0.1:5173现网v1开发服务。未向现网举报，真实权限/风控和审核结果未验。表态与其他全站模块继续适配。

协议来源：[ReportProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ReportProcessor.java)、[Report模型常量](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/model/Report.java)、[ReportMgmtService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/ReportMgmtService.java)。只读核对源码，不运行第三方脚本、不恢复页面Cookie桥接。

## 第十七批：文章、评论与聊天室表态

公共V3ReactionBar按模式挂载LegacyReactionBar或原实现V3ReactionBarContent；v3目录、明确设置/删除及原键恢复保持原样。v1单独定义官方Reaction.java的28项协议常量，不把旧目录用作v3 GET失败兜底，也不重新接回原ReactionBar快照切换包装。

旧协议没有独立表态GET：文章取当前/api/article，消息用getMessage精确读取；普通评论按所属文章/页定位，段评按所属文章/段落/页/排序读取，回复缺席时使用thread/replies的anchorCommentId定位精确回复。只合并同时在途的同源读取，不保留全文快照缓存；公开投影仅目标、当前选择、表情/计数/显示用户名，缺字段、缺目标及坏计数明确报错，不补零、不公开userDetails或源正文。普通评论、楼中楼和优质回帖都传当前文章页上下文，长篇段评传当前段落页与排序；段评主列表本身的旧接口迁移仍属后续批次。

旧写使用POST /article/reaction、/comment/reaction、/chat-room/reaction，分别只传旧apiKey、articleId/commentId/oId、groupType和value；语义是一次切换，相同表情再次点击撤销，没有明确设置或幂等重放保证。禁用共享HTTP风控后的自动重发，保留每个kind+ID的未知原value跨SPA锁定；必须先成功重读、再明确核对解除，不能拿切换请求当安全重试。提交成功仅按当前HTTP状态重读，不拼回执summary。退出/账号/旧key变化清理并拒迟到；SSR/非v1不发旧写，游客仅显式读公开表态，聊天须登录。

现代节点chatReaction事件只携ID失效提示，不接收其actorReaction/summary为本人状态、不向时间线补消息，不会因表态事件恢复清屏消息。挂载的对应消息组件重读当前状态，其余ID不扇出；焦点恢复可重读，原v3订阅链保持独立。代理和nginx转发精确旧表态写与只读评论JSON POST，并保持凭据隔离。

验证：legacy-reactions-test十一组实际API/Pinia/编译组件及公共包装覆盖白名单/分类、三类目标精确格式、普通/段评/锚点读取、并发请求合并、切换/撤销、未知跨SPA锁定与重读后释放、身份迟到、实时元数据、游客/SSR/readonly、按钮DOM保留和重复处理器阻止、成功后读失败不重写；原v3表态16组、旧聊天室共享门面（补chatReaction只失效）/v3时间线、代理/模式、类型及完整构建通过。浏览器仅对本机合成HTTP/WS账号验证添加、再次点击撤销、更换表情；故意注入事件和回执计数999，仍显示当前HTTP计数1。未向现网表态；真实生产并发、权限与风控未验。测试后停夹具，恢复127.0.0.1:5173现网v1开发服务；其他全站兼容继续。

协议来源：[ReactionProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ReactionProcessor.java)、[Reaction模型](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/model/Reaction.java)、[ReactionQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/ReactionQueryService.java)、[ArticleProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ArticleProcessor.java)、[CommentProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/CommentProcessor.java)。核对公开源码，不抓取HTML或恢复Cookie桥接。

## 第十八批：长篇列表、当前段评与章节导航读取

v1长篇列表使用旧/api/articles/recent/long。共享段评读取适配器按模式选择：v3原段落目录/平铺分页不变；v1只读POST /comment/paragraph/summary和/comment/paragraph/thread/parents，使用内存旧key，游客不附凭据。严格校验64位锚点、真实当前页/页大小/总主题数/页数、文章归属、段落归属及有效状态，匿名作者仍投影为空身份；失败不伪造0条。旧接口按顶层评论分页，界面明确显示“个主题”，不把主题总数冒充包含回复的平铺评论总数。普通/最新/热门排序映射旧viewMode与sort，服务端改页返回明确重读提示。旧协议缺少按孤立段落查询的能力，orphaned显式501；完整回复展开、孤立段评定位及评论写入仍待后续批次，不能据本批称全长篇互动完成。

旧文章JSON内的longArticleColumnView以白名单进入共享阅读器和SSR，仅保留专栏基本字段、实际章节目录、当前序号及相邻章节。核对数量、顺序、唯一ID、当前与相邻关系；生成本站/article/{id}链接，不沿用任意源permalink，不序列化原专栏私有对象。独立ArticleColumnNavigation同样按模式读取当前文章JSON，旧key变化清除导航并拒迟到；原v3导航契约保留。旧目录数据缺失或不一致时仍明确报错，不从最近两章补造完整目录。

ArticleView读者边界在v1包含实际旧key，换key/账号重读并清旧阅读器；段评异步结果另外核对当前身份、文章、段落和请求代次，不让旧凭据响应填回。SSR保留来自服务端的data-long-paragraph-id和段内换行，不在运行时抓取现网HTML构造内容。

验证：legacy-long-reading-test五组实际API覆盖统计空/零/重复、分页和三种排序、游客/匿名/签名URL与字段白名单、外来文章/段落/失效/重复目标、孤立查询显式能力错误、完整章节校验/本地导航、长篇列表及共享模式选择；旧内容回归、v3评论32组、v3章节导航7组、旧表态11组和代理回归通过，类型及完整构建通过。浏览器仅用本机合成公开JSON验证SSR长篇正文和三章元数据、挂载后的导航、段落21主题统计与第二页第21条评论；无发帖/评论/资料写操作。夹具已停止，开发服务恢复现网v1。生产非空段评/目录可见性与真实账号权限尚未联调，评论写、其他全站功能继续适配。

协议来源：[ArticleProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ArticleProcessor.java)、[CommentProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/CommentProcessor.java)、[LongArticleColumnQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/LongArticleColumnQueryService.java)、[Comment模型](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/model/Comment.java)。只读核对JSON协议与源码。

## 第十九批：普通评论、回复和段评发布

CommentComposer按模式挂载独立LegacyCommentComposer/V3CommentComposer，原v3源码保留；父级完成通知和刷新选择对应store。v1使用旧POST /comment或/comment/paragraph，只有apiKey、articleId、原Markdown、匿名/可见范围、旧viewMode和回复ID；段评另带paragraphId，由服务端从当前段落或回复目标确定快照/位置，不接受客户端伪造段落元数据。匿名资格、手机号、发布费用和审核继续由服务器核验，不补本机授权或费用。

确认后只提交一次，明确禁用共享HTTP风控后自动重发。普通评论成功没有ID，显示已确认和重新读取提示；段评只接受旧返回实际commentId，两者均不把回执正文填列表。完成后重读当前文章/段评并刷新本人资料；资料或列表读取失败不能重复发布。未知原正文/目标/匿名/可见范围跨SPA锁定，保留本机原操作，无重放按钮；仅明确核对后解除，不把local-comment序号宣称或发送为幂等键。草稿清理校验所属文章、编辑/回复/段落和原内容，确认取消/离页/目标变化拒迟到批准，旧key/账号变化清私有状态。SSR/非v1不能执行旧写。

协议限制仍未解决：旧getCommentContent和removeComment直接依赖Sessions，而旧key中间件只写context用户；update虽接key，但无法安全读取原Markdown与保留原可见范围。当前v1不提供编辑/删除入口，直接调用也不发请求并明确限制；保留“本人”身份判断，不能因隐藏管理按钮而错误显示举报本人。没有恢复Cookie桥接或用已渲染HTML冒充编辑原文。此两项仍在全站兼容未完成清单，需要合法的旧key源读取/删除能力后再接入。

验证：legacy-comments-test七组实际API/Pinia/编译编辑器覆盖普通/回复/段评精确字段、原文/Unicode/长度、匿名/可见范围、段落编号与无假普通ID、取消确认、未知锁定无重发、身份迟到、能力/SSR限制、匹配草稿清理及取消后的迟到批准。v3评论32组、旧长篇读取和代理回归、类型及完整构建通过。浏览器仅对本机合成账号验证普通评论确认、真实旧POST后当前GET显示评论/清草稿，另核对登录本人评论没有编辑/删除/举报本人入口；未在现网评论/扣分。夹具已停止，开发服务恢复现网v1。真实费用/手机/匿名/审核权限与生产段评写尚未联调；编辑删除、完整回复/定位及其他全站能力继续。

协议来源：[CommentProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/CommentProcessor.java)、[段评校验中间件](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/middleware/validate/LongArticleParagraphCommentValidationMidware.java)、[LoginCheckMidware](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/middleware/LoginCheckMidware.java)。仅按公开JSON与源码适配，不改变生产服务认证。

## 第二十批：复读机投稿与点赞切换

RepeaterComposer/LikeButton/Recovery按模式挂载独立实现，原v3组件保持在V3前缀文件，明确点赞设置/删除与原键恢复不变。v1投稿POST /api/repeater，只有apiKey、repeaterContentType、repeaterContent；原文先做共享Unicode/长度校验，规范化与最终2～500单位限制由旧服务执行。投稿返回item仅投影实际oId和核验类型，绝不把回执正文插到榜单、冒充已入选前12条。

旧点赞POST /api/repeater/{id}/like是真正切换，只带旧key，不传假设的目标liked，不当作v3明确设置重试。校验返回liked及真实整数计数字段，但仅发完成元数据，随后当前GET决定界面状态。投稿及点赞未知结果保留原kind/正文/类型或目标跨SPA锁定，禁止风控后自动重发、没有旧同键重放按钮；用户核对后才能解除。换key/账号清理及拒迟到；SSR/非v1/游客不能写。共享useRepeaterFeed同时选择旧store完成通知，并按实际旧key隔离个性化读取，不再只观察始终为空的Bearer。

本批纠正第三批读取协议：旧服务分类参数名实际是repeaterContentType，不能发送v3的type；没有下一条时旧服务返回item:{}，按已确认协议投影null，仍拒坏记录，保留既有null响应兼容。旧列表仍是服务端前12条有限榜单，不称全量分页。

验证：legacy-repeater-test六组实际API/Pinia/编译组件/共享feed与公共包装覆盖精确旧字段、原文及专用key、空next对象、无假幂等/目标状态、未知冻结无重发、身份/SSR边界、点赞/撤销后真实GET、投稿草稿清理但不插回执、成功后读失败不重写及旧key迟到读取隔离。原v3复读机19组、旧发现读取回归、类型与完整构建通过。浏览器仅对本机合成账号验证点赞后HTTP计数1而非回执999，投稿后清空输入框并显示重新读取的榜单，回执正文不渲染；未在现网投复读内容或点赞。夹具已停止并恢复现网v1开发服务。生产投稿权限/规范化/并发切换仍需真实环境联调，全站剩余榜单/账号/内容互动等继续适配。

协议来源：[RepeaterProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/RepeaterProcessor.java)、[RepeaterMgmtService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/RepeaterMgmtService.java)、[RepeaterContent](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/model/RepeaterContent.java)。只读核对JSON协议，不恢复旧会话桥接。

## 第二十一批：十五类普通榜单与游戏子榜

v1统一迁至legacy/rankings，删除discovery中的重复六榜实现。连签/在线/财富/支出/优选/邀请沿真实旧字段；四个积分小游戏榜使用point；人生重开取data.times和服务端achievement；进化四子榜取data.top及data.stats六个指标；捐助取total/totalCount及totalData.totalAmount/donateMakeDays；链接通过/api/top/any?types=topLinks读取公开聚合组，拒绝跨组响应并过滤危险URL。旧list仅有限名单，在原顺序上做本机分页，total表示本次实际名单长度，不能称全站人数/全量排名。

小冰四子榜的uname先通过既有旧公开用户JSON核对真实稳定ID，不使用第三方oId或按名字造ID；分批最多四个并发，失败明确报错，不跳过未知用户后重排。公开投影仅姓名/昵称/头像及该榜必要指标，原存档、profile全文、联系方式和凭据不进SSR或客户端状态。签名头像URL保留。捐助汇总缺失、坏计数、重复用户或类型不一致保持错误，不补0；既有旧服务内部吞错返回空名单时客户端无法证明全站为空，界面仍只称当前快照。

进化旧存档的知识值可能是合法小数，v1允许安全有限范围内的实际数值，不四舍五入成整数；v3整数契约保持不变。字符串数字只接规范十进制并校验安全范围，不从空字段推0。共享useRankingBoard按模式观察实际旧key/Bearer，旧key变化清状态并拒迟到；正常v3行为保留。公开SSR、首页8条预览和完整榜单继续共用原有组件，职业榜仍独立待适配。

验证：legacy-rankings-test七组实际适配器/公共API和共享hook覆盖十五类主榜、进化/小冰四子榜、真实字段/范围分页、捐助小数和未知汇总、聚合链接与安全URL、私有存档白名单、小冰公开ID核验、空/错分离、旧key迟到与v3整数契约隔离；v3普通榜单16组、旧发现和复读机回归，类型及完整构建通过。浏览器仅对本机公开JSON夹具验证SSR进化榜、切知识子榜、第二页21～25名和小数知识显示；没有账号写入或读取真实游戏存档。夹具已停并恢复现网v1开发服务。生产非空游戏/捐助/小冰来源可用性未完整联调，职业与其余账号/关系/互动等全站兼容继续。

协议来源：[TopProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/TopProcessor.java)、[ActivityQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/ActivityQueryService.java)、[LinkQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/LinkQueryService.java)、[进化榜模板字段](https://github.com/FishPiOffical/rhythm/blob/master/src/main/resources/skins/classic/pc/top/evolve.ftl)。只读取源码核对JSON，不在运行时抓取模板。

## 第二十二批：用户文章、回帖与个人清风列表

fetchMemberContent按模式读取旧/api/user/{name}/articles、long、comments、breezemoons，使用真实页码/总数/页数，v3原栏目资源保持独立。仅当前栏目读取，三个公开资源不借用首页/全站最近列表。空结果、错误、隐私拒绝分开；旧文章/回帖接口在越界空页丢失总数时明确409并提示返回第一页，不把0伪装为该用户实际总数。接受旧合法空目录的0或1页表达，但不补计数。

文章保留独立用户名/昵称，验证署名与当前主页、匿名标记和长文类型；公开回帖同时核对稳定作者ID、commenter用户名及明确非匿名。回帖所属文章只投影ID/标题，不由缺失匿名元数据推其作者身份。旧接口没有当前正文可见性证明，公开栏目只显示commentVisible=0的服务端清洗正文；私密回帖保留目标/时间占位且不显示返回体正文，包括本人浏览也不猜授权。个人清风按公开用户JSON核验身份，保留旧接口实际raw/cleaned内容、创建/更新时间，不携带IP/UA/源用户对象。

useMemberPage的身份边界按模式观察实际旧key/Bearer，换key/账号/目标/栏目清旧状态并拒迟到；适配器在复合读取前后另核对旧key，不能借新身份续读旧列表。用户公开六字段及SSR入口仍用既有独立读取，不把旧完整用户资料作主页或编辑数据。

当前旧清风没有精确单条JSON读取，v1隐藏列表里的单条链接，已有深链接明确501，不能从最近列表推断删除。公开勋章旧接口只是当前启用快照，尚未伪装v3历史授予分页；勋章、职业、关系/收藏栏目继续独立迁移。这些限制仍属于全站兼容未完成项。

验证：legacy-member-content-test五组实际适配器/公共API/共享hook覆盖四类列表（文章与长文分支）、精确旧字段/凭据、作者及匿名验证、嵌套私有字段剔除、私密正文隐藏、清风身份/HTML、分页/隐私/空/越界、缺失单条能力零查询和旧key迟到隔离。v3用户主页14组、旧内容回归、类型及完整构建通过。浏览器仅对本机公开JSON夹具验证文章第2页3条、公开/私密回帖区分、个人清风显示与无单条入口，私密测试正文未出现；未登录或写真实账号。夹具已停并恢复现网v1开发服务。生产个人隐私组合、真实非空栏目及旧服务内部吞错情况未完整联调；私密正文的当前授权读取另需契约支持。

协议来源：[UserProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/UserProcessor.java)、[CommentQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/CommentQueryService.java)、[BreezemoonQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/BreezemoonQueryService.java)、[DesensitizeUtil](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/util/DesensitizeUtil.java)。只读核对JSON与源码，未抓取页面内容。

## 第二十三批：关系列表、关注标签与收藏读取

独立UserRelationsView和SavedContentView按模式读取旧/api/user/{name}/following/users、followers、following/tags、following/articles；原v3本人/公开资源保持不变。使用旧服务真实分页，不把当前页长度当总数；用户只投影公开身份字段，签名头像不改写。标签ID与URI独立保留，v1链接编码旧URI，描述按纯文本显示，不把数字ID冒充旧标签地址。

本人/stars按模式判断实际凭据，旧key只用于旧JSON参数；换key/账号/目标/栏目清当前状态并拒绝迟到回写，普通v3令牌轮换保留现有行为。SSR只显示准备态，不读取私人列表；HTTP隐私拒绝、响应错误、合法空结果分别保留，不从旧完整用户资料拼列表。

旧收藏服务可能省略已删除文章，但总数仍含原记录；保留真实总数，不编造缺失ID。返回已知失效状态或讨论类且无法确认当前可读性时只显示文章编号，不展示标题、摘要和作者；公开文章继续验证匿名元数据。旧协议不能提供与v3完全相同的不可读记录全集或授权证明，界面明确说明范围。

旧/api/user/{name}/watching是关注动态，并非订阅文章记录，不能替代订阅列表；当前订阅栏目明确501且不请求该动态资源。关注/收藏关系写入、订阅读取和其余账号模块仍在全站兼容未完成范围。

验证：legacy-relations-test五组覆盖实际适配器和公共入口、精确路径/旧key、真实分页、白名单/签名URL、标签URI、匿名与受限收藏、删除记录不编造、订阅零回退、隐私/空/坏响应和换key迟到。原v3关系5组/收藏7组及相关共享身份解码器共16套回归通过，类型检查和完整构建通过。浏览器仅用本机合成身份验证登录回跳/stars、受限正文隐藏、中文标签URI和粉丝第2页5条；无真实关注或收藏写入。夹具已停止，127.0.0.1:5173恢复现网v1开发代理。生产隐私组合及非空真实收藏仍需联调，不据此宣称全站已完成。

协议来源：[UserProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/UserProcessor.java)、[FollowQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/FollowQueryService.java)、[Tag模型](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/model/Tag.java)。只读核对JSON协议与源码，不抓取页面或恢复Cookie桥接。

## 第二十四批：用户关注与取消关注

共享UserFollowButton按模式挂载LegacyUserFollowButton或原样保留的V3UserFollowButton，用户主页和悬浮卡共用入口。v1从/user/{name}?apiKey读取实际canFollow（yes为未关注、no为已关注、hide为当前不可操作），核对返回稳定用户ID与已知目标；不从列表缺席推断未关注，不把完整公开用户响应存入操作状态。用户名变更导致ID不一致时明确拒绝，不能跟随旧名字误操作另一用户。

写入使用POST /follow/user或/unfollow/user，只有专用旧apiKey和followingId。成功响应没有当前状态或幂等回执，随后重新GET；共享完成通知废弃其他组件的在途旧读，不能被迟到状态覆盖。按钮DOM保持稳定，处理函数阻止繁忙/未确认时重复操作。SSR、游客和本人不读取/显示操作。

独立legacyUserFollow保存未确认原目标/意图跨SPA锁定，不自动重发、无假幂等键，不借用v3重试同键机制。任何失败保留锁定，必须成功重读当前状态后由用户明确核对解除；重新打开组件可以核对但不能自动解锁。换key/账号清命令及拒迟到读写。成功后的GET失败只重试读取，不重复提交。

本批同步补齐SSR/生产Node精确两条写路径的模式代理，nginx精确location进入Node，SPA原代理保留。原v3明确PUT/DELETE及原键恢复实现逐字保留，不改其API或生命周期。

已核对的限制：旧FollowProcessor用户关注两方法显式支持getUserByKey；标签、文章收藏、文章订阅六方法仍只使用Sessions.getUser，LoginCheck的apiKey上下文不能替代页面Session。因此这些写入仍待合法接口契约支持，没有恢复退役Cookie桥接，不能宣称全部关系功能完成。

验证：legacy-user-follow-test五组实际API/Pinia/编译Vue覆盖canFollow/ID核验、精确旧字段、无假回执/自动重放、未知跨组件锁定与重读后解除、后置GET失败只重读、身份/SSR/本人隔离、另一组件完成废弃在途GET及模式包装。原v3关注8组、用户卡片12组、双模式代理回归和完整类型/客户端/服务端构建通过。浏览器仅使用本机合成账号验证登录回跳用户主页、关注和取消后的当前GET状态及焦点保留；没有关注真实用户。夹具已停并恢复127.0.0.1:5173现网v1开发代理。生产关注通知、并发、权限和风控仍需真实环境联调。

协议来源：[FollowProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/FollowProcessor.java)、[UserProcessor.getUserInfo](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/UserProcessor.java)。只读核对公开源码，不改变Rhythm服务认证。

## 第二十五批：本人积分流水与当前余额

/points共用原界面，fetchV3PointPage/Balance按模式选择独立legacy/points。每次旧读取先通过/api/user?apiKey核验当前本人及稳定ID，再按返回用户名读取/api/user/{name}/points；不接受页面指定他人用户名，不借公开用户资料或通知正文拼账本。旧服务实际分页大小为20～50，拒绝会被服务端静默钳制的更小size，界面仍每页20条。真实总数/页数、sum、operation、交易后balance、time、type和displayType分别严格投影，坏数字/时间/分页明确报错，不补零。

当前余额独立取新的/api/user响应userPoint，不能用账户store旧快照、最新一条流水余额或旧历史回执替代；余额/列表失败独立提示与重试。旧description包含模板HTML及历史备注，原文仅放descriptionText通过Vue插值展示，不执行为HTML，不将其冒充v3服务端已清洗说明；旧模板标记可能以文字显示，这是当前旧格式展示限制。v3仍按既有descriptionHtml契约渲染，没有改变其解码或余额来源。

页面按模式使用专用旧key/Bearer；旧key变化清记录/余额/页码并拒迟到写回，正常v3非空token轮换保持原页。适配器在本人核验和列表读取后各自检查key，不能借新身份续读。SSR零私有读取，挂载后实际认证才请求，没有localStorage账本缓存或Cookie桥接。

验证：legacy-points-test四组实际旧认证/适配器/公共API/编译Vue覆盖精确本人路径/分页/key、真实金额及独立当前余额、私有字段剔除、历史HTML仅文本、坏数据/游客/迟到key拒绝、第二页、独立余额错误恢复、退出与SSR零读取。原v3积分5组回归及完整类型/客户端/服务端构建通过。浏览器只用本机合成账号验证登录回跳、共21条/两页和第21条记录、当前9876与历史480分别显示；没有读取或修改真实账本、转账或消费。夹具已停止并恢复127.0.0.1:5173现网v1开发代理。真实旧账本、权限、历史类型和旧服务内部吞错情况仍需生产联调；转账、背包及其他财务写入继续适配。

协议来源：[UserProcessor.apiUserPoints](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/UserProcessor.java)、[PointtransferQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/PointtransferQueryService.java)、[Pointtransfer字段](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/model/Pointtransfer.java)。只读核对JSON与源码，不执行真实财务操作。

## 第二十六批：社区公开统计与直达路由

/statistic共用原界面，v1独立legacy/statistics读取GET /api/statistic，按Option和Common的真实字段映射九项公开指标：statisticMemberCount、statisticArticleCount、statisticCmtCount、statisticDomainCount、statisticTagCount、statisticLinkCount、onlineVisitorCnt、onlineMemberCnt、statisticMaxOnlineVisitorCount。共享decodeStatistics继续校验每项非负安全整数并剔除其余字段；缺失/错误不补0，真实0保留。没有用户名、旧key或Bearer参数，不据在线快照宣称全站去重实时人数。

原SSR请求模式隔离和白名单投影继续复用；游客挂载复用合法SSR首屏，实际登录或凭据变化重新读取。useStatistics按模式观察旧key或Bearer，身份/凭据边界及卸载拒迟到结果，出错清旧快照并提供重试。原v3 GET与解码行为保留。

浏览器验证发现并修复遗留路由冲突：Vite仍将/statistic整页代理到经典页面，导致本地直达502；删除该过时代理，生产nginx示例同步从经典页面正则移除statistic。页面交给本地SPA/SSR，只有/api/statistic经过按模式代理，不用旧HTML页面冒充本地渲染。

验证：旧/新两套统计各13组实际API、编译Vue、hook及SSR测试，覆盖精确路径、九字段/安全数值、坏信封/空错区分、真实0、刷新/失败重试、身份/凭据迟到、卸载、SSR复用和路由代理检查；类型与完整客户端/服务端构建通过。现网仅公开只读核对/api/statistic；本地SSR HTML及浏览器直接打开/statistic、刷新后九项数据显示通过，没有账号写入或登录生产站点。在线值随服务端变化，不冻结到测试数值。此批仅统计，同城旧用户API缺总人数及独立文章JSON、大事记和其余全站能力继续迁移。

协议来源：[Router](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/Router.java)、[StatisticProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/StatisticProcessor.java)、[Option常量](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/model/Option.java)。只读JSON与源码，不抓取现网HTML。

## 第二十七批：同城用户分页

fetchCityUsers按模式选择legacy/cities，读取GET /api/city/{cityName}?p=&size=20。使用既有cityInput规范化和单次编码，核对返回city、当前页、pageSize和pageCount，严格公开投影稳定ID/用户名/昵称/签名头像/简介；不保留旧完整用户、编号、在线快照或联系方式。昵称与简介纯文本，头像继续共用安全URL与默认头像。服务端UserQueryService只查询公开位置、有效账号及指定城市，客户端不从全站用户列表猜城市。

旧协议只有总页数、没有总人数，CityPage允许仅旧分支total=null，界面明确“旧接口未提供总人数”，不使用页数×20或本页长度伪造总数。v3仍执行原真实total/pageCount校验，没有放宽其解码契约。空页保留原页码和返回第一页入口；旧错误/限流与合法空列表分开。

useCityFeed按模式观察旧key/Bearer，换key/账号/城市清旧资源并拒迟到写回；v3同账号正常token轮换维持原页。SSR仍准备态，不预取用户或文章，不显示假0。旧读取不携带用户凭据，公开请求失败没有经典页HTML或全站记录过滤兜底。

已核对Router/CityProcessor：旧JSON仅cityUsersApi，同城文章仍是经典HTML页面，尚无独立JSON列表；v1文章请求明确501且零后续查询，不把清风、最近全站文章或同城用户各自文章拼成伪同城流。界面说明当前范围并隐藏无效排序控件，原v3署名文章四种排序保持原样。该缺口仍属于全站未完成项，不能称整个同城模块完成。

验证：legacy-cities-test四组实际API/共享hook/编译Vue覆盖精确旧路径、单次编码、真实页数/未知人数、白名单与签名URL、坏ID/分页/城市、错误与空、缺文章资源零回退、第二页及重试、旧key/目标迟到、SSR零请求。原v3同城13组、类型与完整客户端/服务端构建通过。现网只读核对公开用户JSON；本地浏览器验证上海列表、未知总人数提示及第2页（当时76页），未登录或写真实账号。页数和用户顺序均由服务端当前返回，不写死测试数值。文章资源、其余公共页面和账号能力继续迁移。

协议来源：[Router](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/Router.java)、[CityProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/CityProcessor.java)、[UserQueryService.getUsersByCity](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/UserQueryService.java)。只读JSON及源码，不抓取现网HTML。

## 第二十八批：大事记公开时间线与详情

listMilestones/getMilestone按模式读取独立legacy/milestones。旧GET /api/milestones返回当前已审核通过的公开快照，不提供服务端分页或单条资源；在有界完整快照上按事件日期倒序、真实ID稳定排序，每页20条。total表示本次实际快照记录数，不把本机切页宣称为服务端全量分页。详情每次重新读取当前公开快照并按真实ID取记录，不缓存上次正文；当前快照缺席仅提示未在公开时间线中，不推断已删除或审核状态。

严格映射id/title/date、可选end_date、media对象和link.url，缺省空字段只按旧缓存明确省略规则处理。日期/范围、URL协议/凭据、媒体类型、重复ID、Unicode/长度和快照上限（10000）校验，不截断后报成功；只投影公开必要字段，不带作者私有信息。旧缓存和查询服务可能吞内部异常，客户端不能用空成功证明数据库全局为空，界面只称当前公开快照。

旧content不是v3清洗后的contentHtml。适配后contentHtml为空；MilestoneBody的v1公开详情在挂载后复用既有markdownPreview→旧/markdown，失败明确错误与重试，不把原content写入v-html。正文、身份/凭据、目标变化和卸载取消或拒迟到结果；原v3公开清洗正文/本人预览行为保留。SSR重投影元数据与公开列表，不执行或直接渲染旧原文HTML。

旧提交处理器仍只用Sessions.getUser和表单参数，缺少本人投稿列表/单条JSON；v1不显示投稿编辑器/本人审核入口，API明确501且零旧写请求，不伪造待审回执。公开页说明该限制，原v3投稿表单及原键恢复保持。useMilestones按模式观察实际凭据，旧key变化清目标/列表/详情，不能因Bearer为空漏掉身份边界。

修复Vite与nginx示例中/milestones整页转发经典站的过时规则：本地SPA/SSR负责页面，/api/milestones按当前模式代理。旧投稿能力仍缺失，没有恢复Cookie桥接或自行拓展后端认证。

验证：legacy-milestones-test四组实际API/共享hook/编译页面和正文组件，覆盖旧字段、真实ID/日期、排序/两页快照、当前详情、私有字段剔除、坏日期/URL/重复/预算、合法空/详情缺席、未支持能力零查询、真实预览适配器/失败重试无原文回退、身份迟到及SSR/路由。原v3大事记18组、类型和完整客户端/服务端构建通过。现网仅公开JSON与预览只读；本地浏览器验证54条/三页、第二页和具体事件详情正文，没有投稿或改真实审核记录。真实投稿与本人状态仍需合法旧key资源，其他全站兼容继续。

协议来源：[MilestoneProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/MilestoneProcessor.java)、[MilestoneCache](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/cache/MilestoneCache.java)、[MilestoneQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/MilestoneQueryService.java)。只读JSON及源码，不抓取现网HTML。

## 第二十九批：鱼游目录、公开详情与评论读取

listFishGames/getFishGame/listGameComments按模式选择独立legacy/fish-games。旧GET /api/fish-games仅返回指定页数组，无总数/排序参数或独立详情JSON；按50条逐页读取至真实短页，最多200请求，预算超出明确503，不截断后报成功。汇集本次公开目录后按总投票/点赞和时间排序、本机每页20条；跨页重复ID明确错误。详情重新读取当前目录后取实际ID，缺席仅提示未在当前公开目录中，不宣称已删除。旧服务跨页没有快照版本，不能保证并发增删时全局一致，界面只称当前快照。

目录投影oId/name/description/url/iconURL/authorName/upCount/downCount/createTime，严格URL/字符/计数/安全求和和站点时区时间校验。旧响应缺更新时间与本人投票，分别保留null，绝不补成0或未投票；原v3解码仍严格要求真实数字和三态值。目录没有作者ID，不用名字伪造ID或回退当前账号；保留经格式核对的旧作者用户名用于现有主页链接，不声称公开摘要已提供头像/昵称或ID。

评论GET /api/fish-games/{id}/comments返回当前公开评论快照；核对所属游戏及真实评论/作者ID、正文和时间，剔除其他字段，原文仅文本展示；作者已失效的匿名占位不挂载身份。快照最多10000条，按时间倒序本机分页，不伪称服务端游标或总量接口。错误和真实空评论分开，列表、详情与评论互不吞错。

useFishGames按模式观察实际旧key/Bearer，身份/凭据/卸载使在途旧读失效；SSR仍准备态，无目录或私人请求。GamesView提示旧格式范围，v3投稿/明确投票/评论实现保留。已确认FishGameWriteSecurityMidware支持apiKey，旧写入协议与未知结果处理在后续批次接入，不因此宣称鱼游全模块完成。

验证：legacy-fish-games-test四组实际API/共享hook/编译页面覆盖多批目录汇集、两种全局排序与第二页、完整预算失败、旧真实字段/未知元数据、坏URL/ID/时间/计数/重复和跨游戏评论拒绝、空错分离、详情/作者链接/评论分页/纯文本、身份迟到及SSR零读。原v3鱼游18组、类型和完整客户端/服务端构建通过。现网公开JSON只读核对；本地浏览器验证21个鱼游第二页、具体游戏详情/作者链接及空评论，未打开游戏执行动作、投票、评论或投稿真实数据。非空生产评论与并发目录变化未全验，旧写入继续适配。

协议来源：[FishGameProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/FishGameProcessor.java)、[FishGameWriteSecurityMidware](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/middleware/FishGameWriteSecurityMidware.java)。只读JSON与源码，不抓取经典详情HTML。

## 第三十批：鱼游投稿、编辑申请、投票切换与评论

FishGameEditor/Recovery按模式挂载独立旧组件或逐字保留的V3前缀原组件，GamesView/useFishGames选择对应操作store。旧FishGameWriteSecurityMidware明确核验apiKey，处理器从已核验context用户确定作者，客户端不发送作者ID、不恢复页面Cookie桥接。POST /api/fish-games、/{id}/edit只发送旧apiKey与fishGameName/fishGameDescription/fishGameUrl/fishGameIconUrl；旧验证服务只接四项，不伪造或转发v3 OAuth授权网址。原字符串保持，旧服务去HTML/trim并重验长度、HTTPS、唯一URL和作者权限。编辑入口按当前旧目录用户名提示，真正归属由服务器稳定ID重验，不能据按钮展示宣称授权证明。

POST /{id}/vote发送value=like/dislike，旧语义为切换：同项再点撤销、另一项切换；没有明确none写，也没有本人投票GET。旧界面使用“切换点赞/切换点踩”，不把缺少的userVote当未投票或挂假选中状态。仅校验实际fishGameUserVote及fishGameLikeCount/fishGameDislikeCount回执格式，不写回当前票数或选择；完成后重读当前目录/详情。POST /{id}/comments保留原content，后端规范化至1～500字符，成功只认实际评论ID与匹配游戏ID，正文经当前GET显示，不插回执正文。

投稿成功只认实际oId及待审状态，编辑成功无新对象只认所请求目标；全局提示申请需审核，回执不代表当前公开内容。旧投稿四字段草稿/评论按原目标及内容匹配后清空；编辑确认后关闭编辑表单，待审字段不覆盖公开详情。读失败只重读，不能重复申请或评论。

legacyFishGames保留一个原kind/target/body或value的未确认命令跨SPA锁定，无假幂等键、无自动重放或恢复按钮，并禁止风控后的隐式重发。任何不确定失败先保留原操作；用户核对后明确解除锁定，投票因无本人状态JSON需另核对经典页面本人选择。换key/账号清理，SSR/非v1/游客不能写，迟到结果不能恢复旧状态。全局Recovery仅显示类型/编号/结果，不展示原评论或投稿正文。

验证：legacy-fish-game-writes-test四组实际API/Pinia/编译页面、表单和Recovery，覆盖精确四字段/原文/旧key、无OAuth/Bearer/假键、切换回执契约、真实元数据、坏输入、换key迟到、未知跨SPA锁定零重发、模式/SSR边界、两次切换/撤销后GET、评论草稿清空与回执正文不入列表、编辑待审关闭、核对解除零写。旧读取4组、原v3鱼游18组、类型与完整客户端/服务端构建通过。浏览器只用本机合成账号和HTTP夹具验证点赞后GET为1而非回执999、当前评论及清草稿、四字段投稿后清空/待审提示、编辑关闭且公开简介仍旧值；未在现网投票、评论、投稿或编辑。夹具已停止并恢复现网v1开发代理。生产限流、OAuth之外的旧URL校验、审批、通知和并发切换仍需真实环境联调；其他全站模块继续。

协议来源：[FishGameProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/FishGameProcessor.java)、[FishGameMgmtService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/FishGameMgmtService.java)、[FishGameValidationService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/FishGameValidationService.java)、[FishGameWriteSecurityMidware](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/middleware/FishGameWriteSecurityMidware.java)。只读源码核对协议，不改Rhythm认证。

## 第三十一批：VIP 昵称公开样式

fetchV3MembershipStyles按模式选择legacy/membership-styles，v1使用既有GET /api/membership/{userId}逐个指定目标读取，最多四并发并保持请求顺序；不下载全站/api/memberships/configs，也不在状态中保存会员档位、期限、费用或完整配置。只从已确认state=1且userId一致的configJson投影bold/underline/color，state=0或明确空配置按普通文字处理；配置解析/已知字段类型、Hex与八种既有动画枚举严格校验。空样式不能用于判断非会员，错误不缓存为无会籍。不按前端档位补默认颜色或权限。

旧用户名别名经当前/user/{name}公开JSON核验真实ID和姓名，继续复用缓存/队列去重、可视节点懒读及TTL到期删除/重新观察。共享useVipNickname按模式使用旧key或Bearer作为缓存边界；v1公开端点允许游客，用独立公开身份标记启动读取，退出/换key清缓存、队列及计时器，迟到响应不能回写。HMR取消两种凭据监听，SSR始终普通文本，不把装饰缓存放入服务端初始状态。v3仍原指定ID批量API、严格三字段和Bearer边界，没有失败时旧接口回退。

遵循已确认的v1昵称使用范围：VipNickname新增显式legacyStyle选项，只有聊天室ChatBubble、首页简易聊天室、用户悬浮卡和个人主页目标昵称启用；文章/评论/榜单等默认不读不染色。v3原有消费者保持原行为。共享CSS的颜色/渐变与动画定义保持不变，本批只接线数据与生命周期，未重新设计色值。

验证：legacy-membership-styles-test四组实际API、公开用户解码、helper及编译昵称组件，覆盖按ID读取/真实别名、三字段白名单、空与坏配置、Hex/动画、四并发顺序、游客加载/去重/旧key与退出清理/迟到拒绝、四处显式启用默认普通文字、SSR和HMR清理。原v3昵称8组、TTL/HMR5组、会员12组、类型和完整客户端/服务端构建通过。现网仅公开用户与单个会员配置只读；本地浏览器验证未登录个人主页应用当前neon类与加粗/下划线，截图中列表作者仍普通样式；没有登录、修改会籍或购买。聊天室/首页/悬浮卡为共享组件接线，未逐一完成真实账号交互验证；会员设置、资格与其他外观/账号能力仍继续适配。

协议来源：[MembershipProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/MembershipProcessor.java)、[MembershipQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/MembershipQueryService.java)、[Membership字段](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/model/Membership.java)。只读JSON及源码，不抓取页面或从不受信任配置注入CSS。

## 第三十二批：签到状态与昨日活跃奖励

CheckinPanel/ActivityRecovery按模式挂载独立旧组件或逐字保留的V3前缀原组件，首页、聊天室侧栏和活动中心共用入口。旧签到仅读GET /api/checkin/status?apiKey，直接投影checkedIn/liveness/threshold/streak并校验布尔、非负有限数与整数；不用九分钟限流的旧/user/liveness拼不完整状态，不自行触发已停用的每日签到接口。自动签到门槛由服务端真实返回。

昨日奖励只读GET /api/activity/is-collected-liveness只提供isCollectedYesterdayLivenessReward。旧面板独立表达“已领取/尚未领取”，明确日期、金额与实际领取资格不可预览；未领取不等于可领，不伪造RewardState的日期/金额/claimable。两读独立失败/重试，挂载且有实际旧key/账号才请求，身份/退出/目标代数拒迟到结果，SSR零本人读取。

旧GET /activity/yesterday-liveness-reward-api会发放积分，绝不能当状态查询、链接预取或普通刷新。独立legacyClaimReward仅在显式确认后调用一次，冻结当次身份，关闭/离页/换号取消迟到批准；确认说明将尝试服务端当时的昨日奖励，不能保证旧协议没有的expectedDate语义。请求no-store且禁用风控自动重试，无假幂等键或日期参数。正整数sum只作本次返回金额提示，随后重读当前状态；-1同时代表已领、无活跃、金额0或发放失败，界面只称本次未发放，不据此推已领取或伪造金额0。

legacyActivity保存未确认领取跨SPA锁定，没有自动恢复/重发按钮；需核对当前奖励状态及本人积分流水后明确解除，退出清理，迟到回执不能复活。确认后状态读取失败只重读，不再领取。v3仍保留原服务端日期、金额、明确POST及原键恢复行为。

代理补齐有副作用旧GET精确路径，开发SSR和生产nginx按当前模式选择目标。同时修复活动页发现的遗留/article/random/{size}代理绕过：该旧JSON读取也进入按模式Node代理，防止落入本机另一上游返回非JSON；只读现网验证本地该路径实际返回8篇JSON，不使用HTML兜底。

验证：legacy-activity-test四组实际API/Pinia/hook/编译面板与全局Recovery，覆盖完整签到与未知奖励元数据、只读刷新零领取、明确确认/取消、精确旧key/GET/no-store/禁自动重发、正数/-1/坏响应、未知跨SPA锁定、退出/模式/SSR/迟到隔离、独立错误重试及离页取消确认。原v3活动14组、双模式代理回归、类型和完整客户端/服务端构建通过。浏览器仅本机合成账号验证65.5%/80%/3天、未领取提示、刷新、明确确认、领取返回50后当前GET变已领取；未登录生产站点、领取真实奖励或改余额。旁路发现模块在活动夹具中未完整提供，随机JSON路由另经现网只读验证。夹具已停止并恢复现网v1开发代理。生产服务器跨日、账本/多节点竞态及自动签到达标过程仍需真实环境联调，其他全站能力继续。

协议来源：[ActivityProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ActivityProcessor.java)、[ActivityMgmtService.yesterdayLivenessRewardApi](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/ActivityMgmtService.java)。按公开源码适配，不调用金手指接口、不改变生产认证。


## 第三十三批：用户公开职业资料

用户主页职业栏目按模式读取GET /api/user/{name}/profession?position=homeProfile或原v3公开资源；旧接口支持游客，登录时只带当前内存apiKey用于服务端可见性判断，不读取本人私有/me补全隐藏模块。旧key/目标变化清空页面并拒绝迟到结果，API本身也核验读取前后key；SSR仍准备态零本人读取。

旧DTO没有ACTIVE/RETIRED/SELECTED字段，服务端可能为仅选择的主职业返回零级快照，因此客户端明确LEGACY_SNAPSHOT，不从零经验、等级或主职业推实际进度/启用状态。只投影实际等级与可选经验，不补缺失0；旧接口隐藏经验时仍可保留门槛，不能套v3必须成对规则。旧并列榜的百分比与rank算式不同，校验真实数值范围后按原值显示，v3原公式与SELECTED严格契约不变。额外presentation、内部版本、源说明等不进组件状态，所有描述纯文本。

主职业、职业快照、贡献/统计、动态、等级变化、奖励概要和名次仍按字段存在性独立展示，空列表与权限404/失败分开；无假身份、无目录/等级本地兜底。本人职业选择/隐私/进度明细和职业榜仍待独立接入，不能宣称职业全模块完成。

验证：legacy-public-professions-test三组覆盖实际API和编译Vue、精确端点/key/no-store、额外字段剔除、经验隐藏/真实零、并列百分比、错误/重复拒绝、旧key/退出/目标迟到隔离与SSR零读；原v3公开职业七组及完整类型/客户端/服务端构建通过。浏览器对现网公开JSON只读验证本地主页职业栏目与重读，未登录或改职业/隐私。登录读者隐私组合由本地测试覆盖，尚未用真实多账号联调。

协议来源：[ProfessionProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ProfessionProcessor.java)、[PublicProfessionProfileQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/PublicProfessionProfileQueryService.java)。


## 第三十四批：公开勋章当前快照

/member/:name/medals按模式挂载LegacyPublicMedals或保留的V3MedalsView，共用原卡片样式；v3公开授予分页与私有图片读取不变。旧读取GET /user/{name}/medal，游客可读，不发送apiKey/Bearer、不调用/gen或会话桥接。旧端点没有授予ID、授予时间、分页元数据，仅当前启用且有效的展示列表；保留顺序和重复条目，可选id仅命名definitionId，不冒充历史记录ID。当前快照大于20条时本机分页，超过1000条明确失败，不截断报成功。

旧expireDate为日期字符串，服务端还用2099-12-31表达永久期限；客户端仅按原文称“显示有效期”，不推断expiresAt=0或永久有效。name/description/type纯文本，额外data/order/attr原串不留入状态；attr只提取经HTTP(S)/无凭据校验的公开图片URL，保留原签名query，不注入CSS或HTML。图片跨域匿名、无referrer，失败有明确文字；没有图片URL时只显示勋章文字。

页面挂载后读取，旧key、身份上下文、账号、目标和卸载均隔离迟到响应；SSR零读取/图片。刷新失败清旧快照，真实空列表与网络失败独立。旧CloudService会把内部异常转成空list，客户端不能据此确认后端内部正常，保留这一服务端限制，不另造记录补全。

补齐开发SSR、SPA共用Node代理及生产nginx的/user/{name}/medal精确读取路径，防止绕过模式选择后发到错误上游返回非JSON；代理回归验证凭据隔离。

验证：legacy-public-medals-test三组实际API/编译组件覆盖公开精确读取、重复/无ID条目、原签名URL、坏URL/日期/超预算拒绝、快照分页、图片失败、纯文本、重试、身份/目标迟到隔离与SSR零读；原v3公开勋章十组、勋章图片回归、模式代理和完整类型/客户端/服务端构建通过。浏览器现网只读验证本地Yui当前公开勋章、真实图片完成加载和刷新，未登录或修改展示/授予；非空多页由本机夹具验证。本人勋章管理、职业榜与其他全站能力仍待继续适配。

协议来源：[UserProcessor.getUserMedal](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/UserProcessor.java)、[CloudService.getEnabledMedal](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/CloudService.java)。


## 第三十五批：职业排行旧可见快照

/top/profession共用模式包装，v3原ProfessionRanking拆为V3ProfessionRanking，仍有真实目录/榜单分页、可见人数与成长提示；旧LegacyProfessionRanking读取GET /api/profession/ranking?apiKey=...，仅当前内存旧key和可选professionId，不发送Bearer、不抓页面、不借旧Cookie认证。服务端返回professions/selectedProfession/entries，核对完整有界目录、显式选中项与请求目标一致；没有默认伪造首项，也不用v3公开目录填旧数据。

旧服务先取经验前20名，再过滤读者不可见用户，所以rank可能跳号且条目数不代表可见总人数。界面保留原始名次并说明前20范围，只显示本次条目数，无假分页、总人口或按索引重排。经验缺失保留“未公开”，真实0显示0；用户名用于主页寻址、昵称仅展示，头像保留合法URL签名，缺头像复用默认图；原始presentation/iconUrl/颜色/内部身份等不投影。

读取失败清榜单并可按原目标重试，目录按钮在切换请求期间保留DOM和焦点。旧key、账号、上下文、目标及请求序号隔离旧响应，退出/卸载清资料，SSR/游客零私有读。原旧榜JSON不提供成长来源/奖励规则，不能以本人私有详情推公开成长提示，不造空来源或假奖励；v3成长提示完整保留，本人职业明细/管理仍后续接入。

验证：legacy-profession-ranking-test三组实际API及编译UI覆盖精确旧key/端点、服务端选中与目录绑定、跳号/隐藏经验/真实0、坏字段/越界/重复拒绝、失败原目标重试、选项按钮保留、职业/身份迟到隔离、SSR零读与模式分支；原v3职业榜10组、类型与完整客户端/服务端构建通过。浏览器仅本机合成账号验证登录回跳、职业切换、真实第3/20名、“未公开”与0经验及选中焦点，未登录现网；其他导航模块在本机夹具未提供，未计入验收。夹具已停止并恢复真实v1开发代理。真实多账号隐私、生产排行榜当前内容仍待环境联调。

协议来源：[ProfessionProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ProfessionProcessor.java)、[ProfessionRankingQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/ProfessionRankingQueryService.java)、[LoginCheckMidware](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/middleware/LoginCheckMidware.java)。


## 第三十六批：本人职业状态、隐私与游标明细

/settings/profession按模式挂载LegacyOwnerProfessions或保留的V3OwnerProfessions，复用样式。旧GET /api/profession/me使用内存apiKey，核对真实userId与当前账号ID，白名单投影主职业ID/目录状态、选择状态、十模块隐私、完整有界目录、等级快照及已发布成长/奖励概要；不保留内部ID、版本、时间或原配置。moduleVisibilityJson必须真实且十项完整，读错不得补默认公开。目录状态ACTIVE只解释为主职业目录已发布，不伪称已积累经验；旧服务可能重复附带仅选择的零快照，保留原条目而不假造实际进度/授予。

成长提示来自/me内明确publishedTriggers/publishedRewards字典，保留重复来源与奖励，不造本地成长规则；无该职业条目时仅在完整字典已核验后显示无已发布概要。未知合法触发类型纯文本显示编号，不误译为已知动作；奖励只投影真实正积分或勋章类型，配置与私人状态不混用。

详情GET /api/profession/me/{id}/detail独立投影等级路线及贡献汇总，核对professionId，不从零经验推获得状态。流水GET /api/profession/me/{id}/records?limit=20按服务端nextCursor同时发送beforeOccurredAt/beforeEffectId，支持返回已读上一批；不伪造总量/页码或用时间一项翻页。记录按实际时间降序、保留负经验及来源纯文本；next仅完整20条且与末项时间一致，重复游标明确错误。失败按原批次重试，详情/流水错误独立，不清另一成功资源。

主职业选择、跳过和隐私写入被旧ProfessionProcessor显式挂载CSRFMidware，该中间件同时校验经典Referer和页面Session CSRF Token，没有apiKey豁免。因此本批旧界面只读并明确限制，无伪保存/无假幂等键/无自动重发；不恢复page-auth Cookie桥接、不伪造CSRF。v3原选择、隐私写入和原键恢复完整保留。实现旧写入仍需受信任的旧JSON写协议或后端支持，不能把只读接入算整个职业设置完成。

挂载且已认证后读，旧key、账号、上下文、目标与请求序号隔离迟到数据，退出/卸载清私有内容，SSR零私有读。验证：legacy-owner-professions-test三组实际API/编译UI覆盖稳定ID绑定、隐私与概要完整白名单、零/负经验和快照重复、实际复合游标/坏数据/重复拒绝、独立失败重试与上一批、目标/退出隔离、SSR零读与全程零POST；原v3职业设置和职业榜回归、完整类型/客户端/服务端构建通过。浏览器仅本机合成账号验证登录回跳、只读隐私、成长提示、等级/贡献与第二批末尾流水。旁路通知/私信未提供于夹具，不计入本次验收；夹具已停止并恢复现网v1开发服务。未登录生产账号、修改职业/隐私或写入真实数据，生产本人记录与CSRF仍未做真实联调。

协议来源：[ProfessionPrivacyMgmtService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/ProfessionPrivacyMgmtService.java)、[ProfessionGrowthGuideQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/ProfessionGrowthGuideQueryService.java)、[ProfessionProfileDetailQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/ProfessionProfileDetailQueryService.java)、[ProfessionProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ProfessionProcessor.java)、[CSRFMidware](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/middleware/CSRFMidware.java)。


## 第三十七批：本人背包与四种道具使用

账号设置OwnerInventory按模式挂载LegacyOwnerInventory/V3OwnerInventory，共用原样式，v3原消费/改名及原键恢复保留。旧GET /api/user/bag?apiKey只读取当前背包，将真实对象内有界代码与非负32位整数投影为条目；未知合法道具编号仅展示，不造本地数量、资格、功能或自动使用按钮。空对象只称当前快照无物品；CloudService会把内部读取异常转成空对象，客户端无法据此确认上游内部正常。

旧/api/bag/1dayCheckin、2dayCheckin、patchCheckin为有副作用GET，只有明确确认后调用，不属于加载、预取或刷新。改名卡POST /api/bag/nameCard发送apiKey与规范化userName，用户名按实际注册规则校验；三个GET与POST都no-store并禁止风控自动重发。旧接口没有幂等键，空renderer、坏正文、业务错误/断流不能伪装确认或自动重用，未确认原操作在Pinia跨SPA锁定；全局只显示操作类型与核对入口，需用户核对当前背包/用户名后明确解除，无假“重试恢复”按钮。换key、账号、上下文或退出清理，迟到写/读不能恢复旧状态，SSR零私人请求。

确认弹窗绑定身份与原输入，离页/身份变化AbortSignal取消迟到批准；当前显示有卡也不代表最终资格，仍由服务端校验补签及改名可用性。确认成功仅记录本次kind，不把历史bag回执或消息中用户名写入当前状态，也不从旧msg推免签天数/补签连续天数；随后独立GET背包及本人资料。改名后按真实用户ID/旧名失效昵称与资料缓存；缓存/后置读取失败仅提示重读，已确认消费不再执行。改名输入只在原内容仍匹配的成功情况下清空。

旧积分改名处理器使用Sessions.getUser且依赖页面协议，未发现apiKey独立写资源，本批不发起旧积分改名、不恢复Cookie桥接；与已接的改名卡分开说明，不能宣称所有积分/账号功能完成。

验证：legacy-inventory-test三组实际API/Pinia/编译UI覆盖四命令精确旧key、消耗GET/no-store/禁止自动重发、改名规范化、坏快照/renderer拒绝、原操作跨路由锁定、后置GET不采历史999回执、缓存/读取失败不重复消耗、当前账号名取GET、身份/迟到/SSR边界、确认取消与卸载中止、全局核对解锁；原v3背包六组及完整类型/客户端/服务端构建通过。浏览器仅本机合成账号使用免签卡和改名卡，验证真实GET剩余4天/当前名称，并模拟补签已消耗后503、离页返回仍锁定且当前卡已消失。两日卡请求协议由专项测试覆盖；真实补签业务条件、名称占用及多节点扣卡/退款未联调。账号页其他勋章/安全/扫码和旁路通知未由本机夹具提供，不计入本次验收；夹具已停止并恢复现网v1代理，未登录或消耗真实道具。

协议来源：[SettingsProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/SettingsProcessor.java)、[CloudService.getBag/putBag](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/CloudService.java)、[LoginCheckMidware](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/middleware/LoginCheckMidware.java)。


## 第三十八批：旧积分转账

设置与个人主页共用PointTransfer模式包装，v3原表单/详细回执及原键恢复保留；旧LegacyPointTransfer仅POST /point/transfer，精确发送apiKey/userName/amount/memo。已核对LoginCheck及PointTransferValidation均支持apiKey，服务器按用户名解析收款用户及校验状态/余额/备注，不由客户端指定收款ID或手续费。请求no-store并禁用风控自动重发，无假Idempotency-Key，不向旧端点发送Bearer。

旧处理器成功只返回code=0，不含主款流水编号、到账或手续费。客户端只记本次已确认请求与冻结的请求用户名/总积分，不投影额外回执字段、不把用户输入称实际到账、不从会员代码推客户端免税资格。费率、当时会员及实际扣款由旧服务处理；主款与手续费分步执行，失败可能已有部分结果，任何未知/业务错误均保留原操作锁定，不能自动重转或用4xx释放。全局提示只显示状态/核对流水链接，不显示原收款人或备注；跨SPA保留，明确核对后才解除，刷新/退出会丢失本机锁定。

确认前独立GET /api/user?apiKey读取余额，核对本人稳定ID与安全整数；失败显示未知、负余额按实际值显示，余额不足不进入确认。当前GET成功后才更新共享本人余额，历史回执绝不回填；成功后只重读当前余额，读取失败仍保持转账已确认，不重新执行。确认绑定原输入/身份，离页、换号或个人页目标变化取消迟到批准；SSR零私人请求。用户名用于寻址、原备注经旧服务清洗，不在界面注入HTML。

代理新增POST /point/transfer精确入口，SSR/SPA共用按模式Node代理和生产nginx一致，防止落入固定旧Vite代理或SPA非JSON响应。邀请码查询/购买另有经典CSRF或Sessions限制，本批未恢复页面Cookie桥接，未计入已适配。

验证：legacy-point-transfer-test三组实际API/Pinia/编译表单覆盖精确旧body/禁重发、仅成功确认投影、真实本人正负余额与输入/错身份拒绝、未知跨SPA锁定零重放、后置读失败不重转、余额不足、确认取消及目标/离页批准失效、SSR与全局提示白名单。原v3财务七组、双模式代理和完整类型/客户端/服务端构建通过。浏览器仅本机合成账号验证登录回跳含收款query、明确确认、余额100→95及忽略假明细999；模拟第二笔扣款后503，表单锁定且手动只读刷新显示89，无再次转账。生产双账号、并发余额、真实会员费率、分步扣费及通知未联调；旁路通知/私信未提供于夹具，不计入本次验收。夹具已停止并恢复现网v1开发代理，未登录真实账号或转移现网积分。

协议来源：[SettingsProcessor.pointTransfer](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/SettingsProcessor.java)、[PointTransferValidationMidware](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/middleware/validate/PointTransferValidationMidware.java)、[LoginCheckMidware](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/middleware/LoginCheckMidware.java)。


## 第三十九批：本人勋章读取、展示与相邻排序

账号页OwnerMedals按模式挂载LegacyOwnerMedals/V3OwnerMedals，共用原样式；v3授予ID分页、图片与原键恢复保留。旧POST /api/medal/my/list使用内存apiKey，核对每条user_id为当前稳定账号ID，投影user_medal_oId为recordId、medal_id为definitionId及名称/类型/描述、display、display_order、expire_time与合法公开图标URL；data及原内部字段不进入状态。有效列表包含隐藏勋章，当前完整有界快照本机每20条分页，超过1000条明确失败；按实际display_order稳定排序，负序号不重编造，非正有效期按旧服务永久语义显示。

旧服务对重复定义授予可能重复回填第一条user_medal_oId，客户端保留重复而不去重或造新授予ID。旧写入实际只接medalId定义ID，无法指定授予记录；重复定义或重复recordId条目保留展示并禁用歧义写，store同样校验当前唯一绑定。非重复项POST /api/medal/my/display发送明确display布尔、/reorder发送up/down，无用户ID或假幂等键。只接受code=0作请求确认，不从额外返回字段推当前状态或顺序；成功后仅重读本人列表，不能因读错重复移动。

旧移动基于全部持有记录的相邻顺序，当前有效列表并非排序全集，因此不根据可见首尾阻止服务端移动。读接口会清理过期记录且内部异常可能返回空列表，这两项旧服务行为在客户端无法区分；空快照仅按当前返回展示，不据此宣称服务端无异常。所有原描述纯文本，图标只解析既有公开HTTP(S) URL，复用公开勋章图片解析并保留签名query，无/gen/会话桥接/CSS注入。

异步写入保留按钮DOM/焦点，aria-disabled配合处理函数及store双重阻止重复；重读时保留旧快照但明确不可操作，读失败清列表。未知相对移动在Pinia跨SPA保留锁定，无自动重放，需核对当前展示与顺序后明确解除；全局提示不公开私人正文。旧key/账号/身份上下文/请求代际清理，迟到读取与写入不能复活，SSR零私有请求。

验证：legacy-owner-medals-test三组实际API/Pinia/编译UI覆盖记录/定义ID、重复快照、隐藏/永久/原序号与白名单、精确旧写入/禁自动重试、歧义目标store保护、成功后当前GET而非回执、未知移动跨SPA锁定、读错不重复写、按钮节点保留且重复点击零请求、快照分页及身份/SSR隔离。原v3本人勋章、图片、旧公开勋章回归和完整类型/客户端/服务端构建通过。浏览器仅本机合成账号验证隐藏→展示、活动章上移、第三次移动后503与只读刷新后的实际顺序，仍锁定写按钮；重复授予条目保留无操作按钮。测试服务曾随执行环境终止，确认进程/句柄缺失后重启本机夹具完成最后验收。生产多账号/过期清理/重复授予具体数据未联调，账号页安全/扫码及旁路通知不在本机夹具范围。夹具已停止并恢复真实v1开发代理，未登录生产账号或修改现网勋章。

协议来源：[MedalProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/MedalProcessor.java)、[MedalApiAuth](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/MedalApiAuth.java)、[MedalService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/MedalService.java)。


## 第四十批：会员档位、本人状态、开通与昵称展示配置

/vips的OwnerMembership按模式挂载LegacyOwnerMembership/V3OwnerMembership，共用原样式，v3完整目录、资格、优惠券拒绝规则、字段保存和原键恢复保持。旧GET /api/membership/levels投影完整有界目录的真实oId/lvCode/lvName/price/durationType/durationValue/benefits，最多512档位且ID唯一；旧权益JSON中的布尔、数字autoCheckin、checkinCard及color字符串分别保留实际类型，不把red或0套v3契约改成默认值。未支持键只标记存在并阻止完整配置编辑，不把原始未知内容留入组件。

本人状态按当前稳定ID读取GET /api/membership/{id}，state=0明确无当前有效会员，无假档位/期限；state=1核对userId及真实code/期限/configJson。空配置仍为空，不从目录模板补公开/权益默认值。目录与状态分开错误/重试，正常缺字段明确失败而非空列表。SSR始终未认证占位零私有读；浏览器挂载后按旧key/账号/身份上下文及代际隔离请求，退出/换号清理。

旧POST /api/membership/open精确发送apiKey/oId/couponCode/configJson空串，沿旧默认初始化流程，不把v3配置或用户自造权益混入开通。会员资格、周期结算、礼包及实际费用交服务端，成功code只确认请求，不用membership/activation历史结果推当前状态/扣费；之后重读当前状态和本人余额。旧无效券可能按原价1.2倍处罚，耗尽券可能原价，明显区别于v3拒绝无效券；旧界面和冻结档位/券的确认均明确该风险，不虚报优惠后费用或保证礼包与账本同事务。

旧PUT /api/membership/config要求模板所有字段完整且类型匹配，客户端只有当前配置完整且与已核验唯一一致目录模板匹配时才能编辑。仅bold/underline/color为编辑项，保存冻结完整当前白名单配置并原样保留其他权益；缺失、未知配置或模板歧义时禁止编辑，不以模板值补齐。非VIP4六位Hex，VIP4可选既有八种动画；旧red模板仅作原值说明不注入CSS。当前昵称缓存按稳定ID/用户名失效，成功后仅当前GET更新，不将草稿或历史回执覆盖当前状态。

开通和配置均禁自动风控重发/no-store，无假幂等键。未知结果Pinia跨SPA锁定会员写入，全局提示不展示券码/私人配置，需核对会员/背包/积分流水后明确解除，刷新/退出会失去本机锁定；确认绑定身份和冻结输入，离页/身份变化取消迟到批准。开通后读错或缓存/余额刷新失败不重复购买，错误按已确认后的独立读取展示。

验证：legacy-membership-test三组实际API/Pinia/Vue逻辑与完整模板SSR覆盖真实旧类型、空配置不补值、未知字段隔离、ID绑定/有界目录/重复与坏JSON拒绝、精确旧POST/PUT、完整配置保留非编辑权益、未知跨SPA锁定、只认确认不采历史price/config、后置读错不重买、无效券风险确认、离页取消、身份/SSR隔离。原v3会员12组及完整类型/客户端/服务端构建通过。现网仅公开levels只读核对；浏览器仅本机合成账号开通、读取当前VIP4、颜色neon保存保留autoCheckin=0/jointVip、第三次配置已生效后503，再读ocean且写入仍锁定。没有开通/保存真实会员或消耗真实券/积分，生产优惠券结算、期限、礼包发放与并发开通未联调；旁路通知/私信不在本机夹具范围。夹具已停止并恢复真实v1开发代理。其他全站模块继续适配，不能将本批称全站完成。

协议来源：[MembershipProcessor](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/MembershipProcessor.java)、[MembershipQueryService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/MembershipQueryService.java)、[MembershipMgmtService](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/service/MembershipMgmtService.java)。


## 第四十一批：本人资料与头像设置读取

OwnerProfileSettings按模式挂载LegacyOwnerProfileSettings/V3OwnerProfileSettings，原v3资料/QQ/标签/MBTI编辑及头像上传、原键恢复不改。旧/api/user?apiKey为本人认证读取，单独白名单投影username/nickname/intro/website/avatar，核对oId稳定账号与用户名格式，不从当前shell摘要或公开卡片补编辑字段。缺少必要字段明确报错，真实空串仅显示未设置；QQ、tags和MBTI不在旧本人响应中，明确缺少编辑数据，不从旧公开用户详情或其他账号恢复。

资料与头像实际/api/settings/profiles和/avatar虽经过支持apiKey的LoginCheck，但处理器内部仍直接Sessions.getUser，个人标签验证也依赖Sessions；不能把路由有apiKey认证当作最终写入已兼容。因此旧模式只读并明确限制，不展示提交不了的v3输入，不上传孤立图片，不恢复Cookie桥接/伪造页面Session。旧资料编辑仍未完成，需要受信任的独立JSON本人读写协议；本批不是所有设置适配完成。

用户名/昵称/简介/网址纯文本呈现，简介保留换行，网址不创建未经验证的超链接。头像复用共享displayAvatar校验，保留原签名URL，坏scheme/嵌入凭据报错，图片加载失败明确提示。读取错误/重试与真实未设置分开。挂载后读取，目标模式、旧key、账号、上下文和请求序号隔离迟到响应，退出/卸载清私人字段；SSR零本人读取，不预填客户端私有内容。

验证：legacy-owner-profile-test两组实际API/编译UI覆盖精确旧key/GET、必要字段白名单与稳定ID、敏感QQ/手机号等不泄漏、不从公开卡片补值、坏头像/输入拒绝、空串、签名参数、纯文本/换行/无危险网址链接、图片失败、读取错误重试、身份/退出/SSR隔离及全程零写；原v3资料回归和完整类型/客户端/服务端构建通过。浏览器仅本机合成账号验证登录回跳资料、多行简介、切到头像并确认图片完成加载，未保存真实资料或上传文件。旁路通知/私信未由夹具提供，不计入本次验收；夹具已停止并恢复真实v1开发代理。

协议来源：[ApiProcessor.getUser](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/ApiProcessor.java)、[SettingsProcessor.updateProfiles/updateAvatar](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/SettingsProcessor.java)、[UpdateProfilesValidationMidware](https://github.com/FishPiOffical/rhythm/blob/master/src/main/java/org/b3log/symphony/processor/middleware/validate/UpdateProfilesValidationMidware.java)。
