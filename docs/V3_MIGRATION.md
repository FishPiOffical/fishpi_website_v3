# v3 客户端迁移（2026-10-25）

## 当前实际状态

历史聊天室通知真实验收（2026-11-03）：用户确认重编后PID39318，两类通知各8种ID、列表详情一致及越权404/游客401共18项通过。无有效ID不借用同名现存账号，有效字符串/整数ID仍返当前公开资料，可读正文和聊天室链接保持；16通知/16封装事务清理，原通知/余额/账本/回执指纹未变。本轮无新Java、前端源码或迁移；见[实际记录](api-v3-legacy-notification-actor-live.json)。

历史通知与经典只读补验（2026-11-03）：用户确认无稳定作者ID时省略actor，Rhythm移除用户名回退，真实查询两库23/25项通过，最新一Java待IDEA重编；用户站既有缺失actor处理保持，无生产源码变更。另用受限回环代理选择真实PC/mobile四模板，已完成心跳/猜拳详情均走viewOnly，390/1280无溢出，不冒充未领取确认或新结算；代理/页已关闭。见[历史通知回归](api-v3-legacy-notification-actor-regression.json)与[经典只读记录](api-v3-classic-packet-readonly-live.json)。

成功登录活动真实验收（2026-11-03）：用户确认重编后PID11335密码登录记录当前时间，失败/刷新/普通读取不更新，在线与地理字段保持；真实后台公告到达仅用v3登录的账号，当前标题转义、列表/详情、目标收回和越权共7项通过，测试公告/通知已清理。官方APP协议创建/提前换码/双端确认不记登录，消费成功记录，重复410/原生刷新/读取保持，6项通过；全部探测家族撤销。OAuth联调脚本修正媒体/Origin/标准响应解析，不改变服务规则。没有重复优选100分，无新增Java或迁移；详见[真实记录](api-v3-login-activity-live.json)。

成功登录活动记录修复（2026-11-03）：用户确认密码登录/官方APP扫码消费成功时记录最近登录时间。Rhythm把该列写入各自令牌签发根，失败回滚；刷新、读取、OAuth授权不更新，不改在线标志/IP/地理资料，缓存提交后失效。相关令牌/扫码与临时MySQL回归通过，293契约和鉴权接线一致；两Java待IDEA重编确认后真实验收公告接收与APP消费。本批用户站无生产源码修改。详见[回归记录](api-v3-login-activity-regression.json)。

后台新增修复真实复测（2026-11-03）：用户重编后PID89663正常后台新增/删除成功，优选产生type22通知和一次100积分奖励，主账及双索引一致；专用文章/通知已清理，真实账本保留。系统公告实际发布但近期用户筛选为空：v3-only账号userLatestLoginTime仍0，旧UserChannel才更新该字段。该集成缺口的成功登录时间规则已提交用户确认，未通过SQL造近期资格掩盖问题，也不重复优选奖励。阅读自然结算观察保持。

通知真实业务事件补验准备（2026-11-03）：用户授权独立开发库管理员触发优选/系统公告。正常后台新增复现缺失isGoodArticle导致失败，尚未生成文章、通知或奖励；Rhythm仅补未标记好帖的空默认值，66组既有文章专项通过，39个必填列构造覆盖无缺项。最新ArticleMgmtService须IDEA重编后才能重跑真实流程；客户端无生产源码变更。见[回归记录](api-v3-admin-article-default-regression.json)。

通知真实组合链（2026-11-03）：正常登录真实用户站并回到通知，@我分类显示当前操作人，点击进入当前用户名/昵称的资料页；删除临时作者后投票目标仍可读且没有作者链接，新关注者变为不可用占位。1280/390px无溢出，控制台无warn/error；临时作者/两通知已事务清理，原通知/余额/账本/回执指纹不变，退出清私有区。受控SQL通知行仅验证读取和导航，不代表真实事件发布；详见[浏览器记录](api-v3-notification-actor-browser-live.json)。

通知操作人显示修复（2026-11-03）：类型17、23–28、38、39缺少actor时，不再将目标文章/评论作者冒充操作人；正常评论作者回退及可读目标内容保留。实际适配器先失败后修复，11组通知/页面专项和类型/client/SSR构建通过；实际Vue组件隔离浏览器验证当前主页路由、移除actor后无身份链接及1280/390px，无后端请求，不替代完整认证组合链。见[客户端记录](api-v3-notification-client-actor-regression.json)。

当前剩余开发与验收任务统一见[验收入口](api-v3-remaining-acceptance.md)。以下逐批记录保留历史状态；最新通知作者修复已在Rhythm本地提交51206bd0，用户重编后PID66339真实HTTP28项通过，真实浏览器组合链随后已通过（见当前记录），website_v3本批无生产源码变更。

第八十二批（2026-11-03）：使用SQL仅植入临时已发布定义/等级、精确文章+作者条件的经验规则和来源输入，不预置进度/效果、不配置积分/勋章奖励。PID47272原Cron实际生成并应用+15，创建进度0→15/起步→进阶；来源重入队仍1效果、15/version1。实际冲正-15使15→0/回到起步；原+冲正一起重入队后仍2效果、0/version2，最高经验15保留。本人/公开API、贡献和记录及桌面/390px页面一致，正负记录由后台产生，无warn/error。临时规则/来源/效果/职业/文章均锁定事务清理，原隐私恢复，职业/积分/回执/余额指纹不变，临时详情404。源码/接口未变，不重复构建；更新NULL外部关联约定并本地提交。受控来源输入不等于v3阅读登记→自然结算→规则的一次完整联调，积分/勋章奖励、故障/多节点等仍未据此验收。见[真实消费记录](api-v3-profession-growth-live.json)。

第八十一批（2026-11-03）：沿职业成长链核对，实际开发库automation=0、user_profession=0，既有52个SUCCEEDED来源事件不能证明经验增长；未导入正式职业规则。本批在独立本地库植入明确的读取夹具（1职业/2等级/26效果，其中23条满足近90天APPLIED非零条件），真实HTTP8组覆盖本人详情/20+3分页/负经验、越权404与匿名401、公开/排行、隐私收回/损坏503及退休历史。真实5173浏览器从登录→职业设置→路线/贡献/分页、390px、公开经验PUBLIC→HIDDEN重读通过，保留等级名次不留旧经验，无控制台warn/error。全部夹具和原隐私行已事务恢复，职业表/积分/回执/余额完整指纹不变，临时详情404。无生产源码、接口契约、Java/FTL或迁移变化；只提交本地验收记录，不重复全构建；实际后台规则消费/发奖与职业增长仍待单独验证，不能将读取夹具当真实发奖。见[职业读取记录](api-v3-profession-nonempty-live.json)。

第八十批（2026-11-03）：用户再次确认重编，PID47272通过旧别名与原URL目标7组真实检查；桌面/390px第2页定位、受限标题隐藏、前进/后退恢复通过，两文章/23评论已事务清理，登录退出后原内容/余额/回执/账本指纹仍未变。等待重启期间复现并修LoginView可选用户名存储异常阻断成功跳转、路由失败无独立恢复：捕获读写存储失败，成功后清密码/MFA并隐藏登录表单，识别真实Vue Router导航失败，原目标重试不再次认证；已有登录仅挂载后导航。新增真实组件6组，96脚本1074条及类型/client/SSR构建通过；隔离浏览器实测阻断存储/阻断路由恢复，真实开发账号完成登录→原评论定位→退出，控制台无错误。293契约/访问、338源码和79产物检查保持通过。最新Java已完成本次联调，无待重启或迁移；其他业务链路/生产风控/真机仍未全验，未提交推送。详见[本批记录](api-v3-login-return-live.json)。

