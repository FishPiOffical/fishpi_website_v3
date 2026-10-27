import {computed,onScopeDispose,ref,watch} from 'vue'
import {storeToRefs} from 'pinia'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {chatMessageContext,chatMessagePage,type ChatMessage} from '@/api/v3-chat-messages'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatTimelineStore} from '@/stores/v3ChatTimeline'
export function useChatContext(){
 const {accessToken,account}=storeToRefs(useAuthStore()),timeline=useV3ChatTimelineStore()
 const anchor=ref(''),list=ref<ChatMessage[]>([]),busy=ref(false),error=ref(''),changed=ref(false),hasBefore=ref(false),hasAfter=ref(false),before=ref(''),after=ref('')
 let run=0,abort:AbortController|null=null,disposed=false,attempt:{kind:'anchor'|'before'|'after';cursor:string}|null=null
 const identity=computed(()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||''])),active=()=>!import.meta.env.SSR&&!disposed&&!!accessToken.value&&!!account.value?.oId
 function empty(){list.value=[];hasBefore.value=false;hasAfter.value=false;before.value='';after.value=''}
 function cancel(){run++;abort?.abort();abort=null;busy.value=false}
 function close(){cancel();anchor.value='';attempt=null;empty();error.value='';changed.value=false}
 const observed=new Set<string>()
 async function read(kind:'anchor'|'before'|'after'='anchor',cursor=anchor.value){if(!active()||!anchor.value)return;cancel();const seq=run,reader=identity.value,id=anchor.value,controller=new AbortController();abort=controller;observed.clear();busy.value=true;error.value='';changed.value=false;attempt={kind,cursor};const valid=()=>active()&&seq===run&&reader===identity.value&&id===anchor.value&&!controller.signal.aborted
 try{let rows:ChatMessage[],left:boolean,right:boolean,first:string,last:string
 if(kind==='anchor'){const d=await chatMessageContext(id,controller.signal);rows=d.list;left=d.hasMoreBefore;right=d.hasMoreAfter;first=d.nextBefore;last=d.nextAfter}
 else{const d=await chatMessagePage({[kind]:cursor,size:20},controller.signal);rows=d.list;left=kind==='before'?d.hasMore:true;right=kind==='after'?d.hasMore:true;first=d.nextBefore;last=d.nextAfter}
 if(!valid())return;if(observed.has('')||rows.some(m=>observed.has(m.id)))throw new Error('上下文读取期间内容已变化，请重读定位消息')
 if(!rows.length){if(kind==='before')hasBefore.value=false;else hasAfter.value=false;return}
 list.value=rows;hasBefore.value=left;hasAfter.value=right;before.value=first;after.value=last
 }catch(e){if(valid()){error.value=e instanceof Error?e.message:'上下文读取失败';if(e instanceof ApiError&&[401,403,404].includes(e.status))empty()}}
 finally{if(valid()){busy.value=false;abort=null}}}
 async function open(id:string){close();anchor.value=id;if(active())await read()}
 function retry(){return attempt?read(attempt.kind,attempt.cursor):read()}
 const stopIdentity=watch(identity,close,{flush:'sync'})
 const stopHint=watch(()=>timeline.changeHint,hint=>{if(!anchor.value||!hint)return;observed.add(hint.id);if(!hint.id||hint.id===anchor.value||list.value.some(m=>m.id===hint.id)){cancel();empty();changed.value=true;error.value='上下文内容已变化，请重读定位消息';attempt={kind:'anchor',cursor:anchor.value}}},{flush:'sync'})
 onScopeDispose(()=>{disposed=true;stopIdentity();stopHint();close()})
 return{anchor,list,busy,error,changed,hasBefore,hasAfter,open,close,read:()=>read(),retry,previous:()=>read('before',before.value),next:()=>read('after',after.value)}
}
