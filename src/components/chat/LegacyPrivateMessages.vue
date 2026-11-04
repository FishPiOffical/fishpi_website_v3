<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useAuthStore} from '@/stores/auth'
import {useLegacyMessagesStore} from '@/stores/legacyMessages'
import {usePrivateInboxStore} from '@/stores/privateInbox'
import {FILE_PEER,type LegacyMessageCommand} from '@/api/legacy/messages'
import {DEFAULT_AVATAR} from '@/utils/avatar'
import {fpConfirm} from '@/composables/useDialog'
const props=withDefaults(defineProps<{initialName?:string;initialId?:string}>(),{initialName:'',initialId:''})
const emit=defineEmits<{'peer-selected':[peer:{id:string;userName:string}];'connection-change':[state:string]}>()
const auth=useAuthStore(),chat=useLegacyMessagesStore(),inbox=usePrivateInboxStore()
const {peer,conversations,messages,draft,connection,listBusy,historyBusy,resolveBusy,listError,historyError,resolveError,error,notice,mayHaveOlder,pending,busy,canSend}=storeToRefs(chat)
const listPage=ref(1),ordinaryConversations=computed(()=>conversations.value.filter(item=>item.peer.id!==FILE_PEER.id))
const listPages=computed(()=>Math.max(1,Math.ceil(ordinaryConversations.value.length/20)))
const listedConversations=computed(()=>ordinaryConversations.value.slice((listPage.value-1)*20,listPage.value*20))
watch(listPages,pages=>{listPage.value=Math.min(listPage.value,pages)})
const mounted=ref(false),toName=ref(''),scroller=ref<HTMLElement|null>(null),followLatest=ref(true)
const authenticated=computed(()=>mounted.value&&auth.isLoggedIn)
const connectionText=computed(()=>connection.value==='connected'?'已连接':connection.value==='connecting'?'连接中':'已断开')
let release:(()=>void)|null=null,confirmation:AbortController|null=null
watch(connectionText,state=>emit('connection-change',state),{immediate:true})
function cancelConfirmation(){confirmation?.abort();confirmation=null}
async function withdraw(id:string){if(busy.value||pending.value||!peer.value)return;cancelConfirmation();const abort=new AbortController(),owner=auth.account?.oId,selected=peer.value.id;confirmation=abort
 try{const accepted=await fpConfirm({signal:abort.signal,title:'撤回本人私信',message:'是否撤回这条私信？',confirmText:'撤回',tone:'danger'});if(accepted&&!abort.signal.aborted&&owner===auth.account?.oId&&peer.value?.id===selected)await chat.execute({kind:'withdraw',peer:{...peer.value},messageId:id,content:''})}finally{if(confirmation===abort)confirmation=null}}
