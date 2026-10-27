import { computed, onScopeDispose, ref } from 'vue'
import { defineStore } from 'pinia'
import type { UnreadCount } from '@/api/fishpi'
import { getAccessToken, onAccessTokenChange } from '@/api/http'
import { fetchV3UnreadCount } from '@/api/v3-notifications'
import { subscribeNotificationChanges } from '@/api/v3-realtime'

export const useNoticeStore = defineStore('notices', () => {
  const unread = ref<UnreadCount>({})
  const loading = ref(false)
  const error = ref('')
  const revision = ref(0)
  /** Legacy urgent broadcast is not part of the notification invalidation protocol. */
  const warnBroadcast = ref<{ text: string; who: string } | null>(null)
  let generation = 0, sequence = 0
  let stopSubscription: (() => void) | null = null
  const total = computed(() => Number(unread.value.unreadNotificationCnt || 0))

  async function refresh() {
    const token = getAccessToken(), version = generation, id = ++sequence
    if (!token) { unread.value = {}; loading.value = false; error.value = ''; return }
    loading.value = true
    try {
      const result = await fetchV3UnreadCount()
      if (id === sequence && version === generation && getAccessToken() === token) { unread.value = result; error.value = '' }
    } catch (failure) {
      if (id === sequence && version === generation && getAccessToken() === token) {
        unread.value = {}; error.value = failure instanceof Error ? failure.message : '未读数加载失败'
      }
    } finally { if (id === sequence && version === generation) loading.value = false }
  }
  function invalidate() { revision.value++; void refresh() }
  function disconnect() { stopSubscription?.(); stopSubscription = null }
  function connect() { disconnect(); stopSubscription = subscribeNotificationChanges(invalidate) }
  function clear() {
    generation++; sequence++; unread.value = {}; error.value = ''; loading.value = false; warnBroadcast.value = null
    revision.value++; disconnect()
  }
  const unsubscribe = onAccessTokenChange((token) => { clear(); if (token) { void refresh(); connect() } })
  const focus = () => { if (getAccessToken()) invalidate() }
  if (!import.meta.env.SSR) window.addEventListener('focus', focus)
  onScopeDispose(() => { unsubscribe(); clear(); if (!import.meta.env.SSR) window.removeEventListener('focus', focus) })
  return { unread, loading, error, revision, total, warnBroadcast, refresh, invalidate, clear, connect, disconnect }
})
