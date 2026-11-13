# 摸摸獭八关键帧：第 7 帧经过姿势候选

2026-11-13。`explore-v3-legfix.png` 已修正第 7/8 帧腿根身份；第 7 帧前伸幅度仍过大，因此仅追加一次内置 imagegen 编辑，将其近侧暖色脚收回身体中线附近，保持近侧腿在前、离地经过姿势。第 8 帧继续前伸。

原始输出：`exec-377d5548-8932-444a-88a9-4eb5d3b5c676.png`。该整张结果经交叉复查后直接移动为当前 [explore.png](explore.png)，1774 × 887 RGBA、4×2；不再保留重复的 passfix PNG。

输入：`explore-v3-legfix.png`（编辑目标）和 `.temp/pet-explore-v3/foot-plan.png`（第 7 帧轨迹/遮挡参照）。

状态：整张采用并导出外出第三版，8 个独立绘制帧、固定锚点、24fps 时间轴共 24 帧 / 1 秒。没有人工绘制或拼接腿部，没有从其他候选拼接帧，也未补帧。原先保留其他格来源的计划已改为接受本次完整源图，原因是其前六格姿势仍可读，且整张采用能避免不同来源之间的坐标与画质差异。

## 实际提示词

```text
Use case: precise-object-edit.
Input 1 is the EDIT TARGET: the corrected transparent Momota 4-column by 2-row eight-frame walking sheet. Input 2 is the foot-plan gait diagram, reference ONLY its seventh cell for passing-pose foot position and overlap.
Edit ONLY FRAME 7: bottom row, THIRD cell. Specifically change ONLY the NEAR warm-brown hind leg's lifted knee/shin/foot into a smaller mid-swing PASSING pose. Leave all other seven frames unchanged, especially FRAME 8 bottom-right: its warm near foot must remain extended FORWARD. Do not copy frame 8's extended leg into frame 7.
The exact current error: in frame 7 the warm near foot already reaches far forward at roughly 70% of that cell's width, nearly matching frame 8. It must instead sit near the BODY MIDLINE, at roughly 55% of that cell's width from its left edge. Retract that lifted near foot LEFT towards the body center by about one foot-length. The toe still points RIGHT. Near foot is modestly raised, with its sole only about HALF ONE FOOT-HEIGHT above the common ground baseline; not a high knee or kick.
Preserve correct anatomy established in the target: the WARM ORIGINAL-BROWN NEAR thigh begins at the visible close hip on the LEFT side of the belly, bends a little forward/right at the knee, and continues clearly and unbroken to this lifted near foot at the body midline. This small bent warm leg is IN FRONT OF and visibly overlaps/occludes the darker FAR support leg. The near thigh must NOT connect to the grounded dark foot. Show a compact rounded bent knee and short shin, not an elongated belly stripe or disconnected paw. The near passing foot should partly overlap the dark support shin/ankle IN FRONT, making the two limb depths unmistakable.
The FAR leg in frame 7 remains a darker natural chocolate shade through its whole length, vertically supporting the body with the small dark foot on the baseline under the hip. It is BEHIND the warm passing thigh, shin and foot. Do not recolor the legs, exchange them, add a third paw, or make the near passing foot look like it grows from the far edge under the cream belly.
The sequence must clearly read: frame 6 warm near foot is lifted at the REAR; frame 7 warm near foot is raised under the MIDLINE; frame 8 warm near foot is raised at the FRONT; then frame 1 that warm foot contacts the front ground. This edit is ONLY the middle passing frame 7.
Keep frame 7's head, face, scarf, arms, chest, cream belly, broad tail, body proportions and orientation unchanged. Keep its same standing short thick otter anatomy, same warm outlines, light, colors and 2D illustrated finish. Preserve ALL other cells. No floor, shadows, text, grid, labels, extra effects or props. Genuine transparent alpha background and the same exact horizontal 4x2 grid / 2:1 canvas. Return the full sheet with only the seventh pose's near hind leg corrected.
```
