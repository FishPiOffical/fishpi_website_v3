import {defineStore,storeToRefs} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {profileOperationKey} from '@/api/v3-profile'
import {revokeChatMessage,type ChatRevokeCommand,type ChatRevokeReceipt} from '@/api/v3-chat-revoke'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatTimelineStore} from '@/stores/v3ChatTimeline'
export const useV3ChatRevokeStore=defineStore('v3-chat-revoke',()=>{
 const {accessToken,account}=storeToRefs(useAuthStore()),timeline=useV3ChatTimelineStore()
 const pending=ref<ChatRevokeCommand|null>(null),receipt=ref<ChatRevokeReceipt|null>(null),busy=ref(false),error=ref('')
 let generation=0,boundary=getAuthContextVersion(),owner=account.value?.oId
 function clear(){generation++;pending.value=null;receipt.value=null;busy.value=false;error.value=''}
 const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||next!==boundary||owner!==actor)clear();boundary=next;owner=actor},{flush:'sync'})
 onScopeDispose(()=>{stop();clear()})
 async function execute(command:ChatRevokeCommand,recovering:boolean){if(import.meta.env.SSR||busy.value||!accessToken.value||!account.value?.oId)return null;const run=generation,actor=account.value.oId,context=getAuthContextVersion(),valid=()=>run===generation&&!!accessToken.value&&actor===account.value?.oId&&context===getAuthContextVersion();pending.value=command;receipt.value=null;busy.value=true;error.value=''
 try{const result=await revokeChatMessage(command);if(!valid())return null;pending.value=null;receipt.value=result;timeline.removeConfirmed(result.id);return result}
 catch(e){if(valid()){error.value=e instanceof Error?e.message:'撤回失败';if(!recovering&&e instanceof ApiError&&e.status>=400&&e.status<500)pending.value=null}return null}
 finally{if(valid())busy.value=false}}
 function revoke(id:string){if(pending.value||busy.value)return Promise.resolve(null);return execute({id,key:profileOperationKey()},false)}
 function retry(){return pending.value?execute(pending.value,true):Promise.resolve(null)}
 return{pending,receipt,busy,error,revoke,retry}
})
