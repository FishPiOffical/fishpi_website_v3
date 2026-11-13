# 鱼饼喵：外出动作制作记录

当前选用版本为 [外出 v3 八关键帧](explore-v3.md)，源图保存在 explore.png，实际为 4×2 / 8 原绘帧。v3 修正了 v2 近远腿交换和遮挡不连续的问题，导出采用固定锚点、24 时间轴帧 / 1 秒。完整实际提示词及最新来源请看 v3 记录。

## v2 历史记录（已被替代）

工具：内置 imagegen；透明背景；2026-11-13。
原始输出：`exec-0a031075-ee81-43e4-af5d-b80b8931f605.png`。
连续帧参考：[新站立姿势](explore-v2-standing-reference.png)，其身份源自已查看的 `public/images/pets/yubingmiao.webp`；站姿的完整提示词见 [参考制作记录](explore-v2-standing-reference.md)。

## 修正原因与旧来源

用户指出第一版像坐着走路：臀部贴地，只抬起坐姿两侧的脚。第一版提示词把原来的坐姿和抱鱼误当作需要锁定的身份特征。本次先重画真正站立参考，再生成完整步态；全程臀腹离地、两短腿在腹下、脚尖朝右，两前爪随步态反向轻摆，不持蓝鱼，保留蓝项圈与小金鱼吊坠。

旧输出：`exec-5726b24a-a425-42a3-9f12-9b003bdc1d90.png`；旧源图和完整提示词可在 Git 提交 `0d97f6e` 的同路径查看。旧图没有作为本次生成参考，也没有继续用于导出。

本次仍为 16 张原绘帧；导出各帧停留 3 个时间轴帧，共 48 帧 / 2 秒（24fps 时间轴）。没有光流补帧或骨骼变形。

## 完整实际连续帧提示词

```text
Use case: identity-preserve.
Asset type: ONE production WALK CYCLE sprite sheet, transparent PNG, exactly FOUR COLUMNS by FOUR ROWS, 16 equal square cells. Read the 16 consecutive animation frames left to right, then top to bottom. No visible grid lines, labels, frame numbers or text. Square image.
Input image 1 is the APPROVED STANDING POSE and identity reference. Match that same orange-and-cream chubby kitten Yubingmiao: huge round head, soft oval belly, orange triangular ears with pink centers, cream forehead stripe, large brown eyes and tiny cheerful mouth, pink cheeks, warm brown outline, BLUE COLLAR and SMALL GOLD FISH PENDANT, orange-and-cream curled striped tail. Same soft warm 2D cartoon style, NOT 3D. No large blue fish prop.
KEEP THE KITTEN STANDING UPRIGHT throughout ALL SIXTEEN FRAMES. Its rump and round belly are high above the ground, supported by TWO visibly separate short legs UNDER the belly. Maintain a visible transparent gap under the central belly between the legs. Match the short chunky legs of the new standing reference; no longer adult legs. Feet point RIGHT, seen mainly from the side, never displaying the soles to the viewer. Exactly TWO hind feet and TWO forearms, no duplicate or hidden spare limbs.
Camera: consistent three-quarter SIDE view facing RIGHT, slightly more side-on than the reference to make the stepping feet easy to distinguish. Body and head keep the same angle in every frame. Fixed scale, center, lens and ground baseline. Whole character and tail fit entirely inside each cell with clear transparent padding. No horizontal travel through the sheet.
Animation: a TRUE BIPEDAL WALKING-IN-PLACE loop with one complete left-right gait cycle. This is a walking character supported by its feet, NOT a seated character waving feet. Feet travel FORWARD and BACK underneath the raised belly; one foot supports the body while the other swings. Natural low-amplitude opposite forearm swing: near arm swings forward when near leg moves back, and vice versa. Arms hold nothing and remain at the sides.
Frames 1-2: near foot forward makes contact, far foot trails and begins toe-off.
Frames 3-4: weight transfers onto near foot; far foot bends and leaves the ground.
Frames 5-6: near foot supports vertically under the hip while far foot passes beneath the belly in the air.
Frames 7-8: far foot reaches forward; near foot moves back and pushes off.
Frames 9-10: far foot forward makes contact, near foot trails and begins toe-off.
Frames 11-12: weight transfers onto far foot; near foot lifts clear of the ground.
Frames 13-14: far foot supports beneath the hip while near foot passes forward through the air.
Frames 15-16: near foot reaches forward toward its initial contact pose; finish close to frame 1 for a loop.
Use subtle body bob only, keep the belly and rump OFF the ground even in the lowest passing pose. Feet must separate fore-and-aft in the contact poses; make the bent lifted swing foot and single planted support foot visibly distinct in passing poses. Tail makes a tiny gentle counter-sway without touching the floor.
Background: real alpha transparency, no scene, floor plane, white/gray matte or painted checkerboard. No shadow slab that hides contact or the gap under the belly; ideally no shadow at all.
Avoid: ANY sitting or squatting pose, belly dragging on ground, feet spread to left/right of a seated torso, facing pink footpads, standing up/sitting down transition, floating, hopping or jumping, gliding without gait, long human legs, huge knee lifts, body stretching, camera or view changes, props, text, sparkles or speed lines. One consistent genuine standing walk cycle, not a row of near-identical static poses.
```