第七十九批（2026-11-03）：用户重编后PID45335通过真实旧别名6组HTTP，23条混合canonical/provisional记录合并为第2页且桌面滚到目标、受限标题未泄露；临时两文章/23评论已事务清理，原内容/余额/回执/账本指纹不变。浏览器同时确认旧短链重写到开发IPv6时生成无效href，最新修复让v3双视图保留原URL及query/fragment，普通旧Function入口仍走原重写行为；新URL保留模式额外校验配置来源字面前缀，防正则相似域名被当站内标题展开。项目Flexmark/SQLite解析迁移15组，相关18/43/66组回归通过。最新仍为LongArticleParagraphService、ShortLinkQueryService两Java，须再次IDEA重编后验原href、PC/390px和历史返回；无新迁移/客户端生产代码，未提交推送，详见[目标地址回归](api-v3-paragraph-link-target-regression.json)。

第七十八批（2026-11-03）：继续真实旧段落别名验证，发现受限文章短链的双视图在请求地址不同于配置地址时生成不同href，真实8081返回paragraph_mapping_conflict409；两份临时文章均已回滚，业务指纹未变。修ShortLinkQueryService增加原URL标签回调、LongArticleParagraphService让双视图链接属性一致而只替换受限标题，既有普通短链回调保持；目标/结构真实不一致仍409。段落runner改用pom版本实际Flexmark转换器，修正旧HTML包裹Markdown的非真实夹具，14组解析/SQLite迁移及当前内容18、评论43、文章66共141组通过。API/更新记录同步，无客户端生产代码或迁移。本批两Java待用户IDEA重编确认，修后真实HTTP、旧别名第2页及浏览器仍未验；未提交推送，见[回归记录](api-v3-paragraph-safe-link-regression.json)。

第七十七批（2026-11-03）：用户确认七Java重编，核对8081 Java PID36957及无凭据JSON后完成原始CHAR评论开关46组真实检查、评论定位13组HTTP检查；普通/active/orphaned第2页及个人回帖点击在真实桌面和390px视口通过。浏览器复现长篇滚动早于加载结束导致目标未挂载，改为结束loading并nextTick后再校验身份/目标滚动，测试改查真实渲染树；另修评论锚点直达时SSR登录回跳水合不一致，挂载后仍保留完整锚点。95客户端脚本1067条及类型/client/SSR构建通过，293契约/访问审计、338源码边界/路由及79生成JS检查保持通过。77条临时评论及计数已事务清理，内容/余额/账本/回执指纹恢复不变；本批仅客户端生产代码变化，无新增Java/迁移或重启要求。真实旧段落别名、多账号慢网导航、生产风控/CDN与其他业务闭环仍未全验，不宣称整个v3完成。未提交推送，详见[联调记录](api-v3-comment-location-live.json)。

第七十六批（2026-11-03）：按用户批准新增GET comments/{commentId}/location，当前评论/文章权限后按普通或段评oldest同筛选SQL计位置，固定20条；段评沿既有别名与active/orphaned分组，只投影ID/页/分组，不返私密正文或匿名身份。用户主页改共享commentLink，ArticleCommentLocation按目标/文章/凭据隔离读取，普通页加载后定位；长篇打开指定段评页、孤立段评只读恢复与位置变化提示，失败仅GET重查；另修恶意/损坏百分号片段触发URIError。真实服务/当前权限/SQL两库各18组、实际Latke/MySQL2组、共享评论43及访问审计7组通过；95客户端脚本1066条与类型/client/SSR构建通过，293注册文档和338源码/79生成JS局部检查通过。最新7处Java待IDEA重编确认（含上批原始CHAR修复），无需迁移；未调用旧服务冒充新接口验收，浏览器工具已可用但新接口/PC/移动真实链待重启。未提交推送，见comment-location-regression。

第七十五批（2026-11-02）：用户确认重编PID8735后，优选/声明/开关和普通/段评关闭新写、已有读取、原成功键回放共24组真实检查通过，字段及内容/余额/账本/回执指纹恢复不变。损坏CHAR开关x触发实际Latke getBoolean的500，已修v3当前快照显式列与原始别名、专用FOR UPDATE策略读取，不改变旧通用仓储；真实框架/临时MySQL新增2组先复现后通过，原当前内容两库各14及相关66组通过。客户端编辑关闭再开放丢未保存草稿已失败复现，保留编辑组件与已载入草稿、取消确认、丢弃过期原文回调；平铺段评目标ID补验通过。93脚本1050条、类型/client/SSR构建及局部审计通过。最新四Java须再次IDEA重编确认（ApiV3ArticlePolicy、ApiV3ContentSnapshots、ArticleRepository、ApiV3CommentMgmtService），无需迁移；修复后异常字符HTTP及真实PC/移动未验，浏览器被Work设置关闭。未提交推送，见article-policy-current-live/regression。

第七十四批（2026-11-02）：按用户批准补详情commentable/statement，异常旧值为null；v3新评论/回复/编辑在幂等回调内锁文章后按当前锁定开关拒绝，成功原键回放保持。普通/长篇隐藏新写入口、取消未发送确认，保留草稿及原命令恢复，长篇普通/段评抽屉均可恢复；声明未知显式提示，置顶改用既有stick而非旧分钟字段。当前内容SQLite/MySQL各14组、共享评论与删除/采纳/投票等隔离回归通过，93客户端脚本1046条及类型/client/SSR构建通过；292契约、336源码局部边界、78生成JS检查通过。累计四处Java待IDEA重编确认（含上批优选DTO），无需迁移；实际HTTP拒绝/回放与PC/移动显示仍待重启后验证，未提交推送，见article-policy-regression。

第七十三批（2026-11-02）：当前服务基线确认优选筛选已收录但摘要/详情缺标志，临时标记已恢复。补ApiV3ContentDtoService只读perfect布尔值、客户端严格解析与SSR二次投影、紧凑列表徽标，普通/长篇详情沿现有徽标消费。后端两库各13组及相关23组通过，前端新增4组、93脚本1040条与类型/client/SSR构建通过；缺字段/适配丢失负向回归已复现，292契约和局部边界/78产物检查通过。最新仅此Java待IDEA重编确认，无迁移，真实新徽标及移动正向待验；未提交推送，见perfect-flag-baseline/regression。

第七十二批（2026-11-02）：用户重编后PID8853的问答新字段/最低悬赏/普通与匿名拒绝/当前canAccept/原键回放等22项真实通过，临时文章/评论整行及余额/回执恢复不变，第69–71五处Java无待重启。继续补齐文章列表/普通详情与作者卡/评论/长篇作者及段评回复的共享VipNickname接入，匿名不挂身份组件、用户名路由保持。实际昵称SFC宿主验证新增4组、93脚本1036条及构建通过；E专用普通/长篇及两评论真实浏览器彩虹/粗体/下划线、普通用户与匿名回退、问答已采纳、390px无溢出/日志0通过，视口恢复。正常开发发布/评论费用及阅读记录保留；没有新Java/FTL、未提交推送，见qna-current-live与content-membership-style-regression。

