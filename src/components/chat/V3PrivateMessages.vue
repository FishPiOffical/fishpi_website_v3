<script setup lang="ts">
import { formatDisplayTime } from '@/utils/time'

import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {storeToRefs} from 'pinia'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useV3MessagesStore} from '@/stores/v3Messages'
import {messageConversations,messageHistory,resolveMessagePeer,messageId,type Conversation,type PrivateMessage,type MessagePeer} from '@/api/v3-messages'
import {usePrivateInboxStore} from '@/stores/privateInbox'
import ChatComposer from '@/components/ChatComposer.vue'
import {fpConfirm} from '@/composables/useDialog'

const DEFAULT_AVATAR='/favicon.svg'

const props=withDefaults(defineProps<{initialName?:string;initialId?:string;chatroomActive?:boolean;autoSelectFirst?:boolean}>(),{initialName:'',initialId:'',chatroomActive:false,autoSelectFirst:false})
const emit=defineEmits<{'peer-selected':[peer:{id:string;userName:string}]}>()
const {accessToken,account}=storeToRefs(useAuthStore()),writes=useV3MessagesStore(),mounted=ref(false)
const authenticated=computed(()=>mounted.value&&!!accessToken.value&&!!account.value?.oId)
const identity=()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||''])
const inbox=usePrivateInboxStore(),{unreadTotal:unread,error:unreadError}=storeToRefs(inbox)
const list=ref<Conversation[]>([]),page=ref(1),pages=ref(0),listBusy=ref(false),listError=ref('')
const target=ref(''),other=ref<MessagePeer|null>(null),messages=ref<PrivateMessage[]>([]),before=ref(''),hasMore=ref(false),historyBusy=ref(false),historyError=ref(''),draft=ref(''),toName=ref(''),resolveBusy=ref(false),resolveError=ref(''),changed=ref(false)
const msgScroller=ref<HTMLElement|null>(null)
const displayedTarget=ref('')
let autoReadAttempt=''
let followLatest=true
function trackMessageScroll(){const el=msgScroller.value;if(el)followLatest=el.scrollHeight-el.clientHeight-el.scrollTop<=48}
function onHistoryMediaLoad(){if(followLatest)scrollBottom()}
let eventRevision=0,listRun=0,historyRun=0,resolveRun=0,historyAbort:AbortController|null=null,confirmation:AbortController|null=null
const canSend=computed(()=>authenticated.value&&!!target.value&&!!other.value?.available&&target.value!==account.value?.oId&&!writes.pending&&!writes.busy&&draft.value.length<=10240)

function scrollBottom(){
 followLatest=true
 if(msgScroller.value) msgScroller.value.scrollTop=msgScroller.value.scrollHeight
}

