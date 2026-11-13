# 摸摸獭：站立小步行走（第二版）

2026-11-13 修正。初版身份提示词含 `seated hind feet`，导致外出仍然臀部贴地、脚掌朝前。用户指出“像坐着走”后，本次重新绘制站立定姿，再以定姿作为唯一动作图参考；没有把错误旧 sheet 传给生成工具。

当前动作源图：`explore.png`，原始输出 `exec-da14a5ab-543e-47db-9ddf-d9caa4d37a30.png`。近侧三分之二角度朝右，全程臀部与腹部离地，双短腿位于髋下，脚前后交替、前爪反相轻摆。透明 4×4 / 16 独立帧；每帧停留 3 个时间轴帧，24fps 输出共 48 帧、2 秒，没有补帧或骨骼变形。

站立定姿保留为 `explore-standing-reference.png`，原始输出 `exec-e01eb453-b46d-43d1-b166-cb9dc9114a43.png`，只以 `public/images/pets/momota.webp` 为形象参考，明确不沿用坐姿。两次均为内置 imagegen、透明背景。

## 第二版实际提示词：站立定姿

```text
Use case: identity-preserve. Create ONE transparent full-body character pose reference for a 2D pet animation.
Input image is ONLY a character identity and rendering-style reference, NOT a pose reference. IMPORTANT: completely replace its seated pose with a real standing pose.
This is 摸摸獭 (Momota): chubby chocolate-brown cartoon otter, cream muzzle and rounded cream belly, small round ears, distinctive dark eyebrows, tiny whiskers and cheek blush, light sky-blue neck scarf tied at the side, one large broad brown otter tail. Preserve the same face character, colors, warm dark-brown outlines, soft illustrated shading and adorable round proportions. Remove fish and yellow floating decorative marks.
Pose: the otter is STANDING UPRIGHT ON TWO SHORT HIND LEGS, in a clear near-side three-quarter view facing RIGHT (about 65 degrees rotated from front). The round pelvis and belly are visibly OFF the ground, with a clear transparent gap between the underside of the belly and the ground. The two short sturdy legs extend DOWN from under the hips. Both small feet are directly BELOW the belly/hips and rest sole-down on one common ground baseline. We see the TOP/SIDE of the feet, NEVER large foot pads facing the viewer. Feet are not spread outside its belly. The character is round and short, not tall, not human-shaped; head still about half the full height. Exactly two relaxed short forepaws hang at the sides near the belly, and exactly two standing legs with feet. One foot is a little forward in a natural ready-to-walk stance.
The broad thick tail extends naturally backwards toward LEFT, behind its body; it may rest near the baseline but cannot support a seated rump. Torso center of mass sits over the planted feet. Friendly small smile and gaze rightward. No crouching, sitting, kneeling, floating, jumping, dancing or holding anything.
Fixed full-body framing, wide clear margin on every side, transparent background with real alpha. No floor, shadow, checkerboard, matte, text, frame, props or other characters. Clean 2D hand-drawn illustration exactly like reference; not 3D or pixel art. Deliver ONLY this single standing pose.
```

## 第二版实际提示词：连续行走

