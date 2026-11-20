import { computed, onBeforeUnmount, onMounted, onScopeDispose, ref, watch } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3Breezemoons, type BreezemoonPage } from '@/api/v3-breezemoons'
import { subscribeBreezemoonChanges } from '@/api/v3-realtime'
import { useAuthStore } from '@/stores/auth'
import { useV3BreezemoonStore } from '@/stores/v3Breezemoons'

const CACHE_MS = 30_000
const PREVIEW_SIZE = 8

const useSharedBreezemoons = defineStore('breezemoon-feed', () => {
  const auth = useAuthStore()
  const operations = useV3BreezemoonStore()
  const identity = () => JSON.stringify([getAuthContextVersion(), !!auth.accessToken, auth.accessToken ? auth.account?.oId : null])
  const result = ref<BreezemoonPage | null>(null)
  const loading = ref(false)
  const error = ref('')
  const revision = ref(0)
  let expires = 0
  let previews = 0
  let consumers = 0
  let sequence = 0
  let flight: Promise<void> | null = null
  let pendingRefresh: { afterWrite: boolean } | null = null
  let unsubscribe: (() => void) | undefined
  let disconnectTimer: ReturnType<typeof setTimeout> | undefined
  let updateTimer: ReturnType<typeof setTimeout> | undefined
  let hasReady = false

  function clear() {
    sequence++
    expires = 0
    flight = null
    pendingRefresh = null
    result.value = null
    loading.value = false
    error.value = ''
  }

  function load(preferCache = false, afterWrite = false) {
    if (!previews || (auth.accessToken && !auth.account?.oId)) return
    if (flight) return flight
    if (preferCache && Date.now() < expires) return
    const turn = sequence
    const reader = identity()
    const valid = () => turn === sequence && reader === identity()
    loading.value = true
    error.value = ''
    const task = fetchV3Breezemoons(1, PREVIEW_SIZE).then(data => {
      if (!valid()) return
      result.value = data
      expires = Date.now() + CACHE_MS
    }).catch((failure: unknown) => {
      if (!valid()) return
      result.value = null
      expires = 0
      const message = failure instanceof Error ? failure.message : '清风明月读取失败'
      error.value = afterWrite ? `操作已确认，列表读取失败：${message}` : message
    }).finally(() => {
      if (flight !== task) return
      flight = null
      loading.value = false
      const pending = pendingRefresh
      pendingRefresh = null
      if (pending) void load(false, pending.afterWrite)
    })
    flight = task
    return task
  }

  function stop() {
    clearTimeout(updateTimer)
    updateTimer = undefined
    unsubscribe?.()
    unsubscribe = undefined
  }

  function invalidate(afterWrite = false) {
    clearTimeout(updateTimer)
    updateTimer = undefined
    sequence++
    expires = 0
    if (afterWrite) result.value = null
    if (flight) {
      pendingRefresh = { afterWrite: afterWrite || !!pendingRefresh?.afterWrite }
      return
    }
    // 没有挂载预览时只失效，返回预览时才重读。
    void load(false, afterWrite)
  }

  function scheduleUpdate() {
    if (!consumers || updateTimer) return
    updateTimer = setTimeout(() => {
      updateTimer = undefined
      invalidate()
      revision.value++
    }, 250)
  }

  function connect() {
    if (unsubscribe || !consumers || !auth.accessToken || !auth.account?.oId) return
    unsubscribe = subscribeBreezemoonChanges(scheduleUpdate, state => {
      if (state !== 'ready') return
      if (hasReady) scheduleUpdate()
      hasReady = true
    })
  }

  watch(identity, () => {
    stop()
    hasReady = false
    clear()
  }, { flush: 'sync' })
  watch([() => auth.accessToken, () => auth.account?.oId], () => {
    stop()
    connect()
    if (!result.value) void load(true)
  })
  watch(() => operations.revision, () => {
    if (operations.lastOperation) invalidate(true)
  }, { flush: 'sync' })

  function attach(preview: boolean, bootstrap: BreezemoonPage | null, fetchedAt?: number) {
    clearTimeout(disconnectTimer)
    consumers++
    if (preview) {
      previews++
      if (!auth.accessToken && !result.value && !flight && bootstrap?.size === PREVIEW_SIZE && fetchedAt !== undefined) {
        result.value = bootstrap
        expires = Math.min(Date.now(), fetchedAt) + CACHE_MS
      }
      void load(true)
    }
    connect()
    return () => {
      if (preview) previews--
      if (--consumers === 0) disconnectTimer = setTimeout(stop, 500)
    }
  }

  onScopeDispose(() => { clearTimeout(disconnectTimer); stop(); clear() })
  return { attach, load, preview: () => ({ result, loading, error }), liveRevision: () => revision }
})

