# 荷小豚：坐着打盹

模式：内置 imagegen，参考已认可角色，透明 4×4 / 16 帧动作图。

第一版原始输出：`exec-842f5631-75ad-4b18-bddc-6cef38f7c886.png`，因与待机姿势区别过小，保存在本地临时目录 `sleep-first.png`，不作为当前素材。

当前第二版输出：`exec-1c47b0d6-aa64-46e0-b2d6-5519b6509c2e.png`。定向编辑第一版，改为低头闭眼、双前爪叠放的坐着睡姿；保持两前爪、两后脚、荷叶帽及鱼形斜挎包，没有睡眠文字或额外道具。

## 第二版定向编辑提示词

```text
Use case: precise-object-edit / identity-preserve. EDIT THIS EXISTING 4×4 transparent 16-frame pet sprite sheet with one targeted change: change the upright idle-looking pose into an unmistakably peacefully SLEEPING seated pose, keeping the exact same character, palette, warm brown linework, lotus-leaf hat, orange fish crossbody satchel, transparency, equal 4×4 grid and frame scale.
In EVERY frame, the capybara's head should hang gently downward, chin tucked closer to upper chest rather than held upright, muzzle pointing slightly down. Eyes completely closed and soft. Its EXACTLY TWO small front paws overlap/rest together quietly low on the belly, instead of being separately held apart. Keep both rear feet planted in the familiar seated position. DO NOT add duplicate paws, hands between feet, objects, pillows, nightcaps or blankets. Original green lotus hat rests securely on and tilts with its head; it must never float or obscure the entire face. The orange fish-shaped satchel at left hip remains visible and attached to the unchanged diagonal strap.
Only a very tiny slow breathing motion through the 16 frames: chest rises a little then settles; the downward head angle remains clearly a dozing posture throughout. First and last frames match. No return to upright alert pose, no large nod or sway, no sleeping letters, no Zzz, no icons, no external human hand. Remain seated, not lying down.
Keep the fixed frame center and baseline and equal square cell boundaries; clear transparent margins with full cap, both ears, body and feet visible. True transparent alpha background, no checkerboard or colored backdrop, no extra scenery, no text, no borders. This is one continuous subtle sleep loop and needs a visibly lower chin/relaxed overlapping-paw silhouette than the supplied upright reference. Deliver only the corrected exact 4-column×4-row sprite sheet.
```

## 第一版提示词（保留来源）

```text
Use case: identity-preserve. Asset type: production 16-frame transparent 2D pet animation sprite sheet, precise four columns and four rows, all 16 cells exactly equal square dimensions, frames in reading order. No visible cell borders, captions, text, numbers, grid lines or layout decorations.
Input 1 is the approved original 荷小豚 sheet, providing exact character and 2D drawing style. Input 2 confirms the project portrait. Preserve this exact plump orange-tan capybara with large two-lobed tan muzzle, small dark slit eyes and blush, natural green lotus-leaf hat with little curled stem seated on its head, and little orange fish-shaped crossbody SATCHEL at its left hip, strap across chest. Hat/head proportion and warm brown ink outlines must match. Only two forepaws and two hind feet. Never add paws between the feet or hide the satchel.
Animation: SLEEPY SITTING NAP, a quiet seamless loop. The capybara sits in the familiar pose, both empty forepaws resting gently on its round belly, eyes closed, no held food. Across 16 frames it slowly breathes in, gently nods its head by 3 degrees as if dozing, then breathes out and returns to the same sleeping pose; frame 16 equals frame 1. Lotus-leaf hat remains attached to the head and follows its small movement. Tiny chest rise only, body anchored and feet planted, no pose change to lying down. Very subtle peaceful facial change, no giant snore bubble, no letter Z, no icons, no floating decorative marks. Keep the same scale, baseline and camera in every cell, avoid any drifting or jitter.
Full body and complete hat within each cell with clear transparent margins, same centered anchor. Real transparent alpha background, clean edges without colored specks or fringe, no checkerboard artwork, no white backdrop or matte. If present, only a tiny consistent soft translucent warm ground shadow. Preserve the soft flat cartoon shading and original palette, no 3D rendering. Deliver only the exact 4×4 animation sheet.
```
