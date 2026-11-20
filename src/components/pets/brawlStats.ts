export interface BrawlStats {
  maxHp: number
  attack: number
}

export const formatBattleStat = new Intl.NumberFormat('zh-CN').format

// 目录中的效果说明沿用旧展示单位，回合、概率及次数仍按原文显示。
export function formatBattleEffect(effect: string) {
  return effect.replace(/((?:加伤|减伤|回复|穿透最多)\s*)(\d+(?:\.\d+)?)(?![\d.%％])/g,
    (_, label: string, amount: string) => label + formatBattleStat(Math.round(Number(amount) * 100)))
}
