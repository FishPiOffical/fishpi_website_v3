import {defineStore,storeToRefs} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {profileOperationKey} from '@/api/v3-profile'
import {publishReport,reportOptions,reportInput,type ReportInput,type ReportCommand,type ReportReceipt,type ReportTarget} from '@/api/v3-reports'
import {useAuthStore} from '@/stores/auth'

export const useV3ReportsStore=defineStore('v3-reports',()=>{
 const {accessToken,account}=storeToRefs(useAuthStore())
 const pending=ref<ReportCommand|null>(null),completed=ref<ReportCommand|null>(null),receipt=ref<ReportReceipt|null>(null),busy=ref(false),error=ref(''),needsConfirmation=ref(false)
 const options=ref<ReportTarget[]|null>(null),optionsLoading=ref(false),optionsError=ref('')
 let optionsSequence=0,optionsController:AbortController|null=null
 function clearOptions(){optionsSequence++;optionsController?.abort();optionsController=null;options.value=null;optionsLoading.value=false;optionsError.value=''}
 async function loadOptions(){if(import.meta.env.SSR||!accessToken.value||!account.value?.oId)return;const sequence=++optionsSequence,context=getAuthContextVersion(),actor=account.value.oId;optionsController?.abort();const abort=new AbortController();optionsController=abort;options.value=null;optionsLoading.value=true;optionsError.value='';const valid=()=>sequence===optionsSequence&&context===getAuthContextVersion()&&!!accessToken.value&&actor===account.value?.oId&&!abort.signal.aborted;try{const data=await reportOptions(abort.signal);if(valid())options.value=data}catch(e){if(valid())optionsError.value=e instanceof Error?e.message:'举报分类读取失败'}finally{if(valid()){optionsLoading.value=false;optionsController=null}}}
 let generation=0,boundary=getAuthContextVersion(),owner=account.value?.oId
 function clear(){clearOptions();generation++;pending.value=completed.value=null;receipt.value=null;busy.value=false;error.value='';needsConfirmation.value=false}
 const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||next!==boundary||actor!==owner)clear();boundary=next;owner=actor},{flush:'sync'});onScopeDispose(()=>{stop();clear()})
 async function execute(command:ReportCommand,recovering:boolean){if(import.meta.env.SSR||!accessToken.value||!account.value?.oId||busy.value)return null;const run=generation,context=getAuthContextVersion(),actor=account.value.oId,valid=()=>run===generation&&context===getAuthContextVersion()&&!!accessToken.value&&actor===account.value?.oId;if(!recovering){completed.value=null;receipt.value=null}pending.value=command;busy.value=true;error.value='';needsConfirmation.value=false
 try{const result=await publishReport(command);if(!valid())return null;pending.value=null;completed.value=command;receipt.value=result;return result}
 catch(e){if(valid()){error.value=e instanceof Error?e.message:'举报提交失败';if(e instanceof ApiError&&e.code==='confirmation_required')needsConfirmation.value=true;else if(!recovering&&e instanceof ApiError&&e.status>=400&&e.status<500)pending.value=null}return null}
 finally{if(valid())busy.value=false}}
 function save(value:ReportInput){if(busy.value||pending.value)return Promise.resolve(null);try{const input=reportInput(value);if(!options.value?.find(t=>t.targetType===input.targetType)?.reasons.some(r=>r.reason===input.reason))throw new ApiError('请先读取并选择当前举报分类',422);return execute({input,key:profileOperationKey()},false)}catch(e){error.value=e instanceof Error?e.message:'举报不合法';return Promise.resolve(null)}}
 function retry(confirmed=false){return pending.value&&(!needsConfirmation.value||confirmed)?execute(pending.value,true):Promise.resolve(null)}
 function cancelConfirmation(){if(needsConfirmation.value&&!busy.value){pending.value=null;needsConfirmation.value=false;error.value=''}}
 function dismiss(){if(!pending.value&&!busy.value){completed.value=null;receipt.value=null;error.value=''}}
 return{pending,completed,receipt,busy,error,needsConfirmation,options,optionsLoading,optionsError,loadOptions,save,retry,cancelConfirmation,dismiss}
})
