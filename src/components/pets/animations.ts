export const petAnimationActions = ['idle', 'eat', 'drink', 'pet', 'play', 'sleep', 'explore', 'study', 'work', 'celebrate'] as const

export type PetAnimationAction = typeof petAnimationActions[number]

export type PetAnimationClip = {
  src: string
  poster: string
}

// 素材来自 RhyPic 的固定白名单，不按接口返回值拼接外部地址。
const petMedia = new Map<string, { portrait: string; clips: Record<PetAnimationAction, PetAnimationClip> }>([
  ['hexiaotun', {
    portrait: 'https://file.fishpi.cn/yui/files/2026/11/13/271705.webp',
    clips: {
      idle: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271628.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271629.webp' },
      eat: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271624.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271625.webp' },
      drink: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271622.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271623.webp' },
      pet: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271631.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271632.webp' },
      play: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271633.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271634.webp' },
      sleep: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271635.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271636.webp' },
      explore: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271626.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271627.webp' },
      study: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271637.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271638.webp' },
      work: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271639.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271640.webp' },
      celebrate: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271620.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271621.webp' },
    },
  }],
  ['momota', {
    portrait: 'https://file.fishpi.cn/yui/files/2026/11/13/271706.webp',
    clips: {
      idle: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271649.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271650.webp' },
      eat: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271645.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271646.webp' },
      drink: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271643.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271644.webp' },
      pet: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271652.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271653.webp' },
      play: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271654.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271655.webp' },
      sleep: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271656.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271657.webp' },
      explore: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271647.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271648.webp' },
      study: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271658.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271659.webp' },
      work: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271660.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271661.webp' },
      celebrate: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271641.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271642.webp' },
    },
  }],
  ['yubingmiao', {
    portrait: 'https://file.fishpi.cn/yui/files/2026/11/13/271708.webp',
    clips: {
      idle: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271692.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271693.webp' },
      eat: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271687.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271688.webp' },
      drink: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271685.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271686.webp' },
      pet: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271695.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271696.webp' },
      play: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271697.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271698.webp' },
      sleep: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271699.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271700.webp' },
      explore: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271689.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271690.webp' },
      study: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271701.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271702.webp' },
      work: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271703.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271704.webp' },
      celebrate: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271683.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271684.webp' },
    },
  }],
  ['paixiaoyu', {
    portrait: 'https://file.fishpi.cn/yui/files/2026/11/13/271707.webp',
    clips: {
      idle: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271670.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271671.webp' },
      eat: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271666.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271667.webp' },
      drink: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271664.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271665.webp' },
      pet: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271673.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271674.webp' },
      play: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271675.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271676.webp' },
      sleep: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271677.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271678.webp' },
      explore: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271668.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271669.webp' },
      study: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271679.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271680.webp' },
      work: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271681.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271682.webp' },
      celebrate: { src: 'https://file.fishpi.cn/yui/files/2026/11/13/271662.webm', poster: 'https://file.fishpi.cn/yui/files/2026/11/13/271663.webp' },
    },
  }],
])

export function petPortrait(species: string): string | undefined {
  return petMedia.get(species)?.portrait
}

export function petAnimationClip(species: string, action: PetAnimationAction): PetAnimationClip | null {
  if (!petAnimationActions.includes(action)) return null
  return petMedia.get(species)?.clips[action] ?? null
}
