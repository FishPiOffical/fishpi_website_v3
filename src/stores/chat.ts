import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchChatHistory,
  fetchChatNode,
  fetchMutes,
  openRedPacket,
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

function toDevWs(url: string) {
  try {
    const normalized = url.replace(/^ws/i, 'http')
    const u = new URL(normalized)
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${location.host}${u.pathname}${u.search}`
  } catch {
    return url
  }
}

function asLine(item: ChatHistoryItem | Record<string, unknown>): ChatLine {
  const content = item.content
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
  const error = ref('')
  const lastPacket = ref('')
  let ws: WebSocket | null = null
  let hb: number | null = null

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
    try {
      const history = await fetchChatHistory(auth.apiKey, 1)
      messages.value = []
      prependHistory(history)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载历史失败'
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

    let node = `/chat-room-channel?apiKey=${auth.apiKey}`
    try {
      const remote = await fetchChatNode(auth.apiKey)
      node = toDevWs(remote.includes('apiKey=') ? remote : `${remote}?apiKey=${auth.apiKey}`)
    } catch {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
      node = `${proto}//${location.host}/chat-room-channel?apiKey=${auth.apiKey}`
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

  async function openPacket(oId: string) {
    const auth = useAuthStore()
    if (!auth.apiKey) return
    try {
      const res = await openRedPacket(auth.apiKey, oId)
      lastPacket.value = JSON.stringify(res.data ?? res)
    } catch (e) {
      lastPacket.value = e instanceof Error ? e.message : '领取失败'
    }
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
    error,
    lastPacket,
    connect,
    disconnect,
    send,
    openPacket,
    setDiscuss,
  }
})
