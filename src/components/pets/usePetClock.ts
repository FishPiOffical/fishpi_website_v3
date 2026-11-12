import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { usePetsStore } from '@/stores/pets'

/** 只更新本地倒计时，不轮询接口，也不自行推算或覆盖养成数值。 */
export function usePetClock() {
  const pets = usePetsStore()
  const clock = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined
  const update = () => { if (!document.hidden) clock.value = Date.now() }
  onMounted(() => {
    timer = setInterval(update, 1000)
    document.addEventListener('visibilitychange', update)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', update)
  })
  const now = computed(() => (pets.state?.serverNow ?? 0) + Math.max(0, clock.value - pets.receivedAt))
  return { now }
}

export function petDuration(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}