function closeTarget(){displayedTarget.value='';autoReadAttempt='';followLatest=true;historyRun++;resolveRun++;historyAbort?.abort();historyAbort=null;confirmation?.abort();confirmation=null;target.value='';other.value=null;messages.value=[];before.value='';hasMore.value=false;historyBusy.value=false;draft.value='';historyError.value='';resolveError.value='';resolveBusy.value=false;changed.value=false}
async function loadList(p=page.value){if(!authenticated.value||listBusy.value)return;const run=++listRun,reader=identity(),owner=account.value!.oId;listBusy.value=true;listError.value='';try{const result=await messageConversations(owner,p);if(run===listRun&&reader===identity()&&authenticated.value){list.value=result.list;page.value=result.p;pages.value=result.pageCount;if(props.autoSelectFirst&&!props.chatroomActive&&!target.value&&!props.initialId&&!props.initialName&&result.list.length>0)select(result.list[0]!.peer)}}catch(e){if(run===listRun&&reader===identity())listError.value=e instanceof Error?e.message:'会话读取失败'}finally{if(run===listRun&&reader===identity())listBusy.value=false}}
async function loadUnread(){await inbox.refreshUnread()}
async function loadHistory(older=false){if(!authenticated.value||!target.value||older&&(!hasMore.value||historyBusy.value))return;historyAbort?.abort();const abort=new AbortController();historyAbort=abort;const oldHeight=msgScroller.value?.scrollHeight||0,oldTop=msgScroller.value?.scrollTop||0;const run=++historyRun,reader=identity(),id=target.value,owner=account.value!.oId,cursor=older?before.value:'',event=eventRevision;historyBusy.value=true;historyError.value='';if(!older)displayedTarget.value='';const valid=()=>run===historyRun&&reader===identity()&&id===target.value&&authenticated.value&&!abort.signal.aborted
 try{const result=await messageHistory(owner,id,cursor,abort.signal);if(!valid())return;other.value=result.peer;emit('peer-selected',{id:result.peer.id,userName:result.peer.userName});if(older){const known=new Set(messages.value.map(m=>m.id));messages.value=[...result.list.filter(m=>!known.has(m.id)),...messages.value]}else messages.value=result.list;before.value=result.nextBefore;hasMore.value=result.hasMore;if(!older&&event===eventRevision)changed.value=false;await nextTick();if(!valid())return;if(older){followLatest=false;if(msgScroller.value)msgScroller.value.scrollTop=oldTop+msgScroller.value.scrollHeight-oldHeight}else{scrollBottom();displayedTarget.value=id}}
 catch(e){if(valid()){historyError.value=e instanceof Error?e.message:'历史读取失败';if(!older&&e instanceof ApiError&&[401,403,404].includes(e.status)){messages.value=[];before.value='';hasMore.value=false}}}
 finally{if(valid()){historyBusy.value=false;historyAbort=null}}}
