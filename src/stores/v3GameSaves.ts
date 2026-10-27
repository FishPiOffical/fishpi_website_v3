import {defineStore,storeToRefs} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {profileOperationKey} from '@/api/v3-profile'
import {executeGameSave,gameSaveData,gameSaveRevision,type GameSaveCommand,type GameSaveMetadata} from '@/api/v3-game-saves'
import {useAuthStore} from '@/stores/auth'

export const useV3GameSavesStore=defineStore('v3-game-saves-write',()=>{
 const {accessToken,account}=storeToRefs(useAuthStore())
 const pending=ref<GameSaveCommand|null>(null),completed=ref<GameSaveCommand|null>(null),receipt=ref<GameSaveMetadata|null>(null),busy=ref(false),error=ref(''),needsConfirmation=ref(false)
 const revision=ref(0)
 let generation=0,boundary=getAuthContextVersion(),owner=account.value?.oId
 function clear(){generation++;pending.value=completed.value=null;receipt.value=null;busy.value=false;error.value='';needsConfirmation.value=false}
 const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||next!==boundary||actor!==owner)clear();boundary=next;owner=actor},{flush:'sync'});onScopeDispose(()=>{stop();clear()})
 async function execute(command:GameSaveCommand,recovering:boolean){if(import.meta.env.SSR||!accessToken.value||!account.value?.oId||busy.value)return null;const run=generation,context=getAuthContextVersion(),actor=account.value.oId,valid=()=>run===generation&&context===getAuthContextVersion()&&!!accessToken.value&&actor===account.value?.oId;if(!recovering){completed.value=null;receipt.value=null}pending.value=command;busy.value=true;error.value='';needsConfirmation.value=false
 try{const result=await executeGameSave(command);if(!valid())return null;pending.value=null;completed.value=command;receipt.value=result;revision.value++;return result}
 catch(e){if(valid()){error.value=e instanceof Error?e.message:'存档操作失败';if(e instanceof ApiError&&e.code==='confirmation_required')needsConfirmation.value=true;else if(!recovering&&e instanceof ApiError&&e.status>=400&&e.status<500)pending.value=null}return null}
 finally{if(valid())busy.value=false}}
 function save(data:string,expectedRevision:number){if(busy.value||pending.value)return Promise.resolve(null);try{return execute({kind:'save',data:gameSaveData(data),expectedRevision:gameSaveRevision(expectedRevision),key:profileOperationKey()},false)}catch(e){error.value=e instanceof Error?e.message:'存档不合法';return Promise.resolve(null)}}
 function migrate(){if(busy.value||pending.value)return Promise.resolve(null);return execute({kind:'migrate',key:profileOperationKey()},false)}
 function dismiss(){if(!busy.value&&!pending.value){receipt.value=null;completed.value=null;error.value=''}}
 function retry(confirmed=false){return pending.value&&(!needsConfirmation.value||confirmed)?execute(pending.value,true):Promise.resolve(null)}
 function cancelConfirmation(){if(needsConfirmation.value&&!busy.value){pending.value=null;needsConfirmation.value=false;error.value=''}}
 return{pending,completed,receipt,busy,error,needsConfirmation,save,migrate,retry,cancelConfirmation,dismiss,revision}
})
