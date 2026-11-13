# 派小鱼静态形象重绘

日期：2026-11-13。用户要求：动画开始前调整派小鱼，解决与另外三只宠物比例不协调的问题。

## 来源与输出

- 工具模式：内置 `image_gen.imagegen`，参考图片重绘，`transparent_background: true`。
- 第一张参考为项目原 `public/images/pets/paixiaoyu.webp`，来自用户提供的派小鱼素材包；其他参考依次为 `hexiaotun.webp`、`momota.webp`、`yubingmiao.webp`。
- 原始生成文件：`exec-3b3d006c-f2aa-47f6-8ba3-a7bacc14ef69.png`，已保存为同目录的 `paixiaoyu-v2.png`，1254 × 1254 RGBA。
- 生产文件：`public/images/pets/paixiaoyu.webp`，256 × 256，12,926 字节，保留透明通道。
- 技术导出：浏览器 Canvas，开启高质量平滑，`drawImage(image, 3, 1, 250, 250)`，`toDataURL('image/webp', 0.88)`。只做等比例尺寸规范化和格式转换。
- 此版仅静态形象，没有新增动画或修改宠物业务逻辑；通过现有共用路径更新所有宠物展示。

## 实际生成提示词

```text
Use case: style-transfer / character redesign. Asset type: ONE transparent 2D companion pet portrait for an existing browser game. Redraw ONLY the orange fish mascot 派小鱼 from image 1, in the exact warm illustrated family/style and substantial chibi body proportions of images 2, 3 and 4. Image 1 is the character identity reference and edit target; images 2–4 are style, pose, visual weight, framing and shared baseline references, DO NOT include those animals in the output. Preserve recognizable identity: rich warm orange fish body, white three-lobed little paw-like cap with three pale pink pads seated directly on top of its head, cute cheerful curved eyes and small w-shaped smile, two short flipper arms, a short fish tail and two small rounded lower fin/feet. Give it a large rounded head/body and a comfortably plump seated resting pose, in a subtle three-quarter view turned a little to the right like the reference pets. Arms calmly held against its body; clear simple readable silhouette and correct anatomy, no additional hands or legs. Keep it recognizably a fish mascot, not a cat, otter or human. Match the warm dark brown organic outlines (not harsh thick black sticker outlines), gentle peach/orange shaded volume, soft rosy cheeks, hand-drawn cartoon illustration finish, restrained cel shading and soft tiny ground shadow of the other three pets. It should be designed as a companion pet, with equivalent visual mass to the capybara, not the little jumping sticker. Composition: square canvas; one single full-body pet centered, entire cap/body/feet/tail visible. Including its cap, solid connected character fills about 90–92% of canvas height and 78–86% of width; head top around 5%, resting baseline about 95% from top; same generous visible body size as the references. NO huge empty space above, NO stretching, NO cropping. Actual transparent background, preserving opaque white cap. Small subtle warm ground shadow only. Remove floating stars, motion marks, sparkles and any unrelated decorations. No text, letters, labels, watermark, border, UI, accessories, leaf or held objects. Deliver only the redesigned single orange fish pet, not a comparison sheet, no website screenshot.
```

## 核对结果

四张生产素材均为 256 × 256，透明画布、等比例显示。以 alpha ≥ 128 统计主体边界，新派小鱼为 `(35, 10)–(222, 243)`；另外三只底边为 244。浏览器并排检查了正常卡片尺寸与 44px 缩略显示，头顶和落脚线协调，帽子、笑脸和尾鳍在缩略尺寸下仍可辨认。

仅替换静态资源并记录美术来源，未执行应用构建或操作登录账号，未对后台测试工作区和服务做任何修改。
