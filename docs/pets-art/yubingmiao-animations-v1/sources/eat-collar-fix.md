# 鱼饼喵吃鱼：吊牌遮挡修正

2026-11-13，内置 imagegen 编辑模式，透明背景；未使用 CLI/API fallback。最终素材保存为本目录 `eat.png`，视频为 `public/images/pets/animations/yubingmiao-v1/eat.webm`。

原图第 3～8 格把蓝项圈和金鱼吊牌随食物一起抬到嘴边。喝水图的层次正确，因此用它核对颈部位置；最终吃鱼图中，蓝鱼在前，项圈与吊牌在后，被遮住时不另画一枚吊牌，也不下移到腹部。

## 来源与取舍

- 原始编辑目标：本目录 `eat.png` 的旧版本；身份参考为 `public/images/pets/yubingmiao.webp`，位置参考为 `sources/drink.png`，均先查看后编辑。
- 首次分离项圈与食物的输出 `exec-f8070c75-c46e-4374-8d26-588a9c2d8405.png` 出现重复吊牌，不采用为最终稿。
- 换用喝水图替换道具的输出 `exec-b701a35b-f306-4a80-a2ba-1a601076ec5c.png` 中段仍残留杯子，弃用。
- 对首次编辑去除重复吊牌后得到 `exec-df6167cb-d71d-4ed7-9e15-34a6f9d5598a.png`。该稿第 4～10 格吊牌位置偏低，继续修正为自然遮挡。
- 最终输出：`exec-18502e04-07e2-43f9-9251-a28e55599154.png`，来自 `/Users/ling/.codex/generated_images/01a12364-3187-7f71-b221-8b55c133d4bd/`，已复制到项目。本地中间候选不作为项目消费资源。

## 最终精修完整提示词

输入为上述 `exec-df6167cb-d71d-4ed7-9e15-34a6f9d5598a.png`。

```text
Precise final cleanup. Keep this same 4x4 transparent animation sprite sheet, all poses, fish, paws, eyes, mouths, head/body proportions and palette unchanged.

In ONLY these SEVEN cells: row1column4; row2columns1,2,3,4; row3columns1,2 — erase the small YELLOW fish floating on the lower chest/belly BELOW the blue fish. Fill that tiny area with the surrounding cream fur. Do not draw any replacement yellow object in these seven cells. The neck pendant is naturally HIDDEN BEHIND the lifted blue fish and forepaws in these poses. Do not reposition it lower to make it visible. Hidden is correct. Keep blue collar fragments at the base of the neck if visible, never raise them toward the mouth.

All other NINE cells unchanged, INCLUDING their visible yellow fish pendant correctly attached to their neck collar. In particular row1col1/2/3, row3col3/4, row4all4 keep their gold necklace pendants at the collar.

This is a minimal object removal edit in exactly seven cells. Do NOT add props or edit food. Larger blue fish stays complete and blue, held by exactly two paws. Do not remove any blue fish or paws. Same16frame grid and transparent alpha.
```

## 导出与验证

继续使用既有导出工具，仅指定 `--species=yubingmiao eat`，保持十六个原绘姿势、原停帧节奏和 24fps 时间轴，不补帧、不调播放器倍速。同步更新本宠物的 `preview.html` 和 `overview.mp4`。

输出 256×256、64 帧 / 2.667 秒、115,121 字节；全帧可解码且保留透明通道。其他 78 个 WebM/WebP 哈希不变，包括喝水及其他宠物。详细结果见 [eat-collar-validation.json](../eat-collar-validation.json)。图像逐格检查与实际播放仍需用户最终确认自然度。

`node tools/pet-animation-browser-test.mjs` 已通过 30 组检查：新吃鱼视频在家园与桌宠播放正常，喂食仍更新状态且只有一次写入与一次聚合读取，全部四十段媒体无意外加载失败或运行时异常。报告为 `.temp/pet-animation-browser/report.json`。本轮仅美术资产与文档变动，未额外重复应用构建或业务专项。

仅在 `website_v3-pet-next` 隔离工作区修改；未更改原工作区、Rhythm、数据库或八小时测试服务。5186/5187 使用 `no-store` 静态预览，刷新即可获取新素材。
