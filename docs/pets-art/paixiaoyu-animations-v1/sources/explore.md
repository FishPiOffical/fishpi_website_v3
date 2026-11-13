# 派小鱼：站立原地步行（第二版）

模式：内置 imagegen，透明 4×4 / 16 帧动作图。2026-11-13 根据“外出像坐着走”的反馈重画；本次只替换 explore。

最终原始输出：`exec-415b120b-5c6d-4139-836c-ec647b98f7ad.png`。

## 修正与来源

- 旧来源为 `exec-a1ce4bc1-5dba-4ab0-a884-5b9439116d2b.png`，保留在 Git `0d97f6e` 的本文件和 `explore.png` 中。旧提示词同时约束坐姿和走路，导致臀部贴地、只抬脚；该版本已替换。
- 先以已认可的 `docs/pets-art/paixiaoyu-v2.png` 只锁定身份，生成 [站立定姿](../explore-standing-reference.png)，原始输出为 `exec-faac94cd-2a16-437c-b02d-a1ef771a94e4.png`。臀部离地，两短腿在腹下，脚底向下；保持胖圆橙鱼与三瓣帽，不恢复瘦长站立造型。
- 最终动作图仅引用上述站立定姿，改成偏侧向右的全程站立步行；近腿亮橙、远腿自然深橙阴影，便于检查半周期交换。第 1 / 9 格两腿前后关系相反，第 5 / 13 格经过身体下方。
- 中间三张候选 `exec-c1432bd2-969d-4a31-a702-e4d24542fc88.png`、`exec-c7804f80-48da-41c7-bf50-65d3e8409505.png` 与 `exec-305f53bc-f8c1-4a67-9344-7be9a6672834.png` 因步幅偏高或交替不清而未选用，未覆盖生产视频。
- 最终 16 个源帧各停留 3 个时间轴帧，输出 24fps、48 帧、2 秒。没有补帧、骨骼变形或拆分腿部合成。

## 最终动作图完整实际提示词

```text
Make a 4x4 animation sprite sheet: 16 successive frames of the SAME plump orange fish mascot WALKING IN PLACE to the RIGHT, on transparent alpha. Use the reference only for identity and round fat proportions, hat and colors. Camera is almost pure SIDE VIEW facing right, just enough three-quarter angle to see the face. This is a normal grounded alternating two-leg walk, not kicking or hopping.

Most important: there are two short stubby legs UNDER the raised round body. Distinguish the legs consistently: the NEAR leg is BRIGHT ORANGE like the lit body; the FAR leg is DARKER BURNT ORANGE from natural shadow. Both feet point right. The bright near leg and dark far leg MUST change which one is in front and which one is behind. They MUST both take turns as the support leg. Never leave one leg upright throughout the sheet.

Use this repeating 8-key-pose walk with one in-between after each key pose, 16 frames total, ordered left to right and top to bottom:
1. CONTACT: bright near foot AHEAD to the RIGHT, dark far foot BEHIND to the LEFT.
3. DOWN: bright near foot planted, dark far foot lifts from behind.
5. PASSING: bright near leg supports the body, dark far leg passes forward low under belly.
7. UP: dark far foot swings FORWARD to RIGHT, bright near leg is now BEHIND to LEFT.
9. OPPOSITE CONTACT: dark far foot AHEAD to RIGHT and grounded, bright near foot BEHIND to LEFT. EXACT REVERSE of frame 1.
11. DOWN: dark far foot planted, bright near foot lifts from behind.
13. PASSING: dark far leg supports the body, bright near leg passes forward low.
15. UP: bright near foot swings FORWARD to RIGHT, dark far leg now BEHIND to LEFT.
16. Return toward frame 1.
At least one foot contacts ground in EVERY frame. Feet are small, soles down. Knees never lift near belly. Body bottom never touches ground. Two arms make small opposite swings. Body stays centered with tiny natural bob, no traveling. No sliding, floating, crouching, sitting or jumping.

Preserve the round chubby orange fish body, small two-lobed tail behind on viewer left, large round face, happy curved eyes, w mouth, rosy cheeks, attached white three-lobed cap with three pink oval patches, warm brown cartoon outlines. Exactly 2 arms + 2 legs + 1 tail, no props or outfit. Keep legs short but visible beneath the hips, not thin or human-like. Fixed camera and scale. Full body in each equal cell with margin. No grid lines, text, marks, scenery or white matte, genuine transparency. Tiny consistent ground shadow optional. Clean hand-drawn 2D. Do not draw 16 copies of one foot lifting: draw the two-foot alternating walk described above.
```

## 站立参考完整实际提示词

```text
Use case: identity-preserve.
Asset type: a single transparent PNG animation pose reference, one full-body character only.
Reference image is the approved design of 派小鱼 / Paixiaoyu. Preserve its CHARACTER IDENTITY, colors, large round fish face, plump body, white three-lobed soft cap with three pink oval patches, tiny happy curved dark-brown eyes, w-shaped mouth, rosy cheeks, warm brown outlines and soft orange shading. The reference is seated, but its POSE MUST CHANGE completely.
Primary request: Draw this SAME fat orange fish mascot STANDING UPRIGHT on its two very SHORT feet beneath its body, in a three-quarter SIDE VIEW FACING RIGHT. The two-lobed orange tail protrudes behind the body, to viewer LEFT. Exactly two short front arms hang beside the belly, and exactly two short rear legs/feet support the body from UNDERNEATH. Remain rounded and compact: do not stretch into a skinny tall human.
Critical standing anatomy: hips and bottom are raised clearly off the floor; there is a visible gap beneath the rounded belly/hips and above the floor, occupied only by two little vertical leg stubs. Small feet are under the hips, one slightly ahead of the other, shown in side profile with toes pointing RIGHT and soles facing DOWN. At least one foot is firmly planted. The feet are NOT splayed sideways and NOT flat oval pads facing the viewer. This must unmistakably read as standing, never sitting, squatting or kneeling.
Keep the whole cap attached to the head; same three lobes and pink patches. Clean recognizable two arms + two legs + one tail. Fixed 2D cartoon illustration, no 3D, no pixel art, no outfit, no props or extra characters.
Composition: one full body centered, 12% clear margins, transparent alpha background, no matte, checkerboard, floor line or scenery. A tiny translucent shadow under the feet is allowed. Deliver a single standing pose, not a sprite sheet.
```
