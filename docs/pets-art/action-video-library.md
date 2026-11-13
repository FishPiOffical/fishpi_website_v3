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
| 摸摸獭 | 929,796 字节 | 174,442 字节 | 1.05 MiB |
| 鱼饼喵 | 1,241,689 字节 | 192,574 字节 | 1.37 MiB |
| 派小鱼 | 834,513 字节 | 149,762 字节 | 0.94 MiB |

四种宠物的透明视频总计 **3,996,038 字节（3.81 MiB）**。这是全部动作的素材量，不是一次页面打开的加载量；四种均已接入家园和桌宠，仅加载当前可见动作。以上数字已包含下述步态、节奏及吃鱼吊牌修正。

## 鱼饼喵吃鱼：项圈与食物分离

吃鱼源帧曾把金鱼吊牌和手持蓝鱼一起升到嘴边。本次使用内置 imagegen 修正遮挡，吊牌留在颈部，被食物挡住时自然隐藏，放下食物后露出。只重导出鱼饼喵 `eat`，仍为 256×256、64 帧 / 2.667 秒；视频 115,121 字节，其他 78 个 WebM/WebP 文件哈希不变，喝水动作保持原样。[提示词与来源](yubingmiao-animations-v1/sources/eat-collar-fix.md)、[编码检查](yubingmiao-animations-v1/eat-collar-validation.json)。5186 家园/桌宠及 5187 素材预览刷新即可使用，无须重启长跑服务。

## 当前节奏版：走路放慢，日常互动加快

本轮仅重排摸摸獭、鱼饼喵和派小鱼五项动作的停帧时间，不重绘、不补帧，也不修改播放器倍速。上次走路从 16 个原绘帧减为 8 个后仍各停 3 帧，导致整轮由 2 秒缩到 1 秒；其他短互动却保持了约 4～5 秒，这次分别校准。

| 动作 | 调整前 | 当前时长 | 节奏处理 |
| --- | ---: | ---: | --- |
| 外出行走 | 1.000 秒 | 1.500 秒 | 两次迈步各占 18 个时间轴帧，保持对称 |
| 吃东西 | 5.000 秒 | 2.667 秒 | 咀嚼稍停，缩短回到原姿势后的等待 |
| 饮水 | 5.083 秒 | 2.750 秒；鱼饼喵 2.792 秒 | 保留举杯饮水的停顿；鱼饼喵高点略晚 |
| 被摸摸 | 4.833 秒 | 2.667 秒 | 闭眼享受稍停，抬头与收尾更利落 |
| 玩耍 | 4.000 秒 | 2.333 秒 | 推球与回手加快，接触位置短暂停顿 |

待机、睡觉、上课、工作、庆祝及荷小豚整套原样保留。外出仍是八个原绘姿势，日常互动各十六个；输出为 24fps 时间轴，调速不会增加独立画面或自动消除源帧跳变。

刷新原 [本地预览](http://127.0.0.1:5187/)，也可直接看[新版三只行走对比](explore-walk-v4.mp4)。三只的整套 `overview.mp4` 已同步更新。当前素材检查见 [tempo-v4-validation.json](tempo-v4-validation.json)：15 段视频完整解码，帧数、透明通道与清单一致；其余 65 个媒体文件及 42 张源图哈希不变。浏览器逐页打开三套对比，30 段视频均可加载播放、倍速为 1、无媒体错误；当前仅为本地预览验收，不代表最终艺术验收或家园业务接入。

仅在隔离工作区更新素材与预览，未重启任何服务，也未改动原工作区、Rhythm、账号状态或八小时测试。

```sh
PET_FFMPEG=/absolute/path/to/ffmpeg node tools/pet-animation-export.mjs --species=momota explore eat drink pet play
node tools/pet-animation-preview.mjs --species=momota
PET_FFMPEG=/absolute/path/to/ffmpeg node tools/pet-explore-overview.mjs --version=4
```

另外两只使用各自的 `--species=yubingmiao` / `--species=paixiaoyu`；制作整套对比使用 `tools/pet-animation-overview.mjs`。

## 外出动作第三版：固定两条腿的身份与轨迹（原绘沿用，时长为历史）

站立第二版仍有源帧问题，并非播放器倒放：摸摸獭后半程没有完成第二条腿的前摆，鱼饼喵和派小鱼在经过姿势改变了近远腿的遮挡和颜色。逐格观察腿根到脚尖，比只对比首尾接触姿势更能发现这些错误。

本轮参考 [Animation Mentor 的步态关键姿势讲解](https://www.animationmentor.com/blog/tutorial-animating-human-walk-cycle/)，先以八个完整角色关键帧表达左右两次「接触、承重、经过、抬升」，而非继续堆叠不连贯的中间帧。自制[脚步轨迹指南](walk-foot-plan-v3.png)仅控制顺序和前后遮挡，不是宠物成图。近侧腿保持原色并始终在前，远侧整条腿保持自然阴影且位于后层；支撑脚相对身体由右向左，离地脚由左向右回摆。

三段当时为 4×2 / 8 原绘帧，各保持 3 个时间轴帧，合计 24 帧 / 1 秒。仍输出 256×256 透明 VP9 WebM，不做光流插值或身体拆分。八帧使用同一缩放和同一画布锚点，保留重心起伏，不再逐帧追着最低脚点移动整只角色。该次其余动作不变；当前时长以后续节奏版为准。

[第三版原速度并排行走](explore-walk-v3.mp4)与[当时的基本检查](explore-walk-v3-validation.json)仅保留历史；步态自然度仍以实际观看为准，不能用编码通过代替艺术验收。

三种角色的实际内置图像生成提示词与来源分别见：[摸摸獭](momota-animations-v1/sources/explore-v3.md)、[鱼饼喵](yubingmiao-animations-v1/sources/explore-v3.md)、[派小鱼](paixiaoyu-animations-v1/sources/explore-v3.md)。选用源图仍保存为各目录的 `sources/explore.png`，没有改动家园业务、Rhythm 或原八小时测试环境。

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

上述为素材制作阶段的历史验证范围。三种宠物现已接入家园及桌宠，复用荷小豚的成功确认、活动状态、减少动态效果与静态回退逻辑；喂食、饮水等仍更新养成状态，详见 [本地接入与验证](../pets-animation-all-species.md)。本轮没有重新编码视频或更换源帧。

所有修改位于 `website_v3-pet-next` 隔离工作区。没有修改、重启原 `pet` 工作区的前端和 Rhythm，没有触碰数据库、测试账号或正在执行的八小时测试；不部署、不推送。