第七十一批（2026-11-02）：用户批准问答详情公开qna后，当前文章同次SQL以EXISTS投影offerPoint/accepted，隐藏/匿名/失效回答保留已采纳存在性但不返身份，非问答null。客户端严格解析并显示悬赏/已采纳，旧后端缺字段显示未知；采纳确认经组件事件重读文章，失败仅重读恢复。新增采纳断流/轮换/跨账号及状态投影/父子联动8组，前端93脚本1032条与类型/client/SSR构建通过；后端当前内容SQLite/MySQL各12组，临时库清理，292契约及局部边界/78产物检查通过。真实浏览器仅验证旧后端未知回退及回答已采纳，无新规则部署结论；当前五处Java待IDEA重编确认，无迁移、未提交推送。见qna-display-regression。

第七十批（2026-11-02）：按已批准的v3问答/最低20积分资格，GET采纳状态的canAccept同步要求offer>=20，防止低悬赏仍显示可采纳。署名/匿名0、19均false，20为true且匿名offerPoint仍0；SQLite与临时MySQL各5组通过，测试容器已清理。当前待IDEA重编共三处Java（此前两个采纳写入类及本次ApiV3CommentRewardQueryService），没有实测新规则、无需迁移；公开qna详情字段提案待用户选择，未提前实现。文档与回归已同步，未提交推送，见qna-state-minimum-regression。

第六十九批（2026-11-02）：真实问答发布/两回答/采纳/同键与新键重复/第二回答409及实际type33通知共21项通过，一次20积分悬赏及双侧唯一索引，临时字段恢复。源码另发现v3 POST未限制问答资格，用户批准后在锁定文章回调增加type=5且悬赏>=20检查，保留旧入口与成功原键回放。移除guard对照失败，实际核心/幂等及读取共74组隔离回归通过，292契约一致、API/更新日志已同步。最新两处Java须IDEA重编确认，运行21项先于guard不能替代新代码验收。优选/系统文章公告两个真实事件及问答展示元数据缺口继续。未提交推送，见qna-accept-live与qna-eligibility-regression。

第六十八批（2026-11-02）：实际文章购买通知及新建评论感谢通知共22项HTTP验证通过：当前标题及纯文本转义、列表/详情一致、目标失效占位、他人404/游客401、评论失效和讨论阅读资格收回后清旧内容、恢复可读。评论感谢正常15积分仅扣收一次、同键不再收费、一笔转账及双侧唯一索引；临时字段恢复，读取矩阵余额/通知行与已读均不变。正常开发感谢记录保留，无新Java/FTL或构建要求、未提交推送。内容描述六类真实事件现已覆盖感谢文章/购买文章/感谢评论，优选/采纳/系统文章公告三类仍待验，浏览器及生产风控矩阵另列。见notification-extra-live。

第六十七批（2026-11-02）：专用D首次购买17积分文章，生产http/API经本地TCP代理在真实上游200且交易提交后仅转发5字节并断流；客户端明确offline且无自动重试，显式原键重试成功。首次失败后及重试后分别核对仅一次扣/收、一份购买/转账/通知/回执、双账户唯一索引，重试六类业务指纹不变；买前/游客隐藏、买后解锁。保留正常开发测试账，无SQL退款。没有业务源码改动或重启要求，未提交推送；这是实际Node传输故障，不冒充浏览器/跨实例验收。见api-v3-first-charge-ack-live.json。

第六十六批（2026-11-02）：职业/勋章/会员公开读取源码复核后，会员样式17项真实HTTP证明当前配置/到期/状态/四类停用/白名单/错误规则，字段及五余额恢复。发现客户端TTL不使已挂载computed失效，已补共享计时删除及可见批量重读/别名过期/HMR清理；资料页破图补一次默认头像回退。最终93脚本1024条、构建和局部审计通过；真实页面不刷新完成样式消失/恢复、原rainbow及默认头像加载、390px通过，完整会员行恢复。无Java重启、未提交推送。见membership-style-current-live及style-expiry两报告。

第六十五批（2026-11-02）：真实TCP复现旧请求换号后误发离线通知及旧提示遗留；http按调用时身份版本+令牌存在状态隔离（含认证队列），AppShell在身份变化清旧提示、普通refresh保持。六组专项、全92脚本1018条及构建通过。独立生产构建+真实Rhythm浏览器复验当前断流→提示→重读保持活跃→退出/换号→释放旧连接，活连接核验true，新页无旧提示/正文；原A/视口/5173恢复、临时端口关闭、无新收费。无Java重启、未提交推送，首次收费ACK/跨实例/真机另验。见offline-identity-regression/live。

第六十四批（2026-11-02）：真实TCP复现共享http正文半途断开抛原始terminated，已统一JSON/文本/SVG/ZIP读取为明确offline、取消保持aborted，不自动重发写入。新增5组实际socket+Pinia/API/transport回归，原键经断流与普通refresh保留并显式恢复；91脚本1012条、构建与边界/78产物检查通过。真实Rhythm旧购买原键经代理成功回放后截正文，再同键成功，六类业务指纹不变、无新收费；浏览器正常读取通过，首次收费/真实浏览器丢包/跨实例另验。无Java重启，未提交推送。见response-body-regression/live。

第六十三批（2026-11-02）：专用C对17积分测试文章以两键各重复一次、四并发购买成功，只扣/收一次，一份购买/转账/通知、两份安全回执及双账户唯一索引；同键重放不扣费，买前/游客无正文、买后正文等于作者投影。浏览器买方读取/刷新/退出及390px通过。截图发现导航头像破图，AppShell补失败占位/换URL与账号重试/拒绝旧URL错误，90脚本1007条、完整构建和局部边界/产物检查通过。保留正常17积分测试账，不SQL撤回；无新Java重启、未提交推送。见purchase-concurrent-live与shell-avatar-regression。

第六十二批（2026-11-02）：现有专用文章的有评论/有付费阅读删除拒绝16项真实通过，含同键重试、他人/游客与四并发失败；正文/互动/统计/余额/回执指纹均未变化。永久置顶11项真实通过，五种recent排序优先、详情永久标志及付费覆盖409/同键/他人/游客，原置顶恢复且余额/账本/回执不变。无新收费、业务源码或重编要求，未提交推送；余额不足与成功扣费并发、管理员界面及多实例仍另验。见两份article-protected-removal/permanent-stick-live报告。

第六十一批（2026-11-02）：客户端实际丢弃昵称且匿名普通文章生成无效主页链接，已补文章/评论昵称与用户名分列、SSR二次投影、普通/长篇/列表/段落显示及匿名链接保护；背景头像统一CSS字符串转义，保留签名URL。新回归先失败后通过，最终89脚本1003条PASS、类型/client/SSR构建及336源码/78生成JS局部检查通过。真实普通文章/列表/评论/长篇及390px通过，专用资料/匿名状态和余额恢复，无新Java或重启要求、未提交推送。见api-v3-client-author-regression.json。

第六十批（2026-11-02）：用户确认重编后，Java PID96544的作者资料及头像投影17项真实HTTP通过，覆盖五种recent排序、长篇列表、详情/评论/公开资料/本人头像、匿名身份隐藏、无效地址安全回退及旧HTTP完整query只读兼容。原昵称/头像HEX及匿名状态恢复，两账号余额不变；第59批待重启已闭环，无本批新Java/FTL或迁移。外部图片签名有效性、全部列表组合/多实例及真机加载另验，见api-v3-public-author-live.json。

2026-10-30第二十四批：用户确认重启后新章节导航真实HTTP/权限/当前状态及浏览器专栏→正文→前后章→目录→刷新/390px通过，原重关联已恢复。全部82脚本939组通过；大目录分页503恢复另用独立生产构建夹具验证。没有本批源码变化，旧阅读记录/后续结算是否纳入v3另待范围确认；完整步骤见联调记录第二十四批。

