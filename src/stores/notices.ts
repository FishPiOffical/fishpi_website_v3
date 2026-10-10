import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchUnreadCount, type UnreadCount } from '@/api/fishpi'
import type { WhisperMsg } from '@/api/fishpi'
import { useAuthStore } from './auth'
import { useWhisperStore } from './whispers'

export const useNoticeStore = defineStore('notices', () => {
  const unread = ref<UnreadCount>({})
  const loading = ref(false)
  /** 管理员 /admin/broadcast/warn 推送的紧急公告 */
  const warnBroadcast = ref<{ text: string; who: string } | null>(null)
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  let lastChatCountPushAt = 0

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

  function connectSocket(apiKey: string) {
    const auth = useAuthStore()
    if (auth.apiKey !== apiKey || typeof WebSocket === 'undefined') return
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${proto}//${location.host}/user-channel?apiKey=${encodeURIComponent(apiKey)}`)
    ws = socket
    socket.onopen = () => {
      reconnectAttempts = 0
    }
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as Record<string, unknown> & { command?: string }
        if (msg.command === 'refreshNotification') {
          applyCount(msg)
        } else if (msg.command === 'chatUnreadCountRefresh') {
          const whispers = useWhisperStore()
          lastChatCountPushAt = Date.now()
          if (msg.count !== undefined) whispers.applyUnreadCount(msg.count)
          else void whispers.refreshUnread()
        } else if (msg.command === 'newIdleChatMessage') {
          const hasRecentCountPush = Date.now() - lastChatCountPushAt < 1500
          useWhisperStore().noteIncomingMessage(msg as Partial<WhisperMsg>, !hasRecentCountPush)
        } else if (msg.command === 'warnBroadcast') {
          warnBroadcast.value = {
            text: String(msg.warnBroadcastText ?? ''),
            who: String(msg.who ?? ''),
          }
        }
      } catch {
        /* ignore */
      }
    }
    socket.onerror = () => socket.close()
    socket.onclose = () => {
      if (ws !== socket) return
      ws = null
      if (reconnectTimer || auth.apiKey !== apiKey) return
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000)
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        reconnectAttempts += 1
        connectSocket(apiKey)
      }, delay)
    }
  }

  function connect() {
    const auth = useAuthStore()
    disconnect()
    if (import.meta.env.SSR || typeof WebSocket === 'undefined' || !auth.apiKey) return
    connectSocket(auth.apiKey)
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    reconnectAttempts = 0
    const socket = ws
    ws = null
    if (socket) {
      socket.onclose = null
      socket.onerror = null
      socket.close()
    }
  }

  function clear() {
    unread.value = {}
    disconnect()
  }

  return { unread, loading, total, warnBroadcast, refresh, clear, connect, disconnect }
})
