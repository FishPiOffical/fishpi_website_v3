import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { getApiMode } from '@/api/mode'
import { writeLegacyPost, type LegacyPostCommand, type LegacyPostReceipt } from '@/api/legacy/posts'
import { useAuthStore } from './auth'
export const useLegacyPostsStore=defineStore('legacy-posts',()=>{
 const auth=useAuthStore(),pending=ref<LegacyPostCommand|null>(null),receipt=ref<LegacyPostReceipt|null>(null),busy=ref(false),error=ref(''),revision=ref(0)
 let generation=0
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId])
 function clear(){generation++;pending.value=null;receipt.value=null;busy.value=false;error.value='';revision.value++}
 const stop=watch(identity,clear,{flush:'sync'});onScopeDispose(()=>{stop();clear()})
 async function submit(command:LegacyPostCommand){
  if(import.meta.env.SSR||getApiMode()!=='v1'||!auth.apiKey||!auth.account?.oId||pending.value||busy.value)return null
  const reader=identity(),run=generation,owner=auth.account.oId,valid=()=>reader===identity()&&run===generation
  const frozen=JSON.parse(JSON.stringify(command)) as LegacyPostCommand
  pending.value=frozen;busy.value=true;receipt.value=null;error.value=''
  try{const result=await writeLegacyPost(frozen,owner);if(!valid())return null;pending.value=null;receipt.value=result;revision.value++;if(result.op==='publish')try{await auth.reloadAccount()}catch{if(valid())error.value='文章已发布，但余额刷新失败，请到积分页核对。'}return valid()?result:null}
  catch(failure){if(valid())error.value=(failure instanceof Error?failure.message:'旧文章操作失败')+'。结果未确认，请先核对文章/草稿列表；旧接口不支持幂等恢复，不能自动重复提交。';return null}
  finally{if(valid())busy.value=false}
 }
 function release(){if(!busy.value){pending.value=null;error.value=''}}
 function dismiss(){if(!busy.value&&!pending.value){receipt.value=null;error.value=''}}
 return{pending,receipt,busy,error,revision,submit,release,dismiss}
})