// Mark only a successfully displayed unread conversation, never a failed/stale history read.
async function autoMarkRead(){
 if(!authenticated.value||props.chatroomActive||historyBusy.value||historyError.value||changed.value||displayedTarget.value!==target.value||!target.value||writes.busy||writes.pending)return
 if(list.value.find(item=>item.peerId===target.value)?.unreadCount===0)return
 const latest=messages.value.at(-1)?.id
 if(!latest)return
 const attempt=JSON.stringify([identity(),target.value,latest]);if(autoReadAttempt===attempt)return
 autoReadAttempt=attempt;const reader=identity(),id=target.value
 if(await writes.start('read',id)){if(authenticated.value&&reader===identity())await refresh()}
}
watch([displayedTarget,()=>list.value,historyBusy,changed,()=>props.chatroomActive,()=>writes.busy,()=>writes.pending],()=>{void autoMarkRead()},{flush:'post'})
function select(peer:MessagePeer){if(peer.id===account.value?.oId){resolveError.value='不能给自己发信';return}closeTarget();target.value=peer.id;other.value=peer;emit('peer-selected',{id:peer.id,userName:peer.userName});void loadHistory()}
async function resolve(name=toName.value){if(!authenticated.value)return;const run=++resolveRun,reader=identity();resolveBusy.value=true;resolveError.value='';try{const peer=await resolveMessagePeer(name);if(run===resolveRun&&reader===identity()&&authenticated.value){toName.value='';select(peer)}}catch(e){if(run===resolveRun&&reader===identity())resolveError.value=e instanceof Error?e.message:'用户读取失败'}finally{if(run===resolveRun&&reader===identity())resolveBusy.value=false}}
async function initial(){if(!authenticated.value)return;if(props.initialId){try{messageId(props.initialId);closeTarget();target.value=props.initialId;await loadHistory()}catch{resolveError.value='会话ID不合法'}}else if(props.initialName)await resolve(props.initialName)}
async function refresh(){await Promise.all([loadList(),loadUnread(),loadHistory()])}
watch(()=>inbox.revision,()=>{if(!authenticated.value)return;eventRevision++;changed.value=true;if(!listBusy.value)void loadList()})
async function send(){if(!canSend.value||!draft.value.trim())return;const text=draft.value,id=target.value,reader=identity();if(await writes.start('send',id,text)){if(reader!==identity()||!authenticated.value)return;if(reader===identity()&&target.value===id&&draft.value===text)draft.value='';await refresh()}}
async function withdraw(message:PrivateMessage){if(!authenticated.value||!message.fromMe||writes.busy||writes.pending)return;confirmation?.abort();const abort=new AbortController();confirmation=abort;const reader=identity(),id=target.value;try{const accepted=await fpConfirm({signal:abort.signal,title:'撤回本人私信',message:'是否撤回这条本人发送的私信？',confirmText:'撤回',tone:'danger'});if(accepted&&!abort.signal.aborted&&reader===identity()&&id===target.value&&await writes.start('withdraw',message.id)){if(reader!==identity()||!authenticated.value)return;await refresh()}}finally{if(confirmation===abort)confirmation=null}}
async function markRead(all=false){if(!authenticated.value||writes.pending||writes.busy||!all&&!target.value)return;const reader=identity();if(await writes.start(all?'read-all':'read',all?'':target.value)){if(reader!==identity()||!authenticated.value)return;await refresh()}}
async function retry(){const pending=writes.pending,reader=identity();if(!pending)return;if(await writes.retry()){if(reader!==identity()||!authenticated.value)return;if(reader===identity()&&pending.kind==='send'&&pending.target===target.value&&draft.value===pending.content)draft.value='';await refresh()}}
watch(()=>JSON.stringify([identity(),props.initialName,props.initialId]),()=>{closeTarget();listRun++;list.value=[];page.value=1;pages.value=0;listBusy.value=false;listError.value='';if(authenticated.value){void loadList(1);void loadUnread();void initial()}},{flush:'sync'})
onMounted(()=>{mounted.value=true;void loadList(1);void loadUnread();void initial()})
onBeforeUnmount(()=>{mounted.value=false;listRun++;closeTarget()})
</script>
<template>
 <div v-if="!authenticated" class="hint">登录后可读取私信。</div>
 <div v-else class="private-messages">
  <!-- 保持状态与恢复区 -->
  <div class="toolbar sr-toolbar">
   <span>未读：{{ unread===null?'待查询':unread }}</span>
   <button class="fp-control" type="button" :disabled="listBusy||historyBusy" @click="refresh">刷新当前状态</button>
   <button class="fp-control" type="button" :disabled="writes.busy||!!writes.pending" @click="markRead(true)">全部标记已读</button>
  </div>
  <p v-if="unreadError" class="alert-bar" role="alert">{{ unreadError }} <button class="fp-retry-icon" type="button" @click="loadUnread" title="重读未读数">重读未读数</button></p>
  <div v-if="writes.pending && !writes.busy" class="pending-banner" role="status">
   <p class="fp-retry-copy">暂未确认私信操作是否成功，请重试。</p>
   <button class="fp-retry-icon" type="button" :disabled="writes.busy" @click="retry" title="恢复本次私信操作">恢复本次私信操作</button>
   <p class="pending-sub">整页刷新或退出会清除本地恢复信息，请先核对原操作。</p>
  </div>
  <p v-if="writes.error" class="alert-bar" role="alert">{{ writes.error }}</p>

  <div class="conversation-layout columns">
   <!-- 左侧：发起私信 + 聊天室选项(插槽) + 私信头像会话列表 -->
   <aside class="conversation-list">
    <form class="start" @submit.prevent="resolve()">
     <input class="fp-control start-input" v-model="toName" maxlength="64" placeholder="输入用户名发起私信" aria-label="输入用户名发起私信" />
     <button class="fp-control start-btn" type="submit" :disabled="resolveBusy||!toName.trim()">发起</button>
     <button class="fp-control sr-helper-btn" type="button" @click="select({id:'1000000000086',userName:'',userNickname:'文件传输助手',userAvatarURL:'',available:true,builtin:true})">文件传输助手</button>
    </form>
    <p v-if="resolveError" class="side-error" role="alert">{{ resolveError }}</p>

    <slot name="sidebar-top" />

    <p v-if="listBusy&&!list.length" class="side-status" role="status">读取会话…</p>
    <p v-if="listError" class="side-error" role="alert">{{ listError }} <button class="fp-control" @click="loadList()">重读会话</button></p>
    <p v-if="!listBusy&&!listError&&!list.length" class="empty-list">暂无会话</p>

    <ol class="conv-items">
     <li v-for="item in list" :key="item.peerId">
      <button
       type="button"
       class="peer conversation fp-control"
       :class="{selected:!chatroomActive&&target===item.peerId}"
       :aria-current="!chatroomActive&&target===item.peerId?'true':undefined"
       :title="item.unreadCount>0?`${item.peer.userNickname||item.peer.userName} (${item.unreadCount} 条未读)`:(item.peer.userNickname||item.peer.userName)"
       @click="select(item.peer)"
      >
       <span class="conversation-avatar">
        <img :src="item.peer.userAvatarURL||DEFAULT_AVATAR" alt="" @error="($event.target as HTMLImageElement).src=DEFAULT_AVATAR" />
        <span v-if="item.unreadCount>0" class="conversation-unread-dot" aria-hidden="true" />
       </span>
       <span class="conversation-copy">
        <b>{{ item.peer.userNickname||item.peer.userName||'不可用账号' }}</b>
        <span class="sr-unread"> · {{ item.unreadCount }} 未读</span>
        <p>{{ item.lastMessage.available?item.lastMessage.preview:'正文不可用' }}</p>
       </span>
      </button>
     </li>
    </ol>

    <nav class="conv-pager" :class="{'is-single-page':pages<=1}">
     <button class="fp-control" type="button" :disabled="listBusy||page<=1" @click="loadList(page-1)">上一页会话</button>
     <span>{{ page }} / {{ Math.max(1,pages) }}</span>
     <button class="fp-control" type="button" :disabled="listBusy||page>=pages" @click="loadList(page+1)">下一页会话</button>
    </nav>
   </aside>

   <!-- 右侧：聊天室覆盖插槽 或 私信消息对话区 -->
   <slot v-if="chatroomActive" name="main-override" />
   <section v-else-if="target" class="conversation-content">
    <header class="conversation-head">
     <div class="head-main">
      <h2>{{ other?.userNickname||other?.userName||'会话 '+target }}</h2>
      <small class="connection-label connected">实时连接中 · {{ messages.length }} 条已加载消息</small>
     </div>
     <div class="head-ops">
      <button v-if="changed" class="fp-control head-op-btn is-accent" type="button" :disabled="historyBusy" @click="loadHistory()">有新消息 · 刷新</button>
     </div>
    </header>

    <p v-if="other&&!other.available" class="unavailable-banner">该账号资料不可用，仍可阅读本人历史。</p>
    <p v-if="changed" class="sr-changed" role="status">私信状态有更新 <button class="fp-control" :disabled="historyBusy" @click="loadHistory()">读取当前历史</button></p>
    <p v-if="historyError" class="alert-bar" role="alert">{{ historyError }} <button class="fp-retry-icon" type="button" :disabled="historyBusy" @click="loadHistory()" title="重读当前历史">重读当前历史</button></p>
    <p v-if="historyBusy&&!messages.length" class="empty-content" role="status">读取历史…</p>

    <div ref="msgScroller" class="messages-scroller" @scroll.passive="trackMessageScroll" @load.capture="onHistoryMediaLoad">
     <button class="fp-control more-btn" v-if="hasMore" type="button" :disabled="historyBusy" @click="loadHistory(true)">读取更早消息</button>
     <p v-if="!messages.length&&!historyBusy&&!historyError" class="empty-content">暂无消息</p>
     <ol class="messages">
      <li v-for="m in messages" :key="m.id" class="msg-row" :class="{'is-self':m.fromMe}">
       <img
        class="msg-avatar"
        :src="(m.fromMe?account?.userAvatarURL:other?.userAvatarURL)||DEFAULT_AVATAR"
        alt=""
        @error="($event.target as HTMLImageElement).src=DEFAULT_AVATAR"
       />
       <div class="msg-bubble">
        <div class="msg-meta-top">
         <span class="msg-author">{{ m.fromMe?(account?.userNickname||account?.userName||'我'):(other?.userNickname||other?.userName||'对方') }}</span>
         <span class="sr-meta">{{ m.fromMe?'我':'对方' }} · {{ formatDisplayTime(m.sentAt) }}</span>
        </div>
        <div v-if="m.available&&m.contentHtml" class="message-body" v-html="m.contentHtml" />
        <pre v-else-if="m.available" class="message-pre">{{ m.content }}</pre>
        <p v-else class="message-unavailable">正文不可用</p>
        <div class="msg-meta-foot">
         <time class="msg-time">{{ formatDisplayTime(m.sentAt) }}</time>
         <button class="fp-control withdraw-btn" v-if="m.fromMe" type="button" :disabled="writes.busy||!!writes.pending" @click="withdraw(m)">撤回</button>
        </div>
       </div>
      </li>
     </ol>
    </div>

    <div class="composer-box">
     <ChatComposer :key="identity()+':'+target" v-model="draft" :height="100" compact :sending="writes.busy" :disabled="!canSend" placeholder="说点什么吧，友善第一哦。" submit-text="发送私信" @submit="send" />
     <span class="sr-count">{{ draft.length }} / 10240</span>
    </div>
   </section>
   <div v-else class="conversation-content empty-pane">
    <p class="empty-content">选择会话或查找用户开始私信。</p>
   </div>
  </div>
 </div>
