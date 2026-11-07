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

新免费包仅作用于 `.fp-msg.is-room`；单独图片/红包不附加气泡背景与徽记。当前 `fp.appearance` 为本机阅读外观，选择会影响本机看到的全部聊天室消息，并未保存发送者个人外观。
