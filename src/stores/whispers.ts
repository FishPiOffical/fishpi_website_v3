import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  fetchWhisperList,
  fetchWhisperMessages,
  fetchWhisperUnread,
  markWhisperRead,
  revokeWhisper,
  type WhisperMsg,
} from '@/api/fishpi'
import { useAuthStore } from './auth'

function resolveWsUrl(url: string) {
  try {
    const httpish = url.replace(/^wss?/i, (m) => (m.toLowerCase() === 'wss' ? 'https' : 'http'))
    const u = new URL(httpish, location.href)
    if (u.hostname && u.hostname !== location.hostname) {
      const proto = u.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${proto}//${u.host}${u.pathname}${u.search}`
    }
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${location.host}${u.pathname}${u.search}`
  } catch {
    return url
  }
}

function peerOf(msg: WhisperMsg, me?: string) {
  if (me && msg.senderUserName === me) return msg.receiverUserName || ''
  return msg.senderUserName || ''
}

export const useWhisperStore = defineStore('whispers', () => {
  const list = ref<WhisperMsg[]>([])
  const messages = ref<WhisperMsg[]>([])
  const unread = ref<WhisperMsg[]>([])
  const connected = ref(false)
  const loading = ref(false)
  const listLoading = ref(false)
  const sending = ref(false)
  const error = ref('')
  const usingMock = ref(false)
  const hasMore = ref(true)
  const loadingMore = ref(false)
  let ws: WebSocket | null = null
  let peer = ''
  let page = 1

  const unreadTotal = computed(() => unread.value.length)
  const unreadBy = computed(() => {
    const map: Record<string, number> = {}
    for (const m of unread.value) {
      const from = m.senderUserName || ''
      if (from) map[from] = (map[from] || 0) + 1
    }
    return map
  })

  function touchList(msg: WhisperMsg) {
    const auth = useAuthStore()
    const who = peerOf(msg, auth.account?.userName)
    if (!who) return
    const prev = list.value.find((m) => peerOf(m, auth.account?.userName) === who)
    const entry: WhisperMsg = {
      ...prev,
      ...msg,
      senderAvatar: msg.senderAvatar || prev?.senderAvatar,
      receiverAvatar: msg.receiverAvatar || prev?.receiverAvatar,
    }
    list.value = [entry, ...list.value.filter((m) => m !== prev)]
  }

  async function refreshUnread() {
    const auth = useAuthStore()
    if (!auth.apiKey) {
      unread.value = []
      return
    }
    try {
      unread.value = await fetchWhisperUnread(auth.apiKey)
    } catch {
      unread.value = []
    }
  }

  async function loadList() {
    const auth = useAuthStore()
    if (!auth.apiKey) return
    listLoading.value = true
    error.value = ''
    try {
      list.value = await fetchWhisperList(auth.apiKey)
      usingMock.value = list.value.some((m) => String(m.oId).startsWith('mock-'))
      await refreshUnread()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '私信列表失败'
      list.value = []
    } finally {
      listLoading.value = false
    }
  }

  async function open(userName: string) {
    const auth = useAuthStore()
    if (!auth.apiKey || !userName) return
    peer = userName
    page = 1
    hasMore.value = true
    loading.value = true
    error.value = ''
    try {
      const rows = await fetchWhisperMessages(auth.apiKey, userName, 1, 40)
      usingMock.value = rows.some((m) => String(m.oId).startsWith('mock-'))
      messages.value = [...rows].reverse()
      if (rows.length < 40) hasMore.value = false
      await markWhisperRead(auth.apiKey, userName).catch(() => undefined)
      await refreshUnread()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '私信加载失败'
      messages.value = []
    } finally {
      loading.value = false
    }
    connectWs(userName, auth.apiKey)
  }

  async function loadMore() {
    const auth = useAuthStore()
    if (!auth.apiKey || !peer || loadingMore.value || !hasMore.value) return
    loadingMore.value = true
    page += 1
    try {
      const rows = await fetchWhisperMessages(auth.apiKey, peer, page, 40)
      if (!rows.length) hasMore.value = false
      else {
        const known = new Set(messages.value.map((m) => m.oId))
        messages.value = [...rows.filter((m) => !known.has(m.oId)).reverse(), ...messages.value]
        if (rows.length < 40) hasMore.value = false
      }
    } catch {
      page -= 1
    } finally {
      loadingMore.value = false
    }
  }

  async function revoke(oId: string) {
    const auth = useAuthStore()
    if (!auth.apiKey) return
    await revokeWhisper(auth.apiKey, oId)
    messages.value = messages.value.filter((m) => m.oId !== oId)
  }

  function connectWs(userName: string, apiKey: string) {
    disconnect()
    const url = resolveWsUrl(`/chat-channel?apiKey=${encodeURIComponent(apiKey)}&toUser=${encodeURIComponent(userName)}`)
    ws = new WebSocket(url)
    ws.onopen = () => {
      connected.value = true
    }
    ws.onclose = () => {
      connected.value = false
    }
    ws.onerror = () => {
      connected.value = false
    }
    ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(String(ev.data)) as WhisperMsg & { type?: string; data?: WhisperMsg | string }
        if (raw.type === 'revoke') {
          const id = typeof raw.data === 'string' ? raw.data : String((raw.data as WhisperMsg)?.oId || '')
          messages.value = messages.value.filter((m) => m.oId !== id)
          return
        }
        if ((raw as { code?: number }).code === -1) {
          error.value = (raw as { msg?: string }).msg || '发送失败'
          return
        }
        const msg = (raw.data && typeof raw.data === 'object' ? raw.data : raw) as WhisperMsg
        if (!msg.oId && !msg.content && !msg.markdown) return
        if (msg.oId && messages.value.some((m) => m.oId === msg.oId)) return
        error.value = ''
        if (msg.senderUserName === userName) void markWhisperRead(apiKey, userName).catch(() => undefined)
        const row: WhisperMsg = {
          oId: msg.oId || `local-${Date.now()}`,
          content: msg.content,
          markdown: msg.markdown,
          preview: msg.preview,
          time: msg.time,
          senderUserName: msg.senderUserName,
          receiverUserName: msg.receiverUserName,
          senderAvatar: msg.senderAvatar,
          receiverAvatar: msg.receiverAvatar,
        }
        messages.value.push(row)
        touchList(row)
      } catch {
        /* ignore non-json */
      }
    }
  }

  async function send(text: string) {
    const content = text.trim()
    if (!content) return
    const auth = useAuthStore()
    if (usingMock.value || !ws || ws.readyState !== WebSocket.OPEN) {
      if (!usingMock.value) {
        error.value = '私信通道未连接'
        return
      }
      messages.value.push({
        oId: `mock-local-${Date.now()}`,
        senderUserName: auth.account?.userName,
        receiverUserName: peer,
        markdown: content,
        preview: content,
        content: content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        time: '刚刚',
      })
      return
    }
    sending.value = true
    error.value = ''
    try {
      ws.send(content)
    } finally {
      sending.value = false
    }
  }

  function disconnect() {
    connected.value = false
    ws?.close()
    ws = null
    peer = ''
  }

  function clear() {
    list.value = []
    messages.value = []
    unread.value = []
    usingMock.value = false
    disconnect()
  }

  return {
    list,
    messages,
    unread,
    unreadTotal,
    connected,
    loading,
    listLoading,
    unreadBy,
    sending,
    error,
    usingMock,
    hasMore,
    loadingMore,
    peerOf,
    refreshUnread,
    loadList,
    open,
    loadMore,
    revoke,
    send,
    disconnect,
    clear,
  }
})
