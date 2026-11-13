# 摸摸獭八关键帧：第 7/8 帧腿部连接修正候选

2026-11-13。放大检查 `explore-v3.png` 后发现第 7、8 帧的可见近侧大腿仍连接深色落地脚，亮色悬空脚却由远侧腹下长出。此次用内置 imagegen 编辑完整候选图，要求只修正末两格的腿根→膝→脚连接和近远遮挡。

原始输出：`exec-fef58779-2d52-447f-9a29-76966f4ed421.png`。保存为 `explore-v3-legfix.png`，1774 × 887 RGBA，4×2 八关键帧。

输入：`explore-v3.png`（编辑目标）、`.temp/pet-explore-v3/foot-plan.png`（近远腿时序）、`.temp/momota-animations-v1/explore-v3-audit/frame-6-legs.png`（正确近腿连续性放大参照）。

本图是中间候选，PNG 已移至 `.temp/momota-animations-v1/explore-v3-candidates/explore-v3-legfix.png`。生成工具虽被要求保持前六格不变，但像素核对显示各格都有重新编码/重绘差异，不能声称前六格逐像素未变。后续又修正第 7 帧经过姿势，最终直接采用完整 passfix 图，见 [最终来源](explore-v3.md)；未拼接不同来源的帧。

## 实际提示词

```text
Use case: precise-object-edit and identity-preserve.
Input 1 is the EDIT TARGET: an eight-frame otter walking sprite sheet, 4 columns x 2 rows. It is almost correct. Edit ONLY the two hind legs in FRAME 7 and FRAME 8 (bottom row third and fourth cells). Keep the other SIX frames completely unchanged. Keep all heads, faces, torsos, scarves, arms, tails, cell positions, character scales, original outlines and alpha transparency unchanged, including frames 7 and 8. Do not regenerate or restyle the sheet.
Input 2 is the gait-plan guide; use ONLY the leg topology/occlusion in its seventh and eighth cells. Do not copy its colors, long legs, labels or diagram style. Input 3 is a close-up of frame 6: it demonstrates the CORRECT near-leg identity, the continuous warm-brown outer hip/thigh connected to the warm-brown lifted foot in the foreground, crossing IN FRONT of the darker far support leg.
THE EXACT BUG TO REPAIR: in target frames 7 and 8, the large visible warm-brown NEAR-side thigh wrongly continues down into the DARK planted foot at left, while the BRIGHT raised right foot grows out from the FAR side under the cream belly. This is NOT fixed by swapping the foot colors. REDRAW THE LEG CONNECTIONS AND OVERLAP correctly.
Frame 7 (bottom row column 3), passing pose: the large visible NEAR hip/thigh must form ONE CONTINUOUS short warm-brown bent leg that reaches inward then FORWARD to the raised warm-brown foot at the right. The connecting knee/shin is visible in front of the darker leg: draw the warm near thigh curving from the outer hip ACROSS THE FRONT of the dark support shin, ending in the raised foot. There must be no outline that connects this near hip to the planted dark foot. The FAR support leg is ONE CONTINUOUS naturally darker chocolate-brown limb emerging BEHIND the cream lower belly and near thigh, down to its small grounded foot near CENTER. At the crossing, the near warm leg clearly occludes the far dark leg. The near foot is modestly lifted, close to the body, passing forward. Exact two feet.
Frame 8 (bottom row column 4), up pose: again the large warm-brown NEAR-side hip continues as ONE UNBROKEN short warm-brown thigh/knee/shin into the FORWARD raised warm foot at RIGHT. Show this near leg diagonally in front of and occluding the darker far leg; do not let it terminate in the rear dark foot. The FAR darker leg begins behind the belly on the farther side, extends BACK to LEFT and supports the body on its small grounded foot. It remains behind the near leg from hip to toes. All feet point RIGHT.
Both repaired poses must read anatomically from HIP -> KNEE -> ANKLE -> FOOT, with one and the same near warm limb continuous throughout frames 5,6,7,8 and back to 1. Do not merely recolor disconnected feet. The near warm thigh is the visually closest structure; the far darker thigh/leg is always behind it. Keep short thick otter legs and a plump belly off the ground, no extra paws, no long human legs, no backwards foot motion.
Preserve target exact 4x2 eight-cell layout and transparent 2:1 canvas. Only repair these last TWO leg poses. No labels, lines, shadows, backgrounds, effects or new props. Output the corrected full sprite sheet, with frames 1–6 and every non-leg element unchanged.
```
