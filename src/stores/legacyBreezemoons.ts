import {defineStore} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {useAuthStore} from './auth'
import {getAuthContextVersion,ApiError} from '@/api/http'
import {writeLegacyMoon,type LegacyMoonCommand} from '@/api/legacy/breezemoons'
export const useLegacyBreezemoonsStore=defineStore('legacy-breezemoons',()=>{
  const auth=useAuthStore(),draft=ref(''),busy=ref(false),uncertain=ref<LegacyMoonCommand|null>(null),error=ref(''),revision=ref(0),completed=ref<LegacyMoonCommand|null>(null)
  let generation=0
  const stop=watch(()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId]),()=>{generation++;draft.value='';busy.value=false;uncertain.value=null;error.value='';completed.value=null;revision.value++},{flush:'sync'})
  onScopeDispose(stop)
  async function execute(command:LegacyMoonCommand) {
    if(busy.value||uncertain.value||!auth.isLoggedIn)return false
    const current=generation,version=getAuthContextVersion(),key=auth.apiKey
    const valid=()=>current===generation&&version===getAuthContextVersion()&&key===auth.apiKey
    const snapshot={...command};busy.value=true;error.value=''
    try{await writeLegacyMoon(snapshot);if(!valid())return false;completed.value=snapshot;if(snapshot.kind==='create'&&draft.value===snapshot.content)draft.value='';revision.value++;return true}
    catch(e){if(valid()){error.value=e instanceof Error?e.message:'操作失败';if(!(e instanceof ApiError)||e.status<400||e.status>=500){uncertain.value=snapshot;error.value='操作结果尚未确认，请先重新读取列表核对；旧接口不能安全地自动重发。'}}return false}
    finally{if(valid())busy.value=false}
  }
  function release(){if(busy.value)return;uncertain.value=null;error.value='';completed.value=null}
  return {draft,busy,uncertain,error,revision,completed,execute,release}
})
