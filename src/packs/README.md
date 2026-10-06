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

站点主题免费。对话框与头像框除默认包外标记 `"vip": true`，开通会员后才能应用。
