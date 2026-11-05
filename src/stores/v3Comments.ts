import { defineStore, storeToRefs } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { commentInput, writeV3Comment, type CommentCommand, type CommentInput } from '@/api/v3-comments'
import { profileOperationKey } from '@/api/v3-profile'
import { fpConfirm } from '@/composables/useDialog'
import { useAuthStore } from '@/stores/auth'
export const useV3CommentsStore=defineStore('v3-comments',()=>{
  const auth=useAuthStore()
  const{accessToken,account}=storeToRefs(auth),pending=ref<CommentCommand|null>(null),completed=ref<CommentCommand|null>(null),busy=ref(false),confirming=ref(false),error=ref(''),message=ref(''),revision=ref(0),lastOperation=ref(''),receipt=ref<{articleId:string;id:string;operation:string}|null>(null)
  let generation=0,context=getAuthContextVersion(),owner=account.value?.oId,confirmation:AbortController|undefined,confirmationOwner:symbol|undefined
  function reset(){generation++;confirmation?.abort();confirmation=undefined;confirmationOwner=undefined;pending.value=null;completed.value=null;receipt.value=null;busy.value=confirming.value=false;error.value=message.value='';lastOperation.value='';revision.value++}
  const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),id=account.value?.oId;if(!accessToken.value||next!==context||id!==owner)reset();context=next;owner=id},{flush:'sync'})
  onScopeDispose(()=>{stop();reset()})
  function capture(){const current=generation,version=getAuthContextVersion(),id=account.value?.oId;return()=>!import.meta.env.SSR&&!!accessToken.value&&!!id&&id===account.value?.oId&&current===generation&&version===getAuthContextVersion()}
  async function execute(command:CommentCommand){
    const valid=capture();if(!valid()||busy.value)return false
    const recovering=!!pending.value;pending.value=command;busy.value=true;error.value=message.value=''
    try{const result=await writeV3Comment(command);if(!valid())return false;completed.value={...command};receipt.value={articleId:command.articleId,id:result.id,operation:command.operation};pending.value=null;message.value='操作已确认，请以重新读取的评论为准。';lastOperation.value=command.operation;revision.value++;try{await auth.reloadAccount()}catch{if(valid())message.value='操作已确认，余额刷新失败，请到积分页核对。'}return true}
    catch(err){if(valid()){error.value=err instanceof Error?err.message:'评论操作失败';if(!recovering&&err instanceof ApiError&&err.status>=400&&err.status<500)pending.value=null}return false}
    finally{if(valid())busy.value=false}
  }
  async function save(articleId:string,input:CommentInput,id='',origin?:symbol){
    if(pending.value||busy.value||confirming.value)return false
    const valid=capture();if(!valid())return false
    const operation=id?'update':'create',normalized=commentInput(operation,input)
    error.value=message.value='';confirming.value=true;confirmation=new AbortController();confirmationOwner=origin
    try{
      const accepted=await fpConfirm({title:id?'编辑评论确认':'发布评论确认',message:id?'按平台编辑费用与五分钟规则结算，窗口外编辑可能扣积分。确定保存？':'按平台评论费用、匿名资格及审核规则发布。确定提交此评论？',confirmText:id?'保存修改':'发表评论',signal:confirmation.signal})
      if(accepted&&valid())return execute({operation,articleId,id,input:normalized,key:profileOperationKey()})
      return false
    }finally{if(valid()){confirming.value=false;confirmation=undefined;confirmationOwner=undefined}}
  }
  async function remove(articleId:string,id:string,origin?:symbol){
    if(pending.value||busy.value||confirming.value)return false
    const valid=capture();if(!valid())return false;error.value=message.value='';confirming.value=true;confirmation=new AbortController();confirmationOwner=origin
    try{const accepted=await fpConfirm({title:'删除评论',message:'删除不可恢复，将按平台当前删除费用结算（默认100积分）；不满足删除条件时不会扣款。是否继续？',confirmText:'删除',tone:'danger',signal:confirmation.signal});if(accepted&&valid())return execute({operation:'delete',articleId,id,input:{content:''},key:profileOperationKey()});return false}
    finally{if(valid()){confirming.value=false;confirmation=undefined;confirmationOwner=undefined}}
  }
  function cancelConfirmation(origin:symbol){if(confirmationOwner===origin)confirmation?.abort()}
  async function retry(){if(pending.value)return execute(pending.value);return false}
  return{pending,completed,receipt,busy,confirming,error,message,revision,lastOperation,capture,save,remove,retry,cancelConfirmation}
})
