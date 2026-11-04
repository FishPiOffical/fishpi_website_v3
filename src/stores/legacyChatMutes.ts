import {defineStore} from 'pinia'
import {computed,onScopeDispose,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {legacyMuteSnapshot,type LegacyMutedUser} from '@/api/legacy/chat-mutes'
import {useAuthStore} from './auth'
export const useLegacyChatMutesStore=defineStore('legacy-chat-mutes',()=>{
 const auth=useAuthStore(),snapshot=ref<LegacyMutedUser[]|null>(null),page=ref(1),attempt=ref(1),loading=ref(false),error=ref(''),readAt=ref<number|null>(null)
 let consumers=0,sequence=0,abort:AbortController|null=null,dirty=false
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId||'']),active=()=>consumers>0&&!import.meta.env.SSR&&getApiMode()==='v1'
 function clear(){sequence++;abort?.abort();abort=null;dirty=false;snapshot.value=null;page.value=attempt.value=1;loading.value=false;error.value='';readAt.value=null}
 async function load(p=page.value){if(!active())return;if(!Number.isSafeInteger(p)||p<1){error.value='思过崖页码不合法';return}const run=++sequence,reader=identity(),controller=new AbortController();abort?.abort();abort=controller;attempt.value=p;loading.value=true;error.value='';const valid=()=>active()&&run===sequence&&reader===identity()&&!controller.signal.aborted
 try{const result=await legacyMuteSnapshot(controller.signal);if(valid()){snapshot.value=result.list;readAt.value=result.readAt;page.value=p}}catch(e){if(valid()){snapshot.value=null;readAt.value=null;error.value=e instanceof Error?e.message:'思过崖读取失败'}}finally{if(valid()){loading.value=false;abort=null;if(dirty){dirty=false;void load(attempt.value)}}}}
 async function refresh(){if(loading.value){dirty=true;return}await load(page.value)}
 async function connect(){consumers++;if(consumers===1)await refresh()}
 function disconnect(){consumers=Math.max(0,consumers-1);if(!consumers)clear()}
 const stop=watch(identity,()=>{clear();if(active())void refresh()},{flush:'sync'}),focus=()=>{if(active())void refresh()}
 if(!import.meta.env.SSR)window.addEventListener('focus',focus)
 onScopeDispose(()=>{stop();consumers=0;clear();if(!import.meta.env.SSR)window.removeEventListener('focus',focus)})
 return{users:computed(()=>snapshot.value?.slice((page.value-1)*20,page.value*20)||[]),total:computed(()=>snapshot.value?.length??null),pageCount:computed(()=>snapshot.value?Math.ceil(snapshot.value.length/20):0),hasMore:computed(()=>snapshot.value!==null&&page.value*20<snapshot.value.length),page,attempt,loading,error,readAt,connect,disconnect,load,refresh,retry:()=>load(attempt.value)}
})
