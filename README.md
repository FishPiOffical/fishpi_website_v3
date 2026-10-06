# 摸鱼派用户站（Vue 重构 P0）

用户站 SPA，不含管理后台。后端仍为 [Rhythm](https://github.com/FishPiOffical/rhythm)。

```bash
npm install
npm run dev
```

开发代理默认指向 `https://fishpi.cn`。若本地 Rhythm 在 `8080`，在 `.env.development` 设置：

```
VITE_API_TARGET=http://localhost:8080
```

## P0

- 顶栏 / 首页双栏 / 登录 / 聊天室
- 主题、对话框、头像框：`src/packs` 目录包，点选即切
- 对话框与头像框进阶包标记 VIP
- 广告位 `home.top` `footer.sponsors` `home.sidebar`，接口未就绪时用 mock
- 聊天室侧边栏模块化：显示/隐藏、排序，配置存在 localStorage

新增侧边栏模块：在 `src/chat/sidebar/modules` 加组件，并登记到 `registry.ts`。