2026-10-30第二十三批：真实长篇/专栏草稿发布、可见过滤及管理通过；发现详情缺导航，用户确认新增独立column GET并接ArticleColumnNavigation，前后章与按需分页目录、显式失败重试/身份隔离。新专项7及公开14/评论23/文章32/读取10、build和边界/产物审计通过；后端需IDEA重编再验新HTTP/UI/390px。当前291路，完整真实状态及步骤见联调记录第二十三批。

2026-10-30第二十二批：背包四卡/积分改名真实HTTP与账本/并发通过，浏览器账号页取消/实际单日卡消耗/刷新/失败保留/390px/退出通过。旧回执不覆盖后来用户名与余天；无本批源码变化，真实定时签到/奖励、浏览器最终改名提交及第三方scope仍待。完整记录及人工步骤见联调记录第二十二批。

2026-10-30第二十一批：私信/聊天室实际快速发送及刷新回读通过，完整业务命令拒绝/仅引用发送通过；修复布局切换、话题/涂鸦追加前丢失最新缓冲，97组回归、build、边界/77产物审计通过，390px切换与退出清理已验。真实涂鸦上传/触屏/抽屉及断网恢复仍待验。完整文件及人工步骤见联调记录第二十一批。

2026-10-29第二十批：修复编辑器延迟回调导致草稿付费区/末尾正文丢失，PostView及共享ChatComposer冻结命令前读取实时缓冲；未加载拒绝、未修改源文保持。浏览器草稿快存/标题单改/载入取消/390px/退出和实际评论快发回读通过，32+10+23+21组回归及build/边界/产物审计通过。私信/聊天室浏览器快速发送待验；文件及完整人工步骤见联调记录第二十批。

2026-10-29第十九批：用户确认重启后聊天室举报修复已真实通过；历史版本的作者/权限/私密边界、匿名本人列表及草稿私有源文/替换默认/回执/删除通过。无新客户端源码修改，尚非浏览器草稿/历史界面验收；步骤见联调记录第十九批。

2026-10-29第十八批：后端通知批量分类/全部已读、分类删除及私信全部已读HTTP链路通过，重点验证旧键不处理后到记录、另一owner/分类保持；四条新私信已撤回。不计作浏览器批量按钮已验，聊天室举报仍待第十七批重启确认。步骤见联调记录第十八批。

2026-10-29第十七批：邀请码原子购买/模式恢复/重放与状态白名单、非聊天室举报权限/复用实测通过；聊天室举报发现作者整数形态兼容问题，后端已修复、10组回归通过。需IDEA重编重启后再验真实聊天室举报，客户端无本批源码改动。步骤见联调记录第十七批。

2026-10-29第十六批：职业目录、隐私可见排行/连续分页、公开经验和统计省略、主职业/跳过引导幂等及本人详情空记录的后端HTTP/SQL通过；修复独立开发库旧职业表collation，不改业务源码。夹具已清理，真实经验事件/升级奖励和浏览器界面仍待验。步骤见联调记录第十六批。

2026-10-29第十五批：勋章列表/显示/移动及SVG读取权限25项后端HTTP通过；实际清洗用受控本机渲染响应（真实渲染器未启），临时进程和数据均已清理。尚非浏览器勋章展示/真实外部生成器验收；完整人工步骤及限制见联调记录第十五批。

2026-10-29第十四批：用户确认重启后，后端认证PNG/JPEG原字节上传、并发一次性材料读取（200/410）、权限和读后审核完整HTTP/SQL通过；临时本地审核员及绑定已清理，不涉及生产账号。没有本批客户端源码修改或浏览器下载UI验收，详见联调记录第十四批。

2026-10-29第十三批：后端真实企业认证PNG上传暴露二进制预处理问题，create已改原始字节读取；12组隔离及临时MySQL并发回归通过。客户端接口方式不变，无本批UI改动；需要用户IDEA重编重启后继续完整应用上传/一次性材料/审核验收，暂不记为浏览器已通过。

2026-10-29第十二批：鱼游投稿/已审核夹具待审编辑、QQ/个人标签/MBTI的后端HTTP实测通过，均有越权/格式/重放矩阵及原值恢复。真实管理员审核、第三方QQ拒绝和头像合法保存仍未计运行验收；不是相应UI全部已验。现有429保留，不改限制。详细步骤见联调记录第十二批。

2026-10-29第十一批：文章置顶/付费阅读/本人删除的后端HTTP与SQL核对通过，含实际100/17积分、重复键无多扣、第三读者隐私及目标reaction清理。不是客户端付费确认UI已验收；时间规则使用独立开发库专用夹具。详细人工步骤与限制见联调记录第十一批。

2026-10-29第十批：图片表情/迁移与卡片HTTP实测通过；用户站/cr实际展示音乐及跨年五日天气，ChatCard修复日期相挤和窄屏负温度折断，完整日期保留在time标注。npm run build及AST边界审计通过；390px日期/温度在列内、页面无横溢出，刷新恢复与退出清理通过。手工完整步骤/未验项见同名联调记录第十批。

2026-10-29补充：重编后的完整应用导出已通过ZIP归属/hash/私有下载及收费重放；会员受控夹具购买/券/礼包/展示样式、MFA完整启停及密码变更恢复的HTTP链路通过，v3旧Access/Refresh均按变更撤销。未修改本批客户端业务代码，不能据协议通过声称相应浏览器全链路已验；详见联调记录第八/九批。

2026-10-29补充：当前真实浏览器已通过本人文章编辑取消/确认、Vditor评论发表、整页刷新身份恢复/评论唯一性、390px弹窗和退出后私密正文清理；OAuth/APP/云存档另有真实HTTP协议证据。仍未覆盖的浏览器模块、外部服务和生产风控见联调记录，不将历史未验项全部自动销项。

2026-10-29 已恢复真实后端联调：本机5173指向独立Rhythm 8081；修复认证开发代理后，浏览器登录、整页刷新恢复、聊天室历史/在线名单与实时连接、本人设置读取、退出清理已验证。76个后端GET读取/预期拒绝及认证/预览边界另有实际证据。此处以下保留历史分批记录，不把历史“尚未完成”当作最新缺口；当前证据和剩余范围见[首批实际联调记录](api-v3-live-integration-work.md)。最新要求为保留本地修改，不提交、不推送。

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


第八十六轮（2026-10-27）：复读机首页/独立页迁移既有v3榜单、分类、服务端next、投稿及明确PUT/DELETE点赞，原命令/key全局恢复与平台确认，成功只GET当前榜单不回写历史计数；Home/SSR明确joke，纯文本不剥HTML。新增18组，tools目录60脚本全部通过共613组，类型/客户端/SSR构建、73JS版本0/无map通过。285路由保持，无Java/FTL/SQL/Maven/APP改动；浏览器双视口、真实权限/DB/风控仍待验。本批按用户要求两仓提交，见[复读机记录](api-v3-client-repeater-work.md)。


第八十七轮（2026-10-27）：/games鱼游迁移既有v3目录/两排序/分页/详情/评论、明确赞踩清除、五字段投稿及本人编辑（OAuth必填），原命令/key全局恢复，成功独立GET不写历史回执正文/计数，待审不等于公开批准。旧submitFishGame与暂无JSON提示删除，官方游戏直接导航经典站点。61脚本回归630组全通过，最终鱼游专项18组、类型/客户端/SSR构建、73JS版本0/无map通过；两仓diff检查通过。285路由保持，无Java/FTL/SQL/Maven/APP，浏览器双视口/真实审核OAuth/事务权限/反漏扫链待验。本批两仓提交，见[鱼游客户端记录](api-v3-client-fish-games-work.md)。