function command(kind:LegacyMessageCommand['kind']){void chat.execute({kind,peer:peer.value?{...peer.value}:null,messageId:'',content:kind==='send'?draft.value:''})}
function onScroll(){const el=scroller.value;if(el)followLatest.value=el.scrollHeight-el.scrollTop-el.clientHeight<80}
watch(()=>[props.initialName,props.initialId],()=>{if(mounted.value&&(props.initialName||props.initialId))void chat.open(props.initialName,props.initialId)})
watch(()=>peer.value?.id,()=>{cancelConfirmation();followLatest.value=true;const index=ordinaryConversations.value.findIndex(item=>item.peer.id===peer.value?.id);if(index>=0)listPage.value=Math.floor(index/20)+1;if(peer.value)emit('peer-selected',{id:peer.value.id,userName:peer.value.userName})},{immediate:true})
watch(()=>auth.account?.oId,cancelConfirmation)
watch(()=>messages.value,async()=>{if(!followLatest.value)return;await nextTick();if(scroller.value)scroller.value.scrollTop=scroller.value.scrollHeight})
onMounted(()=>{mounted.value=true;release=chat.acquire();if(props.initialName||props.initialId)void chat.open(props.initialName,props.initialId)})
onBeforeUnmount(()=>{mounted.value=false;cancelConfirmation();release?.();release=null})
</script>
<template>
 <p v-if="!authenticated" class="hint">登录后可读取私信。</p>
 <div v-else class="legacy-private">
  <div class="status"><span>未读 {{ inbox.error?'暂不可用':inbox.unreadTotal===null?'待查询':inbox.unreadTotal }}</span><button @click="chat.loadList();chat.loadHistory();inbox.refreshUnread()">刷新</button><button :disabled="busy||!!pending" @click="command('read-all')">全部已读</button></div>
  <p v-if="inbox.error" class="error" role="alert">{{ inbox.error }} <button @click="inbox.refreshUnread">重试</button></p>
  <p v-if="notice" class="notice" role="status">{{ notice }}</p>
  <div v-if="pending" class="pending" role="status"><span>{{ busy?'正在等待操作确认…':'操作结果未确认，请先核对历史或未读状态。' }}</span><details><summary>查看待核对操作</summary><p>{{ pending.kind }} · {{ pending.peer?.userName||'全部会话' }}</p><pre v-if="pending.kind==='send'">{{ pending.content }}</pre></details><button :disabled="busy" @click="chat.loadHistory();inbox.refreshUnread()">读取当前状态</button><button :disabled="busy" @click="chat.release">我已核对，解除锁定</button><small>未确认的消息不会自动重发。刷新或退出将清除本机核对信息。</small></div>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <div class="private-layout">
   <aside class="peers" aria-label="私信会话列表">
    <form class="new-peer" @submit.prevent="chat.open(toName)"><input v-model="toName" maxlength="64" aria-label="私信用户名" placeholder="输入用户名" /><button :disabled="resolveBusy||!toName.trim()">发起</button></form>
    <p v-if="resolveError" class="error" role="alert">{{ resolveError }}</p>
    <p v-if="listBusy" role="status">读取会话…</p><p v-if="listError" class="error" role="alert">{{ listError }} <button @click="chat.loadList">重试</button></p>
    <button class="peer" :aria-current="peer?.id===FILE_PEER.id?'true':undefined" @click="chat.select(FILE_PEER)"><span class="file-avatar" aria-hidden="true">▣</span><span class="peer-info"><b>文件传输助手</b></span></button>
    <button v-for="item in listedConversations" :key="item.peer.id" class="peer" :title="item.peer.userName" :aria-label="item.peer.userName+(inbox.byPeer[item.peer.id]?`，${inbox.byPeer[item.peer.id]}条未读`:'')" :aria-current="peer?.id===item.peer.id?'true':undefined" @click="chat.select(item.peer)"><span class="peer-avatar"><img :src="item.peer.userAvatarURL||DEFAULT_AVATAR" alt="" @error="($event.target as HTMLImageElement).src=DEFAULT_AVATAR" /><i v-if="inbox.byPeer[item.peer.id]" class="unread-dot" aria-label="有未读消息" /></span><span class="peer-info"><b>{{ item.peer.userName }}</b><small>{{ item.preview }}</small></span><span v-if="inbox.byPeer[item.peer.id]" class="unread-count">{{ inbox.byPeer[item.peer.id]>99?'99+':inbox.byPeer[item.peer.id] }}</span></button>
    <nav v-if="listPages>1" class="list-pages" aria-label="会话分页"><button :disabled="listPage<=1" @click="listPage--">‹</button><span>{{ listPage }}/{{ listPages }}</span><button :disabled="listPage>=listPages" @click="listPage++">›</button></nav>
    <p v-if="!listBusy&&!listError&&!conversations.length" class="muted">暂无其他会话</p>
   </aside>
   <section v-if="peer" class="conversation">
    <header><strong>{{ peer.userNickname||peer.userName }}</strong><span :class="{connected:connection==='connected'}">{{ connectionText }}</span><button :disabled="busy||!!pending" @click="command('read')">标记已读</button></header>
    <div ref="scroller" class="history" @scroll.passive="onScroll">
     <p v-if="historyError" class="error" role="alert">{{ historyError }} <button :disabled="historyBusy" @click="chat.loadHistory()">重试</button></p><p v-if="historyBusy" role="status">读取历史…</p>
     <button v-if="mayHaveOlder" :disabled="historyBusy" @click="followLatest=false;chat.loadHistory(true)">尝试读取更早消息</button>
     <p v-if="!historyBusy&&!historyError&&!messages.length" class="muted">暂无消息</p>
     <ol><li v-for="message in messages" :key="message.id" :class="{mine:message.fromMe}"><div class="bubble"><small>{{ message.fromMe?'我':peer.userNickname||peer.userName }}</small><div class="message-body" v-html="message.contentHtml" /><time>{{ message.sentAt }}</time><button v-if="message.fromMe" :disabled="busy||!!pending" @click="withdraw(message.id)">撤回</button></div></li></ol>
    </div>
    <form class="composer" @submit.prevent="command('send')"><textarea v-model="draft" aria-label="私信内容" maxlength="10240" placeholder="说点什么吧…" @keydown.ctrl.enter.prevent="command('send')" @keydown.meta.enter.prevent="command('send')" /><button :disabled="!canSend">发送</button></form>
   </section><p v-else class="muted choose">选择会话或输入用户名开始聊天。</p>
  </div>
 </div>
