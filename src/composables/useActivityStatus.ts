import { defineStore } from 'pinia'
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { fetchCheckinState, fetchRewardState } from '@/api/v3-activity'
import { useAuthStore } from '@/stores/auth'
import { useV3ActivityStore } from '@/stores/v3Activity'

const CACHE_MS = 30_000
const beijingDate = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'short' })
const today = () => beijingDate.format(Date.now())

const useActivityReadStore = defineStore('activity-read-status', () => {
  const auth = useAuthStore()
  const writes = useV3ActivityStore()
  const identity = () => JSON.stringify([getAuthContextVersion(), !!auth.accessToken, auth.account?.oId])
  let consumers = 0

  function resource<T>(fetch: () => Promise<T>) {
    const value = ref<T | null>(null)
    const loading = ref(false)
    const error = ref('')
    let expires = 0
    let day = ''
    let flight: Promise<void> | null = null

    function clear() {
      flight = null
      expires = 0
      value.value = null
      loading.value = false
      error.value = ''
    }

    function read(preferCache = false) {
      if (!consumers || !auth.accessToken || !auth.account?.oId || import.meta.env.SSR) return
      const date = today()
      if (day !== date) { clear(); day = date }
      if (flight) return flight
      if (preferCache && Date.now() < expires) return
      const reader = identity()
      const current = () => flight === task && reader === identity() && date === today()
      expires = 0
      error.value = ''
      loading.value = true
      const task = fetch().then(data => {
        if (!current()) return
        value.value = data
        expires = Date.now() + CACHE_MS
      }).catch((failure: unknown) => {
        if (!current()) return
        value.value = null
        error.value = failure instanceof Error ? failure.message : '活动状态读取失败'
      }).finally(() => {
        if (flight !== task) return
        flight = null
        loading.value = false
        if (date !== today()) read(true)
      })
      flight = task
      return task
    }

    return { value, loading, error, read, clear, checkDay: () => { if (day !== today()) read(true) } }
  }

  const checkin = resource(fetchCheckinState)
  const reward = resource(fetchRewardState)
  function refresh() {
    checkin.clear()
    reward.clear()
    void checkin.read()
    void reward.read()
  }
  watch(identity, refresh, { flush: 'sync' })
  watch(() => writes.revision, refresh, { flush: 'sync' })

  function checkDay() { checkin.checkDay(); reward.checkDay() }
  function attach() {
    if (++consumers === 1 && typeof window !== 'undefined') window.addEventListener('focus', checkDay)
    void checkin.read(true)
    void reward.read(true)
    return () => {
      if (--consumers === 0 && typeof window !== 'undefined') window.removeEventListener('focus', checkDay)
    }
  }
  onScopeDispose(() => {
    if (typeof window !== 'undefined') window.removeEventListener('focus', checkDay)
    checkin.clear()
    reward.clear()
  })
  return { attach, resources: () => ({ checkin, reward }) }
})

export function useActivityStatus() {
  const store = useActivityReadStore()
  let detach: (() => void) | undefined
  onMounted(() => { detach = store.attach() })
  onScopeDispose(() => detach?.())
  return store.resources()
}
