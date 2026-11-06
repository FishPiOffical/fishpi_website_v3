import { defineStore } from 'pinia'
import { computed,ref,watch } from 'vue'
import {
  type ChatNodeOption,
  type RedPacketContent,
} from '@/api/fishpi'
import { type ChatCardData } from '@/utils/chatCard'
import {useV3ChatPublicationStore} from './v3ChatPublication'
import {useV3ChatOnlineStore} from './v3ChatOnline'
import {useV3ChatTimelineStore} from './v3ChatTimeline'
import type {ChatMessage} from '@/api/v3-chat-messages'

export type ChatStyle = 'classic' | 'modern'

export interface ChatLine {
  oId: string
  userOId?: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  html?: string
  time?: string
  redPacket?: RedPacketContent
  card?: ChatCardData
  sysMetal?: unknown
}

export interface OnlineUser {
  userOId?: string
  oId?: string
  userName: string
  userAvatarURL?: string
  userNickname?: string
}

function asV3Line(message:ChatMessage):ChatLine{
 const card=message.card
 const redPacket:RedPacketContent|undefined=message.type==='redPacket'?{msgType:'redPacket',type:String(card.type),money:Number(card.money),count:Number(card.count),got:Number(card.got),msg:String(card.message),senderId:message.author.id}:undefined
 const publicCard:ChatCardData|undefined=message.type==='music'?{msgType:'music',title:String(card.title),source:String(card.source),coverURL:String(card.coverURL),from:String(card.from)}:message.type==='weather'?{msgType:'weather',date:String(card.date),weatherCode:String(card.weatherCode),max:String(card.max),min:String(card.min),t:String(card.t),st:String(card.st)}:undefined
 return{oId:message.id,userOId:message.author.id,userName:message.author.userName,userNickname:message.author.userNickname,userAvatarURL:message.author.userAvatarURL,html:message.type==='text'?message.contentHtml:message.type==='unavailable'?'<p>当前消息不可读取</p>':undefined,time:Number.isFinite(new Date(message.createdAt).getTime())?new Date(message.createdAt).toISOString():'',redPacket,card:publicCard}
}

export const useChatStore = defineStore('chat', () => {
  const publication=useV3ChatPublicationStore(),timeline=useV3ChatTimelineStore(),online=useV3ChatOnlineStore()
  const chatStyle = ref<ChatStyle>('classic')
  function restoreStyle(){if(import.meta.env.SSR||typeof localStorage==='undefined')return;const saved=localStorage.getItem('fp_chat_style');if(saved==='classic'||saved==='modern')chatStyle.value=saved}
  const messages = computed(()=>timeline.messages.map(asV3Line))
  const onlines=computed<OnlineUser[]>(()=>online.users.map(u=>({userOId:u.id,userName:u.userName,userAvatarURL:u.userAvatarURL})))
  const discuss = computed(()=>timeline.topic)
  const connected = computed(()=>timeline.connected)
  const connecting = computed(()=>timeline.connecting)
  /** 浮动聊天窗正在使用聊天室实时连接；离开 /cr 时据此保留连接。 */
  const floatingChatroomOpen = ref(false)
  const sending=computed(()=>publication.busy)
  const loading = computed(()=>timeline.loading)
  const loadingMore = computed(()=>timeline.loadingMore)
  const hasMore = computed(()=>timeline.hasMore)
  const error=computed(()=>timeline.error)
  const nodeName=computed(()=>timeline.connected?'当前站点':'未连接')
  const nodeOptions = ref<ChatNodeOption[]>([])
  async function connect(){await Promise.all([timeline.connect(),online.connect()])}
  watch(()=>timeline.connected,value=>{if(value)void online.refresh()})

  async function loadMore(){await timeline.loadMore()}
  function disconnect(){timeline.disconnect();online.disconnect()}
  async function switchNode(_option:ChatNodeOption){}
  async function refreshNodes(){}
  watch(()=>publication.currentMessage,message=>{if(message)timeline.upsertConfirmed(message)})
  async function refreshMessages(){await timeline.readLatest()}

  async function send(text:string){return !!await publication.send(text)}
  function clearScreen(){timeline.clearVisible()}

  return {
    messages,
    onlines,
    onlineTotal:computed(()=>online.total),
    discuss,
    connected,
    connecting,
    floatingChatroomOpen,
    sending,
    loading,
    loadingMore,
    hasMore,
    error,
    nodeName,
    nodeOptions,
    connect,
    disconnect,
    loadMore,
    refreshMessages,
    topicError:computed(()=>timeline.topicError),
    send,
    clearScreen,
    switchNode,
    refreshNodes,
    chatStyle,
    restoreStyle,
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