export function useBreezemoonFeed(size: number, bootstrap: BreezemoonPage | null = null, preview = false, fetchedAt?: number) {
  const auth = useAuthStore()
  const { accessToken, account } = storeToRefs(auth)
  const operations = useV3BreezemoonStore()
  const shared = useSharedBreezemoons()
  const mounted = ref(false)
  const page = ref(1)
  let detach: (() => void) | undefined
  if (preview) {
    const state = shared.preview()
    onMounted(() => { detach = shared.attach(true, bootstrap, fetchedAt); mounted.value = true })
    onBeforeUnmount(() => detach?.())
    return {
      mounted,
      result: computed(() => mounted.value ? state.result.value : bootstrap),
      loading: computed(() => mounted.value ? state.loading.value : !bootstrap),
      error: state.error,
      page,
      load: () => shared.load(),
      move: () => {},
      home: () => shared.load(),
    }
  }
  const result = ref<BreezemoonPage | null>(bootstrap), loading = ref(!bootstrap), error = ref('')
  let sequence = 0, boundary = '', pendingLive = false
  function identity() { return `${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId || ''}` }
  function clear() { sequence++; result.value = null; loading.value = false; error.value = ''; pendingLive = false }
  async function load(afterWrite = false, background = false) {
    if (!mounted.value) return
    if (loading.value) {
      if (background) pendingLive = true
      return
    }
    const current = ++sequence, reader = identity(), requested = page.value
    loading.value = true
    if (!background) result.value = null
    error.value = ''
    const valid = () => mounted.value && sequence === current && reader === identity()
    try { const value = await fetchV3Breezemoons(requested, size); if (valid()) result.value = value }
    catch (err) {
      if (valid()) {
        result.value = null
        const message = err instanceof Error ? err.message : '清风明月读取失败'
        error.value = afterWrite ? `操作已确认，列表读取失败：${message}` : message
      }
    }
    finally {
      if (valid()) {
        loading.value = false
        if (pendingLive) { pendingLive = false; void load(false, true) }
      }
    }
  }
  function move(value: number) {
    if (loading.value || !result.value || value < 1 || value > Math.min(result.value.pageCount, 42949672)) return
    page.value = value
    void load()
  }
  function home() { page.value = 1; void load() }
  watch([accessToken, () => account.value?.oId], () => {
    const next = identity()
    if (next === boundary) return
    boundary = next
    clear()
    page.value = 1
    void load()
  }, { flush: 'sync' })
  watch(() => operations.revision, () => {
    if (!mounted.value || !operations.lastOperation) return
    clear()
    if (operations.lastOperation === 'create') page.value = 1
    void load(true)
  }, { flush: 'sync' })
  watch(shared.liveRevision(), () => { if (page.value === 1) void load(false, true) })
  onMounted(() => {
    mounted.value = true
    boundary = identity()
    loading.value = false
    detach = shared.attach(false, null)
    if (!result.value || accessToken.value) void load()
  })
  onBeforeUnmount(() => { detach?.(); mounted.value = false; clear() })
  return { mounted, result, loading, error, page, load, move, home }
}
