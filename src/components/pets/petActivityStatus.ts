import type { Pet, PetSkillId } from '@/api/v3-pets'
import { petDuration } from './usePetClock'

/** 目录暂不可读时仍可给活动快照中的技能标识提供展示名称，不补造技能数值。 */
export const petSkillNames: Record<PetSkillId, string> = {
  vitality: '体能', exploration: '探索', knowledge: '知识', expression: '表达', crafting: '手作', kindness: '亲和',
}

export function petActivityStatus(activity: Pet['activity'], now: number): string {
  if (!activity) return '在家等你'
  const remaining = activity.endsAt - now
  if (activity.kind === 'rest') return remaining > 0 ? `休息中 · 还剩 ${petDuration(remaining)}` : '休息已结束'
  if (activity.status === 'claimable' || remaining <= 0) return `${activity.name}已完成 · 待领取`
  return `${activity.kind === 'outing' ? '外出' : '上课'}中 · 还剩 ${petDuration(remaining)}`
}
