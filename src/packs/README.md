# 外观包约定

每个包一个目录，放入 `src/packs/{themes|bubbles|frames}/<id>/`：

- `pack.json`：`id` `kind` `name` `vip` `preview`
- `style.css`：只覆盖 CSS 变量和文档里的稳定选择器
- 不要写 JavaScript

```json
{
  "id": "candy",
  "kind": "bubble",
  "name": "糖果",
  "vip": true,
  "preview": "linear-gradient(#ff9ec7,#fff)"
}
```

## 钩子

| 类型 | 根属性 | 选择器 |
| --- | --- | --- |
| 主题 | `html[data-theme="id"]` | `--fp-bg` `--fp-nav` `--fp-card` `--fp-text` `--fp-muted` `--fp-primary` `--fp-link` `--fp-border` |
| 对话框 | `html[data-bubble="id"]` | `.fp-msg` `.fp-bubble` `.fp-msg.is-self` |
| 头像框 | `html[data-frame="id"]` | `.fp-avatar` `.fp-avatar-frame` |

站点主题免费。对话框与头像框按各包 `vip` 字段判断权限；免费包使用 `"vip": false`，VIP 包使用 `"vip": true`。派派橘（`paipai-orange`）与摸鱼蓝（`fishpond-blue`）各提供一款免费气泡和头像框，复用原始 `/logo.png`，不改写品牌资产。

新免费包仅作用于 `.fp-msg.is-room`；单独图片/红包不附加气泡背景与徽记。主题仍为本机偏好；聊天室气泡与头像框由本人 v3 配置决定，仅固化到之后发送的消息。历史不随换装更新，详见 `docs/chat-appearance-sync-plan.md`。消息使用 `.fp-msg[data-appearance-snapshot="v1"][data-bubble="id"]` / `[data-frame="id"]`，本机 html 外观仅作用于无快照节点。v1 样式必须保持稳定；未来改版新增版本并保留旧版样式。

积分包增加 `"points": true`，不在免费/VIP 列表直接应用，通过外观商城购买后走服务器权益校验。当前版本提供三个气泡与三个头像框；价格、有效期及装备链路见 `docs/appearance-shop-integration.md`。素材预览与历史消息都使用同一稳定 v1 样式钩子。