第八十八轮（2026-10-27）：同城移除近50清风过滤/旧apiKey门槛/SWR/v-html，改已有v3公开用户和署名文章独立分页/total/排序/原页错误重试；单次城市编码，切城/凭据/迟到隔离，头像/昵称/ArticleFeed共用。13专项、62脚本644组、类型双构建、73JS版本0/无map通过；真实Chrome生产构建+SSR夹具完成1280用户p2故障→原页恢复/文章末页与390排序/末页，page-error/hydration warn无，预期401/503单列。285路由保持，无Java/FTL/SQL/Maven/APP；真实位置隐私/风控/后端运行待验。按用户要求两仓提交，见[同城记录](api-v3-client-cities-work.md)。


第八十九轮（2026-10-27）：大事记页接既有五接口，公开SSR时间线/本人筛选与独立分页详情、Markdown投稿及原键跨SPA恢复；本人历史原文经当前preview清洗，失败无原HTML回退，提交回执不代替当前审核状态。18专项、63脚本663组、类型双构建、74JS版本0/无map通过。真实Chrome生产构建+SSR合成HTTP完成1280已提交503→同键仅创建一次→待审GET/预览503重试及390本人深链接/公开末页详情；无page-error/水合警告，预期503单列。285路由保持，无Java/FTL/SQL/Maven/APP；真实权限/审核事务/风控仍待验。按用户要求两仓提交，见[大事记记录](api-v3-client-milestones-work.md)。


第九十轮（2026-10-27）：/statistic页脚改SPA统计，复用现有GET九项数字白名单与每请求公开SSR；错误清旧快照/不填零、原资源重试、凭据/迟到隔离，桌面三列/移动两列。统计12专项、64脚本676组、类型双构建、75JS版本0/无map通过；真实Chrome生产构建+SSR合成HTTP完成1280刷新503→旧数字清除→重试恢复和390九项/零值/刷新，无page-error/水合警告，预期401/503单列。285保持，无Java/FTL/SQL/Maven/APP；真实业务统计、权限与反漏扫链未验。本批两仓提交，见[统计记录](api-v3-client-statistics-work.md)。


第九十一轮（2026-10-27）：账号页APP码改既有v3三网页POST，本地矩阵SVG/两分钟/手动状态/APP确认后网页明确批准或拒绝，未知决定只查当前状态，consumed才显示完成；清除旧apiKey/外部QR链，APP源码不动。扫码16专项、65脚本692组、类型双构建、73JS版本0/无map通过，独立jsQR解码回读一致。真实Chrome合成协议1280批准已保存503→只GET语义的状态POST恢复→consumed，390本地码/拒绝通过，无page-error/水合警告，预期503及原密码verbose提示单列。285保持，无Java/FTL/SQL/Maven；真实APP/issuer/单次换码/风控未验。本批两仓提交，见[网页扫码记录](api-v3-client-app-login-work.md)。


第九十二轮（2026-10-27）：普通十五榜/全部游戏子类接既有v3有限快照分页，原页重试/子类重置/身份迟到隔离、赞助汇总/安全链接；Top目录只导航，职业独立。Home连签/在线size8独立预览/错误/SSR，不入旧缓存，删除旧top包装和mock导出。16专项、66脚本709组、类型双构建、74JS版本0/无map通过。Chrome生产构建+SSR合成HTTP完成1280连签p2故障→rank21/子榜/赞助与390Home前8→更多→p2重试；修复短末页停页脚并复验定位，无page-error/水合警告，预期401/503单列。285保持，无Java/FTL/SQL/Maven/APP；真实快照/权限/反漏扫未验。两仓提交，见[排行榜记录](api-v3-client-rankings-work.md)。


第九十三轮（2026-10-27）：设置数据页接既有Evolve目录/本人原文GET/CAS保存/显式迁移，透明Unicode与字节/hash核验；原文/版本/key跨SPA未知恢复、冲突不自动覆盖、读取不盖草稿、回执不盖最新版本。18专项、67脚本727组、类型双构建、74JS版本0/无map通过。Chrome生产构建+SSR合成HTTP完成1280已写503→离页同键恢复仅一写→GET503只读重试/原文及390迁移/编辑框纯文本；无page-error/水合警告，预期404/503及相邻夹具限制单列。285保持，无Java/FTL/SQL/Maven/APP；真实DB/游戏导入/权限与风控待验。两仓提交，见[存档客户端记录](api-v3-client-game-saves-work.md)。


第九十四轮（2026-10-27）：Home/活动中心签到面板接既有两GET/奖励POST，真实门槛/状态、独立失败/非假0、原date/key全局恢复，清旧apiKey/持久活跃缓存链。奖励POST加可选expectedDate绑定规范化请求，锁后fresh跨日409、原回执先重放，旧{}兼容。Java25日期五组/通用写六套件（幂等8场景）通过；前端14专项、68脚本741组、类型双构建、74JS版本0/无map通过。Chrome合成1280/390明确领取/取消、已发503→同键恢复仅一笔/当前GET，无page-error/水合警告，预期503单列。285保持，无FTL/SQL/Maven/APP；Java已提醒IDEA重编/重启，真实HTTP/积分/日期/风控未验。两仓提交，见[活动记录](api-v3-client-activity-work.md)。


第九十五轮（2026-10-27）：全局用户卡片改既有v3公开六字段与明确重试，删除无限期LRU/旧角色与在线假默认，ID昵称样式和关注目标、私信保持。UserFollowButton增可选ID绑定，旧仅name调用保持。12专项+关注新增1、69脚本754组、类型双构建、73JS版本0/无map通过。Chrome桌面合成键盘打开→503→重试/纯文本通过，无page-error/水合警告；ID补充后专项回归通过，窄屏采集未完成，真实鼠标/触控/390px仍待。285保持，无Java/FTL/SQL/Maven/APP；主页/徽章页旧公开资料链、真实权限/风控继续。两仓提交，见[用户卡片记录](api-v3-client-user-card-work.md)。


第九十六轮（2026-10-27）：公开勋章页接既有v3用户名分页GET，移除旧完整用户合并/SWR/apiKey，真实总数/原页失败重试、身份迟到隔离和纯文本元数据；保留重复授予，图片URL契约缺口仍待。10专项、70脚本764组、类型双构建、74JS版本0/无map通过。IAB生产构建+SSR合成HTTP完成1280第一页20/总21→p2失败清旧→重试末页/按钮禁用。285保持，无Java/FTL/SQL/Maven/APP；真实窄屏/权限/过滤/风控未验，MemberView继续。两仓提交，见[公开勋章记录](api-v3-client-public-medals-work.md)。


第九十七轮（2026-10-27）：MemberView/SSR改公开六字段，普通/长文章/回帖/清风v3真实分页，错误独立/原页重试/身份迟到隔离；清风详情精确ID与归属、私密评论置空，删除四个无调用旧用户包装。不补缺失角色/积分/在线等字段。13专项、71脚本777组、最终构建证据见第九十八轮更正、73JS版本0/无map。IAB1280合成生产SSR完成20/总21→p2故障→末页重试/私密回帖/清风栏目，最终重载确认详情链接。285保持，无Java/FTL/SQL/Maven/APP；真实隐私/授权/风控/窄屏/写操作待验，公开画像/勋章图片缺口仍在。两仓提交，见[用户主页记录](api-v3-client-member-work.md)。