</template>
<style scoped lang="scss">
.private-messages {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  overflow: hidden;
}

.sr-toolbar,
.sr-unread,
.sr-helper-btn,
.sr-changed,
.sr-meta,
.sr-count,
.conv-pager.is-single-page {
  display: none !important;
}

.alert-bar,
.unavailable-banner,
.pending-banner {
  margin: 0;
  padding: 8px 14px;
  font-size: 12.5px;
  border-bottom: 1px solid var(--fp-border);
  background: var(--fp-elevated, var(--fp-hover));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.alert-bar {
  color: var(--fp-danger);
  background: var(--fp-danger-soft);
}

.pending-banner p {
  margin: 0;
}

.pending-sub {
  font-size: 11.5px;
  color: var(--fp-muted);
}

/* 左右分栏布局 */
.conversation-layout {
  display: grid;
  flex: 1;
  grid-template-columns: 220px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  transition: grid-template-columns 180ms ease;
}

/* 左侧会话栏 */
.conversation-list {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 8px;
  border-right: 1px solid var(--fp-border);
  background: var(--fp-card);
  transition: padding 180ms ease;
}

.start {
  position: sticky;
  top: -10px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: -10px -8px 8px;
  padding: 10px 8px;
  border-bottom: 1px solid var(--fp-border);
  background: var(--fp-card);
  transition: max-height 180ms ease, opacity 140ms ease, padding 180ms ease, margin 180ms ease;
}

.start-input {
  flex: 1;
  width: 0;
  min-width: 0;
  height: 32px !important;
  min-height: 32px !important;
  padding: 0 10px !important;
  border: 1px solid var(--fp-border);
  border-radius: 7px !important;
  background: var(--fp-elevated, var(--fp-bg));
  color: var(--fp-text);
  font-size: 12px !important;
}

.start-btn {
  flex: none;
  height: 32px !important;
  min-height: 32px !important;
  padding: 0 11px !important;
  border: 0 !important;
  border-radius: 7px !important;
  background: var(--fp-primary) !important;
  color: #fff !important;
  font-size: 12px !important;
  font-weight: 500;
  cursor: pointer;
}

.start-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.side-error,
.side-status,
.empty-list {
  margin: 8px 4px;
  font-size: 12px;
  color: var(--fp-muted);
  text-align: center;
}

.side-error {
  color: var(--fp-danger);
}

.conv-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.conversation,
:deep(.conversation) {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 52px;
  padding: 8px 10px !important;
  margin: 0;
  border: 0 !important;
  border-radius: 9px !important;
  background: transparent;
  color: var(--fp-text);
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
  transition: gap 180ms ease, padding 180ms ease, background-color 140ms ease;
}

.conversation:hover,
:deep(.conversation:hover) {
  background: var(--fp-hover);
}

.conversation.selected,
.conversation[aria-current='true'],
:deep(.conversation.selected) {
  background: color-mix(in srgb, var(--fp-accent) 13%, var(--fp-card));
}

:deep(.chatroom-pinned) {
  margin-bottom: 6px;
  padding-bottom: 10px !important;
  border-bottom: 1px solid var(--fp-border) !important;
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.conversation-avatar,
:deep(.conversation-avatar) {
  position: relative;
  width: 36px;
  height: 36px;
  flex: none;
  transition: width 180ms ease, height 180ms ease;
}

.conversation-avatar img,
:deep(.conversation-avatar img) {
  display: block;
  width: 36px;
  height: 36px;
  border-radius: var(--fp-avatar-radius);
  object-fit: cover;
  background: var(--fp-hover);
  transition: width 180ms ease, height 180ms ease;
}

:deep(.room-avatar) {
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: var(--fp-avatar-radius);
  background: var(--fp-primary);
  color: #fff;
}

:deep(.room-avatar svg) {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.conversation-unread-dot {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 9px;
  height: 9px;
  border: 1.5px solid var(--fp-card);
  border-radius: 50%;
  background: var(--fp-accent);
}

.conversation-copy,
:deep(.conversation-copy) {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  opacity: 1;
  transition: max-width 180ms ease, opacity 140ms ease;
}

.conversation-copy b,
:deep(.conversation-copy b) {
  color: var(--fp-title);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-copy p,
:deep(.conversation-copy small) {
  margin: 0;
  color: var(--fp-muted);
  font-size: 11.5px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--fp-border);
  font-size: 11px;
  color: var(--fp-muted);
}

.conv-pager button {
  min-height: 26px !important;
  padding: 2px 6px !important;
  font-size: 11px !important;
}

/* 右侧会话内容区 */
.conversation-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: var(--fp-card);
}

.conversation-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--fp-border);
}

