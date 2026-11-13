# 四种宠物动作素材

2026-11-13。本批继续制作摸摸獭、鱼饼喵和派小鱼的动作视频，沿用荷小豚的 2D、固定机位、小幅动作及 256 × 256 透明 WebM 规格。派小鱼使用已确认的新版坐姿比例。

## 本地预览

在当前隔离工作区运行：

```sh
node tools/pet-animation-serve.mjs
```

打开 <http://127.0.0.1:5187/>，可切换宠物及动作。服务仅提供预览 HTML、视频、海报与素材清单，没有 API 代理，不使用账号，也不会修改宠物状态。端口被占用时直接报错；不会停止其他进程。

每只宠物包含待机、进食、喝水、被摸摸、玩耍、睡觉、外出、上课、工作、庆祝十项。预览默认只加载所选视频，点击「同时对比全部动作」才加载整套；切到后台暂停播放。浅底 MP4 总览只用于快速看效果，游戏分发素材仍为透明 WebM。

- [荷小豚](hexiaotun-animations-v1/preview.html)：现有十项，原吃叶子版本保持不变。
- [摸摸獭](momota-animations-v1/preview.html)
- [鱼饼喵](yubingmiao-animations-v1/preview.html)
- [派小鱼](paixiaoyu-animations-v1/preview.html)

## 实际大小

本批新增三种宠物 30 段视频；连同原荷小豚，共 40 段。以下数字来自实际文件，不包含源帧、提示词、JSON 清单和额外 MP4 总览。

| 宠物 | 透明视频 | 静态预览 | 视频与静态预览合计 |
| --- | ---: | ---: | ---: |
| 荷小豚（原有） | 990,040 字节 | 145,814 字节 | 1.08 MiB |
| 摸摸獭 | 992,863 字节 | 178,306 字节 | 1.12 MiB |
| 鱼饼喵 | 1,464,353 字节 | 199,474 字节 | 1.59 MiB |
| 派小鱼 | 896,812 字节 | 151,878 字节 | 1.00 MiB |

四种宠物的透明视频总计 **4,344,068 字节（4.14 MiB）**。这是全部动作的素材量，不是一次页面打开的加载量；新增动作暂未接入家园。

## 制作方式

源帧使用内置 imagegen 生成，各宠物 `sources/*.md` 保存实际提示词、参考路径及来源文件名，`sources/*.png` 保存原始透明帧表。不调用外部生成接口。

每个动作是 4 × 4 的 16 张完整角色帧；仅分离帧、等比例缩放与对齐，随后按停留时长编码为 24fps。没有光流补帧、骨骼拆分或肢体拉伸，24fps 不代表每秒 24 张新绘制帧。

```sh
# FFmpeg 需包含 libvpx-vp9、libwebp；完整角色帧已生成后再执行。
PET_FFMPEG=/absolute/path/to/ffmpeg node tools/pet-animation-export.mjs --species=momota
node tools/pet-animation-preview.mjs --species=momota
PET_FFMPEG=/absolute/path/to/ffmpeg node tools/pet-animation-overview.mjs --species=momota
```

`--species` 支持 `hexiaotun`、`momota`、`yubingmiao`、`paixiaoyu`，默认仍为荷小豚。导出命令末尾可加 `idle eat` 等动作 ID；不同宠物使用独立临时目录，同一宠物顺序导出。荷小豚已认可的吃叶子文件不会被重新编码。MP4 总览默认使用 macOS 黑体，可通过 `PET_FONT` 指定其他中文字体。

## 验收边界

按本轮要求先完成动作素材，统一检查放到最后。编码、透明通道及文件可读取的检查不能代替动作自然度的人工验收；帧间轮廓与首尾衔接仍需在实际播放中统一确认。

本批已做源帧布局、视频编码/解码、256 × 256 尺寸、透明像素与文件大小的基本检查，结果见 [摸摸獭](momota-animations-v1/validation.json)、[鱼饼喵](yubingmiao-animations-v1/validation.json) 和 [派小鱼](paixiaoyu-animations-v1/basic-validation.json) 的检查记录。独立静态预览和视频返回 200，API 路径拒绝访问。制作工具已通过 Node 语法检查。本批没有运行应用类型检查、构建或完整浏览器/业务测试，`src/` 没有改动。

荷小豚原吃叶子视频 SHA-256 仍为 `1abf196eccbdc07919668b92f321e7d4aad2b412094c5e1ec63011ccf149af31`，没有重新生成或改为补帧版本。

本批新增的三种宠物尚未接入家园或桌宠的动作注册表。后续接入应复用荷小豚现有的成功回执触发、活动状态、减少动态效果与静态回退逻辑，不以播放动画替代喂食、饮水等状态更新。

所有修改位于 `website_v3-pet-next` 隔离工作区。没有修改、重启原 `pet` 工作区的前端和 Rhythm，没有触碰数据库、测试账号或正在执行的八小时测试；不部署、不推送。
