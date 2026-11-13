# 鱼饼喵：外出 v3 八关键帧

状态：主代理已交叉检查完整源图及腿部放大，八帧的近远腿身份和遮挡轨迹通过本轮源帧检查。选用源图已移动替换 explore.png，不重复保留候选 PNG；已导出为 256×256、24 时间轴帧 / 1 秒的透明 WebM。用户最终艺术验收仍待完成。
工具：内置 imagegen；透明背景；2026-11-13。
原始输出：`exec-e6d2dda0-2a21-48ec-8bfd-1aac881c56aa.png`。
参考一：已查看的 explore-v2-standing-reference.png，只用于角色身份、短腿胖体型与站姿比例。
参考二：已查看的 .temp/pet-explore-v3/foot-plan.png，只指导轨迹和近远层次，不采用其长腿、配色、文字或背景。
修正目标：近侧整条腿为正常奶白色且始终位于前层；远侧整条腿采用较深暖灰米色自然阴影且始终位于后层。4×2 八姿势按两轮 contact/down/pass/up 排列，支撑脚沿右→左，摆动脚离地左→右。

实际源图：1774×887 RGBA，4×2 八个原绘帧。导出每张停留 3 帧，使用统一缩放 0.58 和固定锚点 [217.5, 410]；不逐帧追踪最低脚点，不使用插帧或骨骼变形。基本核验见 ../explore-v3-validation.json。

## 完整实际提示词

```text
Use case: identity-preserve.
Asset type: ONE candidate 2D walk-cycle sprite sheet with EXACTLY 8 key poses, in exactly 4 columns and 2 rows of equal square cells. Wide 2:1 composition, approximately 2048x1024. Read left to right across top row, then left to right across bottom row. Transparent PNG. NO visible cell lines, text, numbers or labels.
Input image 1 is the CHARACTER IDENTITY and SHORT STANDING PROPORTION reference. Preserve this exact cute orange-and-cream tabby kitten Yubingmiao: very large round head, chunky round belly, small triangular orange ears with pink inner ears, cream forehead stripe, warm brown outlines and large brown eyes, cheerful little pink mouth, blush cheeks, BLUE COLLAR with SMALL GOLD FISH PENDANT, and orange-and-cream striped curled tail. Match its soft warm hand-drawn 2D style. Two stubby hind legs, two little free forepaws. No large blue fish prop. Do NOT lengthen the legs or make a human-shaped body.
Input image 2 is ONLY a FOOT-TRAJECTORY AND OCCLUSION PLAN for the eight contact/down/pass/up poses. Follow its alternating support and swing paths. DO NOT copy its long legs, stick figures, body shape, orange/blue-gray identity colors, text, labels, ground lines or white background.
FIXED CAMERA: nearly SIDE VIEW facing RIGHT, with only a slight three-quarter turn so the friendly face remains visible. Maintain the same direction, body scale, horizontal hip/root position, framing and palette in every cell. Full tail, ears, arms and feet fit inside every cell with clear padding. Keep the chubby belly and rump well above the ground for all eight poses. Feet point RIGHT throughout; show sides/tops of paws, not pads facing viewer. Exactly TWO short hind legs, with ankles attached to feet, and exactly TWO forearms.
CRITICAL LEG IDENTITY RULE:
The NEAR LEG belongs to the camera-facing hip and stays on the FRONT drawing layer in ALL 8 frames. Its WHOLE thigh, shin, ankle and foot are the kitten's normal light CREAM-WHITE fur.
The FAR LEG belongs to the opposite hip and stays on the BACK drawing layer in ALL 8 frames. Its WHOLE thigh, shin, ankle and foot are a visibly darker, naturally shaded WARM GRAY-BEIGE version of the same cream fur. Not blue, not orange, not a different sock. Use this same shadow tone on that same entire far leg in EVERY pose.
Whenever the legs cross, the LIGHT NEAR LEG occludes the SHADED FAR LEG. Never switch their colors, hip attachments or front/back layering when a foot moves from left to right. The leading foot is NOT always light. In the SECOND ROW, the leading planted leg must be the shaded FAR leg while the light NEAR leg swings in front of it. Keep a small visible portion of the far foot/leg in passing poses; no disappearing limb, extra feet or floating disconnected paws.
Create this exact ONE complete eight-pose walk cycle:
TOP ROW:
1 CONTACT: light NEAR foot planted FORWARD on the RIGHT; shaded FAR foot on the LEFT trailing at toe-off. Two separated feet.
2 DOWN: light NEAR leg carries the weight, its planted foot has moved slightly LEFT/back from pose 1; shaded FAR foot is lifted behind on the LEFT. Small knee compression only.
3 PASS: light NEAR leg remains planted under the hip at CENTER; shaded FAR leg bends and passes BEHIND it in the air, travelling LEFT to RIGHT. The light leg must remain in front at the overlap.
4 UP: light NEAR foot is planted BACK on the LEFT at toe-off; shaded FAR foot is lifted FORWARD on the RIGHT ready to contact. The shaded leg stays on the rear layer even though its foot is ahead.
BOTTOM ROW:
5 CONTACT: shaded FAR foot planted FORWARD on the RIGHT; light NEAR foot trailing on the LEFT at toe-off. This must be the opposite leg phase from pose 1, NOT the same colors reset.
6 DOWN: shaded FAR leg carries the weight, its planted foot moves slightly LEFT/back; light NEAR foot is lifted behind on the LEFT.
7 PASS: shaded FAR leg stays planted under the hip at CENTER; light NEAR leg bends and passes IN FRONT of it in the air, travelling LEFT to RIGHT.
8 UP: shaded FAR foot is planted BACK on the LEFT at toe-off; light NEAR foot lifted FORWARD on the RIGHT, ready to return to pose 1.
Support foot travels RIGHT to LEFT along one consistent ground baseline during its four-pose stance. Swing foot travels LEFT to RIGHT above that baseline. Distinct support-versus-swing poses. Compact steps, no high kicking. A single low body bob is fine; do not let the torso translate across cells. Two short forearms swing gently in opposition to their corresponding legs, remaining attached to the same shoulders. Tiny tail counter-sway only.
Each cell uses the SAME ground baseline, body proportions and camera. Draw no ground or ground shadow: transparent space below and around feet must make foot contact and lift visible. Real alpha transparency everywhere outside the kitten; no matte, checkerboard, floor or background.
Avoid: seated/squatting poses, belly touching ground, long human legs, swapping feet, changing limb colors by screen position, changing only foot color while the leg stays white, wrong overlap, support feet moving forwards while planted, sliding without lifting, floating or jumping, detached paws, extra limbs, hidden third feet, copied guide lines/text, motion marks and sparkles. This is a mechanically clear eight-key-pose walk cycle, not eight unrelated standing illustrations.
```
