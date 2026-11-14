# v3 客户端消息上下文（第七十七轮）

## 范围与行为

复用已有 `GET /api/v3/chat/messages/{id}/context?radius=5` 和 before/after 列表读取，无公开契约变更。本轮只改前端，不修改 Rhythm。

`/cr#chatroom{id}` 引用链接在完整聊天室原消息区域内定位，不再打开弹窗。即使目标不在最近历史中也按 ID 一次查询，登录恢复后保留深链接。首次读取目标与前后各 5 条，最多 11 条；经典模式倒序、简约模式升序，目标独立渲染并高亮，不因复读折叠而丢失定位节点。前后翻页各取 10 条并替换当前窗口，不逐页扫描全部历史。

历史窗口与共享实时列表隔离；实时连接和内存消息继续保留。返回最新清除 hash，直接恢复已有消息，不额外重读主列表。经典模式滚动页面至目标，简约模式仅滚动内部消息区，输入框保持可用。路由通用滚动不抢先定位旧列表的同名节点。同一 hash 在翻页后再次点击，也能重新读取原定位窗口。

悬浮聊天和隐藏会话在引用导航成功后收起，避免挡住原消息；导航被取消或拒绝时保留窗口。目标前的图片晚到时继续校正定位，用户主动滚动或操作后停止校正，避免抢夺阅读位置。

失败显示原因，可按原方向与游标重试；非权限类失败保留当前窗口，空边缘保留最后非空游标并禁用该方向。401/403/404清掉旧正文；关闭/切目标/身份变化取消并隔离迟到结果。正常token轮换保留当前读取身份语义；退出或账号/授权上下文变化清理。

复用共享timeline的元数据changeHint，不新增WebSocket。相关窗口成员/定位消息更新、删除、本地确认撤回、发布回填或全量同步/清授权时清旧上下文并提示重读；读取途中出现最终页成员变更时拒绝提交旧页。无关目标不清现有快照。服务端事件可丢失，因此保留显式重读，不宣称上下文实时完整性。

## 实际文件

客户端根 `/Users/ling/Documents/fishpi/website_v3`：

| 文件 | 修改行为 |
| --- | --- |
| `src/api/v3-chat-messages.ts` | 上下文GET，anchor/条数/升序/唯一性/游标严格校验 |
| `src/composables/useChatContext.ts` | 独立窗口、双向分页、原游标重试、身份/事件/迟到隔离 |
| `src/components/chat/ChatContextPanel.vue` | 当前清洗HTML/卡片摘要、定位高亮、翻页/重读/返回入口、移动布局 |
| `src/stores/v3ChatTimeline.ts` | 公开内部变更提示给上下文失效，清授权也清上下文旧数据 |
| `src/views/ChatroomView.vue` | 两套布局入口、路由hash定位及返回最新消息 |
| `src/composables/useChatQuoteNavigation.ts` | 成功与重复 hash 导航通知，取消/失败隔离，卸载清理 |
| `src/api/fishpi.ts` | 删除无消费者的旧fetchChatAround |
| `tools/v3-chat-context-test.mjs` | API/Pinia/composable/Vue：有界查询、身份隔离、迟到响应及内联窗口 |
| `tools/chat-context-browser-test.mjs` | 隔离网络的浏览器专项：实际页面与引用窗口滚动、路由和返回最新 |
| `tools/chat-quote-navigation-test.mjs` | 实际 Vue Router 的成功/重复/取消/拒绝导航及监听清理 |
| `AGENTS.md`、`docs/V3_MIGRATION.md`、`docs/api-v3-client-chat-context-work.md` | 架构/进度/本记录 |

后端仅文档：`AGENTS.md`、`UPDATE_LOG.md`、`docs/api-v3-progress.md`、`docs/api-v3-client-chat-context-work.md`。

## 2026-11-14 内联定位验证