</template>
<style scoped>
.legacy-private{container-type:inline-size;min-width:0;display:flex;flex-direction:column;gap:8px;height:100%;min-height:340px;font-size:14px}.status{display:flex;gap:8px;align-items:center;color:var(--fp-muted);font-size:12px}.private-layout{display:grid;grid-template-columns:180px minmax(0,1fr);flex:1;min-height:0}.peers{min-width:0;border-right:1px solid var(--fp-border);overflow:auto;padding-right:8px}.list-pages{display:flex;align-items:center;justify-content:space-between;font-size:11px}.new-peer{display:flex;gap:4px;margin-bottom:8px}.new-peer input{min-width:0;flex:1}.new-peer button{white-space:nowrap}button,input,textarea{font:inherit;color:inherit;border:1px solid var(--fp-border);border-radius:7px;background:var(--fp-card);padding:6px 8px}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}.peer{border:0;display:flex;align-items:center;gap:8px;width:100%;margin:3px 0;text-align:left;padding:8px;position:relative}.peer[aria-current=true]{background:var(--fp-bg);box-shadow:inset 2px 0 var(--fp-accent)}.peer-avatar{position:relative;display:block;flex-shrink:0}.peer-avatar img,.file-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover}.file-avatar{display:grid;place-items:center;font-size:24px}.peer-info{min-width:0;flex:1}.peer-info b,.peer-info small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.peer-info small{color:var(--fp-muted);margin-top:3px;font-size:12px}.unread-dot{position:absolute;right:-2px;top:-2px;background:var(--fp-msg-notify,#ed9226);width:9px;height:9px;border-radius:50%;box-shadow:0 0 0 2px var(--fp-card)}.unread-count{background:var(--fp-msg-notify,#ed9226);color:white;border-radius:12px;font-size:11px;padding:1px 5px}.conversation{min-width:0;display:flex;flex-direction:column;min-height:0;padding-left:12px}.conversation header{display:flex;align-items:center;gap:9px;border-bottom:1px solid var(--fp-border);padding-bottom:8px;min-width:0}.conversation header strong{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.conversation header span{font-size:12px;white-space:nowrap;color:var(--fp-muted)}.conversation header .connected{color:var(--fp-accent)}.conversation header button{margin-left:auto;font-size:12px}.history{flex:1;overflow:auto;min-height:0;max-height:65vh;overscroll-behavior:contain}.history ol{padding:0;list-style:none;margin:0}.history li{display:flex;padding:7px 0}.history li.mine{justify-content:flex-end}.bubble{background:var(--fp-bg);border-radius:12px;padding:9px 11px;max-width:90%;overflow-wrap:anywhere}.mine .bubble{background:color-mix(in srgb,var(--fp-accent) 12%,var(--fp-card))}.bubble small,.bubble time{font-size:11px;color:var(--fp-muted);display:block}.bubble time{margin-top:5px}.bubble button{font-size:11px;background:none;border:0;padding:2px 0}.message-body{line-height:1.55}.message-body :deep(p){margin:3px 0}.message-body :deep(img){max-width:100%;height:auto}.message-body :deep(pre){white-space:pre-wrap}.message-body :deep(blockquote){font-size:12px;margin:5px 0;padding-left:8px;border-left:2px solid var(--fp-border)}.composer{display:flex;gap:8px;padding-top:8px;border-top:1px solid var(--fp-border)}textarea{flex:1;min-width:0;height:64px;resize:vertical;box-sizing:border-box}.composer button{align-self:flex-end;background:var(--fp-accent);color:white;border:0}.pending{background:var(--fp-bg);padding:9px;border-radius:8px;font-size:12px}.pending small{display:block}.pending pre{white-space:pre-wrap;max-height:90px;overflow:auto}.error{color:#b9503c;font-size:12px;margin:3px 0}.notice{margin:0}.notice,.muted{color:var(--fp-muted);font-size:12px}.choose{padding:12px}.conversation,.bubble,.peer-avatar img,textarea{transition:padding .18s ease,font-size .18s ease,width .18s ease,height .18s ease}
@container (max-width:480px){.notice{display:none}.private-layout{grid-template-columns:52px minmax(0,1fr)}.peer-info,.new-peer,.unread-count{display:none}.peer{padding:6px 3px;justify-content:center}.peers{padding-right:3px}.conversation{padding-left:7px}.conversation header{gap:5px;font-size:13px}.conversation header button{font-size:10px;padding:3px}.bubble{font-size:12px;padding:7px 9px}.bubble time{font-size:10px}textarea{height:42px;resize:none}.status{font-size:11px;gap:4px}.status button{padding:4px 6px}.composer{gap:5px}.composer button{padding:8px}.peer-avatar img{width:32px;height:32px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
