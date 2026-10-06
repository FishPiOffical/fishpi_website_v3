# 摸鱼派用户站（Vue 重构）

用户站 SPA，不含管理后台。后端仍为 [Rhythm](https://github.com/FishPiOffical/rhythm)。

```bash
npm install
npm run dev
```

开发代理默认指向 `https://fishpi.cn`。若本地 Rhythm 在 `8080`，在 `.env.development` 设置：

```
VITE_API_TARGET=http://localhost:8080
```

本站**只走 JSON API**，不再解析旧站 HTML。现网 `/api/articles/recent*`、`/api/article/{id}`、`/api/top/*` 仍需登录；游客会看到登录引导。关闭 FTL 前请在 Rhythm 放开匿名读接口。

## 已实现

- 顶栏 / 首页双栏 / 登录 / 聊天室
- 帖子列表、详情、评论（需登录）
- 清风明月（可匿名）
- 主题、对话框、头像框：`src/packs` 目录包
- 广告位 mock：`home.top` `footer.sponsors` `home.sidebar`
- 聊天室侧边栏模块化

新增侧边栏模块：在 `src/chat/sidebar/modules` 加组件，并登记到 `registry.ts`。
