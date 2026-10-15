# 摸鱼派 Web v3 — UI 视觉设计规范 (`UI_VISUAL_GUIDE.md`)

本文档定义全站统一的现代风 UI 视觉体系，涵盖设计令牌（Design Tokens）、色彩语义、按钮规范、表单与 Switch 滑动开关、弹窗交互、内页双栏与模块化侧边栏约定。新增或维护页面与组件时请优先复用下述变量与类名，避免编写硬编码颜色或私有重复样式。

---

## 1. 色彩与主题令牌（Design Tokens）

全局令牌定义在 `src/styles/base.css`，并由主题包（`src/packs/themes/classic-dark/style.css` 与 `src/packs/themes/classic-light/style.css`）按 `html[data-theme="<id>"]` 覆盖。

| 变量名 | 用途说明 | Classic Dark（默认深色） | Classic Light（浅色） |
| --- | --- | --- | --- |
| `--fp-bg` | 页面主背景色 / 输入框底色 | `#282a2a` | `#f5f6f8` |
| `--fp-nav` | 顶部导航栏背景 | `#242525` | `#ffffff` |
| `--fp-card` | 模块卡片与面板背景 | `#282a2a` | `#ffffff` |
| `--fp-elevated` | 浮层/二级抬升表面背景 | `#2f3232` | `#f9fafb` |
| `--fp-title` | 一级标题、强调正文 | `#ddd7cc` | `#1f2329` |
| `--fp-text` | 常规正文颜色 | `#cbc5ba` | `#2c2e33` |
| `--fp-head` | 模块小标题、副导航文字 | `#aca396` | `#555962` |
| `--fp-muted` | 次要说明、时间戳、占位提示 | `#9e9689` | `#767b85` |
| `--fp-primary` | 品牌主色（主按钮、Switch 开启态、聚焦高亮） | `#69aa69` | `#60b044` |
| `--fp-primary-hover` | 品牌主色悬停态 | `#5b9a5b` | `#529c38` |
| `--fp-primary-soft` | 品牌主色浅底高亮 | `rgba(105, 170, 105, 0.15)` | `rgba(96, 176, 68, 0.12)` |
| `--fp-accent` | 强调色（徽章、打赏、活跃点缀） | `#e59230` | `#e59230` |
| `--fp-accent-hover` | 强调色悬停态 | `#cf8024` | `#cf8024` |
| `--fp-danger` | 危险/警示色（删除、解绑、错误提示） | `#d9534f` | `#dc2626` |
| `--fp-danger-hover` | 危险色悬停态 | `#c6433f` | `#b91c1c` |
| `--fp-link` | 链接色 | `#5c9fdf` | `#3b82f6` |
| `--fp-border` | 常规分割线与边框 | `rgba(255, 255, 255, 0.08)` | `#e6e8ec` |
| `--fp-border-strong` | 控件悬停边框、弹窗外框 | `rgba(255, 255, 255, 0.16)` | `#d0d5dd` |
| `--fp-hover` | 列表项与次级按钮悬停背景 | `rgba(255, 255, 255, 0.05)` | `#f3f5f8` |
| `--fp-control-bg` | Switch 关闭态轨道底色 | `rgba(255, 255, 255, 0.14)` | `#d5d9e0` |
| `--fp-focus-ring` | 键盘与表单控件聚焦光环 | `0 0 0 3px rgba(105, 170, 105, 0.22)` | `0 0 0 3px rgba(96, 176, 68, 0.2)` |

### 圆角与阴影令牌

- `--fp-radius-sm: 6px`：按钮、小徽标、小号控件
- `--fp-radius-md: 8px`：输入框、下拉框、单选/开关行容器
- `--fp-radius-lg: 10px`：内容卡片（`.module` / `.card`）、下拉菜单
- `--fp-radius-xl: 14px`：模态弹窗（`FpDialog`）、侧边设置抽屉（`SettingsDrawer`）
- `--fp-card-shadow`：常规卡片轻量阴影
- `--fp-dialog-shadow`：模态窗与浮层高阶阴影
- `--fp-mask-bg`：模态弹窗背景遮罩色（配合 `backdrop-filter: blur(6px)`）

---

## 2. 按钮规范（现代风）

全站统一使用克制现代风按钮，取消旧版 `.btn:hover` 的 `scale(1.02)` 放大跳动，统一采用边框、背景色平滑过渡与轻柔光晕投影。

- **基础按钮**：`<button class="fp-btn">` 或 `<button class="btn">`
- **主按钮（绿色）**：`class="fp-btn fp-btn--primary"` 或 `class="btn green"`
- **强调按钮（橙色）**：`class="fp-btn fp-btn--accent"` 或 `class="btn orange"`
- **危险按钮（红色）**：`class="fp-btn fp-btn--danger"` 或 `class="btn danger"`
- **次级/幽灵按钮**：`class="fp-btn fp-btn--ghost"` 或 `class="btn ghost"`
- **小尺寸按钮**：叠加 `fp-btn--sm` 或 `small`

