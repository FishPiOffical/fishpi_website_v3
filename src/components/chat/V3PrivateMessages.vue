<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {storeToRefs} from 'pinia'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useV3MessagesStore} from '@/stores/v3Messages'
import {messageConversations,messageHistory,resolveMessagePeer,messageId,type Conversation,type PrivateMessage,type MessagePeer} from '@/api/v3-messages'
import {usePrivateInboxStore} from '@/stores/privateInbox'
import ChatComposer from '@/components/ChatComposer.vue'
import {fpConfirm} from '@/composables/useDialog'
const props=withDefaults(defineProps<{initialName?:string;initialId?:string}>(),{initialName:'',initialId:''})
const emit=defineEmits<{'peer-selected':[peer:{id:string;userName:string}]}>()
const {accessToken,account}=storeToRefs(useAuthStore()),writes=useV3MessagesStore(),mounted=ref(false)
const authenticated=computed(()=>mounted.value&&!!accessToken.value&&!!account.value?.oId)
const identity=()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||''])
const inbox=usePrivateInboxStore(),{unreadTotal:unread,error:unreadError}=storeToRefs(inbox)
const list=ref<Conversation[]>([]),page=ref(1),pages=ref(0),listBusy=ref(false),listError=ref('')
const target=ref(''),other=ref<MessagePeer|null>(null),messages=ref<PrivateMessage[]>([]),before=ref(''),hasMore=ref(false),historyBusy=ref(false),historyError=ref(''),draft=ref(''),toName=ref(''),resolveBusy=ref(false),resolveError=ref(''),changed=ref(false),notice=ref('')
let eventRevision=0,listRun=0,historyRun=0,resolveRun=0,historyAbort:AbortController|null=null,confirmation:AbortController|null=null
const canSend=computed(()=>authenticated.value&&!!target.value&&!!other.value?.available&&target.value!==account.value?.oId&&!writes.pending&&!writes.busy&&draft.value.length<=10240)
function closeTarget(){historyRun++;resolveRun++;historyAbort?.abort();historyAbort=null;confirmation?.abort();confirmation=null;target.value='';other.value=null;messages.value=[];before.value='';hasMore.value=false;historyBusy.value=false;draft.value='';historyError.value='';resolveError.value='';resolveBusy.value=false;notice.value='';changed.value=false}
async function loadList(p=page.value){if(!authenticated.value||listBusy.value)return;const run=++listRun,reader=identity(),owner=account.value!.oId;listBusy.value=true;listError.value='';try{const result=await messageConversations(owner,p);if(run===listRun&&reader===identity()&&authenticated.value){list.value=result.list;page.value=result.p;pages.value=result.pageCount}}catch(e){if(run===listRun&&reader===identity())listError.value=e instanceof Error?e.message:'会话读取失败'}finally{if(run===listRun&&reader===identity())listBusy.value=false}}
async function loadUnread(){await inbox.refreshUnread()}
async function loadHistory(older=false){if(!authenticated.value||!target.value||older&&(!hasMore.value||historyBusy.value))return;historyAbort?.abort();const abort=new AbortController();historyAbort=abort;const run=++historyRun,reader=identity(),id=target.value,owner=account.value!.oId,cursor=older?before.value:'',event=eventRevision;historyBusy.value=true;historyError.value='';const valid=()=>run===historyRun&&reader===identity()&&id===target.value&&authenticated.value&&!abort.signal.aborted
 try{const result=await messageHistory(owner,id,cursor,abort.signal);if(!valid())return;other.value=result.peer;emit('peer-selected',{id:result.peer.id,userName:result.peer.userName});if(older){const known=new Set(messages.value.map(m=>m.id));messages.value=[...result.list.filter(m=>!known.has(m.id)),...messages.value]}else messages.value=result.list;before.value=result.nextBefore;hasMore.value=result.hasMore;if(!older&&event===eventRevision)changed.value=false}
 catch(e){if(valid()){historyError.value=e instanceof Error?e.message:'历史读取失败';if(!older&&e instanceof ApiError&&[401,403,404].includes(e.status)){messages.value=[];before.value='';hasMore.value=false}}}
 finally{if(valid()){historyBusy.value=false;historyAbort=null}}}
