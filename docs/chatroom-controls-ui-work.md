# 聊天室工具栏、表情与清风侧栏（2026-11-06）

## 修改

- `src/views/ChatroomView.vue`：经典/简约共用同一组工具数据和线性图标，当前展开工具有选中态；话题通过context插槽独立单行展示，截断长话题，引用/编辑保持；窄屏工具只显示图标，保留可访问名称。不更改发红包、涂鸦、弹幕、音乐、天气及话题的业务/费用/恢复逻辑。
- `src/components/ChatComposer.vue`：工具和发送操作对齐，发送增加图标，支持独立话题行；接收并传递安全emoji标签。
- `src/components/MarkdownEditor.vue`：将已经过滤的Lute Unicode标签通过emoji-labels事件传出。根因是原来只有编辑器内部选择器得到这份映射，ChatComposer下方的独立选择器没有labels，因而显示`:smile:`等别名。只修正显示，原Markdown插入/服务端别名保持。
- `src/components/EmojiPicker.vue`：入口增加笑脸图标，支持外部点击和Escape关闭，关闭/身份变化/卸载拒绝迟到读取。
- `src/components/V3ReactionBar.vue`：聊天室入口只显示笑脸，中文留在title/aria-label；选中后自动收起并归还焦点，外部点击/Escape/滚动/窗口变化关闭。palette挂载后Teleport到body，避免滚动容器和悬浮窗裁切，按视口边界定位；继续用v-show保留按钮DOM，写入仍走原明确选择/原键恢复/当前GET链路，不用历史回执拼状态。
- `src/components/breezemoons/BreezemoonList.vue`、`BreezemoonPanel.vue`、`src/components/sidebar/BreezemoonFeed.vue`及`src/chat/sidebar/modules/BreezemoonsModule.vue`：增加avatarOnly展示，聊天室侧栏启用头像+内容双列；可见昵称/时间隐藏，头像主页链接与资料卡数据保留，普通清风列表默认不变。

## 验证

- 类型检查、客户端和SSR完整构建；完整v3专项105脚本通过。
- 编辑器专项新增实际ChatComposer+MarkdownEditor+EmojiPicker组合验证：下方选择器显示😄/❤️而不是别名，点击仍插`:smile:`。表态专项使用真实Teleport测试宿主，验证选择后收起、原写入/当前GET、未知原键恢复及异步按钮DOM保留；音乐/天气接线断言适配共享工具循环，真实业务专项保留。
- 实际浏览器使用本机HTTP/WS夹具和真实CDN Vditor：经典/简约切换、真实Unicode表情面板、选择表态自动收起、外部/Escape关闭、头像内容侧栏；390px窄屏检查工具行，无横向溢出，结束恢复默认视口。表态写入仅落本机夹具，没有向真实聊天室发消息或表态。
- 浏览器截图：`/tmp/fp-chat-controls-final.png`、`/tmp/fp-chat-controls-mobile.png`。夹具路由仅提供聊天室，因此资料/收藏等未配置导航会有Vue Router警告，不冒称全站导航或真实账号写链验收通过。

## 人工验收

1. 登录进入`/cr`，检查经典模式下工具行、话题单行/长文本省略、发送状态；切换简约模式，未发送草稿应保留，工具能展开对应原面板。取消面板即可，不需要真实收费操作。
2. 点击编辑器下方“表情”，检查常用项为实际emoji；选择后编辑器得到原别名及可视渲染，图片区仍保留真实图片/签名URL，未加载/失败应明确提示。
3. 点击任一消息笑脸，选择表情后自动收起，计数由当前GET更新；再次打开后点外部、按Escape、滚动均关闭。弱网/失败时仍能恢复同次原键，不应重复提交。
4. 右侧清风仅有头像+内容，无可见姓名/时间；头像链接/资料卡仍可使用，完整清风页维持原作者和时间。检查长文本/图片、深浅主题、窄屏图标名称和键盘焦点。
