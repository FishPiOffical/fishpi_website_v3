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
| 摸摸獭 | 944,475 字节 | 174,442 字节 | 1.07 MiB |
| 鱼饼喵 | 1,296,283 字节 | 193,430 字节 | 1.42 MiB |
| 派小鱼 | 851,691 字节 | 149,762 字节 | 0.96 MiB |

四种宠物的透明视频总计 **4,082,489 字节（3.89 MiB）**。这是全部动作的素材量，不是一次页面打开的加载量；新增动作暂未接入家园。以上数字已包含下述外出动作修正。

## 外出动作第三版：固定两条腿的身份与轨迹

站立第二版仍有源帧问题，并非播放器倒放：摸摸獭后半程没有完成第二条腿的前摆，鱼饼喵和派小鱼在经过姿势改变了近远腿的遮挡和颜色。逐格观察腿根到脚尖，比只对比首尾接触姿势更能发现这些错误。

本轮参考 [Animation Mentor 的步态关键姿势讲解](https://www.animationmentor.com/blog/tutorial-animating-human-walk-cycle/)，先以八个完整角色关键帧表达左右两次「接触、承重、经过、抬升」，而非继续堆叠不连贯的中间帧。自制[脚步轨迹指南](walk-foot-plan-v3.png)仅控制顺序和前后遮挡，不是宠物成图。近侧腿保持原色并始终在前，远侧整条腿保持自然阴影且位于后层；支撑脚相对身体由右向左，离地脚由左向右回摆。

三段当前为 4×2 / 8 原绘帧，各保持 3 个时间轴帧，合计 24 帧 / 1 秒。仍输出 256×256 透明 VP9 WebM，不做光流插值或身体拆分。八帧使用同一缩放和同一画布锚点，保留重心起伏，不再逐帧追着最低脚点移动整只角色。其余动作不变。

[查看第三版并排行走](explore-walk-v3.mp4)，或刷新原本的 5187 预览，选择「外出」。[本轮基本检查](explore-walk-v3-validation.json)核对实际编码帧、透明通道、固定锚点及其他动作文件哈希；步态自然度仍以实际观看为准，不能用编码通过代替艺术验收。

三种角色的实际内置图像生成提示词与来源分别见：[摸摸獭](momota-animations-v1/sources/explore-v3.md)、[鱼饼喵](yubingmiao-animations-v1/sources/explore-v3.md)、[派小鱼](paixiaoyu-animations-v1/sources/explore-v3.md)。选用源图仍保存为各目录的 `sources/explore.png`，没有改动家园业务、Rhythm 或原八小时测试环境。

```sh
PET_FFMPEG=/absolute/path/to/ffmpeg node tools/pet-explore-overview.mjs --version=3
```

## 外出动作第二版（历史）

首版外出的提示词错误地保留了参考图的坐姿和摊开的后脚，导致看起来只是坐着抬腿。此次仅重绘这三只宠物的 `explore`：先确定站立姿势，再用站姿参考生成步行连续帧。臀腹离地、短脚位于身体下方，采用朝右的侧向视角，双脚交替支撑及向前摆动；派小鱼用自然深浅阴影区分前后腿，避免同一条腿反复后勾。

三段仍为 256 × 256 透明 WebM，16 张完整角色帧各停留 3 个时间轴帧，合计 48 帧 / 2 秒；不补光流帧、不拆分身体。荷小豚的外出节奏保持原样。

[查看第二版历史预览](explore-walk-v2.mp4)。这个 6 秒浅底 MP4 保留作对照，当前素材已由第三版替换。

[本次文件核验](explore-walk-v2-validation.json) 确认仅三份外出视频及其海报改变，其他 74 个视频/海报文件的 SHA-256 保持不变。三段各 48 帧均可解码并保留透明通道。三种宠物的预览和总览已同步更新，整体人工验收仍留待后续；本轮没有修改家园交互、服务端或原长跑环境。

## 制作方式

源帧使用内置 imagegen 生成，各宠物 `sources/*.md` 保存实际提示词、参考路径及来源文件名，`sources/*.png` 保存原始透明帧表。不调用外部生成接口。

除第三版外出的 4×2 / 8 帧以外，其余动作是 4×4 / 16 张完整角色帧；仅分离帧、等比例缩放与对齐，随后按停留时长编码为 24fps。没有光流补帧、骨骼拆分或肢体拉伸，24fps 不代表每秒 24 张新绘制帧。

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