.head-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}

.head-main h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--fp-title);
  white-space: nowrap;
}

.connection-label {
  font-size: 12px;
  color: var(--fp-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head-ops {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.head-op-btn {
  min-height: 26px !important;
  height: 26px !important;
  padding: 0 8px !important;
  font-size: 11.5px !important;
  border-radius: 6px !important;
  background: transparent !important;
  color: var(--fp-muted) !important;
  border: 1px solid var(--fp-border) !important;
}

.head-op-btn:hover:not(:disabled) {
  background: var(--fp-hover) !important;
  color: var(--fp-text) !important;
}

.head-op-btn.is-accent {
  color: var(--fp-primary) !important;
  border-color: var(--fp-primary) !important;
}

/* 消息滚动区与聊天气泡 */
.messages-scroller {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.more-btn {
  flex: none;
  align-self: center;
  min-height: 26px !important;
  height: 26px !important;
  padding: 0 10px !important;
  border-radius: 999px !important;
  font-size: 11.5px !important;
  color: var(--fp-muted);
  background: transparent;
}

.messages {
  flex: none;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 86%;
}

.msg-row.is-self {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--fp-avatar-radius);
  object-fit: cover;
  flex: none;
  background: var(--fp-hover);
}

.msg-bubble {
  position: relative;
  min-width: 96px;
  max-width: 100%;
  padding: 8px 12px 6px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--fp-accent) 11%, var(--fp-elevated, var(--fp-bg)));
  border: 1px solid color-mix(in srgb, var(--fp-accent) 16%, var(--fp-border));
  color: var(--fp-text);
}

.msg-row.is-self .msg-bubble {
  background: color-mix(in srgb, var(--fp-primary) 13%, var(--fp-elevated, var(--fp-bg)));
  border-color: color-mix(in srgb, var(--fp-primary) 22%, var(--fp-border));
}

.msg-meta-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.msg-author {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--fp-muted);
}

