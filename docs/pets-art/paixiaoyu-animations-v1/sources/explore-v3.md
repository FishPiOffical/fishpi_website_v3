# 派小鱼：外出第三版八关键帧

模式：内置 imagegen。2026-11-13，根据“新版两只脚像互换”的反馈制作 4×2 / 8 个关键姿势。通过本轮源帧交叉检查后，已作为正式 `explore.png`，并以固定画布锚点导出一秒循环。实际播放仍待用户统一验收。

原始输出：`exec-110f5ba9-df10-4bd0-a760-d99c23bdc88e.png`。

输入参考：

1. `docs/pets-art/paixiaoyu-animations-v1/explore-standing-reference.png`：锁定派小鱼圆胖橙鱼身份、三瓣帽和短四肢。
2. `.temp/pet-explore-v3/foot-plan.png`：只参考八个脚序和遮挡姿势，不复制长腿、灰色示意人物、文字或地线。

本版近腿全腿亮橙、远腿全腿深橙，约束近腿始终在前层；第一行近腿着地从右向左、远腿离地回摆，第二行相反。交叉检查逐帧跟踪同一条腿：第 3 格远腿经过略被遮挡，但由第 2 格后方→第 3 格中后方→第 4 格前方仍可跟踪同一深色腿；第 7 格近腿在前遮挡远腿。没有只凭第 1 / 5 格接触姿势互反判定通过。

源图实际为 1774×887 RGBA；8 个源帧各停留 3 个时间轴帧，输出为 256×256、24fps、24 帧、1 秒。没有补帧、骨骼变形或身体部件拆分。

## 完整实际提示词

```text
Use case: identity-preserve.
Create ONE transparent PNG animation sprite sheet, exactly FOUR columns and TWO rows, EIGHT equal-size cells total. Read left to right, top row then bottom row. Eight distinct key poses of the SAME round orange fish mascot walking in place to the RIGHT.

REFERENCE ROLES:
Image 1 is the approved STANDING Paixiaoyu identity: preserve the fat round orange body, large rounded face, happy curved eyes, tiny w mouth, blush cheeks, white three-lobed cap with three pink patches, small two-lobed orange tail, warm brown outlines and gentle 2D shading.
Image 2 is a MOTION AND OCCLUSION GUIDE ONLY. Reproduce its eight corresponding leg poses and overlap order in the SAME eight cells. Do not copy its oval gray body, long legs, diagram colors, numbers, text, ground lines or white background. Adapt those poses to the mascot's very short round orange legs.

FIXED LEG IDENTITIES:
The NEAR leg is bright orange from hip attachment to toes in ALL eight frames. It is ALWAYS the foreground leg, drawn in front of the far leg whenever they overlap.
The FAR leg is a deeper burnt-orange natural shadow from hip attachment to toes in ALL eight frames. It is ALWAYS behind the near leg.
They NEVER exchange colors, roots, or foreground/background layers. The near leg remains the same continuous near limb when it moves backward; the far leg remains the same far limb when it moves forward. Each leg stays attached to its own fixed hip joint. This rule applies to the whole leg, not just a differently colored foot.

MOTION:
Copy the exact eight key-pose relationships from image 2. Character torso remains centered. Grounded support feet move steadily from RIGHT to LEFT relative to that centered torso; airborne swing feet travel from LEFT to RIGHT in a low arc. Feet stay short, rounded and point right, soles down.
1 Contact: bright near foot forward/right on ground; dark far foot back/left on ground.
2 Down: bright near foot still grounded and progressing left; dark far foot lifted from behind.
3 Passing: bright near foot grounded directly beneath body; dark far foot passes behind the near leg, visibly raised.
4 Up: bright near foot grounded behind/left; dark far foot swung ahead/right, still raised.
5 Opposite contact: bright near foot behind/left on ground; dark far foot ahead/right on ground. Keep near in front of far, NEVER swap leg colors.
6 Down: dark far foot grounded and progressing left; bright near foot lifted from behind.
7 Passing: dark far foot grounded under body; bright near foot passes IN FRONT OF dark far leg, visibly raised.
8 Up: dark far foot grounded behind/left; bright near foot ahead/right and raised, ready to land in pose 1.

Every frame is standing: buttocks and rounded belly stay off the floor. Legs must remain very short and chubby, with a clear gap below the belly, no thin humanoid proportions. Use a nearly side-facing right view with a slight three-quarter angle so face remains cute and leg overlap is unmistakable. Exactly two arms, two legs and one tail; arms swing only slightly opposite the legs. Cap remains attached to head and unchanged.
Keep identical body scale, stable torso placement, same camera, and clear margin within all eight cells. No extra in-betweens and no duplicated cells. No standing-up or sitting-down sequence. No hopping or floating; at least one foot grounded in every pose.
Real alpha transparency. NO GROUND SHADOW, no ground line, no background, no checkerboard, no labels or text, no props, no effects. Deliver ONLY the 4x2 eight-pose character sheet.
```
