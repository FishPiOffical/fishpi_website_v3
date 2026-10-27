import {defineStore,storeToRefs} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {chatMutePage,type ChatMutedUser} from '@/api/v3-chat-mutes'
import {useAuthStore} from '@/stores/auth'
export const useV3ChatMutesStore=defineStore('v3-chat-mutes',()=>{
 const {accessToken,account}=storeToRefs(useAuthStore())
 const users=ref<ChatMutedUser[]>([]),total=ref<number|null>(null),page=ref(1),pageCount=ref(0),hasMore=ref(false),loading=ref(false),error=ref(''),attempt=ref(1),readAt=ref<number|null>(null)
 let consumers=0,wanted=false,generation=0,sequence=0,boundary=getAuthContextVersion(),owner=account.value?.oId,controller:AbortController|null=null,dirty=false
 const active=()=>!import.meta.env.SSR&&!!accessToken.value&&!!account.value?.oId
 function empty(){users.value=[];total.value=null;pageCount.value=0;hasMore.value=false;readAt.value=null}
 function clear(){generation++;sequence++;controller?.abort();controller=null;dirty=false;empty();page.value=1;attempt.value=1;loading.value=false;error.value=''}
 async function load(p=page.value){if(!wanted||!active())return;const run=++sequence,epoch=generation,actor=account.value!.oId,context=getAuthContextVersion();controller?.abort();const abort=new AbortController();controller=abort;attempt.value=p;loading.value=true;error.value='';const valid=()=>wanted&&active()&&run===sequence&&epoch===generation&&actor===account.value?.oId&&context===getAuthContextVersion()&&!abort.signal.aborted
 try{const result=await chatMutePage(p,abort.signal);if(valid()){users.value=result.list;total.value=result.total;page.value=result.page;pageCount.value=result.pageCount;hasMore.value=result.hasMore;readAt.value=Date.now()}}
 catch(e){if(valid()){empty();error.value=e instanceof Error?e.message:'思过崖读取失败'}}finally{if(valid()){loading.value=false;controller=null;if(dirty){dirty=false;void load(attempt.value)}}}}
 async function refresh(){if(loading.value){dirty=true;return}await load(page.value)}
 async function connect(){consumers++;wanted=true;if(active())await refresh()}
 function disconnect(){consumers=Math.max(0,consumers-1);if(!consumers){wanted=false;clear()}}
 const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||next!==boundary||actor!==owner)clear();else{generation++;sequence++;controller?.abort();controller=null;dirty=false;loading.value=false}boundary=next;owner=actor;if(wanted&&active())void load(page.value)},{flush:'sync'})
 const focus=()=>{if(wanted&&active())void refresh()};if(!import.meta.env.SSR)window.addEventListener('focus',focus)
 onScopeDispose(()=>{stop();consumers=0;wanted=false;clear();if(!import.meta.env.SSR)window.removeEventListener('focus',focus)})
 return{users,total,page,pageCount,hasMore,loading,error,attempt,readAt,connect,disconnect,load,refresh,retry:()=>load(attempt.value)}
})
