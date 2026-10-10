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

- 优先使用 Rhythm JSON 接口，不在运行时抓取现网 HTML 拼装数据。
- 缺失接口先查 docs/MISSING_APIS.md；已有占位数据集中在 gaps.mock.ts。
- 用户发帖、收藏、关注、粉丝、通知、私信等列表接口失败时返回空列表，
  不用模拟记录冒充真实数据。
- 用户悬浮卡片加载失败应展示错误状态，不回退到模拟用户资料。
- 浏览器复用 localStorage 中的 fp.apiKey；脚本复用缓存或 FP_API_KEY。
- 不反复调用密码登录接口；不要把密码、API Key、Cookie 写入源码或日志。
- 需要页面认证的写操作沿用现有 page-auth、sym-ce 与 csrfToken 链路。
- 浏览器验证默认只读；不要为测试随意发帖、转账或修改真实账号资料。

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
- 未经用户要求不自动提交、推送或发布。
- Git 提交禁止包含 Cursor 的 Co-authored-by 标记，
  包括 Co-authored-by: Cursor <cursoragent@cursor.com>。
- 提交后核对实际提交信息及工作区状态。

## 进一步参考

- README.md：启动、认证、SSR、功能范围与部署说明。
- docs/MISSING_APIS.md：现网接口缺口及替代方案。
- src/packs/README.md：外观包格式与稳定样式钩子。