```text
Use case: identity-preserve. Asset type: ONE production 2D pet WALKING animation sprite sheet with real transparent alpha.
Input 1 is the corrected STANDING character reference. Preserve this standing anatomy, round chocolate-brown otter identity, cream muzzle and belly, friendly eyebrows, little whiskers and blush, sky-blue scarf, broad tail, short legs, and warm outlined hand-drawn 2D style. Do not turn it back into its former seated pose. No fish or props.
Create EXACTLY 16 consecutive frames of ONE complete true bipedal walking-in-place cycle, arranged in a precise 4-column by 4-row equal-cell square grid, left to right then top to bottom. No grid lines, text, labels, shadows, numbers, floor, or background. Real transparent alpha, not a painted checkerboard.
Camera: fixed near-side three-quarter view facing RIGHT, about 65 degrees away from frontal, showing the advancing feet clearly. Same view, body proportions, size, baseline and body center in all 16 cells. Full body and tail completely inside every cell with generous clear margins. Keep head large and rounded, body compact and plump, never tall/human.
CRITICAL STANDING ANATOMY: in EVERY frame the rounded pelvis, rump and cream belly are visibly elevated ABOVE the ground, supported on TWO SHORT LEGS under the hips. There is a clear transparent gap below the belly. Small feet lie below the hips, viewed from their tops and sides, toes pointing toward the walking direction; NEVER two giant footpads facing camera on the sides of a seated belly. Rump never touches floor, tail is not a seat. One planted foot supports the body's weight while the other makes a small forward swing. Exactly TWO legs/feet and TWO forepaws, no duplicate limbs or motion ghosting.
Walking movement: 16 distinct connected drawings, no identical static lineup. Frames 1–4: nearer foot reaches gently forward, contacts baseline and accepts weight while far foot begins lifting from behind. Frames 5–8: far knee/foot pass forward beneath the hips while nearer foot supports the body. Frames 9–12: far foot plants forward and accepts weight, nearer heel lifts and moves forward from behind. Frames 13–16: nearer foot passes under the hips and returns to first forward-contact pose. One complete left-right cycle. Every swing foot is visibly lifted a SMALL amount, never seated, floating, kicking high, hopping or shuffling both feet together. The two short arms swing lightly opposite their respective legs. Tiny natural vertical bob, torso stable, scarf and large broad tail follow gently; tail trails behind LEFT rather than curling under rump.
Frame 16 should be close to frame 1 for looping. The character stands and WALKS in all frames: no standing-up transition, no sitting down at either end. No skate-like sliding pose, crouch, pads-facing-front, open-legged seated silhouette, or human running. Only the walking otter, transparent background, no effects. Deliver only the exact 4×4 sheet.
```

## 初版来源与提示词（已替换，留作追溯）


模式：内置 imagegen，已确认角色作为参考，透明 4×4 / 16 帧动作图。

参考：`public/images/pets/momota.webp`。

原始输出：`exec-e1c0cbb7-5be0-4017-8750-9a84faf1b035.png`。

## 实际提示词

```text
Use case: identity-preserve. Asset type: one production animation sprite sheet for a 2D browser pet, transparent PNG.
Input image is the approved project character portrait and the STRICT character identity reference. It is 摸摸獭 (Momota), a cute chubby warm chocolate-brown otter with cream muzzle and belly, round small ears, expressive dark eyebrows and eyes, blush cheeks, little whiskers, a light sky-blue neck scarf tied at the viewer-right side, two small brown forepaws, two seated hind feet with dark toe pads, and one large thick curved brown tail sweeping out to the viewer-left. Preserve its exact face, colors, thick warm dark-brown outlines, soft illustrated shading, scarf and broad tail. Keep the cheerful 2D hand-drawn cartoon style; NOT 3D, not pixel art, not a different species.
Create EXACTLY 16 consecutive animation frames in ONE exact 4-column by 4-row equal-cell square sprite sheet, ordered left-to-right, top-to-bottom. This is ONE action sequence, never a mixed action contact sheet. No visible grid, no labels, no text or numbers, no watermark.
Lock one fixed three-quarter front camera, same full-body proportions and scale throughout. Full silhouette including tail and all props remains entirely inside every cell with at least 10% clear margin, baseline and bottom-center anchor stable. Small believable connected movements only. At all times the otter has EXACTLY TWO forepaws and TWO hind feet; one paw must not be drawn twice, no detached hands, extra fingers, duplicate limbs, or new feet between its existing feet. Props remain physically held or grounded, never overlapping magically.
Real transparent alpha background throughout, including between every frame, no painted checkerboard, no white/grey matte, no rectangular tint, no floor or background. No effects or detached objects unless explicitly described in the action. Deliver only the exact 4×4 transparent sprite sheet at high resolution.
Ignore the yellow decorative accent strokes outside the reference otter. There must be no yellow accent strokes, exclamation marks, or other floating marks next to the character in this new animation.
Action: EXPLORE as a very gentle WALK IN PLACE, facing the same three-quarter front direction. Remove held fish entirely. Keep upright chubby otter, blue scarf and broad tail identity. Across 16 frames perform ONE slow balanced stepping cycle: the two hind feet alternate lifting just slightly from the baseline, and the two forepaws swing a little in opposite phase. Exact two forepaws and two hind feet, no duplicate foot outlines or motion ghosts. Entire body stays at the same x coordinate, same scale, no turns, no camera change, tiny vertical movement only. Tail follows subtly without changing shape. First and last poses nearly match.
```