- `node tools/v3-chat-context-test.mjs`：16 组通过，覆盖 ID 有界读取、前后分页、身份及迟到响应隔离、首次登录恢复、特殊消息与经典倒序。
- `node tools/chat-quote-navigation-test.mjs`：3 组通过，使用实际 Vue Router 验证重复 hash、导航失败/取消和卸载清理。
- `node tools/v3-chat-source-test.mjs`：15 组及小尾巴隔离通过，引用来源恢复和清洗行为未回退。
- `tools/chat-context-browser-test.mjs`：实际页面组件、API 解码器与路由，隔离 HTTP；经典/简约分别验证 1200、390、320px，真实目标 DOM 可见，无弹窗，返回复用内存历史。延迟图片、主动滚动解除定位、快速切换、重复 hash 和错误状态均通过。编辑器及身份使用本地夹具，未向真实站点写入数据。
- `npm run build`：类型检查、客户端和 SSR 构建通过。保留既有 FeedbackView 动静态导入构建警告。
- 另尝试旧 `tools/v3-messages-test.mjs`，在测试模块装载阶段被既有 `@/utils/avatar` data-URL 别名缺失阻断，未执行私信断言。本次引用导航由上述独立专项和浏览器检查覆盖，不把该旧专项记为通过。

浏览器专项可使用本地 Playwright：`PLAYWRIGHT_MODULE=/tmp/fishpi-animation-tools/node_modules/playwright/index.mjs node tools/chat-context-browser-test.mjs`。此次仅前端本地修改及提交，不修改 Rhythm、不部署或推送。

## 早期弹窗版本验证记录

以下是旧版窗口的历史记录，本轮内联定位验收以新增专项和本轮实际结果为准。

- 上下文13、历史16、撤回11、私信21、发送15、原文13、在线13、表态16、实时9、通知6、启动9，共142组通过，无异常测试输出。实际API/Pinia/Vue运行；HTTP、外部UI框架及滚动适配为测试替身。
- `corepack yarn run build` 类型及客户端/SSR构建通过；72个生成JS版本审计0命中，无map/sourceMappingURL/sourceURL，两仓库diff空白检查通过。
- IAB真实完整页+合成HTTP/实际WS：启动 `/cr#chatroom1600000000012` 恢复登录后定位最近窗口外的消息；初次失败/同步失效后重读显示原消息及邻居，前页503保窗口、原游标重试至边缘、390px重新定位/后页、返回最新清hash并关闭窗口通过，warn/error空。
- 截图 `/tmp/rhythm-v3-chat-context-mobile-proof.png`；仅合成读取，无真实消息、积分或账号变更。测试页和临时服务验后关闭。

## 完整人工测试

1. 登录进入 `/cr`，分别经典/简约点击引用，或者直接打开不在最近列表的 `/cr#chatroom{id}`。确认原消息区域显示目标前后各 5 条记录、目标高亮且在视口内，无对话框或遮罩；经典倒序、简约升序，不覆盖首页/浮窗的共享实时消息。
2. 读取前一页/后一页，检查 before/after 与对应游标、每次 10 条并替换而非无界追加；点击相同原引用也能重新定位。空历史边缘禁用对应方向、不丢当前窗口及非空游标。移动 390px 同测。
3. 模拟前页503，窗口不清、显示错误；重试仍为同方向同游标。模拟中心404或授权401/403，旧正文清除且显示原因，不假装已成功定位。
4. 慢读期间关闭、切另一消息、退出/换账号，旧页不回填。初次刷新Cookie恢复不应被当成换身份而抹掉深链接；普通同用户token轮换继续本人读取，不用旧apiKey。
5. 在上下文窗口中由另一开发会话修改/撤回可见消息，当前相关内容清空提示重读；无关ID保持当前窗口。读取期间新页成员变更也不能提交旧页。真实撤权/多节点事件和断线重同步需另行验证。
6. 点击回到最新消息，hash 消失、直接复用共享内存历史且无额外 GET；简约滚到末尾，经典定位列表顶部。浏览器后退/前进与引用链接在同页也能重新定位。读取期间实时消息不能把历史窗口推走。

## 安全与未验

只复用既有Bearer读取，无新增匿名路由/viewSkips、Cookie写、SQL、上传下载或远程抓取。ID/固定radius与分页有界，DTO白名单，卡片纯文本，普通HTML仅用已有服务端清洗字段；不展示原始存储信封。身份/目标/请求序号/事件冲突隔离防止迟到回填，不新增订阅或全表读取。无新CDN URL，构建完成版本与source map检查。

真实Java/MySQL可见性、账号撤权、跨实例事件/采样、服务端限流、BeforeRequestHandler黑名单/test/validateCaptcha/anonymous.viewSkips、生产CDN及目录枚举未运行验收；合成测试不证明这些安全项通过。未改Java/FTL，不需要本轮IDEA重编译；未运行Maven、未动APP、未提交推送。

禁言读取仍为旧链；红包/话题/弹幕/音乐/天气写及总清单其他客户端迁移和真实服务验收继续，全站v3目标未完成。