.message-body,
.message-pre {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--fp-title);
  overflow-wrap: anywhere;

  :deep(p) {
    margin: 0 0 4px;
  }
  :deep(p:last-child) {
    margin-bottom: 0;
  }
  :deep(img) {
    max-width: 100%;
    max-height: 220px;
    border-radius: 6px;
  }
}

.message-pre {
  white-space: pre-wrap;
  font-family: inherit;
}

.message-unavailable {
  margin: 0;
  font-size: 12.5px;
  color: var(--fp-muted);
  font-style: italic;
}

.msg-meta-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
}

.msg-time {
  font-size: 11px;
  color: var(--fp-muted);
  font-variant-numeric: tabular-nums;
}

.withdraw-btn {
  min-height: 20px !important;
  height: 20px !important;
  padding: 0 6px !important;
  border: 0 !important;
  border-radius: 4px !important;
  background: transparent !important;
  color: var(--fp-muted) !important;
  font-size: 11px !important;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
}

.msg-bubble:hover .withdraw-btn,
.withdraw-btn:focus-visible {
  opacity: 1;
}

.withdraw-btn:hover:not(:disabled) {
  color: var(--fp-danger) !important;
}

/* 底部输入框 */
.composer-box {
  flex: none;
  padding: 10px 12px;
  border-top: 1px solid var(--fp-border);
  background: var(--fp-card);
}

