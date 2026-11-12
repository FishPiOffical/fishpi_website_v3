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
    opened.value = false
    history.value = null
    error.value = ''
    filter.value = 'all'
    page.value = 1
  }
  function refresh(): Promise<void> {
    if (!opened.value || !active()) return Promise.resolve()
    if (flight) return flight
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
        if (valid()) history.value = result
      } catch (reason) {
        if (valid()) {
          history.value = null
          error.value = reason instanceof ApiError ? reason.message : '活动记录暂时无法读取'
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
    opened.value = true
    return refresh()
  }
  function close() { opened.value = false; cancel() }
  function setFilter(kind: PetHistoryKind) {
    if (!['all', 'outing', 'course', 'work', 'care', 'craft', 'purchase'].includes(kind) || kind === filter.value) return Promise.resolve()
    cancel()
    filter.value = kind
    page.value = 1
    history.value = null
    error.value = ''
    return refresh()
  }
  function setPage(value: number) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 10000 || value === page.value) return Promise.resolve()
    cancel()
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
    void refresh()
  }, { flush: 'sync' })
  onScopeDispose(() => { stopIdentity(); stopState(); clear() })
  return { opened, loading, error, history, filter, page, open, close, refresh, setFilter, setPage }
})