function select(peer:MessagePeer){if(peer.id===account.value?.oId){resolveError.value='不能给自己发信';return}closeTarget();target.value=peer.id;other.value=peer;emit('peer-selected',{id:peer.id,userName:peer.userName});void loadHistory()}
async function resolve(name=toName.value){if(!authenticated.value)return;const run=++resolveRun,reader=identity();resolveBusy.value=true;resolveError.value='';try{const peer=await resolveMessagePeer(name);if(run===resolveRun&&reader===identity()&&authenticated.value)select(peer)}catch(e){if(run===resolveRun&&reader===identity())resolveError.value=e instanceof Error?e.message:'用户读取失败'}finally{if(run===resolveRun&&reader===identity())resolveBusy.value=false}}
async function initial(){if(!authenticated.value)return;if(props.initialId){try{messageId(props.initialId);closeTarget();target.value=props.initialId;await loadHistory()}catch{resolveError.value='会话ID不合法'}}else if(props.initialName)await resolve(props.initialName)}
async function refresh(){await Promise.all([loadList(),loadUnread(),loadHistory()])}
watch(()=>inbox.revision,()=>{if(!authenticated.value)return;eventRevision++;changed.value=true;if(!listBusy.value)void loadList()})
async function send(){if(!canSend.value||!draft.value.trim())return;const text=draft.value,id=target.value,reader=identity();if(await writes.start('send',id,text)){if(reader!==identity()||!authenticated.value)return;if(reader===identity()&&target.value===id&&draft.value===text)draft.value='';notice.value='发送已确认，请以当前读取状态为准';await refresh()}}
async function withdraw(message:PrivateMessage){if(!authenticated.value||!message.fromMe||writes.busy||writes.pending)return;confirmation?.abort();const abort=new AbortController();confirmation=abort;const reader=identity(),id=target.value;try{const accepted=await fpConfirm({signal:abort.signal,title:'撤回本人私信',message:'是否撤回这条本人发送的私信？',confirmText:'撤回',tone:'danger'});if(accepted&&!abort.signal.aborted&&reader===identity()&&id===target.value&&await writes.start('withdraw',message.id)){if(reader!==identity()||!authenticated.value)return;notice.value='撤回已确认，请以当前历史为准';await refresh()}}finally{if(confirmation===abort)confirmation=null}}
async function markRead(all=false){if(!authenticated.value||writes.pending||writes.busy||!all&&!target.value)return;const reader=identity();if(await writes.start(all?'read-all':'read',all?'':target.value)){if(reader!==identity()||!authenticated.value)return;notice.value='本次已读操作已确认，未读数以重新读取为准';await refresh()}}
async function retry(){const pending=writes.pending,reader=identity();if(!pending)return;if(await writes.retry()){if(reader!==identity()||!authenticated.value)return;if(reader===identity()&&pending.kind==='send'&&pending.target===target.value&&draft.value===pending.content)draft.value='';notice.value='原操作已确认，请以当前读取状态为准';await refresh()}}
watch(()=>JSON.stringify([identity(),props.initialName,props.initialId]),()=>{closeTarget();listRun++;list.value=[];page.value=1;pages.value=0;listBusy.value=false;listError.value='';if(authenticated.value){void loadList(1);void loadUnread();void initial()}},{flush:'sync'})
onMounted(()=>{mounted.value=true;void loadList(1);void loadUnread();void initial()})
onBeforeUnmount(()=>{mounted.value=false;listRun++;closeTarget()})
</script>
<template>
 <div v-if="!authenticated" class="hint">登录后可读取私信。</div>
 <div v-else class="private-messages">
  <div class="toolbar"><span>未读：{{ unread===null?'待查询':unread }}</span><button type="button" :disabled="listBusy||historyBusy" @click="refresh">刷新当前状态</button><button type="button" :disabled="writes.busy||!!writes.pending" @click="markRead(true)">全部标记已读</button></div>
  <p v-if="unreadError" role="alert">{{ unreadError }} <button @click="loadUnread">重读未读数</button></p>
  <p v-if="notice" role="status">{{ notice }}</p>
  <div v-if="writes.pending" role="status"><p>私信操作结果未确认（{{ writes.pending.kind }}，目标 {{ writes.pending.target||'全部会话' }}），请恢复原操作。</p><button :disabled="writes.busy" @click="retry">恢复本次私信操作</button><p>整页刷新或退出会清除本地恢复信息，请先核对原操作。</p></div>
  <p v-if="writes.error" role="alert">{{ writes.error }}</p>
  <form @submit.prevent="resolve()"><label>发起私信 <input v-model="toName" maxlength="64" placeholder="输入用户名" /></label><button :disabled="resolveBusy||!toName.trim()">查找并打开</button><button type="button" @click="select({id:'1000000000086',userName:'',userNickname:'文件传输助手',userAvatarURL:'',available:true,builtin:true})">文件传输助手</button></form>
  <p v-if="resolveError" role="alert">{{ resolveError }}</p>
  <div class="columns">
   <aside><h2>会话</h2><p v-if="listBusy" role="status">读取会话…</p><p v-if="listError" role="alert">{{ listError }} <button @click="loadList()">重读会话</button></p><p v-if="!listBusy&&!listError&&!list.length">暂无会话</p><ol><li v-for="item in list" :key="item.peerId"><button class="peer" :aria-current="target===item.peerId?'true':undefined" @click="select(item.peer)"><b>{{ item.peer.userNickname||item.peer.userName||'不可用账号' }}</b><span> · {{ item.unreadCount }} 未读</span><p>{{ item.lastMessage.available?item.lastMessage.preview:'正文不可用' }}</p></button></li></ol><nav><button :disabled="listBusy||page<=1" @click="loadList(page-1)">上一页会话</button><span>{{ page }} / {{ Math.max(1,pages) }}</span><button :disabled="listBusy||page>=pages" @click="loadList(page+1)">下一页会话</button></nav></aside>
   <section v-if="target"><h2>{{ other?.userNickname||other?.userName||'会话 '+target }}</h2><p v-if="other&&!other.available">该账号资料不可用，仍可阅读本人历史。</p><button :disabled="writes.busy||!!writes.pending" @click="markRead()">本会话标记已读</button><p v-if="changed" role="status">私信状态有更新 <button :disabled="historyBusy" @click="loadHistory()">读取当前历史</button></p><p v-if="historyError" role="alert">{{ historyError }} <button :disabled="historyBusy" @click="loadHistory()">重读当前历史</button></p><p v-if="historyBusy" role="status">读取历史…</p><button v-if="hasMore" :disabled="historyBusy" @click="loadHistory(true)">读取更早消息</button><p v-if="!messages.length&&!historyBusy&&!historyError">暂无消息</p><ol class="messages"><li v-for="m in messages" :key="m.id"><span>{{ m.fromMe?'我':'对方' }} · {{ m.sentAt||'时间未知' }}</span><div v-if="m.available&&m.contentHtml" class="message-body" v-html="m.contentHtml" /><pre v-else-if="m.available">{{ m.content }}</pre><p v-else>正文不可用</p><button v-if="m.fromMe" :disabled="writes.busy||!!writes.pending" @click="withdraw(m)">撤回</button></li></ol><ChatComposer :key="identity()+':'+target" v-model="draft" :height="130" compact :sending="writes.busy" :disabled="!canSend" placeholder="Markdown私信，最多10240个字符" submit-text="发送私信" @submit="send" /><p>{{ draft.length }} / 10240</p></section>
   <p v-else>选择会话或查找用户开始私信。读取不会自动标记已读。</p>
  </div>
 </div>
</template>
<style scoped lang="scss">
.private-messages{display:flex;flex-direction:column;gap:12px;min-width:0}.columns{display:grid;grid-template-columns:minmax(180px,30%) minmax(0,1fr);gap:20px}aside,section{min-width:0}h2{font-size:17px}ol{list-style:none;padding:0}p{overflow-wrap:anywhere}button,input,textarea{font:inherit;color:inherit;border:1px solid var(--fp-border);background:var(--fp-card);border-radius:6px;padding:6px 9px}button{cursor:pointer;margin:3px}button:disabled{opacity:.5;cursor:default}button[aria-current=true]{border-color:var(--fp-accent)}textarea{display:block;width:100%;box-sizing:border-box}.peer{width:100%;text-align:left}.peer p{margin:5px 0}.messages li{padding:12px 0;border-bottom:1px solid var(--fp-border)}.message-body{overflow-wrap:anywhere;:deep(img){max-width:100%}}pre{white-space:pre-wrap;overflow-wrap:anywhere}[role=alert]{color:#b9503c}.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px}@media(max-width:640px){.columns{grid-template-columns:minmax(0,1fr)}}
</style>
