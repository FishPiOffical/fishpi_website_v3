# 摸鱼派用户站（Vue 重构）

用户站 SPA，不含管理后台。后端仍为 [Rhythm](https://github.com/FishPiOffical/rhythm)。

```bash
npm install
npm run dev
```

开发服务器固定 `http://127.0.0.1:5173`，占用时请先结束旧进程，不会自动换端口。

开发代理默认指向 `https://fishpi.cn`。若本地 Rhythm 在 `8080`，在 `.env.development` 设置：

```
VITE_API_TARGET=http://localhost:8080
```

本站优先请求 Rhythm JSON；匿名列表/详情/搜索/领域/广告若 401 或 404，回退到 `src/api/catalog.mock.json` / `ads.mock.json`（字段与正式接口对齐）。登录后仍走真实 API。

## 已实现

- 顶栏 / 首页双栏 / 登录 / 聊天室
- 帖子列表、详情、评论、发帖/编辑、点赞/感谢、收藏/关注帖、打赏
- 标签、点赞列表、评论分页/删除、徽章
- 用户主页、关注/粉丝、签到/昨日活跃、通知分页、私信撤回
- 清风明月（可匿名）
- 资料编辑、头像/发帖图片上传、表情包、积分转账与流水
- 我的收藏、聊天室多类型红包/领取明细/撤回/@ 补全
- 主题、对话框、头像框：`src/packs` 目录包
- 广告位 mock：`home.top` `footer.sponsors` `home.sidebar`，`GET /api/ads` 有数据时自动替换
- 聊天室侧边栏模块化

新增侧边栏模块：在 `src/chat/sidebar/modules` 加组件，并登记到 `registry.ts`。
