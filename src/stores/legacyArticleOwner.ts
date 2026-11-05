import {defineStore} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {legacyOwnerProof,writeLegacyOwner,type LegacyOwnerKind,type LegacyOwnerCommand} from '@/api/legacy/article-owner'
import {fpConfirm} from '@/composables/useDialog'
import {clearCache} from '@/utils/swr'
import {useAuthStore} from './auth'
export const useLegacyArticleOwnerStore=defineStore('legacy-article-owner',()=>{
 const auth=useAuthStore(),pending=ref<LegacyOwnerCommand|null>(null),receipt=ref<LegacyOwnerCommand|null>(null),busy=ref(false),confirming=ref(false),error=ref(''),accountError=ref('')
 let generation=0,completion=0,confirmation:AbortController|null=null,origin:symbol|null=null
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId])
 const active=()=>!import.meta.env.SSR&&getApiMode()==='v1'&&!!auth.apiKey&&!!auth.account?.oId
 function reset(){generation++;confirmation?.abort();confirmation=null;origin=null;pending.value=receipt.value=null;busy.value=confirming.value=false;error.value=accountError.value=''}
 const stop=watch(identity,reset,{flush:'sync'});onScopeDispose(()=>{stop();reset()})
 function cancelConfirmation(token:symbol){if(origin===token)confirmation?.abort()}
 async function start(kind:LegacyOwnerKind,id:string,token:symbol){
  if(!active()||pending.value||busy.value||confirming.value)return null
  if(typeof id!=='string'||!['delete','stick'].includes(kind)||!/^[1-9][0-9]{0,18}$/.test(id))throw new ApiError('文章操作不合法',422)
  const reader=identity(),run=generation,valid=()=>active()&&reader===identity()&&run===generation
  const abort=new AbortController();confirmation=abort;origin=token;confirming.value=true;error.value=accountError.value=''
  try{
   const accepted=await fpConfirm({signal:abort.signal,title:kind==='delete'?'删除本人文章':'付费置顶确认',tone:kind==='delete'?'danger':'default',message:kind==='delete'?'文章及其编辑历史删除后无法恢复。须发布满24小时、不是周报且满足平台互动限制，以服务端核验为准。是否删除？':'本次按平台当前置顶费用扣除积分，每次重新置顶都会再次收费。旧接口不提供金额预览或幂等恢复；结果未确认时请先核对，不能重复提交。是否继续？',confirmText:kind==='delete'?'确认删除':'确认付费置顶'})
   if(!accepted||abort.signal.aborted||!valid())return null
   busy.value=true
   // Read failures and known blocked state have not sent a mutation and must not create an unknown-write lock.
   try{const proof=await legacyOwnerProof(id,auth.account!.oId,abort.signal);if(!valid()||abort.signal.aborted)return null;if(proof.status!==0)throw new ApiError('当前文章状态不允许操作',409);if(kind==='stick'&&(proof.stick==='permanent'||proof.stick==='unknown'))throw new ApiError(proof.stick==='permanent'?'不能覆盖管理员永久置顶':'当前置顶状态未知，暂不能付费置顶',409)}
   catch(failure){if(valid()&&!abort.signal.aborted)error.value=failure instanceof Error?failure.message:'文章核验失败';return null}
   if(!valid()||abort.signal.aborted)return null
   const command:LegacyOwnerCommand={kind,id};pending.value=command;receipt.value=null
   try{const result=await writeLegacyOwner(command);if(!valid())return null;receipt.value=result;pending.value=null;accountError.value='';try{clearCache()}catch{accountError.value='操作已确认，列表缓存清理失败，请重新读取。'}const completed=++completion;void Promise.resolve().then(()=>{if(valid()&&completed===completion)return auth.reloadAccount()}).catch(()=>{if(valid()&&completed===completion)accountError.value='操作已确认，账号或余额刷新失败，请另行核对。'});return result}
   catch(failure){if(valid())error.value=(failure instanceof Error?failure.message:'文章操作未确认')+'。旧接口不能幂等恢复，请核对原文章，不要重复提交。';return null}
  }catch(failure){if(valid()&&!abort.signal.aborted)error.value=failure instanceof Error?failure.message:'确认失败';return null}
  finally{if(valid()){busy.value=confirming.value=false;confirmation=null;origin=null}}
 }
 function release(){if(!busy.value&&!confirming.value){pending.value=null;error.value=''}}
 return{pending,receipt,busy,confirming,error,accountError,start,release,cancelConfirmation}
})