第九十八轮（2026-10-27）：注册/找回/重置三入口共用既有六v3资源，当前注册选项/服务端captchaId/SMS快照绑定/手机号验证码直提，删旧verify/meta与六包装及假userId。新密码复用6–128/Unicode规则，未知完成先登录核实不自动重发，取消拒迟到、秘密不进URL/storage。20专项、72脚本797组、独立exit0类型双构建、73JS版本0/无map通过。IAB1280合成选项故障→重试、组件故障不发短信及最终重置表单布局通过；未操作真实验证码/账号凭据。更正上轮构建：旧包装删除留下两unused辅助函数，本批清理并独立实核成功。285保持，无Java/FTL/SQL/Maven/APP；真实短信/极验/凭据撤销/风控/390px待验。两仓提交，见[账号入口记录](api-v3-client-account-access-work.md)。


第九十九轮（2026-10-27）：用户批准专栏四GET按当前可读/可列出署名长篇与有效作者过滤，SQL先过滤再数量/最新/热门/分页，无可见章404、SQL失败503，optionalContent/原匿名盾及no-store。旧经典保持。客户端资料/章节独立GET/错误/原页重试、20项分页、原章号/首最新阅读、身份迟到隔离和封面CSS占位；首页架共用严格卡片解码。Java25/SQLite8+接线源码1及既有写核心4通过；客户端14专项、73脚本811组、独立exit0双构建、72JS版本0/无map通过。IAB1280合成20/总21→p2故障→末页重试/占位最终重载通过。285保持，无SQL迁移/FTL/Maven/APP；Java已提醒IDEA重编/重启，真实IoC/MySQL/权限/风控/390px待验。最近注册/随机发现/仅时间类别日志规则已确认、待下一批实现。两仓提交，见[公开专栏记录](api-v3-public-columns-work.md)。


第100轮（2026-10-28）：最近注册/随机发现/日志元数据三GET总接线，288（287HTTP+WS1），GET145/POST72/PUT46/DELETE24。当前有效四字段/随机起点回绕及匿名保护/固定日志类别先过滤再分页，绝不返回data/key2；客户端Home/Activity/Article/Logs及SSR迁移，独立错误与原页重试，删三旧包装。Java25实际服务/SQLite10+源码接线1组及DTO/共享门禁回归通过；客户端74脚本831组、独立exit0双构建、75JS版本0/无map通过。IAB1280合成19人完整/两模块503独立重试、日志p2故障→末页和首页真实入口通过。无SQL/FTL/Maven/APP；Java需IDEA重编重启，真实IoC/MySQL/新路HTTP/权限/反漏扫/390px待验。两仓分别提交，见[本批记录](api-v3-discovery-extras-work.md)。


第101轮（2026-10-28）：用户确认勋章图片profile.read、本人有效持有或指定用户当前公开展示，格式纠正为清洗SVG。两GET总接线290（289HTTP+WS1），GET147。当前SQL权限/定义→固定renderer→SVG白名单→再次SQL核对，no-store/图片响应，保留原始128单位ID，查询参数完整传递，不trim或重复解码；旧/gen保持。客户端Bearer二进制/两并发/Blob img及释放、身份迟到隔离，OwnerMedals与公开页接入，删旧medalSession/gen包装。Java25核心SQL/清洗/实际loopback渲染8组及实际Dispatcher/auth/controller隔离1组通过；75前端脚本841组、认证12组、独立exit0双构建、75JS版本0/无map通过。IAB1280合成公开图片503→单项重试恢复、本人与公开入口实际Bearer通过。无SQL/FTL/Maven/APP；IDEA重编重启、真实MySQL/renderer样式/IoC/风控/390px待验。列表真分页/专栏伪造回退列下批，见[本批记录](api-v3-medal-images-work.md)。


第102轮（2026-10-28）：ArticleListView所有文章分类/搜索/目录采用真实v3分页（20），专栏采用当前可见目录（12）和单选排序，不再猜下一页或由文章拼造作品数/作者/章号。独立错误清旧/原页重试/收缩回首页、凭据与目标迟到隔离，公开SSR按kind/extra/order绑定/白名单/一次消费，Home旧feed保持。新增16专项与SSR第9组、76脚本858组、认证12组、独立exit0双构建、75JS版本0/无map通过；IAB1280合成文章与专栏p2故障→末页/禁下一页、专栏hot重置p1和C++目录通过。290入口保持，无Java/FTL/SQL/Maven/APP/外部接口契约变更。真实权限/风控/390px及Home聚合缓存假空仍待，见[列表记录](api-v3-client-article-list-work.md)。


第103轮（2026-10-28）：Home五资源独立读取/错误/重试，最新40、热议12、专栏最近/热门各8、标签24；移除聚合缓存假空与文章拼造专栏，SSR区分null/[]，当前身份迟到隔离，布局卡片同级。复读机ready及同账号Token轮换草稿保留。77脚本878组、认证12组、exit0类型双构建、75JS版本0/无map；IAB1280合成局部503重试/真实目录/401刷新草稿通过。290入口保持，无Java/FTL/SQL/Maven/APP/接口契约变更；真实权限/风控/390px待验，见[首页记录](api-v3-client-home-reads-work.md)。


第104轮（2026-10-28）：领域/标签目录接现有GET真实50项分页，去SWR/apiKey，原页失败重试/末页禁用/收缩回首页/身份迟到隔离；SSR kind绑定/白名单/一次消费，数字ID链接避免二次解码，透明外层及SCSS滚动留白。11专项+SSR第11组、78脚本890组、认证12组、exit0双构建、76JS版本0/无map通过。IAB1280合成两页50/51→p2故障→重试末页及固定顶栏修复复验通过；真实权限/风控/390px待验。290入口保持，无Java/FTL/SQL/Maven/APP/外部契约变更，见[目录记录](api-v3-client-directories-work.md)。


第105轮（2026-10-28）：ArticleView移除通用正文/评论SWR，当前GET失败不回退旧正文；全部刷新来源401/403/404清正文/回复/图片/历史，确认操作后503保留明确重读提示。普通Token轮换重读且保留实际评论草稿/历史，分页在途提示/禁按钮与卸载迟到保护。10函数专项+完整评论组件新增2组、79脚本902组、认证12组、exit0双构建、76JS版本0/无map通过；IAB1280合成p2故障→原页重试末页→403清正文通过。290保持，无Java/FTL/SQL/Maven/APP/外部契约变化；真实权限/风控/长篇/付费/390px待验，见[文章读取记录](api-v3-client-article-reads-work.md)。


第106轮（2026-10-28）：v3Article详情ID/评论articleId/请求页与size20绑定及重复评论拒绝，参数先验避免半发请求，长篇坏响应不继续取段落正文。新增8组及完整组件0页返回第23组、79脚本911组、认证12组、exit0类型双构建、76JS版本0/无map通过；IAB1280合成错误归属p2→明确错误→原页重试正确末项及收缩0页返回第一页通过。290保持，无Java/FTL/SQL/Maven/APP/外部契约变更，真实权限/风控/长篇/390px待验，见[响应绑定记录](api-v3-client-article-binding-work.md)。


第107轮（2026-10-28）：用户批准网站旧page-auth桥接退役；删除Node转换/HTML抓取/Cookie签发、前端sessionStorage helper及Vite/nginx旧登录转发，Rhythm经典入口保持。fishpi删除47个无调用包装，仅六当前helper。实际生产/开发Node六组桥接404/零上游/无Cookie、现有v3与验证码POST正文保留；80脚本917组、认证12组、exit0双构建、77JS版本0/无map，IAB1280首页→v3登录表单通过。290保持，无Java/FTL/SQL/Maven/APP；需部署重启Node/同步nginx，真实登录/风控/390px待验，见[桥接退役记录](api-v3-retired-bridge-work.md)。


