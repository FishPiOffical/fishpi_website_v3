import {computed,onScopeDispose,ref,watch} from 'vue'
import {defineStore} from 'pinia'
import {useAuthStore} from './auth'
import {usePrivateInboxStore} from './privateInbox'
import {createLegacyMessageChannel,type LegacyConnection} from '@/api/legacy/message-channel'
import {FILE_PEER,legacyMessageContent,legacyMessageConversations,legacyMessageHistory,legacyResolvePeer,projectLegacyMessage,writeLegacyMessage,type LegacyConversation,type LegacyMessageCommand} from '@/api/legacy/messages'
import type {MessagePeer,PrivateMessage} from '@/api/v3-messages'
export const useLegacyMessagesStore=defineStore('legacy-messages',()=>{
 const auth=useAuthStore(),inbox=usePrivateInboxStore(),peer=ref<MessagePeer|null>(null),conversations=ref<LegacyConversation[]>([]),messages=ref<PrivateMessage[]>([]),draft=ref(''),connection=ref<LegacyConnection>('disconnected')
 const listBusy=ref(false),historyBusy=ref(false),resolveBusy=ref(false),listError=ref(''),historyError=ref(''),resolveError=ref(''),error=ref(''),notice=ref(''),historyPage=ref(1),mayHaveOlder=ref(false),pending=ref<LegacyMessageCommand|null>(null),busy=ref(false)
 const consumers=ref(0)
 let operation=0,generation=0,listRun=0,historyRun=0,resolveRun=0,listDirty=false,historyDirty=false,channel:ReturnType<typeof createLegacyMessageChannel>|null=null,confirmationTimer:ReturnType<typeof setTimeout>|null=null,ackId='',beforeSendIds=new Set<string>()
 const authenticated=()=>!import.meta.env.SSR&&auth.isLoggedIn&&!!auth.apiKey&&!!auth.account?.oId
 const active=()=>consumers.value>0&&authenticated()
 const identity=()=>JSON.stringify([auth.apiKey,auth.account?.oId])
 const canSend=computed(()=>active()&&connection.value==='connected'&&!!peer.value&&peer.value.id!==auth.account?.oId&&!busy.value&&!pending.value&&!!draft.value.trim()&&draft.value.length<=10240)
 function clearTimer(){if(confirmationTimer)clearTimeout(confirmationTimer);confirmationTimer=null}
 function finish(){const command=pending.value;if(!command)return;clearTimer();if(command.kind==='send'&&draft.value===command.content&&peer.value?.id===command.peer?.id)draft.value='';pending.value=null;busy.value=false;ackId='';beforeSendIds.clear();error.value='';notice.value=command.kind==='send'?'已在当前历史中找到发送的消息':'操作已确认，当前状态以重新读取为准';inbox.invalidate()}
 function checkSend(){if(pending.value?.kind==='send'&&ackId&&messages.value.some(m=>m.id===ackId&&m.fromMe&&m.toId===pending.value?.peer?.id&&m.content===pending.value?.content.trim()))finish()}
 async function loadList(){if(!active())return;if(listBusy.value){listDirty=true;return}const run=++listRun,reader=identity(),version=generation;listBusy.value=true;listError.value='';const valid=()=>active()&&run===listRun&&version===generation&&reader===identity()
  try{const result=await legacyMessageConversations(auth.account!.oId);if(valid())conversations.value=result}catch(e){if(valid()){conversations.value=[];listError.value=e instanceof Error?e.message:'会话读取失败'}}finally{if(valid()){listBusy.value=false;if(listDirty){listDirty=false;void loadList()}}}}
 async function loadHistory(older=false){if(!active()||!peer.value)return;if(historyBusy.value){if(!older)historyDirty=true;return}const run=++historyRun,reader=identity(),version=generation,selected={...peer.value},owner=auth.account!.oId,pages=older?historyPage.value+1:historyPage.value;historyBusy.value=true;historyError.value='';const valid=()=>active()&&run===historyRun&&version===generation&&reader===identity()&&peer.value?.id===selected.id
  try{const result:PrivateMessage[]=[];let loaded=0,lastSize=0
   // Page offsets can shift when messages arrive/revoke: refresh every displayed page rather than merging stale older bodies.
   for(let p=1;p<=pages;p++){const rows=await legacyMessageHistory(owner,selected,p);if(!valid())return;loaded=p;lastSize=rows.length;result.unshift(...rows);if(rows.length<20)break}
   const unique=new Map(result.map(row=>[row.id,row]));const current=[...unique.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1)
   if(valid()){messages.value=current;historyPage.value=Math.max(1,loaded);mayHaveOlder.value=lastSize===20;checkSend()}
  }catch(e){if(valid()){messages.value=[];historyError.value=e instanceof Error?e.message:'历史读取失败'}}finally{if(valid()){historyBusy.value=false;if(historyDirty){historyDirty=false;void loadHistory()}}}}
 function changed(){if(!active())return;void loadList();void loadHistory();inbox.invalidate()}
 function disconnect(){const old=channel;channel=null;old?.close();connection.value='disconnected';clearTimer();if(pending.value?.kind==='send'){busy.value=false;error.value='操作结果尚未确认，请读取历史核对；不会自动重发。'}}
 function connect(){disconnect();if(!active()||!peer.value)return;const selected={...peer.value},reader=identity(),version=generation;const valid=()=>active()&&version===generation&&reader===identity()&&peer.value?.id===selected.id
  channel=createLegacyMessageChannel(selected,state=>{if(!valid())return;connection.value=state;if(state==='connected'){void loadHistory();void loadList()}else if(state==='disconnected'&&pending.value){clearTimer();busy.value=false;error.value='连接已断开，发送结果尚未确认，请先核对历史。'}},value=>{if(!valid())return
   const frame=value as Record<string,unknown>
   if(typeof frame.code==='number'&&frame.code!==0){if(pending.value?.kind==='send'){clearTimer();busy.value=false;error.value=typeof frame.msg==='string'?frame.msg:'发送结果尚未确认'}return}
   if(frame.type==='revoke'){changed();return}
   try{const message=projectLegacyMessage(frame,auth.account!.oId,selected.id)
    if(pending.value?.kind==='send'&&pending.value.peer?.id===selected.id&&message.fromMe&&message.content===pending.value.content.trim()&&!beforeSendIds.has(message.id))ackId=message.id
    changed()
   }catch{/* A frame is never inserted as a private body. */}
  })
 }
 function select(selected:MessagePeer){if(!authenticated()||selected.id===auth.account?.oId){resolveError.value='不能给自己发信';return}if(peer.value?.id===selected.id){void loadHistory();return}historyRun++;historyBusy.value=false;historyDirty=false;historyPage.value=1;mayHaveOlder.value=false;messages.value=[];historyError.value='';draft.value='';peer.value={...selected};notice.value='';connect();void loadHistory()}
 async function open(name='',id=''){if(!active())return;const run=++resolveRun,reader=identity(),version=generation;resolveBusy.value=true;resolveError.value='';const valid=()=>active()&&run===resolveRun&&version===generation&&reader===identity()
  try{let selected:MessagePeer
   if(name)selected=await legacyResolvePeer(name)
   else if(id===FILE_PEER.id)selected={...FILE_PEER}
   else if(id){const rows=await legacyMessageConversations(auth.account!.oId);if(!valid())return;const found=rows.find(c=>c.peer.id===id)?.peer;if(!found)throw Error('当前列表中未找到该会话，请输入用户名打开');selected=found}
   else return
   if(id&&id!==selected.id)throw Error('用户与会话ID不匹配')
   if(valid())select(selected)
  }catch(e){if(valid())resolveError.value=e instanceof Error?e.message:'用户读取失败'}finally{if(valid())resolveBusy.value=false}}
 function release(){if(busy.value)return;operation++;pending.value=null;ackId='';beforeSendIds.clear();error.value='';notice.value='已解除本机锁定；没有重发消息'}
 async function execute(command:LegacyMessageCommand){if(!active()||pending.value||busy.value)return;error.value='';notice.value=''
  if(command.kind==='send'){try{legacyMessageContent(command.content)}catch(e){error.value=e instanceof Error?e.message:'内容不合法';return}if(connection.value!=='connected'||command.peer?.id!==peer.value?.id){error.value='请等待当前会话连接';return}}
  const commandRun=++operation,snapshot={...command,peer:command.peer?{...command.peer}:null},version=generation,reader=identity(),valid=()=>commandRun===operation&&version===generation&&reader===identity()&&authenticated()
  pending.value=snapshot;busy.value=true
  if(snapshot.kind==='send'){beforeSendIds=new Set(messages.value.map(m=>m.id));ackId='';confirmationTimer=setTimeout(()=>{confirmationTimer=null;if(valid()&&commandRun===operation&&pending.value?.kind==='send'){busy.value=false;error.value='尚未确认发送结果，请读取历史核对；不会自动重发。'}},12000)
   try{if(!channel?.send(snapshot.content))throw Error('消息未能写入连接，请先核对历史')}catch(e){clearTimer();busy.value=false;error.value=e instanceof Error?e.message:'发送结果尚未确认'}return}
  try{await writeLegacyMessage(snapshot);if(!valid())return;finish();await Promise.all([loadHistory(),loadList()])}catch(e){if(valid()){busy.value=false;error.value=(e instanceof Error?e.message:'操作失败')+'；请先核对当前历史/未读状态，再解除锁定。'}}
 }
 function acquire(){consumers.value++;if(consumers.value===1){void loadList();connect();void inbox.refreshUnread()}let disposed=false;return()=>{if(disposed)return;disposed=true;consumers.value--;if(!consumers.value){listRun++;historyRun++;resolveRun++;listBusy.value=historyBusy.value=resolveBusy.value=false;listDirty=historyDirty=false;disconnect();messages.value=[];conversations.value=[]}}}
 const stopAuth=watch(identity,()=>{generation++;listRun++;historyRun++;resolveRun++;disconnect();peer.value=null;conversations.value=[];messages.value=[];draft.value='';pending.value=null;busy.value=false;error.value='';notice.value='';ackId='';beforeSendIds.clear();listBusy.value=historyBusy.value=resolveBusy.value=false;listDirty=historyDirty=false;listError.value=historyError.value=resolveError.value='';historyPage.value=1;mayHaveOlder.value=false;if(active())void loadList()},{flush:'sync'})
 const stopInbox=watch(()=>inbox.revision,()=>{if(active()){void loadList();void loadHistory()}},{flush:'post'})
 onScopeDispose(()=>{stopAuth();stopInbox();consumers.value=0;generation++;disconnect();pending.value=null;messages.value=[];draft.value=''})
 return{peer,conversations,messages,draft,connection,listBusy,historyBusy,resolveBusy,listError,historyError,resolveError,error,notice,historyPage,mayHaveOlder,pending,busy,canSend,acquire,select,open,loadList,loadHistory,execute,release}
})
