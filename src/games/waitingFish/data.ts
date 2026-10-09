/** Auto-exported surface fishing data (from tutusagi/ai-fishing-game) */
export default {
  "rarity": {
    "common": {
      "label": "常见",
      "tag": "C",
      "weight": 1000,
      "discovery_bonus": 20
    },
    "uncommon": {
      "label": "少见",
      "tag": "U",
      "weight": 350,
      "discovery_bonus": 20
    },
    "rare": {
      "label": "稀有",
      "tag": "R",
      "weight": 90,
      "discovery_bonus": 20
    },
    "epic": {
      "label": "史诗",
      "tag": "E",
      "weight": 22,
      "discovery_bonus": 20
    },
    "legendary": {
      "label": "传说",
      "tag": "L",
      "weight": 5,
      "discovery_bonus": 20
    },
    "mythic": {
      "label": "神话",
      "tag": "M",
      "weight": 1,
      "discovery_bonus": 20
    }
  },
  "seasons": {
    "spring": {
      "id": "spring",
      "name": "春",
      "order": 0,
      "description": "水暖花开，鱼群活跃。",
      "tag_weight_mult": {
        "freshwater": 1.15
      }
    },
    "summer": {
      "id": "summer",
      "name": "夏",
      "order": 1,
      "description": "烈日当头，火元素的水域沸腾。",
      "tag_weight_mult": {
        "fire": 1.5
      }
    },
    "autumn": {
      "id": "autumn",
      "name": "秋",
      "order": 2,
      "description": "水温转凉，洄游的鱼群增多。",
      "tag_weight_mult": {
        "nocturnal": 1.2
      }
    },
    "winter": {
      "id": "winter",
      "name": "冬",
      "order": 3,
      "description": "万物沉静，深海的霜冷生物浮现。",
      "tag_weight_mult": {
        "deepsea": 1.3
      }
    }
  },
  "locations": {
    "mangrove_shoal": {
      "id": "mangrove_shoal",
      "name": "红树林浅滩",
      "description": "盘根错节的红树根扎进咸淡交界的浅水，退潮时露出满地跳动的小生物，气根迷宫里藏着伏击的眼睛。",
      "junk_chance_base": 0.1,
      "tag_weight_mult": {
        "brackish": 1.5,
        "armored": 1.3
      },
      "unlock_cost": 320,
      "available_seasons": [
        "spring",
        "summer",
        "autumn"
      ],
      "ambience": [
        "气生根之间响起弹涂鱼跳跃的啪啪声，像小孩在泥里拍巴掌。",
        "退潮了，树根上的藤壶闭合时发出细碎的嗒嗒声，连成一片。",
        "招潮蟹举着大螯从洞里探身，突然被一道水波吓了回去。"
      ],
      "character": "根丛里咬口又凶又贼，能拉上几条硬货，但真正称王的家伙从不搁浅在这种咸淡交界的迷宫里。"
    },
    "whispering_mire": {
      "id": "whispering_mire",
      "name": "耳语沼泽",
      "description": "终年浮着薄雾的沼泽，腐木与水汽间似有低语，越往深处水色越黑，脚下的泥不时咕嘟冒泡。",
      "junk_chance_base": 0.11,
      "tag_weight_mult": {
        "swamp": 1.6,
        "nocturnal": 1.3,
        "poison": 1.4
      },
      "unlock_cost": 200,
      "available_seasons": [
        "spring",
        "summer",
        "autumn"
      ],
      "ambience": [
        "雾霭深处飘来模糊的低语，刚凝神去听，就变成了风刮过树洞的呜呜声。",
        "沼气泡在泥面上炸开，带出一股腐甜的沼气，随即被湿冷吞没。",
        "枝头挂下的松萝轻拂水面，像老人用指尖反复写着同一个字。"
      ],
      "character": "黑水底下藏着沉甸甸的咬口，手感像拖一袋湿泥，只是那低语从不许诺什么惊世巨物。"
    },
    "starry_delta": {
      "id": "starry_delta",
      "name": "星河三角洲",
      "description": "大河入海的扇形浅滩，洄游季一到，亿万带荧光的鱼群涌入，整片水面像把银河倒扣在脚下。",
      "junk_chance_base": 0.09,
      "tag_weight_mult": {
        "brackish": 1.3,
        "glowing": 1.4,
        "migratory": 1.6
      },
      "unlock_cost": 480,
      "available_seasons": [
        "spring",
        "autumn"
      ],
      "ambience": [
        "无数河流在此交汇，水面倒映星空，分不清哪里是水，哪里是银河。",
        "夜鸟贴着水面飞过，翅膀尖点起一串发光的浮游生物。",
        "远处的船灯像一颗悬停的红色星辰，不时被涌浪轻轻托起。"
      ],
      "character": "洄游季的潮头才卷得来这些流光溢彩的猛兽，季节一过，整片浅滩空得像被偷走了魂。"
    },
    "sunken_ruins": {
      "id": "sunken_ruins",
      "name": "沉没遗迹",
      "description": "沉入海底的古城，断柱与残塔在幽蓝水光里若隐若现，退潮时才浮出水面，海藻间漂着说不清的低响。",
      "junk_chance_base": 0.08,
      "tag_weight_mult": {
        "deepsea": 1.4,
        "ancient": 1.7,
        "glowing": 1.3
      },
      "unlock_cost": 650,
      "available_seasons": [
        "autumn",
        "winter"
      ],
      "ambience": [
        "坍塌的拱门在水下透出模糊的影子，气泡从石缝里鱼贯而出，叮叮当当。",
        "水草缠绕着倾颓的柱身，随暗流来回摆动，像在给残垣梳理头发。",
        "钟楼的铜顶倒在沙地上，水流穿过它变形的腔体，发出深沉的瓮声。"
      ],
      "character": "断柱间的阴影咬钩极沉，像在和沉没的历史拔河——分量十足，却还够不上传说之名。"
    },
    "geyser_falls": {
      "id": "geyser_falls",
      "name": "间歇泉瀑布",
      "description": "层层热泉自岩壁喷涌而下汇成温瀑，蒸汽终年不散，再冷的天这里也暖意融融。",
      "junk_chance_base": 0.1,
      "tag_weight_mult": {
        "fire": 1.4,
        "mineral": 1.6
      },
      "unlock_cost": 400,
      "available_seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ],
      "ambience": [
        "间歇泉喷发前，大地深处传来一阵闷雷般的低吼，脚下的岩石都在颤抖。",
        "滚水柱冲天而起，嘶嘶声震耳欲聋，随即被风撕成滚烫的雨点。",
        "蒸汽散去时，空中悬着一道短暂的彩虹，水珠不断击穿它，又迅速重建。"
      ],
      "character": "温水里养出的全是暴脾气，上钩像拽着一团火，虽不算传说，也够你在篝火边吹上几年的。"
    },
    "crystal_cave": {
      "id": "crystal_cave",
      "name": "水晶洞",
      "description": "洞壁缀满巨大的六棱晶柱，每一束微光都被折射成漫天碎虹，洞中恒温，听得见水滴坠落的回响。",
      "junk_chance_base": 0.07,
      "tag_weight_mult": {
        "crystal": 1.7,
        "glowing": 1.4
      },
      "unlock_cost": 800,
      "available_seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ],
      "ambience": [
        "水滴从钟乳石尖坠落，打在洞底水潭上，回声在穹顶反复折叠。",
        "晶簇内部偶尔爆出一声微响，那是矿物正在生长，释放被囚了万年的应力。",
        "空气中的矿物味冰凉而清冽，深吸一口，仿佛能尝到石头的味道。"
      ],
      "character": "晶光把水底照得太透，敢在这儿巡游的大货都不怕被看穿——咬钩那一下，值回你掏的每一分钱。"
    },
    "moonlit_pond": {
      "id": "moonlit_pond",
      "name": "月光池塘",
      "description": "一汪静谧的池水，倒映着永远停在黄昏的天空。水面偶有涟漪，像有什么在月色下游动。",
      "junk_chance_base": 0.1,
      "tag_weight_mult": {
        "freshwater": 1.2,
        "nocturnal": 1.5
      },
      "unlock_cost": 0,
      "available_seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ],
      "ambience": [
        "夜鹭从柳树阴影里无声滑出，翅膀扇灭了几只萤火虫。",
        "水面上的月影被什么东西顶了一下，碎成银亮的圈，又慢慢合拢。",
        "芦苇深处传来拖长的咕咕声，像谁在水下打了个嗝。"
      ],
      "character": "表面温吞得像睡着了，可常夜钓的人会压低声音告诉你，底下偶尔游过不该属于这片小水的巨影。"
    },
    "reed_river": {
      "id": "reed_river",
      "name": "芦苇河",
      "description": "两岸芦苇沙沙作响，水流缓慢清澈，是练手的好去处。",
      "junk_chance_base": 0.12,
      "tag_weight_mult": {
        "freshwater": 1.3
      },
      "unlock_cost": 0,
      "available_seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ],
      "ambience": [
        "风梳过芦苇荡，千万根杆子互相摩擦，发出干涩的沙沙声。",
        "一只秧鸡在水边快速奔跑，脚步声像在敲小鼓。",
        "水流忽然变急，打着旋绕过一丛菖蒲，卷走了几片枯叶。"
      ],
      "character": "水浅流缓，练手正好，但老钓客都门儿清——这儿捞不出让人心跳加速的货。"
    },
    "abyssal_trench": {
      "id": "abyssal_trench",
      "name": "深渊海沟",
      "description": "深不见底的幽蓝海沟，越往下越冷，有微光在黑暗里游弋。",
      "junk_chance_base": 0.08,
      "tag_weight_mult": {
        "deepsea": 1.5,
        "glowing": 1.4
      },
      "unlock_cost": 300,
      "available_seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ],
      "ambience": [
        "无光的深水中，只有压力在耳膜上缓慢地收紧拳头。",
        "远处传来鲸类低沉的呜咽，被海水拉长成一条颤抖的线。",
        "发光的磷虾群突然炸开，像深空里爆破的星团，又立刻被黑暗吞没。"
      ],
      "character": "越往下放线，心跳越重——冷透骨髓的黑暗里，藏着那种一生或许只咬一次的传说。"
    },
    "floating_lake": {
      "id": "floating_lake",
      "name": "浮空之湖",
      "description": "悬在云端的一汪湖水，风从下方穿过，湖面像一面倒扣的镜子。",
      "junk_chance_base": 0.09,
      "tag_weight_mult": {
        "fantasy": 1.4,
        "wind": 1.5
      },
      "unlock_cost": 600,
      "available_seasons": [
        "spring",
        "summer",
        "autumn"
      ],
      "ambience": [
        "水流从浮岛的边缘坠落，在半空中散成银色的薄雾，被风撕成长条。",
        "云层在下方翻涌，偶尔裂开一道缝，露出底下针尖大小的海。",
        "悬空的根系垂入虚空，滴水声从极深的地方传上来，晚了整整一拍。"
      ],
      "character": "悬在天上的水不认常理，传说级的巨影在这里不是念想，是老钓手反复擦拭的勋章。"
    },
    "lava_spring": {
      "id": "lava_spring",
      "name": "熔岩温泉",
      "description": "翻涌着橙红气泡的温泉，水里游着不怕烫的奇异生物。仅夏季开放。",
      "junk_chance_base": 0.1,
      "tag_weight_mult": {
        "fire": 1.6
      },
      "unlock_cost": 550,
      "available_seasons": [
        "summer"
      ],
      "ambience": [
        "水面咕嘟嘟翻起稠密的气泡，破裂时溅出硫磺味的热汽。",
        "一块刚凝固的黑色玄武岩被水波推着，慢慢沉进了滚烫的泉眼。",
        "橘红色的光纹在水底忽明忽暗，像呼吸，又像在讲故事。"
      ],
      "character": "只有盛夏的几个月烫得刚好能下竿，那种浑身冒火的烈性子错过此刻，就得再等一年。"
    }
  },
  "fish": {
    "mud_carp": {
      "id": "mud_carp",
      "name": "泥鲤",
      "rarity": "common",
      "description": "一身粗粝的褐色鳞片，终日拱食河底淤泥，出水时甩你半脸泥点子。",
      "size_min": 10,
      "size_max": 35,
      "size_unit": "cm",
      "base_value": 11,
      "tags": [
        "freshwater"
      ],
      "locations": [
        "moonlit_pond",
        "reed_river",
        "whispering_mire",
        "starry_delta"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "ghost_shrimp": {
      "id": "ghost_shrimp",
      "name": "幽灵虾",
      "rarity": "common",
      "description": "透明的身子只剩两粒黑眼珠像浮空的芝麻，成群漂过时，仿佛水下起了一阵玻璃雨。",
      "size_min": 3,
      "size_max": 12,
      "size_unit": "cm",
      "base_value": 10,
      "tags": [
        "freshwater",
        "nocturnal"
      ],
      "locations": [
        "moonlit_pond",
        "reed_river",
        "mangrove_shoal",
        "whispering_mire",
        "starry_delta"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "flicker_minnow": {
      "id": "flicker_minnow",
      "name": "荧鳞鲦",
      "rarity": "common",
      "description": "体侧一道荧蓝细线如同划着的火柴，暗处成群游动时，能照亮半张脸。",
      "size_min": 4,
      "size_max": 14,
      "size_unit": "cm",
      "base_value": 9,
      "tags": [
        "freshwater",
        "nocturnal"
      ],
      "locations": [
        "moonlit_pond",
        "reed_river"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn"
      ]
    },
    "angler_fry": {
      "id": "angler_fry",
      "name": "灯鮟鱇",
      "rarity": "common",
      "description": "小如拇指的深海鮟鱇，额顶灯笼在无边黑暗中连成一串坠向海底的星链。",
      "size_min": 4,
      "size_max": 18,
      "size_unit": "cm",
      "base_value": 12,
      "tags": [
        "deepsea",
        "glowing"
      ],
      "locations": [
        "abyssal_trench",
        "sunken_ruins"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "sky_skipper": {
      "id": "sky_skipper",
      "name": "跃空鱼",
      "rarity": "common",
      "description": "胸鳍拉成薄膜翼，能掠出水面滑翔数米，溅起的水雾里总挂着一小截虹。",
      "size_min": 8,
      "size_max": 22,
      "size_unit": "cm",
      "base_value": 12,
      "tags": [
        "fantasy",
        "wind"
      ],
      "locations": [
        "floating_lake",
        "starry_delta"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn"
      ]
    },
    "frost_drifter": {
      "id": "frost_drifter",
      "name": "霜漂鱼",
      "rarity": "common",
      "description": "身体像一片薄冰，体内氦气与寒气让它悬在水层中，阳光穿透时棱镜光碎成十几片。",
      "size_min": 6,
      "size_max": 20,
      "size_unit": "cm",
      "base_value": 11,
      "tags": [
        "fantasy",
        "wind"
      ],
      "locations": [
        "floating_lake",
        "starry_delta"
      ],
      "seasons": [
        "autumn"
      ]
    },
    "scorched_tetra": {
      "id": "scorched_tetra",
      "name": "焦鳞灯鱼",
      "rarity": "common",
      "description": "赤褐色的鳞片布满灼痕，在沸水里悠然自得，仿佛刚出炉的火炭块。",
      "size_min": 5,
      "size_max": 15,
      "size_unit": "cm",
      "base_value": 13,
      "tags": [
        "fire"
      ],
      "locations": [
        "lava_spring",
        "geyser_falls"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "shard_fish": {
      "id": "shard_fish",
      "name": "晶片鱼",
      "rarity": "common",
      "description": "身躯如同碎裂的水晶，折射出成千上万道细虹，游动时整个洞穴都在闪光。",
      "size_min": 7,
      "size_max": 18,
      "size_unit": "cm",
      "base_value": 12,
      "tags": [
        "crystal",
        "glowing"
      ],
      "locations": [
        "crystal_cave"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "jelly_phantom": {
      "id": "jelly_phantom",
      "name": "幻水母",
      "rarity": "common",
      "description": "半透明的伞帽悬浮着，触手拖曳星尘般的微光，穿过它能看到对岸扭曲的影子。",
      "size_min": 8,
      "size_max": 25,
      "size_unit": "cm",
      "base_value": 11,
      "tags": [
        "fantasy",
        "glowing"
      ],
      "locations": [
        "floating_lake",
        "crystal_cave"
      ],
      "seasons": [
        "spring",
        "summer"
      ]
    },
    "winter_cinder": {
      "id": "winter_cinder",
      "name": "冬烬鱼",
      "rarity": "common",
      "description": "灰白色的鳞片下隐约透着将熄的火光，只在寒冬温泉的石缝里成群打转。",
      "size_min": 5,
      "size_max": 14,
      "size_unit": "cm",
      "base_value": 11,
      "tags": [
        "fire"
      ],
      "locations": [
        "lava_spring",
        "geyser_falls"
      ],
      "seasons": [
        "winter"
      ]
    },
    "silver_pike": {
      "id": "silver_pike",
      "name": "银梭鱼",
      "rarity": "uncommon",
      "description": "细长如标枪的掠食者，鳞片是冷冽的银色，出水时甩起一串水珠。",
      "size_min": 20,
      "size_max": 55,
      "size_unit": "cm",
      "base_value": 26,
      "tags": [
        "freshwater"
      ],
      "locations": [
        "moonlit_pond",
        "reed_river"
      ],
      "seasons": [
        "spring",
        "autumn"
      ]
    },
    "dusk_eel": {
      "id": "dusk_eel",
      "name": "暮色鳗",
      "rarity": "uncommon",
      "description": "暗紫色的细鳗只在黄昏从泥洞里探出，像一条会流动的影子。",
      "size_min": 25,
      "size_max": 60,
      "size_unit": "cm",
      "base_value": 24,
      "tags": [
        "freshwater",
        "nocturnal"
      ],
      "locations": [
        "moonlit_pond",
        "reed_river",
        "mangrove_shoal",
        "whispering_mire"
      ],
      "seasons": [
        "spring",
        "autumn"
      ]
    },
    "copper_bream": {
      "id": "copper_bream",
      "name": "铜鲂",
      "rarity": "uncommon",
      "description": "宽扁的身体覆着一层铜绿般的鳞，在水草间折射出锈迹似的光晕。",
      "size_min": 18,
      "size_max": 45,
      "size_unit": "cm",
      "base_value": 22,
      "tags": [
        "freshwater",
        "armored"
      ],
      "locations": [
        "moonlit_pond",
        "reed_river",
        "whispering_mire"
      ],
      "seasons": [
        "summer",
        "autumn"
      ]
    },
    "cinder_loach": {
      "id": "cinder_loach",
      "name": "余烬泥鳅",
      "rarity": "uncommon",
      "description": "暗红色的泥鳅在热沙里钻进钻出，体表不时爆出细小的火星，烫得鱼线微微发颤。",
      "size_min": 10,
      "size_max": 28,
      "size_unit": "cm",
      "base_value": 28,
      "tags": [
        "fire"
      ],
      "locations": [
        "lava_spring",
        "geyser_falls"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn"
      ]
    },
    "deep_sculpin": {
      "id": "deep_sculpin",
      "name": "深岩杜父鱼",
      "rarity": "uncommon",
      "description": "长着骨质甲板的怪鱼，趴在海底淤泥里像一块会呼吸的石头，专等粗心的猎物。",
      "size_min": 15,
      "size_max": 40,
      "size_unit": "cm",
      "base_value": 30,
      "tags": [
        "deepsea",
        "armored"
      ],
      "locations": [
        "abyssal_trench",
        "sunken_ruins"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "mangrove_snapper": {
      "id": "mangrove_snapper",
      "name": "红树鲷",
      "rarity": "uncommon",
      "description": "披着青褐色装甲的鲷鱼，在红树气根迷宫间伏击，一双眼珠有潜望镜的冷静。",
      "size_min": 20,
      "size_max": 50,
      "size_unit": "cm",
      "base_value": 25,
      "tags": [
        "brackish",
        "armored"
      ],
      "locations": [
        "mangrove_shoal"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn"
      ]
    },
    "winter_betta": {
      "id": "winter_betta",
      "name": "雪华斗鱼",
      "rarity": "uncommon",
      "description": "尾鳍绽开如一朵完整的雪花，在冰水里游动时，周遭会凝结出一圈细碎冰晶。",
      "size_min": 12,
      "size_max": 30,
      "size_unit": "cm",
      "base_value": 27,
      "tags": [
        "freshwater",
        "fantasy"
      ],
      "locations": [
        "moonlit_pond",
        "reed_river",
        "floating_lake",
        "starry_delta"
      ],
      "seasons": [
        "winter"
      ]
    },
    "zephyr_dancer": {
      "id": "zephyr_dancer",
      "name": "流风舞者",
      "rarity": "uncommon",
      "description": "迅捷如风的蓝翼飞鱼，跃出水面时拖着一缕缕棉花糖般的云丝，落水无声。",
      "size_min": 15,
      "size_max": 40,
      "size_unit": "cm",
      "base_value": 24,
      "tags": [
        "wind",
        "fantasy"
      ],
      "locations": [
        "floating_lake",
        "starry_delta"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn"
      ]
    },
    "geyser_wyrm": {
      "id": "geyser_wyrm",
      "name": "间歇泉龙",
      "rarity": "uncommon",
      "description": "一条无目的白蛇，平日休眠在间歇泉管道深处，只在冰封时被热水冲上地表。",
      "size_min": 30,
      "size_max": 80,
      "size_unit": "cm",
      "base_value": 29,
      "tags": [
        "fire",
        "fantasy"
      ],
      "locations": [
        "lava_spring",
        "geyser_falls"
      ],
      "seasons": [
        "winter"
      ]
    },
    "crystal_angler": {
      "id": "crystal_angler",
      "name": "晶刺鮟鱇",
      "rarity": "rare",
      "description": "额前悬着一枚六棱晶石的深海怪鱼，光芒能穿透洞穴的永夜，诱使猎物自投罗网。",
      "size_min": 15,
      "size_max": 45,
      "size_unit": "cm",
      "base_value": 100,
      "tags": [
        "deepsea",
        "glowing",
        "crystal"
      ],
      "locations": [
        "crystal_cave",
        "abyssal_trench"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "stormray": {
      "id": "stormray",
      "name": "风暴鳐",
      "rarity": "rare",
      "description": "翼展布满电弧纹的银色鳐鱼，跃出水面时能引下一道微型闪电，劈开一瞬的白昼。",
      "size_min": 40,
      "size_max": 80,
      "size_unit": "cm",
      "base_value": 110,
      "tags": [
        "fantasy",
        "wind",
        "electric"
      ],
      "locations": [
        "floating_lake",
        "starry_delta"
      ],
      "seasons": [
        "spring",
        "autumn"
      ]
    },
    "magma_salamander": {
      "id": "magma_salamander",
      "name": "岩浆蝾螈",
      "rarity": "rare",
      "description": "皮肤流淌着熔岩脉络的两栖生物，踏过之处水温骤升，连鱼线都开始发烫。",
      "size_min": 25,
      "size_max": 55,
      "size_unit": "cm",
      "base_value": 120,
      "tags": [
        "fire",
        "fantasy"
      ],
      "locations": [
        "lava_spring",
        "geyser_falls"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn"
      ]
    },
    "void_jellyfish": {
      "id": "void_jellyfish",
      "name": "虚空水母",
      "rarity": "epic",
      "description": "指尖穿过它的边缘时什么都碰不到，只感到一股彻骨的虚无爬上小臂，连水声都像被吸走了。",
      "size_min": 50,
      "size_max": 90,
      "size_unit": "cm",
      "base_value": 200,
      "tags": [
        "deepsea",
        "glowing",
        "shadow"
      ],
      "locations": [
        "abyssal_trench",
        "sunken_ruins"
      ],
      "seasons": [
        "autumn",
        "winter"
      ]
    },
    "cloud_serpent": {
      "id": "cloud_serpent",
      "name": "云鳞蛟",
      "rarity": "epic",
      "description": "握住它的一刻，掌心仿佛拢住了高空的风，冰凉而不可遏制的升力让手臂微微发颤，耳畔尽是流云摩擦的呜咽。",
      "size_min": 60,
      "size_max": 130,
      "size_unit": "cm",
      "base_value": 220,
      "tags": [
        "fantasy",
        "wind",
        "migratory"
      ],
      "locations": [
        "floating_lake",
        "starry_delta"
      ],
      "seasons": [
        "spring"
      ]
    },
    "ember_barb": {
      "id": "ember_barb",
      "name": "烬棘鱼",
      "rarity": "epic",
      "description": "鳞片烫得几乎握不住，空气中弥漫着焦枯的甜味，像刚刚熄灭的森林大火，鱼身轻震时带起火星迸溅的噼啪声。",
      "size_min": 35,
      "size_max": 65,
      "size_unit": "cm",
      "base_value": 180,
      "tags": [
        "fire",
        "armored"
      ],
      "locations": [
        "lava_spring",
        "geyser_falls"
      ],
      "seasons": [
        "summer"
      ]
    },
    "moon_phoenix_fish": {
      "id": "moon_phoenix_fish",
      "name": "月凰鱼",
      "rarity": "legendary",
      "description": "手指刚触到它的冰晶鳍，月光就从你的掌纹里倾泻而出，你听见一声不属于水面的清啸，整个人被提成一缕冷焰，在满月的冰原上无声燃烧——直到它从掌心滑脱，你才落回自己的骨头里。",
      "size_min": 50,
      "size_max": 90,
      "size_unit": "cm",
      "base_value": 450,
      "tags": [
        "freshwater",
        "nocturnal",
        "fantasy"
      ],
      "locations": [
        "moonlit_pond"
      ],
      "seasons": [
        "winter"
      ]
    },
    "starwhale": {
      "id": "starwhale",
      "name": "星鲸",
      "rarity": "legendary",
      "description": "指尖碰到那片半透明深蓝的瞬间，脚下的堤岸便褪成了深空，你正悬浮在缓缓旋转的银河上，它体内的星辉穿过你的胸膛，让你听见自己血管里响起了古老的鲸歌，直到它一摆尾，世界才'咔'地落回原地。",
      "size_min": 200,
      "size_max": 450,
      "size_unit": "cm",
      "base_value": 480,
      "tags": [
        "deepsea",
        "fantasy",
        "glowing"
      ],
      "locations": [
        "abyssal_trench",
        "floating_lake"
      ],
      "seasons": [
        "winter"
      ]
    },
    "time_eater": {
      "id": "time_eater",
      "name": "时噬鱼",
      "rarity": "mythic",
      "description": "将它托出水面的那一刻，所有声音都被它体内的表盘裂缝一口吞尽，你看见刚才的自己正站在钓点上朝你望来，而四周的虫鸣与风被拧成可见的细丝，正被它一点点吸进破裂的钟面里，直到它微微颤动，时间才轰然倒灌，你的心跳重新响起。",
      "size_min": 1,
      "size_max": 999,
      "size_unit": "cm",
      "base_value": 1000,
      "tags": [
        "fantasy",
        "shadow",
        "deepsea"
      ],
      "locations": [
        "all"
      ],
      "seasons": [
        "all"
      ],
      "individual_weight": 0.3
    },
    "bog_creeper": {
      "id": "bog_creeper",
      "name": "沼行鱼",
      "rarity": "common",
      "description": "身体摊平如一片腐烂的阔叶，能在淤泥上匍匐爬行，受惊时蜷成枯球顺水滚走。",
      "size_min": 8,
      "size_max": 22,
      "size_unit": "cm",
      "base_value": 12,
      "tags": [
        "freshwater",
        "swamp",
        "nocturnal"
      ],
      "locations": [
        "whispering_mire"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "bloat_toadfish": {
      "id": "bloat_toadfish",
      "name": "鼓蟾鱼",
      "rarity": "uncommon",
      "description": "鳃囊鼓胀如毒囊，布满暗紫色疣突，一离水就发出沉闷的咕哝声，吐出苦腥的雾气。",
      "size_min": 15,
      "size_max": 38,
      "size_unit": "cm",
      "base_value": 27,
      "tags": [
        "freshwater",
        "swamp",
        "poison"
      ],
      "locations": [
        "whispering_mire"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn"
      ]
    },
    "wraithwood_fish": {
      "id": "wraithwood_fish",
      "name": "朽木灵鱼",
      "rarity": "rare",
      "description": "半透明的身体内裹着枯木的纹理，游动时拖曳几缕黑烟，眼窝里飘着两团幽冥的磷火。",
      "size_min": 25,
      "size_max": 55,
      "size_unit": "cm",
      "base_value": 105,
      "tags": [
        "freshwater",
        "swamp",
        "nocturnal",
        "poison"
      ],
      "locations": [
        "whispering_mire"
      ],
      "seasons": [
        "spring",
        "autumn"
      ]
    },
    "star_sand_darter": {
      "id": "star_sand_darter",
      "name": "星沙镖鲈",
      "rarity": "common",
      "description": "体侧嵌满荧蓝光点，每年随潮水涌入三角洲时，整片浅滩像倒悬的银河在脚下奔流。",
      "size_min": 6,
      "size_max": 16,
      "size_unit": "cm",
      "base_value": 12,
      "tags": [
        "brackish",
        "glowing",
        "migratory"
      ],
      "locations": [
        "starry_delta"
      ],
      "seasons": [
        "spring",
        "autumn"
      ]
    },
    "tidal_trout": {
      "id": "tidal_trout",
      "name": "潮信鳟",
      "rarity": "uncommon",
      "description": "鳞片泛着潮汐的银蓝光泽，只在朔望大潮时成群溯河，鳃盖开合间隐约传来海浪的节奏。",
      "size_min": 30,
      "size_max": 60,
      "size_unit": "cm",
      "base_value": 26,
      "tags": [
        "brackish",
        "migratory",
        "fantasy"
      ],
      "locations": [
        "starry_delta"
      ],
      "seasons": [
        "spring",
        "autumn"
      ]
    },
    "star_barge_whisker": {
      "id": "star_barge_whisker",
      "name": "星舟巨鲶",
      "rarity": "epic",
      "description": "沉重的身躯压得钓竿呻吟，皮肤粗糙如冷却的熔岩，凑近能闻到铁锈和遥远星尘的干涩气味，它喉间发出的次声波让水面跳起细密的水珠。",
      "size_min": 120,
      "size_max": 220,
      "size_unit": "cm",
      "base_value": 220,
      "tags": [
        "brackish",
        "fantasy",
        "glowing",
        "migratory"
      ],
      "locations": [
        "starry_delta"
      ],
      "seasons": [
        "spring"
      ]
    },
    "urn_hermit": {
      "id": "urn_hermit",
      "name": "瓮居蟹",
      "rarity": "common",
      "description": "寄居在碎裂的双耳陶瓮里，在沉船残骸间横行时，瓮中偶尔传出远古的低语与隐隐的钟鸣。",
      "size_min": 5,
      "size_max": 15,
      "size_unit": "cm",
      "base_value": 11,
      "tags": [
        "deepsea",
        "ancient"
      ],
      "locations": [
        "sunken_ruins"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "rune_cod": {
      "id": "rune_cod",
      "name": "铭文鳕",
      "rarity": "uncommon",
      "description": "侧线刻满失传的上古符文，游过覆满海藻的石柱时，那些文字会短暂地亮起琥珀色光芒。",
      "size_min": 30,
      "size_max": 65,
      "size_unit": "cm",
      "base_value": 28,
      "tags": [
        "deepsea",
        "ancient",
        "glowing"
      ],
      "locations": [
        "sunken_ruins"
      ],
      "seasons": [
        "autumn",
        "winter"
      ]
    },
    "sunken_wraith": {
      "id": "sunken_wraith",
      "name": "沉城幽魂鱼",
      "rarity": "epic",
      "description": "触感滑腻而冰冷，散发出一股潮湿石灰与朽木的霉息，贴近耳朵时能听见水下钟楼残破的钟声在空腔里回荡。",
      "size_min": 70,
      "size_max": 130,
      "size_unit": "cm",
      "base_value": 230,
      "tags": [
        "deepsea",
        "ancient",
        "glowing",
        "shadow"
      ],
      "locations": [
        "sunken_ruins"
      ],
      "seasons": [
        "autumn",
        "winter"
      ]
    },
    "sulfur_killie": {
      "id": "sulfur_killie",
      "name": "硫华鳉",
      "rarity": "common",
      "description": "在滚烫的硫磺泉中游弋的鳉鱼，鳞片析出明黄的硫磺结晶，捞起晒干后划一根火柴就能点燃。",
      "size_min": 4,
      "size_max": 12,
      "size_unit": "cm",
      "base_value": 13,
      "tags": [
        "fire",
        "mineral"
      ],
      "locations": [
        "geyser_falls"
      ],
      "seasons": [
        "summer",
        "autumn"
      ]
    },
    "steam_ray": {
      "id": "steam_ray",
      "name": "蒸汽鳐",
      "rarity": "uncommon",
      "description": "从热瀑顶端一跃而下的扁鱼，喷气孔排出咻咻白烟，恍若一台微型蒸汽机车划破水幕。",
      "size_min": 35,
      "size_max": 70,
      "size_unit": "cm",
      "base_value": 29,
      "tags": [
        "fire",
        "mineral"
      ],
      "locations": [
        "geyser_falls"
      ],
      "seasons": [
        "spring",
        "summer"
      ]
    },
    "magma_peacock_bass": {
      "id": "magma_peacock_bass",
      "name": "熔岩孔雀鲷",
      "rarity": "rare",
      "description": "体侧矿脉交错，遇热会绽开孔雀尾屏般的虹彩，只在蒸汽最浓处露面，宛如打翻了一盒熔化的宝石。",
      "size_min": 28,
      "size_max": 52,
      "size_unit": "cm",
      "base_value": 110,
      "tags": [
        "fire",
        "mineral",
        "fantasy"
      ],
      "locations": [
        "geyser_falls"
      ],
      "seasons": [
        "summer"
      ]
    },
    "mudskipper_perch": {
      "id": "mudskipper_perch",
      "name": "泥蟹攀鲈",
      "rarity": "common",
      "description": "用强壮的胸鳍在泥滩上匍匐爬行，甲壳上糊满贝壳碎屑与枯叶，像一团会移动的垃圾堆。",
      "size_min": 12,
      "size_max": 28,
      "size_unit": "cm",
      "base_value": 11,
      "tags": [
        "brackish",
        "armored"
      ],
      "locations": [
        "mangrove_shoal"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn"
      ]
    },
    "root_dragon": {
      "id": "root_dragon",
      "name": "气根龙",
      "rarity": "rare",
      "description": "伪装成红树气根的细长鱼，能在空气中呼吸数小时，暴风雨后会扭动着攀上矮枝，等待下一场潮水。",
      "size_min": 40,
      "size_max": 75,
      "size_unit": "cm",
      "base_value": 95,
      "tags": [
        "brackish",
        "fantasy"
      ],
      "locations": [
        "mangrove_shoal"
      ],
      "seasons": [
        "spring",
        "summer"
      ]
    },
    "prism_lanternfish": {
      "id": "prism_lanternfish",
      "name": "棱镜灯鱼",
      "rarity": "uncommon",
      "description": "身体由无数微小水晶碎片聚合而成，游动时像一枚迪斯科球，在洞壁上泼洒旋转的虹光。",
      "size_min": 10,
      "size_max": 25,
      "size_unit": "cm",
      "base_value": 28,
      "tags": [
        "crystal",
        "glowing"
      ],
      "locations": [
        "crystal_cave"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "shard_shrimp": {
      "id": "shard_shrimp",
      "name": "碎晶虾",
      "rarity": "uncommon",
      "description": "披着透明水晶甲壳的虾，双螯如同两柄玻璃匕首，敲击岩壁时会奏出风铃般的清脆音符。",
      "size_min": 12,
      "size_max": 30,
      "size_unit": "cm",
      "base_value": 30,
      "tags": [
        "crystal",
        "armored"
      ],
      "locations": [
        "crystal_cave"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "crystal_leviathan": {
      "id": "crystal_leviathan",
      "name": "洞天晶龙",
      "rarity": "legendary",
      "description": "握住一片晶柱鳞片的刹那，四周的水体突然凝固成无数面棱镜，每一面都囚着一座正在旋转的陌生星空，你看见自己的倒影被拆分进千百个不同的星系里，同时听见水晶岩洞深处传来一声悠长的吐息，直到它游走，所有镜面才碎成无声的荧光。",
      "size_min": 150,
      "size_max": 280,
      "size_unit": "cm",
      "base_value": 480,
      "tags": [
        "crystal",
        "glowing",
        "fantasy"
      ],
      "locations": [
        "crystal_cave"
      ],
      "seasons": [
        "winter"
      ],
      "individual_weight": 0.6
    },
    "crucian": {
      "id": "crucian",
      "name": "鲫鱼",
      "rarity": "common",
      "description": "最常见的练手鱼，银灰色，憨头憨脑地咬钩。",
      "size_min": 8,
      "size_max": 25,
      "size_unit": "cm",
      "base_value": 11,
      "tags": [
        "freshwater"
      ],
      "locations": [
        "moonlit_pond",
        "reed_river"
      ],
      "seasons": [
        "all"
      ]
    },
    "silver_dace": {
      "id": "silver_dace",
      "name": "银鲦",
      "rarity": "common",
      "description": "成群结队的小银鱼，阳光下鳞片闪成一片碎光。",
      "size_min": 6,
      "size_max": 18,
      "size_unit": "cm",
      "base_value": 10,
      "tags": [
        "freshwater"
      ],
      "locations": [
        "reed_river"
      ],
      "seasons": [
        "all"
      ]
    },
    "reed_perch": {
      "id": "reed_perch",
      "name": "芦苇鲈",
      "rarity": "uncommon",
      "description": "潜伏在芦苇丛里的伏击手，背鳍带着锯齿状的纹路。",
      "size_min": 15,
      "size_max": 40,
      "size_unit": "cm",
      "base_value": 22,
      "tags": [
        "freshwater"
      ],
      "locations": [
        "reed_river",
        "moonlit_pond"
      ],
      "seasons": [
        "spring",
        "summer"
      ]
    },
    "glow_jelly": {
      "id": "glow_jelly",
      "name": "光水母",
      "rarity": "uncommon",
      "description": "半透明的伞状身体里悬着一点幽蓝的光，随水流一缩一放。",
      "size_min": 10,
      "size_max": 35,
      "size_unit": "cm",
      "base_value": 28,
      "tags": [
        "deepsea",
        "glowing",
        "nocturnal"
      ],
      "locations": [
        "abyssal_trench"
      ],
      "seasons": [
        "all"
      ]
    },
    "moonscale_carp": {
      "id": "moonscale_carp",
      "name": "月鳞鲤",
      "rarity": "rare",
      "description": "鳞片在夜色中泛着银白冷光，仿佛吞下了一小片月亮。据说它只会咬住倒映在水面的满月。",
      "size_min": 20,
      "size_max": 60,
      "size_unit": "cm",
      "base_value": 80,
      "tags": [
        "freshwater",
        "nocturnal"
      ],
      "locations": [
        "moonlit_pond"
      ],
      "seasons": [
        "autumn",
        "winter"
      ]
    },
    "ember_carp": {
      "id": "ember_carp",
      "name": "熔岩鲤",
      "rarity": "rare",
      "description": "通体橙红，鳞缝里透出岩浆般的光，离水后仍微微发烫。",
      "size_min": 18,
      "size_max": 55,
      "size_unit": "cm",
      "base_value": 110,
      "tags": [
        "fire"
      ],
      "locations": [
        "lava_spring"
      ],
      "seasons": [
        "summer"
      ]
    },
    "windveil_ray": {
      "id": "windveil_ray",
      "name": "风纱鳐",
      "rarity": "epic",
      "description": "轻得几乎不存在，出水后若不立即捧住，便如薄纱般被风撕走，只留一缕薄荷和雨前空气的清凉在指尖。",
      "size_min": 25,
      "size_max": 70,
      "size_unit": "cm",
      "base_value": 180,
      "tags": [
        "fantasy",
        "wind"
      ],
      "locations": [
        "floating_lake"
      ],
      "seasons": [
        "spring",
        "summer",
        "autumn"
      ]
    },
    "frostfin_eel": {
      "id": "frostfin_eel",
      "name": "霜鳍鳗",
      "rarity": "epic",
      "description": "握在手里凉得发疼，鳍尖的霜化在掌心，像攥着一把不肯停的冬天，松开后还能听见冰裂的细响在骨头里回荡。",
      "size_min": 30,
      "size_max": 90,
      "size_unit": "cm",
      "base_value": 220,
      "tags": [
        "deepsea",
        "glowing"
      ],
      "locations": [
        "abyssal_trench"
      ],
      "seasons": [
        "winter"
      ]
    },
    "clockwork_koi": {
      "id": "clockwork_koi",
      "name": "发条锦鲤",
      "rarity": "legendary",
      "description": "手指覆上它打磨般的黄铜鳞片时，耳中的滴答声猛地扩成一座看不见的钟楼，无数透明的齿轮从你眼前啮合着升起，日与夜在你皮肤上像翻书一样快速明灭，你闻到了时间本身的气味——旧铜、干涸的机油和亿万个正午的暴晒，直到它一甩尾，你才从时间的齿缝里跌回岸边。",
      "size_min": 30,
      "size_max": 80,
      "size_unit": "cm",
      "base_value": 400,
      "tags": [
        "fantasy"
      ],
      "locations": [
        "floating_lake"
      ],
      "seasons": [
        "all"
      ]
    },
    "the_first_drop": {
      "id": "the_first_drop",
      "name": "「第一滴水」",
      "rarity": "mythic",
      "description": "你小心翼翼地捧起这尾近乎不存在的水影，指尖却触到了一片混沌的冰凉，耳中猛然炸开天地初分时的第一声雷鸣，无数道原始的雨丝自虚空垂落，在你眼前汇成海洋、冲积出河床，直到它轻轻滑回水中，这场只有你目睹的创世暴雨才骤然停歇。",
      "size_min": 1,
      "size_max": 30,
      "size_unit": "cm",
      "base_value": 1000,
      "tags": [
        "fantasy"
      ],
      "locations": [
        "all"
      ],
      "seasons": [
        "all"
      ],
      "individual_weight": 1.0
    }
  },
  "baits": {
    "basic_worm": {
      "id": "basic_worm",
      "name": "普通蚯蚓",
      "cost": 10,
      "description": "最朴素的蚯蚓，没有任何特殊效果，胜在便宜。",
      "effects": {}
    },
    "glow_bait": {
      "id": "glow_bait",
      "name": "夜光饵",
      "cost": 35,
      "description": "在黑暗中散发幽幽蓝光，对夜行性鱼类格外有吸引力。",
      "effects": {
        "rarity_weight_mult": {
          "rare": 1.5,
          "epic": 1.3
        },
        "tag_weight_mult": {
          "nocturnal": 2.0
        },
        "junk_chance_mult": 0.8
      }
    },
    "golden_lure": {
      "id": "golden_lure",
      "name": "黄金亮片",
      "cost": 80,
      "description": "华丽的金色旋转亮片，专挑大货：压住普通小鱼的咬口、把机会让给稀有及以上的稀客，还更少缠上杂物。（这片水域有稀有鱼时才划算）",
      "effects": {
        "rarity_weight_mult": {
          "common": 0.5,
          "uncommon": 0.8,
          "rare": 1.4,
          "epic": 1.6,
          "legendary": 2.0,
          "mythic": 2.0
        },
        "junk_chance_mult": 0.7
      }
    }
  }
} as const