第108轮（2026-10-28）：删除孤立catalog/gaps假数据、移纯DomainItem类型、删除无用withKey；静态AST复核找出离线旧ping并改既有v3 captcha-options。330文件165 API字面量/47动态表达式/2 RhyPic校验单列、0发现，报告不等于运行覆盖。80脚本917组、认证13组、exit0双构建、77JS版本0/无map；IAB1280合成离线一次v3探测→原登录页通过。用户确认部署后本机8080仍拒绝，随后明确暂不做真实联调；继续源码/隔离，不等待地址。290保持，无Java/FTL/SQL/Maven/APP/外部契约变化，真实权限/风控/390px待验，见[边界记录](api-v3-client-boundary-work.md)。


第109轮（2026-10-28）：新增Router.requestMapping→registerProcessors→ApiV3/helper注册链审计，与API.md按METHOD/path核对；114方法/290路由/文档290，差集/重复0。9组正反例与node --check通过；全仓837/398口径保持。仅工具/文档，无业务Java/FTL/SQL/客户端/Maven/APP改动，未重复构建或全量客户端测试。真实联调按用户要求暂缓；风险红包经典衔接/停用发送者结算两规则待答，不据源码契约齐全宣称业务完成，见[收尾检查](api-v3-contract-audit-work.md)。


第110轮（2026-10-28）：用户确认风险红包经典两端显式领取、停用发送者存在即可结算/删除409。共享legacy证明/只读/预期账号、JSON媒体类型及PC两JS/生成产物接入，未知重试保留原拳/账号；旧历史保持。Java25核心20组、JS16组、卡片4组、资源build、4JS版本0/无map、290契约一致通过；IAB1280本地捕获两min脚本确认/取消/出拳/只读通过。无新SQL/FTL/Maven/APP；已提醒IDEA重编/重启，真实联调继续暂缓，见[风险红包衔接](api-v3-risk-legacy-bridge-work.md)。


第111轮（2026-10-28）：经典两channel实时领完同步durable状态，完成单向/清待恢复证明，旧事件与快照不回退，完成后只读。新核心参数遇非新核心目标明确拒绝，旧历史正常请求保持。12状态+16领取UI+Java25核心20组、资源build、8JS版本0/无map通过；IAB1280两套实际min与模拟WS→只读请求通过。290保持，无新SQL/FTL/Maven/APP，已提醒IDEA重编/重启；真实联调/移动仍暂缓，见[实时状态收尾](api-v3-risk-status-work.md)。


第112轮（2026-10-28）：真实Util.alert/jquery/生成样式的390px检查发现PC风险弹窗502px越界；新增专用SCSS modifier并PC/mobile共享import，按钮换行、视口留白/旋转与旧弹层清理；仅新风险弹窗。16领取UI+12状态、资源build、4JS版本0/无map、CSS无sourceMappingURL通过；IAB实际DOM390 PC/mobile两脚本、844横屏及1280桌面几何/截图通过。无Java/FTL/SQL/Maven/APP，真实联调/实机仍暂缓，见[窄屏记录](api-v3-risk-dialog-layout-work.md)。

段评联调第二十五批：当前总数/零分页/空末页恢复、错误不伪造0及摘要去计数已修复；实际HTTP孤立与恢复和游客私密投影通过。详见docs/api-v3-live-integration-work.md。阅读登记尚未实现，三项规则已确认。

阅读登记第二十六批：长篇正文后新增ArticleReadRegistration与v3-article-reads API；独立MySQL10/客户端7、当前84脚本951组及build通过，独立浏览器503重试/recorded=false/换章/390px通过。需Rhythm新20261030迁移与Java重编后真实联调；原定时结算/成长消费未据登记测试验收。源码清单和完整人工步骤见Rhythm docs/api-v3-long-read-gap.md。

第二十七批后端阅读结算已补实际MySQL回归并修复负数/溢出、严格commit及主账/双索引原子性，19组（登记10/结算9）和跨JVM数据库等待通过。前端本批无变化；新Java与阅读登记一起待停服迁移、IDEA重编及真实应用验收。见同名联调镜像第二十七批。

第二十八批：当前后端292契约与334源码的路径对照未发现确定缺路由/方法冲突，47动态表达式和2非v3调用分列；新审计8组、实际15模块97构造/12组通过。新增三个本地工具和两份JSON报告，不发送HTTP、不改应用源码，不能据静态匹配判功能/权限完整通过。新阅读登记/结算仍待停服迁移及IDEA重编，完整范围见Rhythm/docs/api-v3-current-completion-audit.md。

第二十九批：真实/vips游客→登录回跳→取消/坏券无扣款→测试VIP4月卡实扣400与期限/双索引→样式保存与非法色拒绝→刷新/390px/退出清理通过，F当前3600且保留测试会员。开发库阅读迁移已应用，PID40308首读/去重及身份边界通过；非法JSON暴露原始体缺陷，控制器已修且真实parseForm/MySQL共20组通过，最新Java仍待再次重编确认。无本批前端应用源码/构建变化，见同名联调第二十九批。

第三十批：用户确认PID44439后，真实原始体拒绝/双scope/当前目标、新旧MD及经典计分、并发同窗去重通过；自然跨窗保留旧记录，后台旧窗仅10积分、一主账/双索引/history及职业事件SUCCEEDED一致。浏览器专用B登录回正文→下一章，无阅读错误或warn/error，同窗未再增加。具体职业规则/积分页面与完整双端/网络矩阵另验。只更新两仓文档，无新Java/FTL/前端源码/迁移/构建/提交推送，见同名联调第三十批。

第三十一批：真实作者积分页面奖励+10/余额3206与SQL一致；职业无自动化规则，event成功不冒称经验增长。修OwnerMembership普通token刷新误清未确认开通key/草稿：context+actor边界隔离，退出/新登录仍清旧。会员12、样式8、认证13组、类型/双构建exit0及77JS版本0/map0通过；真实/vips取消不扣费、390px与warn/error检查通过。实际网络故障轮换仅组件回归，非真实服务端故障注入；无Java/FTL/迁移/提交推送。详见联调第三十一批。

第三十二批：EmojiPacks修普通token轮换误清未知导入key/输入，context+actor变化才清旧。表情12＋编辑器12＋会员12＋认证13共49组、类型与双构建exit0、77JS版本0/map0通过。真实设置页建组→非法URL拒绝→合法图片/成员改名→分享导入→来源删除独立→全部级联→测试清理，桌面/390px与warn/error通过；真实丢包轮换、跨账号浏览器/旧迁移UI另待验。无Java/FTL/迁移/提交推送，见同名联调第三十二批。

第三十三批：资料/头像、偏好、职业、勋章四设置组件补稳定context+actor边界；普通token刷新保留草稿/未知原key/当前回执，退出和新身份仍清旧。新增回归先四处失败，修后全85脚本971组、类型/client/SSR exit0，77JS版本0/map0。真实资料表单在开发专用A access过期后自动轮换并保存成功，简介/临时到期值已恢复；390px无横溢和warn/error。其他写入/真实lost ACK及图床仍未据此验收。文件/人工链见同名联调第三十三批，无Java/FTL/迁移/提交推送。

