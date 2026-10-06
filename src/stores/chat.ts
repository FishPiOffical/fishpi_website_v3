import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchChatHistory,
  fetchChatNode,
  fetchMutes,
  openRedPacket,
  revokeChat,
  sendChat,
  type ChatHistoryItem,
  type MuteItem,
  type RedPacketContent,
} from '@/api/fishpi'
import { useAuthStore } from './auth'

export interface ChatLine {
  oId: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  html?: string
  time?: string
  redPacket?: RedPacketContent
}

export interface OnlineUser {
  userName: string
  userAvatarURL?: string
  userNickname?: string
}

/** Same-origin `/chat-room-channel` goes through Vite proxy; remote node hosts connect directly. */
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

function asLine(item: ChatHistoryItem | Record<string, unknown>): ChatLine {
  let content = item.content as unknown
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content) as RedPacketContent
      if (parsed?.msgType === 'redPacket') content = parsed
    } catch {
      /* html */
    }
  }
  const redPacket =
    content && typeof content === 'object' && (content as RedPacketContent).msgType === 'redPacket'
      ? (content as RedPacketContent)
      : undefined
  return {
    oId: String(item.oId ?? ''),
    userName: String(item.userName ?? ''),
    userNickname: item.userNickname as string | undefined,
    userAvatarURL: item.userAvatarURL as string | undefined,
    html: typeof content === 'string' ? content : undefined,
    time: item.time as string | undefined,
    redPacket,
  }
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatLine[]>([])
  const onlines = ref<OnlineUser[]>([])
  const discuss = ref('加载中...')
  const mutes = ref<MuteItem[]>([])
  const connected = ref(false)
  const sending = ref(false)
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasMore = ref(true)
  const error = ref('')
  const lastPacket = ref('')
  const packetDetail = ref<{ msg?: string; recivers: { userName?: string; money?: number }[] } | null>(null)
  let ws: WebSocket | null = null
  let hb: number | null = null
  let page = 1

  function prependHistory(list: ChatHistoryItem[]) {
    const mapped = list.map(asLine).reverse()
    const known = new Set(messages.value.map((m) => m.oId))
    messages.value = [...mapped.filter((m) => !known.has(m.oId)), ...messages.value]
  }

  function pushIncoming(raw: Record<string, unknown>) {
    const line = asLine(raw)
    if (!line.oId) return
    if (messages.value.some((m) => m.oId === line.oId)) return
    messages.value.push(line)
  }

  async function connect() {
    const auth = useAuthStore()
    if (!auth.apiKey) return
    error.value = ''
    loading.value = true
    page = 1
    hasMore.value = true
    try {
      const history = await fetchChatHistory(auth.apiKey, 1)
      messages.value = []
      prependHistory(history)
      hasMore.value = history.length > 0
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载历史失败'
    } finally {
      loading.value = false
    }
    try {
      mutes.value = await fetchMutes()
    } catch {
      mutes.value = []
    }

    if (ws) {
      ws.close()
      ws = null
    }

    let node = resolveWsUrl(`/chat-room-channel?apiKey=${auth.apiKey}`)
    try {
      const remote = await fetchChatNode(auth.apiKey)
      node = resolveWsUrl(remote.includes('apiKey=') ? remote : `${remote}?apiKey=${auth.apiKey}`)
    } catch {
      node = resolveWsUrl(`/chat-room-channel?apiKey=${auth.apiKey}`)
    }

    ws = new WebSocket(node)
    ws.onopen = () => {
      connected.value = true
      if (hb) window.clearInterval(hb)
      hb = window.setInterval(() => ws?.send('-hb-'), 1000 * 60 * 3)
    }
    ws.onclose = () => {
      connected.value = false
    }
    ws.onerror = () => {
      error.value = '聊天室连接失败'
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as Record<string, unknown>
        if (msg.type === 'online') {
          onlines.value = (msg.users as OnlineUser[]) || []
          discuss.value = String(msg.discussing ?? discuss.value)
        } else if (msg.type === 'discussChanged') {
          discuss.value = String(msg.newDiscuss ?? '')
        } else if (msg.type === 'revoke') {
          messages.value = messages.value.filter((m) => m.oId !== String(msg.oId))
        } else if (msg.type === 'msg' || msg.type === 'redPacket') {
          let content: unknown = msg.content
          if (typeof content === 'string') {
            try {
              const parsed = JSON.parse(content) as RedPacketContent
              if (parsed.msgType === 'redPacket') content = parsed
            } catch {
              /* plain html */
            }
          }
          pushIncoming({ ...msg, content })
        } else if (msg.type === 'redPacketStatus') {
          lastPacket.value = `${msg.whoGot} 领取了 ${msg.whoGive} 的红包`
        }
      } catch {
        /* ignore */
      }
    }
  }

  async function loadMore() {
    const auth = useAuthStore()
    if (!auth.apiKey || loadingMore.value || !hasMore.value) return
    loadingMore.value = true
    page += 1
    try {
      const history = await fetchChatHistory(auth.apiKey, page)
      if (!history.length) hasMore.value = false
      else prependHistory(history)
    } catch {
      page -= 1
    } finally {
      loadingMore.value = false
    }
  }

  function disconnect() {
    if (hb) window.clearInterval(hb)
    hb = null
    ws?.close()
    ws = null
    connected.value = false
  }

  async function send(text: string) {
    const auth = useAuthStore()
    if (!auth.apiKey || !text.trim()) return
    sending.value = true
    error.value = ''
    try {
      await sendChat(auth.apiKey, text.trim())
    } catch (e) {
      error.value = e instanceof Error ? e.message : '发送失败'
    } finally {
      sending.value = false
    }
  }

  async function sendRedPacket(opts: {
    money: number
    count: number
    msg: string
    type?: string
    recivers?: string[]
    gesture?: number
  }) {
    const payload: Record<string, unknown> = {
      msgType: 'redPacket',
      type: opts.type || 'random',
      money: Math.max(1, Number(opts.money) || 1),
      count: Math.max(1, Number(opts.count) || 1),
      msg: opts.msg || '摸鱼者，人品好！',
    }
    if (opts.recivers?.length) payload.recivers = opts.recivers
    if (opts.type === 'rockPaperScissors' && opts.gesture != null) payload.gesture = opts.gesture
    await send(JSON.stringify(payload))
  }

  async function openPacket(oId: string, gesture?: number) {
    const auth = useAuthStore()
    if (!auth.apiKey) return
    try {
      const res = await openRedPacket(auth.apiKey, oId, gesture)
      const data = (res.data ?? {}) as Record<string, unknown>
      const recivers = Array.isArray(data.recivers) ? (data.recivers as { userName?: string; money?: number }[]) : []
      packetDetail.value = { msg: String(data.msg || data.info || ''), recivers }
      const mine = recivers.find((r) => r && r.userName === auth.account?.userName)
      lastPacket.value = mine?.money != null ? `抢到 ${mine.money} 积分` : '已领取红包'
    } catch (e) {
      lastPacket.value = e instanceof Error ? e.message : '领取失败'
    }
  }

  async function revoke(oId: string) {
    const auth = useAuthStore()
    if (!auth.apiKey) return
    await revokeChat(auth.apiKey, oId)
    messages.value = messages.value.filter((m) => m.oId !== oId)
  }

  async function setDiscuss(topic: string) {
    await send(`[setdiscuss]${topic}[/setdiscuss]`)
  }

  return {
    messages,
    onlines,
    discuss,
    mutes,
    connected,
    sending,
    loading,
    loadingMore,
    hasMore,
    error,
    lastPacket,
    packetDetail,
    connect,
    disconnect,
    loadMore,
    send,
    sendRedPacket,
    openPacket,
    revoke,
    closePacketDetail() {
      packetDetail.value = null
    },
    setDiscuss,
  }
})
