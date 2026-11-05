import { defineStore,storeToRefs } from 'pinia'
import { onScopeDispose,ref,watch } from 'vue'
import { ApiError,getAuthContextVersion } from '@/api/http'
import { profileOperationKey } from '@/api/v3-profile'
import { writeArticleOwner,type OwnerCommand,type OwnerOperation,type OwnerReceipt } from '@/api/v3-article-owner'
import { fpConfirm } from '@/composables/useDialog'
import { clearCache } from '@/utils/swr'
import { useAuthStore } from '@/stores/auth'
export const useV3ArticleOwnerStore=defineStore('v3-article-owner',()=>{
 const auth=useAuthStore(),{accessToken,account}=storeToRefs(auth)
 const pending=ref<OwnerCommand|null>(null),receipt=ref<OwnerReceipt|null>(null),busy=ref(false),confirming=ref(false),error=ref(''),accountError=ref('')
 let completionSequence=0
 let generation=0,boundary=getAuthContextVersion(),owner=account.value?.oId,confirmation:AbortController|null=null,origin:symbol|null=null
 function cancelConfirmation(token:symbol){if(origin===token){confirmation?.abort();confirmation=null;origin=null;confirming.value=false}}
 function reset(){generation++;confirmation?.abort();confirmation=null;origin=null;pending.value=null;receipt.value=null;busy.value=false;confirming.value=false;error.value='';accountError.value=''}
 const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||next!==boundary||actor!==owner)reset();boundary=next;owner=actor},{flush:'sync'})
 onScopeDispose(()=>{stop();reset()})
 function capture(){const run=generation,context=getAuthContextVersion(),actor=account.value?.oId;return()=>!import.meta.env.SSR&&!!accessToken.value&&!!actor&&run===generation&&context===getAuthContextVersion()&&actor===account.value?.oId}
 async function execute(command:OwnerCommand,recovering:boolean){
  const valid=capture();if(!valid()||busy.value)return null
  pending.value=command;busy.value=true;error.value='';accountError.value=''
  let result:OwnerReceipt
  try{result=await writeArticleOwner(command)}
  catch(reason){if(valid()){error.value=reason instanceof Error?reason.message:'文章操作失败';if(!recovering&&reason instanceof ApiError&&reason.status>=400&&reason.status<500)pending.value=null;busy.value=false}return null}
  if(!valid())return null
  receipt.value=result;pending.value=null
  try{clearCache()}catch{accountError.value='操作已确认，列表缓存刷新失败，请重新读取。'}
  const completed=++completionSequence
  void Promise.resolve().then(()=>{if(valid()&&completed===completionSequence)return auth.reloadAccount()}).catch(()=>{if(valid()&&completed===completionSequence)accountError.value='操作已确认，账号资料或余额刷新失败，请到积分页核对。'})
  busy.value=false
  return result
 }
 async function start(kind:OwnerOperation,id:string,token:symbol){
  const valid=capture();if(!valid()||pending.value||busy.value||confirming.value)return null
  if(!['delete','stick'].includes(kind)||!/^[1-9][0-9]{0,18}$/.test(id))throw new ApiError('文章操作不合法',422)
  const abort=new AbortController();confirmation=abort;origin=token;confirming.value=true;error.value=''
  let accepted=false
  try{accepted=await fpConfirm({signal:abort.signal,title:kind==='delete'?'删除本人文章':'付费置顶确认',tone:kind==='delete'?'danger':'default',message:kind==='delete'?'文章及其编辑历史删除后无法恢复。文章须发布满24小时、不是周报且没有评论或其他互动，最终以提交结果为准。是否删除？':'本次将支付100积分，刷新这篇文章的置顶时间。每次重新置顶都会再次收费；管理员永久置顶不可覆盖。是否继续？',confirmText:kind==='delete'?'确认删除':'支付100积分并置顶'})}
  catch(reason){if(valid())error.value=reason instanceof Error?reason.message:'确认失败'}
  finally{if(confirmation===abort){confirmation=null;origin=null;confirming.value=false}}
  if(!valid()||abort.signal.aborted||!accepted)return null
  return execute({kind,id,key:profileOperationKey()},false)
 }
 async function retry(){if(!pending.value||busy.value||confirming.value)return null;return execute(pending.value,true)}
 return{pending,receipt,busy,confirming,error,accountError,start,retry,cancelConfirmation}
})
