import {defineStore,storeToRefs} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {profileOperationKey} from '@/api/v3-profile'
import {sendChatWeather,weatherInput,type ChatWeatherInput,type ChatWeatherCommand,type ChatWeatherReceipt} from '@/api/v3-chat-weather'
import {chatMessageDetail,type ChatMessage} from '@/api/v3-chat-messages'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatTimelineStore} from '@/stores/v3ChatTimeline'
export const useV3ChatWeatherStore=defineStore('v3-chat-weather',()=>{
 const timeline=useV3ChatTimelineStore(),auth=useAuthStore(),{accessToken,account}=storeToRefs(auth)
 const pending=ref<ChatWeatherCommand|null>(null),completed=ref<ChatWeatherCommand|null>(null),receipt=ref<ChatWeatherReceipt|null>(null),busy=ref(false),error=ref(''),needsConfirmation=ref(false),currentMessage=ref<ChatMessage|null>(null),reading=ref(false),readError=ref(''),revision=ref(0)
 let generation=0,readRun=0,boundary=getAuthContextVersion(),owner=account.value?.oId,readAbort:AbortController|null=null
 function reset(){generation++;readRun++;readAbort?.abort();readAbort=null;pending.value=null;completed.value=null;receipt.value=null;busy.value=false;needsConfirmation.value=false;currentMessage.value=null;reading.value=false;error.value='';readError.value='';revision.value=0}
 const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||next!==boundary||actor!==owner)reset();boundary=next;owner=actor},{flush:'sync'});onScopeDispose(()=>{stop();reset()})
 function proof(){const run=generation,context=getAuthContextVersion(),actor=account.value?.oId;return()=>!import.meta.env.SSR&&!!accessToken.value&&!!actor&&run===generation&&context===getAuthContextVersion()&&actor===account.value?.oId}
 async function readCurrent(){const valid=proof(),id=receipt.value?.id;if(!valid()||!id)return;readAbort?.abort();const abort=new AbortController(),run=++readRun;readAbort=abort;reading.value=true;readError.value='';currentMessage.value=null
 try{const message=await chatMessageDetail(id,abort.signal);if(message.type==='unavailable')throw new ApiError('当前消息不可读取',404);if(valid()&&run===readRun&&!abort.signal.aborted&&receipt.value?.id===id){currentMessage.value=message;timeline.upsertConfirmed(message)}}
 catch(e){if(valid()&&run===readRun&&!abort.signal.aborted)readError.value=e instanceof Error?e.message:'发送已确认，当前消息读取失败'}finally{if(valid()&&run===readRun){reading.value=false;readAbort=null}}}
 async function execute(command:ChatWeatherCommand,recovering:boolean){const valid=proof();if(!valid()||busy.value)return null;if(!recovering){receipt.value=null;completed.value=null;currentMessage.value=null;readError.value='';readRun++;readAbort?.abort();reading.value=false}pending.value=command;busy.value=true;error.value='';needsConfirmation.value=false
 let result:ChatWeatherReceipt
 try{result=await sendChatWeather(command)}catch(e){if(valid()){error.value=e instanceof Error?e.message:'发送失败';if(e instanceof ApiError&&e.code==='confirmation_required')needsConfirmation.value=true;else if(!recovering&&e instanceof ApiError&&e.status>=400&&e.status<500)pending.value=null;busy.value=false}return null}
 if(!valid())return null
 pending.value=null;completed.value=command;receipt.value=result;currentMessage.value=null;busy.value=false;revision.value++;void readCurrent();return result
 }
 async function send(input:ChatWeatherInput){if(pending.value||busy.value)return null;let normalized:ChatWeatherInput;try{normalized=weatherInput(input)}catch(e){error.value=e instanceof Error?e.message:'天气卡片不合法';return null}return execute({input:normalized,key:profileOperationKey()},false)}
 async function retry(confirmed=false){if(!pending.value||needsConfirmation.value&&!confirmed)return null;return execute(pending.value,true)}
 function cancelRequestedConfirmation(){if(needsConfirmation.value&&!busy.value){pending.value=null;needsConfirmation.value=false;error.value=''}}
 return{pending,completed,receipt,busy,error,needsConfirmation,currentMessage,reading,readError,revision,send,retry,readCurrent,cancelRequestedConfirmation}
})
