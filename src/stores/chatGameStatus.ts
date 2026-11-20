import { computed, onMounted, onScopeDispose, reactive, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { CHAT_GAME_BATCH_SIZE, chatGameUserId, readChatGameStatuses, type ChatGameStatus } from '@/api/v3-chat-game-status'
import { useAuthStore } from './auth'

const CACHE_MS = 60_000
const RETRY_MS = 30_000
const BATCH_DELAY_MS = 40
type Entry = { status?: ChatGameStatus | null; error?: string; until: number }

export const useChatGameStatusStore = defineStore('chatGameStatus', () => {
  const auth = useAuthStore()
  const entries = reactive(new Map<string, Entry>())
  const subscriptions = new Map<string, number>()
  let generation = 0
  let running = false
  let unavailableUntil = 0
  let scheduledAt = Infinity
  let timer: ReturnType<typeof setTimeout> | undefined

  function cancelTimer() {
    clearTimeout(timer)
    scheduledAt = Infinity
  }

  function schedule() {
    if (import.meta.env.SSR || !auth.isLoggedIn || document.hidden || running) { cancelTimer(); return }
    const now = Date.now()
    let next = Infinity
    for (const [id, entry] of entries) {
      if (!subscriptions.has(id) && entry.until <= now) entries.delete(id)
      else next = Math.min(next, entry.until)
    }
    for (const id of subscriptions.keys()) next = Math.min(next, entries.get(id)?.until ?? now)
    if (next === Infinity) { cancelTimer(); return }
    const due = Math.max(now + BATCH_DELAY_MS, next, unavailableUntil)
    // 新消息持续挂载时不能反复推迟已经排队的批次。
    if (scheduledAt <= due) return
    cancelTimer()
    scheduledAt = due
    timer = setTimeout(refresh, due - now)
  }

  async function refresh() {
    scheduledAt = Infinity
    if (document.hidden || running || !auth.isLoggedIn) return
    const now = Date.now()
    const ids = [...subscriptions.keys()].filter(id => (entries.get(id)?.until ?? 0) <= now).slice(0, CHAT_GAME_BATCH_SIZE)
    if (!ids.length) { schedule(); return }
    const current = generation
    const reader = getAuthContextVersion()
    const valid = () => current === generation && reader === getAuthContextVersion()
    running = true
    try {
      const result = await readChatGameStatuses(ids)
      if (!valid()) return
      const until = Date.now() + CACHE_MS
      for (const id of ids) entries.set(id, { status: result.get(id) ?? null, until })
    } catch (failure) {
      if (!valid()) return
      // 旧服务缺少整个接口时一起退避，避免每批作者重复请求。
      if (failure instanceof ApiError && failure.status === 404) unavailableUntil = Date.now() + 5 * CACHE_MS
      const until = Math.max(Date.now() + RETRY_MS, unavailableUntil)
      const message = failure instanceof Error ? failure.message : '游园状态暂不可用'
      if (failure instanceof ApiError && ([401, 403, 404].includes(failure.status))) {
        entries.clear()
        for (const id of subscriptions.keys()) entries.set(id, { error: message, until })
      } else {
        for (const id of ids) entries.set(id, { error: message, until })
      }
    } finally {
      if (current === generation) { running = false; schedule() }
    }
  }

  function subscribe(id: string) {
    subscriptions.set(id, (subscriptions.get(id) ?? 0) + 1)
    schedule()
    return () => {
      const count = (subscriptions.get(id) ?? 1) - 1
      if (count) subscriptions.set(id, count)
      else subscriptions.delete(id)
      schedule()
    }
  }

  function reset() {
    generation++
    running = false
    unavailableUntil = 0
    entries.clear()
    cancelTimer()
  }
  watch(() => [getAuthContextVersion(), auth.account?.oId, !!auth.accessToken].join('|'), () => {
    reset()
    schedule()
  }, { flush: 'sync' })
  if (!import.meta.env.SSR) document.addEventListener('visibilitychange', schedule)
  onScopeDispose(() => {
    reset()
    subscriptions.clear()
    if (!import.meta.env.SSR) document.removeEventListener('visibilitychange', schedule)
  })

  return {
    subscribe,
    entry: (id: string) => entries.get(id),
    retry(id: string) {
      if (subscriptions.has(id) && entries.get(id)?.error) {
        entries.delete(id)
        schedule()
      }
    },
  }
})

export function useChatGameStatus(userId: MaybeRefOrGetter<string | undefined>) {
  const store = useChatGameStatusStore()
  const id = computed(() => toValue(userId) ?? '')
  const entry = computed(() => store.entry(id.value))
  onMounted(() => {
    watch(id, (value, _, cleanup) => {
      if (chatGameUserId.test(value)) cleanup(store.subscribe(value))
    }, { immediate: true, flush: 'sync' })
  })
  return {
    status: computed(() => entry.value?.status),
    error: computed(() => entry.value?.error),
    loading: computed(() => !!id.value && !entry.value),
    retry: () => store.retry(id.value),
  }
}
