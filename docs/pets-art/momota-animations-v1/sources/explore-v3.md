# 摸摸獭：八关键帧行走（第三版）

2026-11-13。第二版外出在第 7→8 帧近/远脚位置跳变，后半段摆动脚存在反向回收，造成倒走感。本版以八关键帧直接约束两个半周期：近腿第一行落地右→左、第二行离地左→右，远腿反相。固定近腿原色在前、远腿整条较深自然阴影在后。

最终采用的整张源图为 [explore.png](explore.png)，来自原始输出 `exec-377d5548-8932-444a-88a9-4eb5d3b5c676.png`（passfix）。完整图经过交叉复查后直接采用，没有从不同图拼接帧，也没有人工画腿。前六格在定向编辑中有细微像素变化，采用时已接受该整图变化。

本次提示词链依次为：本文的八关键帧初稿 → [第 7/8 帧腿根连接修正](explore-v3-legfix.md) → [第 7 帧经过姿势修正](explore-v3-passfix.md)。下方原始输出名和提示词保留初稿来源，不代表当前最终 PNG。两张中间候选 PNG 移至 `.temp/momota-animations-v1/explore-v3-candidates/`，不作为重复生产素材提交。

当前源图为 1774 × 887 RGBA，4×2 / 8 个独立绘制帧。导出共用固定锚点，每张停留 3 个时间轴帧，24fps 共 24 帧、1 秒。未补帧；预览及最终观感仍由整套统一验收。

模式：内置 imagegen，透明背景，4 列 × 2 行，8 个独立绘制关键帧，没有补帧。

参考输入：

1. `sources/explore-standing-reference.png`，只提供站立摸摸獭角色形象与风格。
2. `.temp/pet-explore-v3/foot-plan.png`，只提供脚轨迹、时序与近远遮挡；不复制指南颜色、长腿、文字或背景。

原始输出：`exec-c54cdf27-121b-4057-b9af-e37d7bfa2cb2.png`。

## 实际提示词

```text
Use case: identity-preserve. Asset: one transparent 2D WALK CYCLE sprite sheet with EXACTLY EIGHT key drawings.
Input 1 is the approved STANDING Momota character identity and visual-style reference. Input 2 is a gait construction diagram, used ONLY to dictate leg positions, grounded versus lifted feet, chronological order, and near/far overlap. DO NOT copy its stick limbs, long legs, orange/gray colors, oval torso, floor lines, captions, or labels.
Render exactly FOUR columns by TWO rows, eight equally sized SQUARE cells, on a horizontal 2:1 canvas. Read left-to-right across the first row, then left-to-right across the second row. Each cell contains ONE complete otter including tail. Eight drawings of ONE continuous forward walking-in-place cycle, not variants, not one repeated pose. Genuine alpha transparency, no background, no shadows, no grid or text. Approximately 10% clear margin around each full silhouette.
Character: Momota, chubby chocolate-brown OTTER, big round head, cream muzzle and plump cream belly, dark eyebrows, small round ears, tiny whiskers and blush, sky-blue scarf tied at side, broad thick tail trailing LEFT behind the body. Preserve Input 1's warm dark outlines, soft illustrated shading, friendly expression, colors and round short proportions. No fish, props or effects. Fixed nearly SIDE view facing RIGHT, only a little three-quarter facial angle to preserve its identity. Do not rotate the camera between frames.
Standing anatomy in all eight frames: short thick legs extend DOWN beneath the rounded hips; belly and rump are clear of the ground, small feet point RIGHT and are seen from top/side rather than displaying footpads. Head is about half full height, no lanky human torso, no long legs, no seated pose, no squat or knee-high lift. Small natural strides, not running, sliding, hopping or moonwalking.
CRITICAL permanent leg identities: NEAR LEG = the closer leg, normal original warm brown from hip to toes, always drawn IN FRONT when legs overlap. FAR LEG = the leg farther from camera, ENTIRE leg from hip through foot consistently one naturally darker chocolate-brown shadow shade, always BEHIND the near leg. The shade and depth belong to each anatomical leg for the WHOLE cycle, never to a screen position. Never swap leg colors or foreground/background order when feet cross. Exactly TWO legs with TWO feet and TWO arms throughout. Tail is behind both legs.
Follow the gait diagram EXACTLY, scaled into these short otter legs. The top row is the NEAR leg's planted support half-cycle: its sole moves screen RIGHT TO LEFT while staying on the baseline. The bottom row is the NEAR leg's lifted swing half-cycle: its foot moves screen LEFT TO RIGHT through the air, then touches down as the loop returns to frame 1. FAR leg does precisely the opposite.
Exact ordered key poses:
1 CONTACT: normal-brown NEAR foot is FORWARD at screen-right on the baseline; darker FAR foot is BACK at screen-left with toe touching baseline. Both toes point right.
2 DOWN: NEAR foot remains planted just forward of center and takes the weight; darker FAR foot has lifted at the rear, its toes clear of ground. Tiny body settling.
3 PASS: NEAR leg is straight under the hip, foot planted at CENTER; darker FAR knee/foot swings forward under body, visibly ABOVE the ground and BEHIND the near leg, not a third leg.
4 UP: NEAR foot is planted behind the hip at screen-left; darker FAR foot is in the air FORWARD at screen-right, ready for contact. Tiny body rise, not a jump.
5 OPPOSITE CONTACT: darker FAR foot is FORWARD at screen-right on the baseline; normal NEAR foot is BACK at screen-left with toe touching. NEAR leg is still visibly in front at any overlap.
6 DOWN: darker FAR foot supports weight just forward of center; normal NEAR foot lifts from the rear at screen-left, clear of ground.
7 PASS: darker FAR leg is straight under the hip with foot planted at CENTER; normal NEAR knee/foot swings forward ABOVE the baseline and IN FRONT of the far leg. Keep both legs identifiable.
8 UP: darker FAR foot remains planted behind the hip at screen-left; normal NEAR foot has swung FORWARD at screen-right, slightly ABOVE the ground, ready to touch down in frame 1. Do not return either foot backwards through the air.
Fixed body center, size and ground baseline across cells; subtle body rise/fall only. Arms swing a small amount opposite their same-side legs with stable depth. Scarf and tail motion minimal. Every cell uses the exact same rendering and proportions. Do not reverse the latter half, mirror a frame, reorder steps, exchange near and far limbs, or insert a neutral standing pause. Only these eight correct key poses; no interpolated frames. Deliver just the clean transparent 4×2 animation sheet.
```
