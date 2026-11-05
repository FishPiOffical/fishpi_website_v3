import { defineStore,storeToRefs } from 'pinia'
import { onScopeDispose,ref,watch } from 'vue'
import { ApiError,getAuthContextVersion } from '@/api/http'
import { profileOperationKey } from '@/api/v3-profile'
import { writePost,type PostCommand,type PostReceipt } from '@/api/v3-posts'
import { fpConfirm } from '@/composables/useDialog'
import { useAuthStore } from '@/stores/auth'
export const useV3PostsStore=defineStore('v3-posts',()=>{
  const auth=useAuthStore(),{accessToken,account}=storeToRefs(auth)
  const pending=ref<PostCommand|null>(null),completed=ref<PostCommand|null>(null),receipt=ref<PostReceipt|null>(null),busy=ref(false),confirming=ref(false),error=ref(''),message=ref(''),revision=ref(0)
  let generation=0,boundary=getAuthContextVersion(),owner=account.value?.oId,confirmation:AbortController|null=null,origin:symbol|null=null
  function cancelConfirmation(token:symbol){if(origin===token){confirmation?.abort();confirmation=null;origin=null;confirming.value=false}}
  function reset(){generation++;confirmation?.abort();confirmation=null;origin=null;pending.value=null;completed.value=null;receipt.value=null;busy.value=false;confirming.value=false;error.value='';message.value='';revision.value++}
  const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||next!==boundary||actor!==owner)reset();boundary=next;owner=actor},{flush:'sync'})
  onScopeDispose(()=>{stop();reset()})
  function capture(){const current=generation,context=getAuthContextVersion(),actor=account.value?.oId;return()=>!import.meta.env.SSR&&!!accessToken.value&&!!actor&&actor===account.value?.oId&&current===generation&&context===getAuthContextVersion()}
  async function execute(command:PostCommand,recovering:boolean){
    const valid=capture();if(!valid()||busy.value)return null
    pending.value=command;busy.value=true;error.value='';message.value=''
    try{const result=await writePost(command);if(!valid())return null;completed.value=command;receipt.value=result;pending.value=null;message.value='操作已确认';revision.value++
      if(command.op==='publish'||command.op==='edit')try{await auth.reloadAccount()}catch{if(valid())message.value='操作已确认，余额刷新失败，请到积分页核对。'}
      return valid()?result:null
    }catch(reason){if(valid()){error.value=reason instanceof Error?reason.message:'文章操作失败';if(!recovering&&reason instanceof ApiError&&reason.status>=400&&reason.status<500)pending.value=null}return null}
    finally{if(valid())busy.value=false}
  }
  async function start(op:PostCommand['op'],id:string,input:Record<string,unknown>,token:symbol){
    const valid=capture();if(!valid()||pending.value||busy.value||confirming.value)return null
    const snapshot=JSON.parse(JSON.stringify(input)) as Record<string,unknown>
    error.value='';message.value=''
    if(op!=='draft-save'){
      const controller=new AbortController();confirmation=controller;origin=token;confirming.value=true
      let accepted=false
      try{accepted=await fpConfirm({signal:controller.signal,title:op==='draft-delete'?'删除草稿确认':op==='publish'?'发布确认':'编辑确认',message:op==='draft-delete'?'删除这份草稿后无法恢复，是否继续？':'本次操作将按平台规则结算积分，并提交当前填写的内容。是否继续？',confirmText:'确认提交'})}
      finally{if(confirmation===controller){confirmation=null;origin=null;confirming.value=false}}
      if(!valid()||controller.signal.aborted||!accepted)return null
    }
    if(!valid())return null
    return execute({op,id,input:snapshot,key:profileOperationKey()},false)
  }
  async function retry(){if(!pending.value||busy.value||confirming.value)return null;return execute(pending.value,true)}
  return{pending,completed,receipt,busy,confirming,error,message,revision,start,retry,cancelConfirmation}
})
