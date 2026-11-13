import { effectScope, onBeforeUnmount, onMounted, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'

type PetsStore = ReturnType<typeof usePetsStore>
type CareConsumer = () => boolean
interface CareWatcher { add: (consumer: CareConsumer) => void; remove: (consumer: CareConsumer) => void }
const watchers = new WeakMap<PetsStore, CareWatcher>()

/** 家园与桌宠共用一次到期核对，只使用服务端给出的可互动时间，不在本地推算饱食或水分。 */
export function usePetCareAvailability(active: CareConsumer = () => true) {
  const pets = usePetsStore(), auth = useAuthStore()
  let watcher: CareWatcher | undefined
  onMounted(() => {
    watcher = watchers.get(pets)
    if (!watcher) {
      watcher = createCareWatcher(pets, auth)
      watchers.set(pets, watcher)
    }
    watcher.add(active)
  })
  onBeforeUnmount(() => watcher?.remove(active))
}

function createCareWatcher(pets: PetsStore, auth: ReturnType<typeof useAuthStore>): CareWatcher {
  const scope = effectScope(true), consumers = new Map<CareConsumer, () => void>()
  const attempted = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let identity = ''
  function clearTimer() { clearTimeout(timer); timer = undefined }
  function schedule() {
    clearTimer()
    const context = `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}`
    if (context !== identity) { identity = context; attempted.clear() }
    const state = pets.state, pet = pets.pet
    if (!auth.isLoggedIn || !state || !pet || pet.activity || document.hidden || pets.offline || pets.loading || pets.busy || pets.pending || pets.refreshNeeded
      || ![...consumers.keys()].some(active => active())) return
    const deadlines = [pet.hunger >= 100 ? pet.careAvailableAt?.feed : undefined, pet.water >= 100 ? pet.careAvailableAt?.water : undefined]
      .filter((value): value is number => typeof value === 'number' && value > state.serverNow)
    const due = deadlines.filter(value => !attempted.has(`${pet.id}:${value}`)).sort((left, right) => left - right)[0]
    if (due === undefined) return
    const remaining = due - state.serverNow - Math.max(0, Date.now() - pets.receivedAt)
    timer = setTimeout(() => {
      timer = undefined
      // 即使状态变化与定时器恰好同轮发生，也不能跨账号、隐藏面板或未确认写操作发起读取。
      if (context !== `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}` || pets.state !== state || pets.pet?.id !== pet.id
        || !auth.isLoggedIn || document.hidden || pets.offline || pets.loading || pets.busy || pets.pending || pets.refreshNeeded
        || ![...consumers.keys()].some(active => active())) { schedule(); return }
      // 到期后先登记，多个面板或相同快照不会重复触发；失败交给既有手动恢复，不自行循环。
      attempted.add(`${pet.id}:${due}`)
      if (attempted.size > 32) attempted.delete(attempted.values().next().value!)
      void pets.refresh()
    }, Math.max(0, Math.min(remaining, 2_147_483_647)))
  }
  scope.run(() => watch([
    () => `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}`,
    () => pets.state, () => pets.receivedAt, () => pets.loading, () => pets.busy,
    () => pets.pending, () => pets.refreshNeeded, () => pets.offline,
  ], schedule, { flush: 'post' }))
  document.addEventListener('visibilitychange', schedule)
  return {
    add(consumer) {
      // active 属于各自面板；家园的 v-show 隐藏后不再独自触发核对。
      const stop = scope.run(() => watch(consumer, schedule, { flush: 'post' }))!
      consumers.set(consumer, stop)
      schedule()
    },
    remove(consumer) {
      consumers.get(consumer)?.(); consumers.delete(consumer)
      if (consumers.size) schedule()
      else {
        clearTimer(); scope.stop(); watchers.delete(pets)
        document.removeEventListener('visibilitychange', schedule)
      }
    },
  }
}
