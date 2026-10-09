/** 原版水面钓鱼图鉴（+ 派派鱼），供 Canvas 猫钓鱼使用 */

export type Rarity = '常见' | '少见' | '稀有' | '史诗' | '传说' | '神话'

export type FishKind = {
  id: string
  name: string
  color: string
  belly: string
  fin: string
  rarity: Rarity
  points: number
  size: number
  blurb: string
  /** 刷鱼相对权重 */
  weight: number
}

export const FISH_KINDS: FishKind[] = [
  { id: 'mud_carp', name: '泥鲤', color: '#5a8f6a', belly: '#a8c9b0', fin: '#3d6b4a', rarity: '常见', points: 13, size: 0.68, blurb: '一身粗粝的褐色鳞片，终日拱食河底淤泥，出水时甩你半脸泥点子。', weight: 1000 },
  { id: 'ghost_shrimp', name: '幽灵虾', color: '#5a8f6a', belly: '#a8c9b0', fin: '#3d6b4a', rarity: '常见', points: 12, size: 0.8, blurb: '透明的身子只剩两粒黑眼珠像浮空的芝麻，成群漂过时，仿佛水下起了一阵玻璃雨。', weight: 1000 },
  { id: 'flicker_minnow', name: '荧鳞鲦', color: '#6a7a8a', belly: '#b0bcc8', fin: '#4a5a6a', rarity: '常见', points: 8, size: 0.77, blurb: '体侧一道荧蓝细线如同划着的火柴，暗处成群游动时，能照亮半张脸。', weight: 1000 },
  { id: 'angler_fry', name: '灯鮟鱇', color: '#7a6a5a', belly: '#c8b8a8', fin: '#5a4a3a', rarity: '常见', points: 6, size: 0.81, blurb: '小如拇指的深海鮟鱇，额顶灯笼在无边黑暗中连成一串坠向海底的星链。', weight: 1000 },
  { id: 'sky_skipper', name: '跃空鱼', color: '#7a6a5a', belly: '#c8b8a8', fin: '#5a4a3a', rarity: '常见', points: 9, size: 0.7, blurb: '胸鳍拉成薄膜翼，能掠出水面滑翔数米，溅起的水雾里总挂着一小截虹。', weight: 1000 },
  { id: 'frost_drifter', name: '霜漂鱼', color: '#7a6a5a', belly: '#c8b8a8', fin: '#5a4a3a', rarity: '常见', points: 7, size: 0.73, blurb: '身体像一片薄冰，体内氦气与寒气让它悬在水层中，阳光穿透时棱镜光碎成十几片。', weight: 1000 },
  { id: 'scorched_tetra', name: '焦鳞灯鱼', color: '#5a7a8a', belly: '#a8c0d0', fin: '#3a5a6a', rarity: '常见', points: 9, size: 0.78, blurb: '赤褐色的鳞片布满灼痕，在沸水里悠然自得，仿佛刚出炉的火炭块。', weight: 1000 },
  { id: 'shard_fish', name: '晶片鱼', color: '#5a7a8a', belly: '#a8c0d0', fin: '#3a5a6a', rarity: '常见', points: 10, size: 0.74, blurb: '身躯如同碎裂的水晶，折射出成千上万道细虹，游动时整个洞穴都在闪光。', weight: 1000 },
  { id: 'jelly_phantom', name: '幻水母', color: '#5a7a8a', belly: '#a8c0d0', fin: '#3a5a6a', rarity: '常见', points: 14, size: 0.78, blurb: '半透明的伞帽悬浮着，触手拖曳星尘般的微光，穿过它能看到对岸扭曲的影子。', weight: 1000 },
  { id: 'winter_cinder', name: '冬烬鱼', color: '#8b6b4a', belly: '#c4a882', fin: '#6a4e35', rarity: '常见', points: 14, size: 0.75, blurb: '灰白色的鳞片下隐约透着将熄的火光，只在寒冬温泉的石缝里成群打转。', weight: 1000 },
  { id: 'silver_pike', name: '银梭鱼', color: '#d08050', belly: '#f0c0a0', fin: '#a05030', rarity: '少见', points: 22, size: 0.98, blurb: '细长如标枪的掠食者，鳞片是冷冽的银色，出水时甩起一串水珠。', weight: 350 },
  { id: 'dusk_eel', name: '暮色鳗', color: '#70b050', belly: '#c0e090', fin: '#408030', rarity: '少见', points: 17, size: 0.88, blurb: '暗紫色的细鳗只在黄昏从泥洞里探出，像一条会流动的影子。', weight: 350 },
  { id: 'copper_bream', name: '铜鲂', color: '#70b050', belly: '#c0e090', fin: '#408030', rarity: '少见', points: 27, size: 0.97, blurb: '宽扁的身体覆着一层铜绿般的鳞，在水草间折射出锈迹似的光晕。', weight: 350 },
  { id: 'cinder_loach', name: '余烬泥鳅', color: '#e0a030', belly: '#f5d080', fin: '#c47a18', rarity: '少见', points: 16, size: 0.81, blurb: '暗红色的泥鳅在热沙里钻进钻出，体表不时爆出细小的火星，烫得鱼线微微发颤。', weight: 350 },
  { id: 'deep_sculpin', name: '深岩杜父鱼', color: '#e0a030', belly: '#f5d080', fin: '#c47a18', rarity: '少见', points: 23, size: 0.86, blurb: '长着骨质甲板的怪鱼，趴在海底淤泥里像一块会呼吸的石头，专等粗心的猎物。', weight: 350 },
  { id: 'mangrove_snapper', name: '红树鲷', color: '#70b050', belly: '#c0e090', fin: '#408030', rarity: '少见', points: 23, size: 0.93, blurb: '披着青褐色装甲的鲷鱼，在红树气根迷宫间伏击，一双眼珠有潜望镜的冷静。', weight: 350 },
  { id: 'winter_betta', name: '雪华斗鱼', color: '#70b050', belly: '#c0e090', fin: '#408030', rarity: '少见', points: 27, size: 0.84, blurb: '尾鳍绽开如一朵完整的雪花，在冰水里游动时，周遭会凝结出一圈细碎冰晶。', weight: 350 },
  { id: 'zephyr_dancer', name: '流风舞者', color: '#d08050', belly: '#f0c0a0', fin: '#a05030', rarity: '少见', points: 17, size: 0.94, blurb: '迅捷如风的蓝翼飞鱼，跃出水面时拖着一缕缕棉花糖般的云丝，落水无声。', weight: 350 },
  { id: 'geyser_wyrm', name: '间歇泉龙', color: '#e0a030', belly: '#f5d080', fin: '#c47a18', rarity: '少见', points: 27, size: 0.9, blurb: '一条无目的白蛇，平日休眠在间歇泉管道深处，只在冰封时被热水冲上地表。', weight: 350 },
  { id: 'crystal_angler', name: '晶刺鮟鱇', color: '#e85d4c', belly: '#fff0e8', fin: '#c43c30', rarity: '稀有', points: 51, size: 1.1, blurb: '额前悬着一枚六棱晶石的深海怪鱼，光芒能穿透洞穴的永夜，诱使猎物自投罗网。', weight: 90 },
  { id: 'stormray', name: '风暴鳐', color: '#7b8cff', belly: '#d0d8ff', fin: '#4a58c8', rarity: '稀有', points: 47, size: 1.06, blurb: '翼展布满电弧纹的银色鳐鱼，跃出水面时能引下一道微型闪电，劈开一瞬的白昼。', weight: 90 },
  { id: 'magma_salamander', name: '岩浆蝾螈', color: '#e0c040', belly: '#fff0a0', fin: '#c0a020', rarity: '稀有', points: 55, size: 1.14, blurb: '皮肤流淌着熔岩脉络的两栖生物，踏过之处水温骤升，连鱼线都开始发烫。', weight: 90 },
  { id: 'void_jellyfish', name: '虚空水母', color: '#ff8c40', belly: '#ffd0a0', fin: '#c86020', rarity: '史诗', points: 66, size: 1.07, blurb: '指尖穿过它的边缘时什么都碰不到，只感到一股彻骨的虚无爬上小臂，连水声都像被吸走了。', weight: 22 },
  { id: 'cloud_serpent', name: '云鳞蛟', color: '#ff6b9d', belly: '#ffd0e0', fin: '#c83060', rarity: '史诗', points: 79, size: 1.23, blurb: '握住它的一刻，掌心仿佛拢住了高空的风，冰凉而不可遏制的升力让手臂微微发颤，耳畔尽是流云摩擦的呜咽。', weight: 22 },
  { id: 'ember_barb', name: '烬棘鱼', color: '#40e0d0', belly: '#c0fff8', fin: '#20a090', rarity: '史诗', points: 72, size: 1.1, blurb: '鳞片烫得几乎握不住，空气中弥漫着焦枯的甜味，像刚刚熄灭的森林大火，鱼身轻震时带起火星迸溅的噼啪声。', weight: 22 },
  { id: 'moon_phoenix_fish', name: '月凰鱼', color: '#2dd4a8', belly: '#a8ffe0', fin: '#1a9a78', rarity: '传说', points: 136, size: 1.38, blurb: '手指刚触到它的冰晶鳍，月光就从你的掌纹里倾泻而出，你听见一声不属于水面的清啸，整个人被提成一缕冷焰，在满月的冰原上无声燃', weight: 5 },
  { id: 'starwhale', name: '星鲸', color: '#ff5a7a', belly: '#ffc0d0', fin: '#c03050', rarity: '传说', points: 128, size: 1.35, blurb: '指尖碰到那片半透明深蓝的瞬间，脚下的堤岸便褪成了深空，你正悬浮在缓缓旋转的银河上，它体内的星辉穿过你的胸膛，让你听见自己', weight: 5 },
  { id: 'time_eater', name: '时噬鱼', color: '#a0ffe8', belly: '#ffffff', fin: '#40c0a0', rarity: '神话', points: 176, size: 1.33, blurb: '将它托出水面的那一刻，所有声音都被它体内的表盘裂缝一口吞尽，你看见刚才的自己正站在钓点上朝你望来，而四周的虫鸣与风被拧成', weight: 1 },
  { id: 'bog_creeper', name: '沼行鱼', color: '#6a7a8a', belly: '#b0bcc8', fin: '#4a5a6a', rarity: '常见', points: 6, size: 0.77, blurb: '身体摊平如一片腐烂的阔叶，能在淤泥上匍匐爬行，受惊时蜷成枯球顺水滚走。', weight: 1000 },
  { id: 'bloat_toadfish', name: '鼓蟾鱼', color: '#e0a030', belly: '#f5d080', fin: '#c47a18', rarity: '少见', points: 23, size: 0.81, blurb: '鳃囊鼓胀如毒囊，布满暗紫色疣突，一离水就发出沉闷的咕哝声，吐出苦腥的雾气。', weight: 350 },
  { id: 'wraithwood_fish', name: '朽木灵鱼', color: '#c84ad0', belly: '#f0c0f8', fin: '#9030a0', rarity: '稀有', points: 43, size: 1.02, blurb: '半透明的身体内裹着枯木的纹理，游动时拖曳几缕黑烟，眼窝里飘着两团幽冥的磷火。', weight: 90 },
  { id: 'star_sand_darter', name: '星沙镖鲈', color: '#7a6a5a', belly: '#c8b8a8', fin: '#5a4a3a', rarity: '常见', points: 9, size: 0.81, blurb: '体侧嵌满荧蓝光点，每年随潮水涌入三角洲时，整片浅滩像倒悬的银河在脚下奔流。', weight: 1000 },
  { id: 'tidal_trout', name: '潮信鳟', color: '#d08050', belly: '#f0c0a0', fin: '#a05030', rarity: '少见', points: 25, size: 0.85, blurb: '鳞片泛着潮汐的银蓝光泽，只在朔望大潮时成群溯河，鳃盖开合间隐约传来海浪的节奏。', weight: 350 },
  { id: 'star_barge_whisker', name: '星舟巨鲶', color: '#9b5cff', belly: '#e0d0ff', fin: '#6a30c8', rarity: '史诗', points: 70, size: 1.22, blurb: '沉重的身躯压得钓竿呻吟，皮肤粗糙如冷却的熔岩，凑近能闻到铁锈和遥远星尘的干涩气味，它喉间发出的次声波让水面跳起细密的水珠', weight: 22 },
  { id: 'urn_hermit', name: '瓮居蟹', color: '#8b6b4a', belly: '#c4a882', fin: '#6a4e35', rarity: '常见', points: 10, size: 0.68, blurb: '寄居在碎裂的双耳陶瓮里，在沉船残骸间横行时，瓮中偶尔传出远古的低语与隐隐的钟鸣。', weight: 1000 },
  { id: 'rune_cod', name: '铭文鳕', color: '#d08050', belly: '#f0c0a0', fin: '#a05030', rarity: '少见', points: 19, size: 0.85, blurb: '侧线刻满失传的上古符文，游过覆满海藻的石柱时，那些文字会短暂地亮起琥珀色光芒。', weight: 350 },
  { id: 'sunken_wraith', name: '沉城幽魂鱼', color: '#40e0d0', belly: '#c0fff8', fin: '#20a090', rarity: '史诗', points: 60, size: 1.15, blurb: '触感滑腻而冰冷，散发出一股潮湿石灰与朽木的霉息，贴近耳朵时能听见水下钟楼残破的钟声在空腔里回荡。', weight: 22 },
  { id: 'sulfur_killie', name: '硫华鳉', color: '#8b6b4a', belly: '#c4a882', fin: '#6a4e35', rarity: '常见', points: 7, size: 0.71, blurb: '在滚烫的硫磺泉中游弋的鳉鱼，鳞片析出明黄的硫磺结晶，捞起晒干后划一根火柴就能点燃。', weight: 1000 },
  { id: 'steam_ray', name: '蒸汽鳐', color: '#d08050', belly: '#f0c0a0', fin: '#a05030', rarity: '少见', points: 24, size: 0.85, blurb: '从热瀑顶端一跃而下的扁鱼，喷气孔排出咻咻白烟，恍若一台微型蒸汽机车划破水幕。', weight: 350 },
  { id: 'magma_peacock_bass', name: '熔岩孔雀鲷', color: '#40c8a0', belly: '#a0ffe0', fin: '#209070', rarity: '稀有', points: 49, size: 1.08, blurb: '体侧矿脉交错，遇热会绽开孔雀尾屏般的虹彩，只在蒸汽最浓处露面，宛如打翻了一盒熔化的宝石。', weight: 90 },
  { id: 'mudskipper_perch', name: '泥蟹攀鲈', color: '#6a7a8a', belly: '#b0bcc8', fin: '#4a5a6a', rarity: '常见', points: 10, size: 0.8, blurb: '用强壮的胸鳍在泥滩上匍匐爬行，甲壳上糊满贝壳碎屑与枯叶，像一团会移动的垃圾堆。', weight: 1000 },
  { id: 'root_dragon', name: '气根龙', color: '#e0c040', belly: '#fff0a0', fin: '#c0a020', rarity: '稀有', points: 50, size: 1.09, blurb: '伪装成红树气根的细长鱼，能在空气中呼吸数小时，暴风雨后会扭动着攀上矮枝，等待下一场潮水。', weight: 90 },
  { id: 'prism_lanternfish', name: '棱镜灯鱼', color: '#3db8c8', belly: '#a8f0ff', fin: '#2a8aa8', rarity: '少见', points: 17, size: 0.95, blurb: '身体由无数微小水晶碎片聚合而成，游动时像一枚迪斯科球，在洞壁上泼洒旋转的虹光。', weight: 350 },
  { id: 'shard_shrimp', name: '碎晶虾', color: '#d08050', belly: '#f0c0a0', fin: '#a05030', rarity: '少见', points: 28, size: 0.85, blurb: '披着透明水晶甲壳的虾，双螯如同两柄玻璃匕首，敲击岩壁时会奏出风铃般的清脆音符。', weight: 350 },
  { id: 'crystal_leviathan', name: '洞天晶龙', color: '#2dd4a8', belly: '#a8ffe0', fin: '#1a9a78', rarity: '传说', points: 104, size: 1.39, blurb: '握住一片晶柱鳞片的刹那，四周的水体突然凝固成无数面棱镜，每一面都囚着一座正在旋转的陌生星空，你看见自己的倒影被拆分进千百', weight: 5 },
  { id: 'crucian', name: '鲫鱼', color: '#5a7a8a', belly: '#a8c0d0', fin: '#3a5a6a', rarity: '常见', points: 14, size: 0.71, blurb: '最常见的练手鱼，银灰色，憨头憨脑地咬钩。', weight: 1000 },
  { id: 'silver_dace', name: '银鲦', color: '#7a6a5a', belly: '#c8b8a8', fin: '#5a4a3a', rarity: '常见', points: 6, size: 0.7, blurb: '成群结队的小银鱼，阳光下鳞片闪成一片碎光。', weight: 1000 },
  { id: 'reed_perch', name: '芦苇鲈', color: '#e0a030', belly: '#f5d080', fin: '#c47a18', rarity: '少见', points: 20, size: 0.9, blurb: '潜伏在芦苇丛里的伏击手，背鳍带着锯齿状的纹路。', weight: 350 },
  { id: 'glow_jelly', name: '光水母', color: '#d08050', belly: '#f0c0a0', fin: '#a05030', rarity: '少见', points: 19, size: 0.98, blurb: '半透明的伞状身体里悬着一点幽蓝的光，随水流一缩一放。', weight: 350 },
  { id: 'moonscale_carp', name: '月鳞鲤', color: '#c84ad0', belly: '#f0c0f8', fin: '#9030a0', rarity: '稀有', points: 53, size: 1.12, blurb: '鳞片在夜色中泛着银白冷光，仿佛吞下了一小片月亮。据说它只会咬住倒映在水面的满月。', weight: 90 },
  { id: 'ember_carp', name: '熔岩鲤', color: '#7b8cff', belly: '#d0d8ff', fin: '#4a58c8', rarity: '稀有', points: 47, size: 1.06, blurb: '通体橙红，鳞缝里透出岩浆般的光，离水后仍微微发烫。', weight: 90 },
  { id: 'windveil_ray', name: '风纱鳐', color: '#40e0d0', belly: '#c0fff8', fin: '#20a090', rarity: '史诗', points: 72, size: 1.15, blurb: '轻得几乎不存在，出水后若不立即捧住，便如薄纱般被风撕走，只留一缕薄荷和雨前空气的清凉在指尖。', weight: 22 },
  { id: 'frostfin_eel', name: '霜鳍鳗', color: '#9b5cff', belly: '#e0d0ff', fin: '#6a30c8', rarity: '史诗', points: 72, size: 1.22, blurb: '握在手里凉得发疼，鳍尖的霜化在掌心，像攥着一把不肯停的冬天，松开后还能听见冰裂的细响在骨头里回荡。', weight: 22 },
  { id: 'clockwork_koi', name: '发条锦鲤', color: '#ff5a7a', belly: '#ffc0d0', fin: '#c03050', rarity: '传说', points: 108, size: 1.42, blurb: '手指覆上它打磨般的黄铜鳞片时，耳中的滴答声猛地扩成一座看不见的钟楼，无数透明的齿轮从你眼前啮合着升起，日与夜在你皮肤上像', weight: 5 },
  { id: 'the_first_drop', name: '「第一滴水」', color: '#a0ffe8', belly: '#ffffff', fin: '#40c0a0', rarity: '神话', points: 199, size: 1.51, blurb: '你小心翼翼地捧起这尾近乎不存在的水影，指尖却触到了一片混沌的冰凉，耳中猛然炸开天地初分时的第一声雷鸣，无数道原始的雨丝自', weight: 1 },
  { id: 'logo', name: '派派鱼', color: '#f99e2e', belly: '#fee94e', fin: '#e88820', rarity: '传说', points: 160, size: 1.25, blurb: '摸鱼派站点 logo 本鱼，路过记得打个招呼。', weight: 3 },
]

