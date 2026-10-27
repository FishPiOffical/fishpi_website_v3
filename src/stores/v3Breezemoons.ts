import { defineStore, storeToRefs } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { breezemoonContent, writeV3Breezemoon } from '@/api/v3-breezemoons'
import { profileOperationKey } from '@/api/v3-profile'
import { fpConfirm } from '@/composables/useDialog'
import { useAuthStore } from '@/stores/auth'
type Command={operation:'create'|'update'|'delete';id:string;content:string;key:string}
export const useV3BreezemoonStore=defineStore('v3-breezemoons',()=>{
  const{accessToken,account}=storeToRefs(useAuthStore()),pending=ref<Command|null>(null),completed=ref<Command|null>(null),busy=ref(false),confirming=ref(false),error=ref(''),message=ref(''),revision=ref(0),lastOperation=ref('')
  let generation=0,context=getAuthContextVersion(),owner=account.value?.oId,confirmation:AbortController|undefined
  function reset(){generation++;confirmation?.abort();confirmation=undefined;pending.value=null;completed.value=null;busy.value=confirming.value=false;error.value=message.value='';lastOperation.value='';revision.value++}
  const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),id=account.value?.oId;if(!accessToken.value||next!==context||id!==owner)reset();context=next;owner=id},{flush:'sync'})
  onScopeDispose(()=>{stop();reset()})
  function capture(){const current=generation,version=getAuthContextVersion(),id=account.value?.oId;return()=>!import.meta.env.SSR&&!!accessToken.value&&!!id&&id===account.value?.oId&&current===generation&&version===getAuthContextVersion()}
  async function execute(command:Command){
    const valid=capture();if(!valid()||busy.value)return false
    const recovering=!!pending.value;pending.value=command;busy.value=true;error.value=message.value=''
    try{const result=await writeV3Breezemoon(command.operation,command.id,command.content,command.key);if(!valid())return false;if(command.operation!=='delete'&&result.authorId!==account.value?.oId)throw new ApiError('操作身份响应不一致',502);completed.value={...command};pending.value=null;message.value='操作已确认，正在重新读取列表。';lastOperation.value=command.operation;revision.value++;return true}
    catch(err){if(valid()){error.value=err instanceof Error?err.message:'清风明月操作失败';if(!recovering&&err instanceof ApiError&&err.status>=400&&err.status<500)pending.value=null}return false}
    finally{if(valid())busy.value=false}
  }
  async function save(content:string,id=''){if(pending.value||busy.value||confirming.value)return false;error.value=message.value='';return execute({operation:id?'update':'create',id,content:breezemoonContent(content),key:profileOperationKey()})}
  async function remove(id:string,preview:string){
    if(pending.value||busy.value||confirming.value)return
    const valid=capture();if(!valid())return;confirming.value=true;confirmation=new AbortController()
    try{const accepted=await fpConfirm({title:'删除清风明月',message:`确定删除这条动态？删除后不可恢复。\n${preview.slice(0,80)}`,confirmText:'删除',tone:'danger',signal:confirmation.signal});if(accepted&&valid())await execute({operation:'delete',id,content:'',key:profileOperationKey()})}
    finally{if(valid()){confirming.value=false;confirmation=undefined}}
  }
  async function retry(){if(pending.value)return execute(pending.value);return false}
  return{pending,completed,busy,confirming,error,message,revision,lastOperation,capture,save,remove,retry}
})
