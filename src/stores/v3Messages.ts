import {defineStore,storeToRefs} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {profileOperationKey} from '@/api/v3-profile'
import {writeMessage,type MessageCommand} from '@/api/v3-messages'
import {useAuthStore} from '@/stores/auth'
export const useV3MessagesStore=defineStore('v3-messages',()=>{
 const auth=useAuthStore(),{accessToken,account}=storeToRefs(auth),pending=ref<MessageCommand|null>(null),busy=ref(false),error=ref(''),revision=ref(0),completed=ref<MessageCommand|null>(null)
 let generation=0,boundary=getAuthContextVersion(),owner=account.value?.oId
 function reset(){generation++;pending.value=null;busy.value=false;error.value='';completed.value=null;revision.value=0}
 const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||next!==boundary||actor!==owner)reset();boundary=next;owner=actor},{flush:'sync'});onScopeDispose(()=>{stop();reset()})
 async function execute(command:MessageCommand,retry:boolean){if(import.meta.env.SSR||!accessToken.value||!account.value?.oId||busy.value)return false;const run=generation,context=getAuthContextVersion(),actor=account.value.oId,valid=()=>run===generation&&context===getAuthContextVersion()&&actor===account.value?.oId&&!!accessToken.value
 pending.value=command;busy.value=true;error.value=''
 try{await writeMessage(command);if(!valid())return false;pending.value=null;completed.value=command;revision.value++;return true}
 catch(e){if(valid()){error.value=e instanceof Error?e.message:'私信操作失败';if(!retry&&e instanceof ApiError&&e.status>=400&&e.status<500)pending.value=null}return false}
 finally{if(valid())busy.value=false}}
 async function start(kind:MessageCommand['kind'],target:string,content?:string){if(pending.value||busy.value)return false;return execute({kind,target,content,key:profileOperationKey()},false)}
 async function retry(){if(!pending.value)return false;return execute(pending.value,true)}
 return{pending,busy,error,revision,completed,start,retry}
})
