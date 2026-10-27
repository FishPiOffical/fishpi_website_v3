import { ApiError, getAccessToken, request } from './http'

/** A ticket goes only in the first socket frame, never in a URL or persistent storage. */
export function subscribeNotificationChanges(changed: () => void): () => void {
  return subscribeChanges('notifications','/api/v3/realtime/tickets',changed)
}
export function subscribeArticleChanges(articleId:string,changed:()=>void):()=>void {
  if(!/^[0-9]{1,32}$/.test(articleId))throw new ApiError('文章ID不合法',422)
  return subscribeChanges('article',`/api/v3/articles/${articleId}/realtime-ticket`,changed,articleId)
}
export function subscribeMessageChanges(changed:()=>void):()=>void {return subscribeChanges('messages','/api/v3/me/messages/realtime-ticket',changed)}
export interface ChatBarrageEvent{id:string;content:string;color:string;createdAt:number;author:{id:string;userName:string;userNickname:string;userAvatarURL:string}}
export type ChatRealtimeEvent={type:'sync'|'topic'|'message'|'reactions';id?:string;revision?:string}|{type:'barrage';barrage:ChatBarrageEvent}
function barrageEvent(value:unknown):ChatBarrageEvent|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const d=value as Record<string,unknown>,a=d.author as Record<string,unknown>|null
 const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v)
 if(typeof d.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(d.id)||!text(d.content,32)||!d.content.trim()||typeof d.color!=='string'||!/^#[0-9A-F]{6}$/.test(d.color)||typeof d.createdAt!=='number'||!Number.isSafeInteger(d.createdAt)||d.createdAt<0||!a||Array.isArray(a)||typeof a.id!=='string'||!/^[1-9][0-9]{0,18}$/.test(a.id)||!text(a.userName,64)||!a.userName.trim()||!text(a.userNickname,64)||!text(a.userAvatarURL,2048))return null
 let avatar='';if(a.userAvatarURL)try{const u=new URL(a.userAvatarURL);if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password)avatar=u.href}catch{}
 return{id:d.id,content:d.content,color:d.color,createdAt:d.createdAt,author:{id:a.id,userName:a.userName,userNickname:a.userNickname,userAvatarURL:avatar}}
}
export type ChatRealtimeState='connecting'|'ready'|'closed'|'blocked'
export function subscribeChatChanges(event:(value:ChatRealtimeEvent)=>void,state:(value:ChatRealtimeState)=>void):()=>void{
 return subscribeChanges('chat','/api/v3/chat/realtime-ticket',()=>event({type:'sync'}),undefined,event,state)
}
function subscribeChanges(channel:'notifications'|'article'|'messages'|'chat',path:string,changed:()=>void,articleId?:string,chatEvent?:(value:ChatRealtimeEvent)=>void,connectionState?:(value:ChatRealtimeState)=>void):()=>void {
  if (import.meta.env.SSR || typeof WebSocket === 'undefined') return () => {}
  const token = getAccessToken()
  if (!token) return () => {}
  let stopped = false, attempts = 0, sequence = 0
  let socket: WebSocket | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  let deadline: ReturnType<typeof setTimeout> | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null
  const current = () => !stopped && getAccessToken() === token
  function timers() {
    if (deadline) clearTimeout(deadline)
    if (heartbeat) clearInterval(heartbeat)
    deadline = null; heartbeat = null
  }
  function retire() {
    connectionState?.('closed')
    timers()
    const old = socket; socket = null
    if (old) { old.onopen = null; old.onmessage = null; old.onclose = null; old.onerror = null; old.close() }
  }
  function reconnect() {
    retire()
    if (!current() || retry) return
    retry = setTimeout(() => { retry = null; void connect() }, Math.min(1000 * 2 ** Math.min(attempts++, 5), 30_000))
  }
  async function connect() {
    const turn = ++sequence
    connectionState?.('connecting')
    try {
      const response = await request<{ code: number; data?: { ticket?: unknown; path?: unknown; channel?: unknown; articleId?:unknown } }>(path, { method: 'POST', body: '{}' })
      if (!current() || turn !== sequence) return
      const data = response.data
      if (response.code !== 0 || data?.path !== '/api/v3/realtime' || data.channel !== channel || (articleId!==undefined&&data.articleId!==articleId)
        || typeof data.ticket !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(data.ticket)) {
        throw new ApiError('实时订阅响应格式不正确', 502, 'invalid_response')
      }
      let ticket = data.ticket
      const transport = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v3/realtime`)
      socket = transport
      let authenticated = false, sent = false
      const valid = () => current() && turn === sequence && socket === transport
      const authenticate = () => {
        if (!valid() || sent) return
        sent = true
        transport.send(JSON.stringify({ type: 'authenticate', ticket }))
        ticket = ''
      }
      transport.onopen = authenticate
      deadline = setTimeout(() => { if (valid() && !authenticated) reconnect() }, 5000)
      transport.onmessage = (event) => {
        if (!valid()) return
        try {
          const message = JSON.parse(event.data) as { type?: unknown; data?: { channel?: unknown; articleId?:unknown;messageId?:unknown;revision?:unknown } }
          if (message.type === 'authentication.required') { authenticate(); return }
          if (message.type === 'ready') {
            if (authenticated || !sent || message.data?.channel !== channel || (articleId!==undefined&&message.data?.articleId!==articleId)) { reconnect(); return }
            authenticated = true; attempts = 0
            connectionState?.('ready')
            if (deadline) clearTimeout(deadline); deadline = null
            heartbeat = setInterval(() => { if (valid() && transport.readyState === WebSocket.OPEN) transport.send('{"type":"ping"}') }, 25_000)
            changed() // Recover missed invalidations after every reconnect.
          } else if(authenticated&&channel==='chat'){
            if(message.type==='chat.barrager'){const barrage=barrageEvent(message.data);if(barrage)chatEvent?.({type:'barrage',barrage});return}
            if(message.type==='chat.sync_required'){chatEvent?.({type:'sync'});return}
            const revision=message.data?.revision
            if(typeof revision!=='string'||!revision||revision.length>128||/[\u0000-\u001f\u007f]/.test(revision))return
            if(message.type==='chat.topic_changed'){chatEvent?.({type:'topic',revision});return}
            const id=message.data?.messageId;if(typeof id!=='string'||!/^\d{1,32}$/.test(id))return
            if(message.type==='chat.message.reactions')chatEvent?.({type:'reactions',id,revision})
            else if(['chat.message.created','chat.message.updated','chat.message.deleted'].includes(String(message.type)))chatEvent?.({type:'message',id,revision})
          } else if (authenticated && (channel==='article'?message.type==='article.changed'&&message.data?.articleId===articleId:message.type===`${channel}.changed`)) changed()
        } catch { reconnect() }
      }
      transport.onerror = () => { if (valid()) reconnect() }
      transport.onclose = () => { if (valid()) reconnect() }
    } catch (error) {
      if (!current() || turn !== sequence) return
      if (error instanceof ApiError && ([401, 403].includes(error.status) || error.code === 'captcha')) { retire(); connectionState?.('blocked'); return }
      reconnect()
    }
  }
  void connect()
  return () => { stopped = true; sequence++; if (retry) clearTimeout(retry); retry = null; retire() }
}
