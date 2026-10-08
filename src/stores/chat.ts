import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchChatAround,
  fetchChatHistory,
  fetchChatNodeBundle,
  fetchChatOnlineUsers,
  fetchMutes,
  openRedPacket,
  revokeChat,
  sendChat,
  toggleReaction,
  applyReactionPayload,
  type ChatHistoryItem,
  type ChatNodeOption,
  type MuteItem,
  type ReactionSummary,
  type RedPacketContent,
} from '@/api/fishpi'
import { useAuthStore } from './auth'

export type ChatStyle = 'classic' | 'modern'

export interface ChatLine {
  oId: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  html?: string
  time?: string
  redPacket?: RedPacketContent
  reactionSummary?: ReactionSummary[]
  currentUserReaction?: string
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
    reactionSummary: (item as ChatHistoryItem).reactionSummary,
    currentUserReaction: (item as ChatHistoryItem).currentUserReaction,
  }
}

export const useChatStore = defineStore('chat', () => {
  const chatStyle = ref<ChatStyle>(
    (typeof localStorage !== 'undefined' && (localStorage.getItem('fp_chat_style') as ChatStyle)) || 'classic'
  )
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
  const nodeName = ref('')
  const nodeOptions = ref<ChatNodeOption[]>([])
  const nodeKey = ref('')
  let ws: WebSocket | null = null
  let hb: number | null = null
  let page = 1
  let preferredWs = ''

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
    error.value = ''
    loading.value = true
    page = 1
    hasMore.value = true
    preferredWs = ''
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
      const snap = await fetchChatOnlineUsers(auth.apiKey)
      if (Array.isArray(snap.users)) {
        onlines.value = snap.users
          .filter((u) => u?.userName)
          .map((u) => ({
            userName: String(u.userName),
            userNickname: u.userNickname,
            userAvatarURL: u.userAvatarURL,
          }))
      }
      if (snap.discussing) discuss.value = snap.discussing
    } catch {
      /* WS online event will fill later */
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

    // 游客可浏览历史/在线；实时通道需 apiKey
    if (!auth.apiKey) {
      connected.value = false
      return
    }

    await openSocket(auth.apiKey)
  }

  async function openSocket(apiKey: string) {
    let node = preferredWs || resolveWsUrl(`/chat-room-channel?apiKey=${apiKey}`)
    if (!preferredWs) {
      try {
        const bundle = await fetchChatNodeBundle(apiKey)
        nodeName.value = bundle.msg || '默认节点'
        nodeKey.value = bundle.apiKey
        nodeOptions.value = bundle.avaliable
        node = resolveWsUrl(bundle.data.includes('apiKey=') ? bundle.data : `${bundle.data}?apiKey=${apiKey}`)
      } catch {
        nodeName.value = '本机代理'
        nodeOptions.value = []
        nodeKey.value = ''
        node = resolveWsUrl(`/chat-room-channel?apiKey=${apiKey}`)
      }
    }

    if (ws) {
      ws.close()
      ws = null
    }
    if (hb) {
      window.clearInterval(hb)
      hb = null
    }

    ws = new WebSocket(node)
    ws.onopen = () => {
      connected.value = true
      error.value = ''
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
        } else if (msg.type === 'chatReaction') {
          const line = messages.value.find((m) => m.oId === String(msg.oId || msg.targetId || ''))
          if (line) {
            applyReactionPayload(line, {
              summary: msg.summary as ReactionSummary[] | undefined,
              reactionSummary: msg.reactionSummary as ReactionSummary[] | undefined,
              currentUserReaction: String(msg.actorReaction ?? msg.currentUserReaction ?? ''),
            })
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  async function switchNode(option: ChatNodeOption) {
    const auth = useAuthStore()
    if (!auth.apiKey) return
    const key = nodeKey.value
    const base = option.node
    preferredWs = resolveWsUrl(key ? `${base}${base.includes('?') ? '&' : '?'}apiKey=${key}` : base)
    nodeName.value = option.name || '节点'
    await openSocket(auth.apiKey)
  }

  async function refreshNodes() {
    const auth = useAuthStore()
    if (!auth.apiKey) return
    preferredWs = ''
    try {
      const bundle = await fetchChatNodeBundle(auth.apiKey)
      nodeName.value = bundle.msg || nodeName.value
      nodeKey.value = bundle.apiKey
      nodeOptions.value = bundle.avaliable
    } catch {
      /* keep */
    }
  }

  async function loadAround(oId: string) {
    const auth = useAuthStore()
    if (!oId) return
    try {
      const around = await fetchChatAround(auth.apiKey, oId, 0, 16)
      if (!around.length) return
      const known = new Set(messages.value.map((m) => m.oId))
      const extra = around.map(asLine).filter((m) => m.oId && !known.has(m.oId))
      if (!extra.length) return
      messages.value = [...messages.value, ...extra].sort((a, b) => a.oId.localeCompare(b.oId))
    } catch (e) {
      error.value = e instanceof Error ? e.message : '附近消息失败'
    }
  }

  async function loadMore() {
    const auth = useAuthStore()
    if (loadingMore.value || !hasMore.value) return
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

  async function react(oId: string, value: string) {
    const auth = useAuthStore()
    if (!auth.apiKey) return
    const line = messages.value.find((m) => m.oId === oId)
    try {
      const data = await toggleReaction(auth.apiKey, 'chat', oId, value)
      if (line) applyReactionPayload(line, data)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '表情失败'
    }
  }

  async function setDiscuss(topic: string) {
    await send(`[setdiscuss]${topic}[/setdiscuss]`)
  }

  async function sendBarrage(text: string, color = 'rgba(255,255,255,1)') {
    const content = text.trim().slice(0, 32)
    if (!content) return
    const payload = `[barrager]${JSON.stringify({ color, content })}[/barrager]`
    await send(payload)
  }

  function clearScreen() {
    messages.value = []
    hasMore.value = true
    page = 1
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
    nodeName,
    nodeOptions,
    connect,
    disconnect,
    loadMore,
    loadAround,
    send,
    sendRedPacket,
    sendBarrage,
    openPacket,
    revoke,
    closePacketDetail() {
      packetDetail.value = null
    },
    setDiscuss,
    clearScreen,
    react,
    switchNode,
    refreshNodes,
    chatStyle,
    setChatStyle(style: ChatStyle) {
      chatStyle.value = style
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fp_chat_style', style)
      }
    },
    toggleChatStyle() {
      const next = chatStyle.value === 'classic' ? 'modern' : 'classic'
      chatStyle.value = next
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fp_chat_style', next)
      }
    },
  }
})