.empty-pane {
  display: grid;
  place-items: center;
}

.empty-content {
  margin: auto;
  padding: 20px;
  color: var(--fp-muted);
  font-size: 13px;
  text-align: center;
}

.hint {
  padding: 20px;
  color: var(--fp-muted);
  font-size: 13px;
  text-align: center;
}

@container whisper-panel (max-width: 680px) {
  .start {
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    margin: 0;
    border-bottom-width: 0;
    opacity: 0;
    visibility: hidden;
    overflow: hidden;
  }
}

@container whisper-panel (max-width: 520px) {
  .conversation-layout {
    grid-template-columns: 56px minmax(0, 1fr);
  }
  .conversation-list {
    padding: 6px 4px;
  }
  .conversation,
  :deep(.conversation) {
    justify-content: center;
    gap: 0;
    min-height: 44px;
    padding: 7px 4px !important;
  }
  .conversation-copy,
  :deep(.conversation-copy) {
    max-width: 0;
    opacity: 0;
  }
  .conversation-avatar,
  .conversation-avatar img,
  :deep(.conversation-avatar),
  :deep(.conversation-avatar img) {
    width: 28px;
    height: 28px;
  }
  .conversation-head {
    display: none;
  }
  .messages-scroller {
    padding: 8px;
  }
  .messages {
    gap: 8px;
  }
  .msg-avatar {
    width: 24px;
    height: 24px;
  }
  .msg-bubble {
    padding: 5px 8px 4px;
    border-radius: 8px;
  }
}

@media (max-width: 640px) {
  .conversation-layout {
    grid-template-columns: 170px minmax(0, 1fr);
  }
}
</style>