---

## 3. 表单控件、Switch 滑动开关与单选框

### 3.1 Switch 滑动开关与复选框 (`input[type="checkbox"]`)

- 全站 `<input type="checkbox">` 在 `src/styles/base.css` 中默认基于 `appearance: none` 渲染为 **36×20px 现代胶囊 Switch 滑动开关**：
  - 未选中态采用 `--fp-control-bg` 与 `--fp-border-strong`
  - 选中态平滑过渡至 `--fp-primary`，圆点滑块（`14×14px`）向右平移 `16px`
  - 支持 `:focus-visible` 聚焦光环与 `:disabled` 禁用态
- 若特定场景需要传统方形打勾复选框，可为元素添加 `.fp-checkbox` 类名（`<input type="checkbox" class="fp-checkbox" />`）。
- **注意事项**：页面级 `<style scoped>` 中为文本输入框编写样式时，请使用 `.fp-input` 或 `input:not([type='checkbox']):not([type='radio']):not([type='file'])`，避免覆盖全局 Switch 宽高与圆角。

### 3.2 单选框 (`input[type="radio"]`)

- 全站 `<input type="radio"]` 默认渲染为 **16×16px 现代圆形单选框**，选中时内部 `8×8px` 主色圆点带弹性缩放动效（`cubic-bezier(0.34, 1.56, 0.64, 1)`）。
- 搭配胶囊或卡片标签（如 `src/components/ReportDialog.vue` 中的 `.kind-option`）时，保留单选框圆点指示器与选中态背景联动。

### 3.3 输入框、下拉框与多行文本 (`.fp-input`)

- 统一使用 `class="fp-input"`，内边距 `8px 12px`、圆角 `--fp-radius-md (8px)`、聚焦态自动应用 `--fp-primary` 边框与 `--fp-focus-ring` 光环。

---

## 4. 弹窗体系与命令式确认框

全站禁止直接使用浏览器原生 `window.confirm()`、`window.prompt()` 或 `window.alert()`。

1. **声明式弹窗组件**：使用 `src/components/FpDialog.vue`
   - 支持 `title`、`width`、`tone="default | danger"`、`persistent`、`closable`、`layer="base | top"`。
   - 具备毛玻璃背景遮罩（`backdrop-filter: blur(6px)`）、`14px` 圆角、`Escape` 键关闭与进出场过渡。
2. **命令式确认/输入弹窗**：使用 `src/composables/useDialog.ts`（由挂载在 `src/layouts/AppShell.vue` 中的 `src/components/FpConfirmHost.vue` 承载渲染）
   - **确认弹窗**：`fpConfirm({ title, message, confirmText, tone })`
   - **输入弹窗**：`fpPrompt({ title, message, defaultValue, placeholder, confirmText })`

---

## 5. 内页双栏结构与模块化侧边栏规范

### 5.1 统一双栏页面骨架

所有内容流与列表型内页（包括热门 `/hot`、问答 `/qna`、优选 `/perfect`、专栏 `/column`、总榜 `/top`、清风明月 `/breezemoons`、同城 `/city/:cityName`、领域 `/domains`、标签 `/tags`、关注 `/watch`）统一采用双栏栅格结构：

```html
<div class="wrapper list-page-wrap">
  <div class="content">
    <div class="module">
      <div class="module-header list-page-head">
        <div class="head-left">
          <h2>页面标题</h2>
          <span class="sub-tag">副标题说明</span>
        </div>
        <div class="head-right">
          <span class="total-count">计数或页码</span>
        </div>
      </div>
      <!-- 主体列表内容 -->
      <!-- 底部分页栏 .pagination-bar -->
    </div>
  </div>
  <div class="side">
    <SideBar />
  </div>
</div>
```

### 5.2 模块化内页右侧栏 (`SideBar.vue` & `usePageSidebarStore`)

- **状态与持久化**：维护在 `src/stores/pageSidebar.ts`（持久化键 `fp.pageSidebar.v1`）。
- **支持模块**：
  - `profile`：我的资料（默认开启）
  - `checkin`：今日活跃与签到（默认开启，登录态展示）
  - `download`：客户端下载（默认开启）
  - `breezemoons`：清风明月（默认开启）
  - `income`：上下班时间（可选开启）
  - `appearance`：外观主题（可选开启）
  - `barrage`：弹幕花费（可选开启）
  - `ad`：社区赞助（可选开启）
- **交互与配置入口**：
  - 每个侧栏模块均采用 `.module.side-module-card` 卡片容器，支持点击标题栏独立折叠/展开。
  - 侧栏顶部提供「配置模块」快捷按钮，点击直接唤醒左侧设置抽屉（`SettingsDrawer.vue`）的 **「📑 内页侧栏」** 面板，支持 Switch 滑动开关显隐、拖拽/箭头排序与一键预设（精简 / 全部显示 / 恢复默认）。
