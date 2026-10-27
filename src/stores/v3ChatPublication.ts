import {defineStore,storeToRefs} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {profileOperationKey} from '@/api/v3-profile'
import {publishChat,chatPublicationContent,type ChatPublicationCommand,type ChatPublicationReceipt} from '@/api/v3-chat-publication'
import {chatMessageDetail,type ChatMessage} from '@/api/v3-chat-messages'
import {useAuthStore} from '@/stores/auth'
export const useV3ChatPublicationStore=defineStore('v3-chat-publication',()=>{
 const auth=useAuthStore(),{accessToken,account}=storeToRefs(auth)
 const pending=ref<ChatPublicationCommand|null>(null),completed=ref<ChatPublicationCommand|null>(null),receipt=ref<ChatPublicationReceipt|null>(null),busy=ref(false),error=ref(''),needsConfirmation=ref(false),currentMessage=ref<ChatMessage|null>(null),reading=ref(false),readError=ref(''),revision=ref(0)
 let generation=0,readRun=0,boundary=getAuthContextVersion(),owner=account.value?.oId,readAbort:AbortController|null=null
 function reset(){generation++;readRun++;readAbort?.abort();readAbort=null;pending.value=null;completed.value=null;receipt.value=null;busy.value=false;needsConfirmation.value=false;currentMessage.value=null;reading.value=false;error.value='';readError.value='';revision.value=0}
 const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||next!==boundary||actor!==owner)reset();boundary=next;owner=actor},{flush:'sync'});onScopeDispose(()=>{stop();reset()})
 function proof(){const run=generation,context=getAuthContextVersion(),actor=account.value?.oId;return()=>!import.meta.env.SSR&&!!accessToken.value&&!!actor&&run===generation&&context===getAuthContextVersion()&&actor===account.value?.oId}
 async function readCurrent(){const valid=proof(),id=receipt.value?.id;if(!valid()||!id)return;readAbort?.abort();const abort=new AbortController(),run=++readRun;readAbort=abort;reading.value=true;readError.value='';currentMessage.value=null
 try{const message=await chatMessageDetail(id,abort.signal);if(message.type==='unavailable')throw new ApiError('当前消息不可读取',404);if(valid()&&run===readRun&&!abort.signal.aborted&&receipt.value?.id===id)currentMessage.value=message}
 catch(e){if(valid()&&run===readRun&&!abort.signal.aborted)readError.value=e instanceof Error?e.message:'发送已确认，当前消息读取失败'}finally{if(valid()&&run===readRun){reading.value=false;readAbort=null}}}
 async function execute(command:ChatPublicationCommand,recovering:boolean){const valid=proof();if(!valid()||busy.value)return null;pending.value=command;busy.value=true;error.value='';needsConfirmation.value=false
 let result:ChatPublicationReceipt
 try{result=await publishChat(command)}catch(e){if(valid()){error.value=e instanceof Error?e.message:'发送失败';if(e instanceof ApiError&&e.code==='confirmation_required')needsConfirmation.value=true;else if(!recovering&&e instanceof ApiError&&e.status>=400&&e.status<500)pending.value=null;busy.value=false}return null}
 if(!valid())return null
 pending.value=null;completed.value=command;receipt.value=result;currentMessage.value=null;busy.value=false;revision.value++;void readCurrent();return result
 }
 async function send(content:string){if(pending.value||busy.value)return null;let normalized:string;try{normalized=chatPublicationContent(content)}catch(e){error.value=e instanceof Error?e.message:'正文不合法';return null}return execute({content:normalized,client:'Web/PC网页端',key:profileOperationKey()},false)}
 async function retry(confirmed=false){if(!pending.value||needsConfirmation.value&&!confirmed)return null;return execute(pending.value,true)}
 function cancelRequestedConfirmation(){if(needsConfirmation.value&&!busy.value){pending.value=null;needsConfirmation.value=false;error.value=''}}
 return{pending,completed,receipt,busy,error,needsConfirmation,currentMessage,reading,readError,revision,send,retry,readCurrent,cancelRequestedConfirmation}
})
