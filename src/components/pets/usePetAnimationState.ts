import { computed, onBeforeUnmount, onMounted, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { usePetsStore, type PetConfirmedEvent } from '@/stores/pets'
import { petAnimationClip, type PetAnimationAction } from './animations'

function confirmedAction(event: PetConfirmedEvent): PetAnimationAction | null {
  if (event.kind === 'actions') {
    switch (event.action) {
      case 'feed': return 'eat'
      case 'water': return 'drink'
      case 'pet': return 'pet'
      case 'play': return 'play'
      default: return null
    }
  }
  if (event.kind === 'crafts') return 'work'
  if (['adoption', 'readoption', 'supplies', 'activities/claim', 'stories/claim'].includes(event.kind)) return 'celebrate'
  return null
}

/** 将当前活动与本次已确认操作投影为动作，不推算成长、不请求接口、不重播历史回执。 */
export function usePetAnimationState(now: Ref<number>, active: MaybeRefOrGetter<boolean>) {
  const pets = usePetsStore()
  const transient = ref<{ action: PetAnimationAction; sequence: number } | null>(null)
  let expiry: ReturnType<typeof setTimeout> | undefined
  function clear() { clearTimeout(expiry); expiry = undefined; transient.value = null }
  const baseAction = computed<PetAnimationAction>(() => {
    const activity = pets.pet?.activity
    if (pets.refreshNeeded || !activity || activity.endsAt <= now.value) return 'idle'
    if (activity.kind === 'rest') return 'sleep'
    if (activity.status === 'claimable') return 'idle'
    return activity.kind === 'outing' ? 'explore' : activity.kind === 'course' ? 'study' : 'work'
  })
  const action = computed(() => transient.value?.action ?? baseAction.value)
  const loop = computed(() => transient.value === null)
  const playbackKey = computed(() => transient.value
    ? `${pets.pet?.id}:confirmed:${transient.value.sequence}`
    : `${pets.pet?.id}:state:${baseAction.value}`)

  // 监听后来的确认信号；初次挂载和路由返回只展示当前活动，不补播上次喂食。
  watch(() => pets.confirmedEvent, event => {
    clear()
    if (!event || !toValue(active) || typeof document === 'undefined' || document.hidden
        || event.petId !== pets.pet?.id) return
    const next = confirmedAction(event)
    // 家园和桌宠只播放当前物种已有的动作，未知物种不借用其他宠物的素材。
    if (!next || !petAnimationClip(pets.pet.speciesId, next)) return
    transient.value = { action: next, sequence: event.sequence }
    // 媒体无法播放或结束事件丢失时有界退出，不能永久卡在一次性的动作中。
    expiry = setTimeout(clear, 12_000)
  }, { flush: 'sync' })
  watch(() => [pets.pet?.id, pets.pet?.speciesId, pets.busy, pets.refreshNeeded, toValue(active)] as const,
    ([petId, speciesId, busy, stale, enabled], previous) => {
      if (petId !== previous?.[0] || speciesId !== previous?.[1] || busy || stale || !enabled) clear()
    }, { flush: 'sync' })
  function end(key: string | number) { if (key === playbackKey.value) clear() }
  function visibility() { if (document.hidden) clear() }
  onMounted(() => document.addEventListener('visibilitychange', visibility))
  onBeforeUnmount(() => { clear(); document.removeEventListener('visibilitychange', visibility) })
  return { action, loop, playbackKey, end }
}