第三十四批（2026-10-31）：Rhythm OAuth真实浏览器登录回跳正常，拒绝却因no-referrer→Origin:null被严格来源拒绝。已修授权HTML响应与PC/mobile FTL same-origin，原同源/CSRF不放宽；模板回归先失败后通过。最新Java/FTL待用户IDEA重编重启后验回调，客户端业务源码无改动，无迁移/提交推送。见同名联调记录。

第三十四批最终：PID63733已部署Referrer-Policy与CSP303目标两处修复，真实浏览器拒绝及明确批准后允许都回精确地址，state/固定query保留；浏览器签码错PKCE/回调拒绝后正确换码、来源/刷新撤销通过。测试client已停用、零active token，回环服务关闭。最新165条完整PASS＋Cookie3组，390px通过；外部HTTPS/真机与跨实例另验，暂无待重启。无提交推送，详见同名记录。

第三十五批：真实私有导出自然旧任务清理/原键expired无收费，新单任务四类块/hash损坏503且不发ZIP、账号status1..4下载401，恢复后原ZIP逐字节一致；浏览器本人任务查询/真实下载hash及模拟到期410/按钮禁用通过。后端/前端应用源码无改动，导出专项7组通过，无新重启/迁移/构建/提交推送；大包多块/全内容状态/MFA/真实网络故障另验，见同名记录。

第三十六批：实际5块/206207字节导出包含本人匿名隐藏无效长篇、锁定讨论、私密匿名无效评论及付费原文，ID集/逐项Markdown一致；中间/末块损坏503，恢复ZIP一致，真实浏览器下载hash通过，一次100主账/双索引。诊断快照曾受mysql批量转义影响，两篇测试正文已按保存快照纠正并HEX逐字节恢复；未重建导出/重复扣费。既有Java导出10组复跑通过，无应用源码/迁移/构建/重启/提交推送；MFA/边界预算/网络等另验。见同名记录。

第三十七批进行中：Rhythm共享JSON helper存在预处理丢失原始校验的缺陷，测试改真实parseForm后先失败；等待用户兼容决策，尚未改生产解析器/客户端，无需新重启。测试暂失败，详见同名联调记录。

第三十八批：通知页修普通refresh误清批量已读原key/p2，context+actor与unmount隔离；真实分类已读A2→0/B保持、分类空状态和390px通过。全86脚本974组（含新页前三组）、最终专项4组及类型/client/SSR exit0，77JS版本0/map0。真实丢包/轮换由组件受控测试覆盖，不冒称浏览器故障实测。共享JSON兼容选择仍待答，后端失败回归尚未修；无Java/FTL/新重启/提交推送。见同名记录。

第三十九批：ProfessionRanking修普通refresh重置职业/提示，以及p2请求内refresh因ranking=null忘记目标页；context+actor隔离且重新当前GET。排行10/本人8/公开7/通用排行16共41组、类型/双构建通过，77JS版本0/map0。真实浏览器合法空目录与390px通过；开发库无职业，有数据选择/分页由组件受控测试，真机另验。共享JSON选择仍待答且后端复现测试失败保留，无Java/新重启/提交推送。

2026-11-02 第44批：PostView接现有usePageSeo，创建/编辑/长篇标题随heading，canonical只含route.path、noindex且不含私有输入；新增元数据回归，相关52条PASS、构建和普通/长篇浏览器/390px通过。第43批后端Cookie修复待IDEA重编重启确认，见联调记录及post-metadata-regression报告。

2026-11-02 第45批：后端认证严格正文与全局刷新Cookie回写修复已由用户重编部署并完成44次认证/7路径HTTP、正常浏览器登录/整页恢复/退出再刷新游客验证。5173临时API目标明确[::1]:8081以避IPv4其他项目；不改生产默认配置。无本批业务源码/新重启要求，剩余MFA/网络/真机等分列，见auth-body-live及联调第45批。

2026-11-02 第46/47批：删除九场景真实拒绝与无费用/回执已验；ArticleView在实时票据明确403/404后清旧正文并阻迟到，当前恢复显式GET。开发WS代理支持IPv6hostname，两栈v3/经典升级真实回归通过。全部87专项984条PASS及构建、浏览器失效/恢复/390px通过；服务端缓存权限及完整剩余矩阵仍单列，详见联调和article-unavailable-regression报告。

2026-11-02 第48批：后端普通论坛读取预热后仍可读的缓存缺口已复现，用户批准当前记录校验，文章/评论/引用/表态六处Java已改、142条相关隔离检查通过，API字段保持。尚待IDEA重编重启后真实验收，无前端源码改动，不据此重写第47批运行结果；见content-current-regression及联调第48批。

第49批（2026-11-02）：Rhythm当前文章15/评论9项真实通过；发现通知旧标题链路并补修，最新后端通知Java仍待IDEA重编确认。六类完整通知查询回归随SQLite/MySQL及相关共47条通过，客户端业务源码未改；见两仓联调与content-current-runtime-regression报告。

第50批（2026-11-02）：历史当前权限/目标与三类预算12项真实通过，原数据恢复；无业务源码变更，第49批通知修复重编仍待。见revision-current-budget-live及联调记录。

第51批（2026-11-02）：历史真实浏览器版本切换、权限错误、实际503清旧正文/恢复重试及390px通过，临时历史已清、原指纹一致；没有业务源码变更，通知第49批重编仍待。见revision-browser-live报告。

第52批（2026-11-02）：最新重编PID91346后，通知当前标题/发送者/占位及鉴权13项HTTP、实际浏览器新标题→失效→恢复和390px通过，夹具/未读恢复。当前无待重启；其他五类真实事件、跨实例等仍分列，见notification-current-live。

第53批（2026-11-02）：全292注册显式鉴权清单及实际784次凭据/scope拒绝通过，原测试scope/state恢复，业务表行数保持；没有前端/后端业务源码变更。合法业务/越权与匿名协议证据仍按各批次分列，见route-access及access-live报告。

第54批（2026-11-02）：头像正常保存及functions偏好/边界/幂等恢复共32项真实通过，原值/余额恢复；无客户端源码变更，不等于远端图片或设置UI已验。见avatar/functions-normal-live及联调记录。

第55批（2026-11-02）：语言/时区与首页地址34项存取/严格输入通过，原值恢复；源码未找到首页自动跳转消费，触发规则待用户选择，不能把表单保存当已应用。无客户端源码改动，见locale-redirect-live。

第56批（2026-11-02）：展示设置与双端皮肤19项真实存取/失败/幂等恢复通过，原值/余额恢复；不等于实际主题/GIF消费已实现，首页触发规则待选择。无客户端业务源码变更，见display-normal-live。

第57批（2026-11-02）：Rhythm公开资料/列表隐私缓存缺口真实复现并修Discovery当前读取，48条隔离回归通过；最新Java待IDEA重编，客户端业务源码未改。首页跳转规则另待，见profile-current-regression及基线。

第58批（2026-11-02）：PID93962公开资料隐私41项真实通过，无待Java重启；首页跳转规则获批后实际接HomePreferenceRedirect/homeRedirect，47相关回归、双构建、边界/版本检查及实际浏览器跳转/保留query/hash/未支持/重试/清空/390px通过，原设置/余额恢复。其它偏好实际消费与外部矩阵另列，见两报告。

第59批（2026-11-02）：Rhythm列表作者缓存与签名头像丢query缺口已修，67条隔离回归及负向对照通过；最新五处Java待IDEA重编，无客户端源码变更/迁移，不等于外部图片已可用。见public-author-regression及基线。
