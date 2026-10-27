import {defineStore,storeToRefs} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {chatOnlinePage,type ChatOnlineUser} from '@/api/v3-chat-online'
import {useAuthStore} from '@/stores/auth'
export const useV3ChatOnlineStore=defineStore('v3-chat-online',()=>{
 const {accessToken,account}=storeToRefs(useAuthStore())
 const users=ref<ChatOnlineUser[]>([]),total=ref<number|null>(null),page=ref(1),pageCount=ref(0),hasMore=ref(false),nodesSampledAt=ref<number|null>(null),nodesComplete=ref<boolean|null>(null),loading=ref(false),error=ref(''),attempt=ref(1),readAt=ref<number|null>(null)
 let wanted=false,generation=0,sequence=0,boundary=getAuthContextVersion(),owner=account.value?.oId,controller:AbortController|null=null,dirty=false
 const active=()=>!import.meta.env.SSR&&!!accessToken.value&&!!account.value?.oId
 function empty(){users.value=[];total.value=null;pageCount.value=0;hasMore.value=false;nodesSampledAt.value=null;nodesComplete.value=null;readAt.value=null}
 function clear(){generation++;sequence++;controller?.abort();controller=null;dirty=false;empty();page.value=1;attempt.value=1;loading.value=false;error.value=''}
 async function load(p=page.value){if(!wanted||!active())return;const run=++sequence,epoch=generation,actor=account.value!.oId,context=getAuthContextVersion();controller?.abort();const abort=new AbortController();controller=abort;attempt.value=p;loading.value=true;error.value='';const valid=()=>wanted&&active()&&run===sequence&&epoch===generation&&actor===account.value?.oId&&context===getAuthContextVersion()&&!abort.signal.aborted
 try{const result=await chatOnlinePage(p,abort.signal);if(valid()){users.value=result.list;total.value=result.total;page.value=result.page;pageCount.value=result.pageCount;hasMore.value=result.hasMore;nodesSampledAt.value=result.nodesSampledAt;nodesComplete.value=result.nodesComplete;readAt.value=Date.now()}}
 catch(e){if(valid()){empty();error.value=e instanceof Error?e.message:'在线名单读取失败'}}finally{if(valid()){loading.value=false;controller=null;if(dirty){dirty=false;void load(attempt.value)}}}}
 async function refresh(){if(loading.value){dirty=true;return}await load(page.value)}
 async function connect(){wanted=true;if(active())await refresh()}
 function disconnect(){wanted=false;clear()}
 const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||next!==boundary||actor!==owner)clear();else{generation++;sequence++;controller?.abort();controller=null;dirty=false;loading.value=false}boundary=next;owner=actor;if(wanted&&active())void load(page.value)},{flush:'sync'})
 const focus=()=>{if(wanted&&active())void refresh()};if(!import.meta.env.SSR)window.addEventListener('focus',focus)
 onScopeDispose(()=>{stop();disconnect();if(!import.meta.env.SSR)window.removeEventListener('focus',focus)})
 return{users,total,page,pageCount,hasMore,nodesSampledAt,nodesComplete,loading,error,attempt,readAt,connect,disconnect,load,refresh,retry:()=>load(attempt.value)}
})
