import {defineStore,storeToRefs} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {profileOperationKey} from '@/api/v3-profile'
import {createPacket,claimPacket,packetDetail,packetInput,packetClaimInput,packetId,type PacketInput,type PacketType,type ClaimInput,type PacketDetail,type ClaimReceipt,type CreateReceipt} from '@/api/v3-chat-red-packets'
import {chatMessageDetail} from '@/api/v3-chat-messages'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatTimelineStore} from '@/stores/v3ChatTimeline'
export type PacketCommand={kind:'create';input:PacketInput;key:string}|{kind:'claim';id:string;type:PacketType;input:ClaimInput;key:string}
export type PacketReceipt={kind:'create';data:CreateReceipt}|{kind:'claim';data:ClaimReceipt}
export const useV3ChatRedPacketsStore=defineStore('v3-chat-red-packets',()=>{
 const {accessToken,account}=storeToRefs(useAuthStore()),timeline=useV3ChatTimelineStore()
 const pending=ref<PacketCommand|null>(null),completed=ref<PacketCommand|null>(null),receipt=ref<PacketReceipt|null>(null),busy=ref(false),error=ref(''),needsConfirmation=ref(false)
 const selectedId=ref(''),detail=ref<PacketDetail|null>(null),loading=ref(false),detailError=ref(''),reading=ref(false),readError=ref('')
 let generation=0,detailRun=0,readRun=0,boundary=getAuthContextVersion(),owner=account.value?.oId,detailAbort:AbortController|null=null,readAbort:AbortController|null=null
 function proof(){const run=generation,context=getAuthContextVersion(),actor=account.value?.oId;return()=>!import.meta.env.SSR&&!!accessToken.value&&!!actor&&run===generation&&context===getAuthContextVersion()&&actor===account.value?.oId}
 function close(){detailRun++;detailAbort?.abort();detailAbort=null;selectedId.value='';detail.value=null;detailError.value='';loading.value=false}
 function reset(){generation++;readRun++;readAbort?.abort();readAbort=null;close();pending.value=completed.value=null;receipt.value=null;busy.value=reading.value=needsConfirmation.value=false;error.value=readError.value=''}
 async function open(id=selectedId.value){const valid=proof();if(!valid())return;close();selectedId.value=id;try{packetId(id)}catch(e){detailError.value=e instanceof Error?e.message:'红包ID不合法';return}loading.value=true;const run=detailRun,abort=new AbortController();detailAbort=abort;try{const value=await packetDetail(id,account.value!.oId,abort.signal);if(valid()&&run===detailRun&&!abort.signal.aborted)detail.value=value}catch(e){if(valid()&&run===detailRun&&!abort.signal.aborted)detailError.value=e instanceof Error?e.message:'红包详情读取失败'}finally{if(valid()&&run===detailRun){loading.value=false;detailAbort=null}}}
 async function readCurrent(){const valid=proof(),id=receipt.value?.data.id;if(!valid()||!id)return;readAbort?.abort();const abort=new AbortController(),run=++readRun;readAbort=abort;reading.value=true;readError.value='';try{const value=await chatMessageDetail(id,abort.signal);if(value.type==='unavailable')throw new ApiError('当前红包消息不可读',404);if(valid()&&run===readRun&&!abort.signal.aborted&&receipt.value?.data.id===id)timeline.upsertConfirmed(value)}catch(e){if(valid()&&run===readRun&&!abort.signal.aborted)readError.value=e instanceof Error?e.message:'当前红包消息读取失败'}finally{if(valid()&&run===readRun){reading.value=false;readAbort=null}}}
 async function execute(command:PacketCommand,recovering:boolean){const valid=proof();if(!valid()||busy.value)return null;if(!recovering){receipt.value=null;completed.value=null;readError.value='';readRun++;readAbort?.abort();reading.value=false}pending.value=command;busy.value=true;error.value='';needsConfirmation.value=false
 try{const result:PacketReceipt=command.kind==='create'?{kind:'create',data:await createPacket(command.input,command.key,account.value!.oId)}:{kind:'claim',data:await claimPacket(command.id,command.type,command.input,command.key)};if(!valid())return null;pending.value=null;completed.value=command;receipt.value=result;void readCurrent();if(selectedId.value===result.data.id)void open(result.data.id);return result}
 catch(e){if(valid()){error.value=e instanceof Error?e.message:'红包操作失败';if(e instanceof ApiError&&e.code==='confirmation_required')needsConfirmation.value=true;else if(!recovering&&e instanceof ApiError&&e.status>=400&&e.status<500)pending.value=null}return null}
 finally{if(valid())busy.value=false}}
 function create(input:PacketInput){if(pending.value||busy.value)return Promise.resolve(null);try{return execute({kind:'create',input:packetInput(input,account.value?.oId||''),key:profileOperationKey()},false)}catch(e){error.value=e instanceof Error?e.message:'红包参数不合法';return Promise.resolve(null)}}
 function claim(id:string,type:PacketType,input:ClaimInput){if(pending.value||busy.value)return Promise.resolve(null);try{return execute({kind:'claim',id:packetId(id),type,input:packetClaimInput(type,input),key:profileOperationKey()},false)}catch(e){error.value=e instanceof Error?e.message:'领取参数不合法';return Promise.resolve(null)}}
 function retry(confirmed=false){return pending.value&&(!needsConfirmation.value||confirmed)?execute(pending.value,true):Promise.resolve(null)}
 function cancelConfirmation(){if(needsConfirmation.value&&!busy.value){pending.value=null;needsConfirmation.value=false;error.value=''}}
 function dismiss(){if(pending.value||busy.value)return;readRun++;readAbort?.abort();reading.value=false;receipt.value=null;error.value=readError.value=''}
 const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||next!==boundary||actor!==owner)reset();boundary=next;owner=actor},{flush:'sync'})
 onScopeDispose(()=>{stop();reset()});return{pending,completed,receipt,busy,error,needsConfirmation,selectedId,detail,loading,detailError,reading,readError,open,close,dismiss,readCurrent,create,claim,retry,cancelConfirmation}
})
