import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchUnreadCount, type UnreadCount } from '@/api/fishpi'
import { useAuthStore } from './auth'
import { useWhisperStore } from './whispers'

export const useNoticeStore = defineStore('notices', () => {
  const unread = ref<UnreadCount>({})
  const loading = ref(false)
  let ws: WebSocket | null = null

  const total = computed(() => Number(unread.value.unreadNotificationCnt || 0))

  async function refresh() {
    const auth = useAuthStore()
    if (!auth.apiKey) {
      unread.value = {}
      return
    }
    loading.value = true
    try {
      unread.value = await fetchUnreadCount(auth.apiKey)
    } catch {
      unread.value = {}
    } finally {
      loading.value = false
    }
  }

  function applyCount(msg: Record<string, unknown>) {
    const next = { ...unread.value }
    for (const [k, v] of Object.entries(msg)) {
      if (k.startsWith('unread') && typeof v === 'number') (next as Record<string, number>)[k] = v
    }
    unread.value = next
  }

  function connect() {
    const auth = useAuthStore()
    disconnect()
    if (import.meta.env.SSR || typeof WebSocket === 'undefined' || !auth.apiKey) return
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${proto}//${location.host}/user-channel?apiKey=${encodeURIComponent(auth.apiKey)}`)
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as Record<string, unknown> & { command?: string }
        if (msg.command === 'refreshNotification') {
          applyCount(msg)
        } else if (msg.command === 'chatUnreadCountRefresh') {
          void useWhisperStore().refreshUnread()
        }
      } catch {
        /* ignore */
      }
    }
  }

  function disconnect() {
    ws?.close()
    ws = null
  }

  function clear() {
    unread.value = {}
    disconnect()
  }

  return { unread, loading, total, refresh, clear, connect, disconnect }
})
