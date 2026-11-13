export const petAnimationActions = ['idle', 'eat', 'drink', 'pet', 'play', 'sleep', 'explore', 'study', 'work', 'celebrate'] as const

export type PetAnimationAction = typeof petAnimationActions[number]

export type PetAnimationClip = {
  src: string
  poster: string
}

const hexiaotunRoot = '/images/pets/animations/hexiaotun-v1'

// 素材目录是本地白名单，不根据服务端名称拼接任意视频地址，也不额外读取目录接口。
export function petAnimationClip(species: string, action: PetAnimationAction): PetAnimationClip | null {
  if (species !== 'hexiaotun' || !petAnimationActions.includes(action)) return null
  return { src: `${hexiaotunRoot}/${action}.webm`, poster: `${hexiaotunRoot}/${action}.webp` }
}
