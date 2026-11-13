import { onScopeDispose, ref, watch } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { readPetJournal, type PetJournal, type PetHistoryKind } from '@/api/v3-pets'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'

/** 活动履历只在展开时读取；关闭、换页和换号均废弃旧响应。 */
export const usePetActivityHistoryStore = defineStore('pet-activity-history', () => {
  const { accessToken, account } = storeToRefs(useAuthStore())
  const pets = usePetsStore()
  const opened = ref(false), loading = ref(false), error = ref('')
  const history = ref<PetJournal | null>(null)
  const filter = ref<PetHistoryKind>('all'), page = ref(1)
  let sequence = 0, boundary = getAuthContextVersion(), owner = account.value?.oId
  let controller: AbortController | null = null, flight: Promise<void> | null = null
  let failures = 0, retryAt = 0, receivedAt = 0, lastAutoRead = 0, stale = false, listening = false
  let autoTimer: ReturnType<typeof setTimeout> | null = null
  const active = () => !import.meta.env.SSR && !!accessToken.value && !!account.value?.oId

  function cancel() {
    sequence++
    controller?.abort()
    controller = null
    flight = null
    loading.value = false
  }
  function clear() {
    cancel()
    cancelAuto()
    opened.value = false
    history.value = null
    error.value = ''
    filter.value = 'all'
    page.value = 1
    failures = retryAt = receivedAt = lastAutoRead = 0
    stale = false
  }
  function refresh(): Promise<void> {
    if (!opened.value || !active() || pets.offline) return Promise.resolve()
    if (flight) return flight
    cancelAuto()
    stale = false
    const run = ++sequence, context = getAuthContextVersion(), actor = account.value?.oId
    const requestFilter = filter.value, requestPage = page.value, abort = new AbortController()
    controller = abort
    const valid = () => active() && opened.value && run === sequence && !abort.signal.aborted
      && context === getAuthContextVersion() && actor === account.value?.oId
    loading.value = true
    error.value = ''
    const task = (async () => {
      try {
        const result = await readPetJournal(requestFilter, requestPage, abort.signal)
        if (valid()) {
          history.value = result
          failures = retryAt = 0
          receivedAt = Date.now()
        }
      } catch (reason) {
        if (valid()) {
          history.value = null
          error.value = reason instanceof ApiError ? reason.message : '活动记录暂时无法读取'
          stale = true
          retryAt = reason instanceof ApiError && reason.status >= 400 && reason.status < 500
            ? Infinity : Date.now() + Math.min(300_000, 30_000 * 2 ** Math.min(failures++, 4))
        }
      } finally {
        if (valid()) { loading.value = false; controller = null }
      }
    })().finally(() => { if (flight === task) flight = null })
    flight = task
    return task
  }
  function open() {
    if (!active()) return Promise.resolve()
    if (!listening && typeof window !== 'undefined') {
      listening = true
      window.addEventListener('focus', onFocus)
      document.addEventListener('visibilitychange', onFocus)
    }
    opened.value = true
    if (pets.offline) { stale = true; error.value = '网络已断开，联网后会读取活动记录' }
    return refresh()
  }
  function close() { opened.value = false; cancel(); cancelAuto() }
  function cancelAuto() { if (autoTimer !== null) clearTimeout(autoTimer); autoTimer = null }
  function onFocus() {
    if (!active() || !opened.value || pets.offline || pets.loading || document.hidden || flight || autoTimer !== null || Date.now() < retryAt) return
    if (!stale && receivedAt && Date.now() - receivedAt < 60_000) return
    const delay = Math.max(0, lastAutoRead + 1000 - Date.now())
    if (delay) { autoTimer = setTimeout(() => { autoTimer = null; onFocus() }, delay); return }
    lastAutoRead = Date.now()
    void refresh()
  }
  function setFilter(kind: PetHistoryKind) {
    if (!['all', 'outing', 'course', 'work', 'care', 'craft', 'purchase', 'story', 'readoption'].includes(kind) || kind === filter.value) return Promise.resolve()
    cancel()
    cancelAuto()
    filter.value = kind
    page.value = 1
    history.value = null
    error.value = ''
    return refresh()
  }
  function setPage(value: number) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 10000 || value === page.value) return Promise.resolve()
    cancel()
    cancelAuto()
    page.value = value
    history.value = null
    error.value = ''
    return refresh()
  }
  const stopIdentity = watch([accessToken, () => account.value?.oId], () => {
    const context = getAuthContextVersion(), actor = account.value?.oId
    if (!accessToken.value || context !== boundary || actor !== owner) clear()
    boundary = context
    owner = actor
  }, { flush: 'sync' })
  const stopState = watch(() => pets.state, value => {
    if (!value || !opened.value || !active()) return
    // 写后核对、跨标签失效和聚焦重读共用这一处，丢弃领取前仍在途的旧履历。
    cancel()
    stale = true
    onFocus()
  }, { flush: 'sync' })
  const stopNetwork = watch(() => [pets.offline, pets.loading], ([offline], [wasOffline]) => {
    if (!opened.value || !active()) return
    if (offline) {
      cancel(); cancelAuto(); stale = true
      error.value = '网络已断开，联网后会读取活动记录'
    } else {
      if (wasOffline && Number.isFinite(retryAt)) retryAt = 0
      onFocus()
    }
  }, { flush: 'sync' })
  onScopeDispose(() => {
    stopIdentity(); stopState(); stopNetwork(); clear()
    if (listening) { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  })
  return { opened, loading, error, history, filter, page, open, close, refresh, setFilter, setPage }
})
