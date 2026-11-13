export const petAnimationActions = ['idle', 'eat', 'drink', 'pet', 'play', 'sleep', 'explore', 'study', 'work', 'celebrate'] as const

export type PetAnimationAction = typeof petAnimationActions[number]

export type PetAnimationClip = {
  src: string
  poster: string
}

const petAnimationRoots = new Map<string, string>([
  ['hexiaotun', '/images/pets/animations/hexiaotun-v1'],
  ['momota', '/images/pets/animations/momota-v1'],
  ['yubingmiao', '/images/pets/animations/yubingmiao-v1'],
  ['paixiaoyu', '/images/pets/animations/paixiaoyu-v1'],
])

// 素材目录是本地白名单，不根据服务端名称拼接任意视频地址，也不额外读取目录接口。
export function petAnimationClip(species: string, action: PetAnimationAction): PetAnimationClip | null {
  const root = petAnimationRoots.get(species)
  if (!root || !petAnimationActions.includes(action)) return null
  return { src: `${root}/${action}.webm`, poster: `${root}/${action}.webp` }
}
