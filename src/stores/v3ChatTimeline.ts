import {defineStore,storeToRefs} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {chatMessagePage,chatTopic,type ChatMessage} from '@/api/v3-chat-messages'
import {subscribeChatChanges,type ChatBarrageEvent,type ChatRealtimeEvent} from '@/api/v3-realtime'
import {useAuthStore} from '@/stores/auth'
import {useV3ReactionsStore} from '@/stores/v3Reactions'
export const useV3ChatTimelineStore=defineStore('v3-chat-timeline',()=>{
 const {accessToken,account}=storeToRefs(useAuthStore()),reactions=useV3ReactionsStore()
 const barrage=ref<ChatBarrageEvent|null>(null)
 const changeHint=ref<{id:string;version:number}|null>(null)
 const messages=ref<ChatMessage[]>([]),loading=ref(false),loadingMore=ref(false),hasMore=ref(false),error=ref(''),connected=ref(false),connecting=ref(false),topic=ref(''),topicError=ref('')
 let wanted=false,blocked=false,generation=0,latestRun=0,before='',oldestRun=0,version=0,boundary=getAuthContextVersion(),owner=account.value?.oId,stop:(()=>void)|null=null,latestAbort:AbortController|null=null,olderAbort:AbortController|null=null,topicAbort:AbortController|null=null,topicRun=0,topicBusy=false,topicDirty=false
 let cancelStartup: (() => void) | undefined
 let snapshotRecovery: ReturnType<typeof setTimeout> | undefined
 const removed=new Set<string>()
 const localChanges=new Map<string,{version:number;message:ChatMessage|null}>()
 const active=()=>!blocked&&!import.meta.env.SSR&&!!accessToken.value&&!!account.value?.oId
 function proof(requireConsumer=true){const run=generation,context=getAuthContextVersion(),actor=account.value?.oId;return()=>(!requireConsumer||wanted)&&active()&&run===generation&&context===getAuthContextVersion()&&actor===account.value?.oId}
 function clear(){cancelStartup?.();barrage.value=null;changeHint.value={id:'',version:++version};blocked=false;generation++;latestRun++;oldestRun++;topicRun++;latestAbort?.abort();olderAbort?.abort();topicAbort?.abort();latestAbort=olderAbort=topicAbort=null;cancelSnapshotRecovery();stop?.();stop=null;messages.value=[];before='';hasMore.value=false;loading.value=false;loadingMore.value=false;connected.value=false;connecting.value=false;topic.value='';topicError.value='';error.value='';localChanges.clear();removed.clear();version=0;topicBusy=false;topicDirty=false}
 function deny(){clear();blocked=true;error.value='聊天室授权不可用，请重新登录或授权'}
 function merge(message:ChatMessage){const list=messages.value.filter(m=>m.id!==message.id);list.push(message);list.sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);messages.value=list}
 function upsertConfirmed(message:ChatMessage){if(!active()||removed.has(message.id))return;const seq=++version;changeHint.value={id:message.id,version:seq};localChanges.set(message.id,{version:seq,message});merge(message)}
 function removeConfirmed(id:string){if(!active())return;removed.add(id);const seq=++version;changeHint.value={id,version:seq};localChanges.set(id,{version:seq,message:null});messages.value=messages.value.filter(m=>m.id!==id);reactions.invalidate('chat',id)}
 async function readTopic(){const valid=proof(false);if(!valid())return;if(topicBusy){topicDirty=true;return}topicBusy=true;const run=++topicRun,abort=new AbortController();topicAbort=abort;topicError.value='';try{const value=await chatTopic(abort.signal);if(valid()&&run===topicRun)topic.value=value}catch(e){if(valid()&&run===topicRun&&!abort.signal.aborted){if(e instanceof ApiError&&[401,403].includes(e.status))deny();else topicError.value=e instanceof Error?e.message:'话题读取失败'}}finally{if(valid()&&run===topicRun){topicBusy=false;topicAbort=null;if(topicDirty){topicDirty=false;void readTopic()}}}}
 async function readLatest(){const valid=proof();if(!valid())return;latestAbort?.abort();olderAbort?.abort();oldestRun++;loadingMore.value=false;const run=++latestRun,start=version,abort=new AbortController();latestAbort=abort;loading.value=true;error.value='';try{const page=await chatMessagePage({size:20},abort.signal);if(!valid()||run!==latestRun||abort.signal.aborted)return;messages.value=page.list.filter(m=>!removed.has(m.id));for(const [id,change] of localChanges)if(change.version>start){if(change.message)merge(change.message);else messages.value=messages.value.filter(m=>m.id!==id)};before=page.nextBefore;hasMore.value=page.hasMore;for(const [id,change]of localChanges)if(change.version<=start)localChanges.delete(id)}catch(e){if(valid()&&run===latestRun&&!abort.signal.aborted){error.value=e instanceof Error?e.message:'历史读取失败';if(e instanceof ApiError&&[401,403].includes(e.status))deny()}}finally{if(valid()&&run===latestRun){loading.value=false;latestAbort=null}}}
 async function loadMore(){const valid=proof();if(!valid()||loading.value||loadingMore.value||!hasMore.value||!before)return;const run=++oldestRun,cursor=before,start=version,abort=new AbortController();olderAbort=abort;loadingMore.value=true;error.value='';try{const page=await chatMessagePage({before:cursor,size:20},abort.signal);if(!valid()||run!==oldestRun||abort.signal.aborted)return;const known=new Set(messages.value.map(m=>m.id));for(const message of page.list)if(!removed.has(message.id)&&!known.has(message.id)&&(localChanges.get(message.id)?.version||0)<=start)merge(message);if(page.nextBefore)before=page.nextBefore;hasMore.value=page.hasMore}catch(e){if(valid()&&run===oldestRun&&!abort.signal.aborted){if(e instanceof ApiError&&[401,403].includes(e.status))deny();else error.value=e instanceof Error?e.message:'更早历史读取失败'}}finally{if(valid()&&run===oldestRun){loadingMore.value=false;olderAbort=null}}}
 function cancelSnapshotRecovery(){
   clearTimeout(snapshotRecovery)
   snapshotRecovery=undefined
 }
 function reconcileMissingSnapshot(){
   if(snapshotRecovery!==undefined)return
   const valid=proof()
   snapshotRecovery=setTimeout(()=>{
     snapshotRecovery=undefined
     if(!valid())return
     if(loading.value)reconcileMissingSnapshot()
     else void readLatest()
   },1000)
 }
 function sync(keepVisible = false){if(!wanted||!active())return;changeHint.value={id:'',version:++version};localChanges.clear();cancelSnapshotRecovery();if(!keepVisible){messages.value=[];before='';hasMore.value=false}void readLatest();void readTopic()}
 function event(value:ChatRealtimeEvent){
   if(!wanted||!active())return
   if(value.type==='barrage'){barrage.value=value.barrage;return}
   if(value.type==='sync'){sync();return}
   if(value.type==='topic'){void readTopic();return}
   if(removed.has(value.id))return
   if(value.type==='reactions'){
     if (value.snapshot || value.reactionsUnavailable) {
       const message = messages.value.find(item => item.id === value.id)
       if (message && message.type !== 'unavailable') {
         const next = {...message,reactions:value.snapshot,reactionsUnavailable:value.reactionsUnavailable,
           reactionReadStarted:performance.now()}
         localChanges.set(value.id,{version:++version,message:next})
         merge(next)
       }
     }
     if (!value.reactionsUnavailable) reactions.invalidate('chat',value.id,false,value.snapshot)
     return
   }
   if(value.type==='deleted'){removeConfirmed(value.id);return}
   if(value.message)upsertConfirmed(value.message)
   else {
     changeHint.value={id:value.id,version:++version}
     reconcileMissingSnapshot()
   }
 }
 function clearVisible(){latestRun++;oldestRun++;latestAbort?.abort();olderAbort?.abort();cancelSnapshotRecovery();localChanges.clear();messages.value=[];before='';hasMore.value=false;loading.value=false;loadingMore.value=false;error.value=''}
 function bind() {
   stop?.()
   const valid = proof()
   const initialLatestRun = latestRun
   connecting.value = true
   return new Promise<void>(resolve => {
     let started = false
     const fallback = setTimeout(start, 1500)
     cancelStartup = () => {
       clearTimeout(fallback)
       cancelStartup = undefined
       resolve()
     }
     function start() {
       if (started || !valid()) return
       started = true
       clearTimeout(fallback)
       // An explicit refresh or clear-screen action takes precedence over startup.
       const history = initialLatestRun === latestRun ? readLatest() : undefined
       void Promise.all([history, readTopic()]).then(() => {
         if (valid()) cancelStartup = undefined
         resolve()
       })
     }
     stop = subscribeChatChanges(value => {
       if (valid()) event(value)
     }, state => {
       if (!valid()) return
       connected.value = state === 'ready'
       connecting.value = state === 'connecting'
       if (state === 'ready') {
         // Subscribe first so that the initial snapshot cannot miss an invalidation.
         // If HTTP fallback already ran, reconcile the gap when the socket recovers.
         if (started) sync(true)
         else start()
       } else if (state === 'blocked') {
         start()
         error.value = '聊天室实时授权不可用，请重新登录或授权'
       }
     })
   })
 }
 async function connect(){wanted=true;if(!active()){messages.value=[];error.value='登录后可读取聊天室消息';return}if(stop||loading.value)return;await bind()}
 function disconnect(){wanted=false;clear()}
 const stopAuth=watch([accessToken,()=>account.value?.oId],()=>{blocked=false;const next=getAuthContextVersion(),actor=account.value?.oId,changed=next!==boundary||actor!==owner||!accessToken.value;if(changed)clear();else{cancelStartup?.();generation++;latestRun++;oldestRun++;topicRun++;latestAbort?.abort();olderAbort?.abort();topicAbort?.abort();cancelSnapshotRecovery();stop?.();stop=null;loading.value=false;loadingMore.value=false;topicBusy=false;topicDirty=false}boundary=next;owner=actor;if(wanted&&active())void bind()},{flush:'sync'})
 onScopeDispose(()=>{stopAuth();disconnect()})
 return{barrage,changeHint,messages,loading,loadingMore,hasMore,error,connected,connecting,topic,topicError,connect,disconnect,loadMore,readLatest,readTopic,sync,clearVisible,upsertConfirmed,removeConfirmed}
})
