import {defineStore} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {repeaterPublication} from '@/api/v3-repeater'
import {legacyRepeaterPublish,legacyRepeaterToggle} from '@/api/legacy/repeater'
import {useAuthStore} from './auth'
type Command={kind:'publish';type:'joke'|'kfc'|'fish';content:string}|{kind:'like';id:string}
export const useLegacyRepeaterStore=defineStore('legacy-repeater',()=>{
 const auth=useAuthStore(),pending=ref<Command|null>(null),completed=ref<Command|null>(null),receipt=ref<{id:string}|null>(null),busy=ref(false),error=ref(''),revision=ref(0);let generation=0
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId]),active=()=>!import.meta.env.SSR&&getApiMode()==='v1'&&!!auth.apiKey&&!!auth.account?.oId
 function clear(){generation++;pending.value=completed.value=null;receipt.value=null;busy.value=false;error.value=''}
 const stop=watch(identity,clear,{flush:'sync'});onScopeDispose(()=>{stop();clear()})
 async function execute(command:Command){if(!active()||busy.value||pending.value)return null;const run=generation,reader=identity(),valid=()=>active()&&run===generation&&reader===identity();completed.value=null;receipt.value=null;pending.value=command;busy.value=true;error.value=''
 try{let result:{id:string};if(command.kind==='publish')result=await legacyRepeaterPublish(command.type,command.content);else{await legacyRepeaterToggle(command.id);result={id:command.id}}if(!valid())return null;pending.value=null;completed.value=command;receipt.value=result;revision.value++;return result}
 catch(e){if(valid()){error.value=e instanceof Error?e.message:'复读机操作失败';if(e instanceof ApiError&&[401,403,422].includes(e.status))pending.value=null;else error.value='本次结果未确认，旧投稿没有幂等恢复，点赞为切换操作，请勿重发。'}return null}
 finally{if(valid())busy.value=false}}
 function publish(type:string,content:string){if(!active()||busy.value||pending.value)return Promise.resolve(null);try{return execute({kind:'publish',...repeaterPublication(type,content)})}catch(e){error.value=e instanceof Error?e.message:'投稿不合法';return Promise.resolve(null)}}
 function toggleLike(id:string){if(!/^[1-9][0-9]{0,31}$/.test(id)){error.value='内容ID不合法';return Promise.resolve(null)}return execute({kind:'like',id})}
 function release(){if(!busy.value){pending.value=null;error.value=''}}
 function dismiss(){if(!busy.value&&!pending.value){receipt.value=null;completed.value=null;error.value=''}}
 return{pending,completed,receipt,busy,error,revision,publish,toggleLike,release,dismiss}
})
