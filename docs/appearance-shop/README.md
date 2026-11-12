# 积分外观：首批视觉预览

这是商城实施的视觉阶段，尚未接入购买、扣积分、权益、正式聊天室或 Rhythm。

直接用浏览器打开同目录 `index.html`。支持三类外观、7/30 天报价切换、浅色/暗色、座驾进场动画和气泡/头像框试用。预览不访问接口、不购买、不保存账号状态。价格沿用已确认方案中的建议配置。

## 素材

通过内置 imagegen 生成三张透明 RGBA PNG（1536×1024）。保留生成原图，未进行背景移除或重绘；派派鱼 Logo 使用仓库原始 `public/logo.png` 独立叠加。所有生成结果已复制到本目录 `assets`，不依赖生成工具临时目录。

| 素材 | 文件 | 7 天 / 30 天积分 |
| --- | --- | --- |
| 派派小电驴 | `assets/paipai-scooter-v1.png` | 1024 / 3584 |
| 摸鱼纸飞机 | `assets/paper-plane-v1.png` | 1024 / 3584 |
| 深海潜艇 | `assets/deepsea-submarine-v1.png` | 2048 / 7168 |

气泡：海盐汽水、落日邮笺、星夜航线。头像框：潮汐、派派邮票、星环。当前为 CSS 设计预览，没有注册为正式外观包，避免无购买权益的用户提前装备。

### 生成提示词

生成方式：内置 `image_gen`，三次独立生成，均指定 `transparent_background: true`。

**小电驴**

> Create a production game UI sprite illustration: one cute compact pale-blue electric scooter facing right, full side view, rounded clean hand-painted cartoon forms, charcoal thin outlines, cream seat, small orange accents, no rider, no text, no logo. Transparent background, object centered with ample empty margin. Asset for a Chinese community chat entrance animation, readable at 150px wide. Not photorealistic, no ground shadow outside scooter, no scene.

**纸飞机**

> Production game UI sprite illustration of one cute cream origami paper airplane pointing RIGHT, clear folded paper silhouette with pale blue underside and a tiny orange accent, clean rounded cartoon hand-painted style matching a pale blue scooter with charcoal thin outline. Full object isolated on transparent background with ample margin. No rider, no text, no logo, no scenery, no sparkles, no halo, no background shadow. Readable at 150px wide for community chat entrance animation.

**潜艇**

> Production game UI sprite, one cute rounded tiny ocean submarine facing RIGHT in full side view. Pale teal and powder blue hull, cream circular porthole, small warm orange propeller on LEFT tail, short periscope. Clean hand-painted cartoon illustration, subtle texture, thin charcoal outlines, consistent with a cute pale-blue scooter and cream paper airplane collectible set. Isolated on true transparent background, NO black background, no shadow or glow outside object, no text, no logo, no scene, no rider. Object centered with ample margin, readable at 150px wide.

## 后续功能接入边界

- 后端以商品目录、购买记录和本人权益为准；7/30 天续期从当前时间与原到期时间较大值累加。扣款、积分流水、权益、幂等回执必须同事务完成。
- 本人装备读取与写入服务扩展积分资格；既有免费及 VIP 包不改规则。有效性在发消息时重验，历史快照保留。
- 座驾沿用 `ApiV3RealtimeService.pollChatPresence` 的在线隐私、多标签页合并和重连去重；仅进场替代管理员文案，退场仍使用原配置。数据随事件发送，不逐人补查。
- 素材 ID 与版本由后端白名单决定，前端不执行远程 CSS/脚本。正式接入前需要为大 PNG 制作有尺寸预算的发布资源，保留原图。
- 管理上下架、报价及期限继续放在 Rhythm `/admin`，前端商城只消费受校验目录。
- 阶段验收后再将素材和样式接入正式外观包，并完成事务、鉴权、过期、重复消费和双账号实时测试。本预览不能证明这些功能已实现。
