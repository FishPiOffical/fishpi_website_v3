import {defineStore} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {legacyClaimReward} from '@/api/legacy/activity'
import {useAuthStore} from './auth'
export const useLegacyActivityStore=defineStore('legacy-activity-write',()=>{
 const auth=useAuthStore(),pending=ref(false),busy=ref(false),error=ref(''),receipt=ref<{amount:number|null;awarded:boolean}|null>(null),revision=ref(0);let generation=0
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId]),active=()=>!import.meta.env.SSR&&getApiMode()==='v1'&&!!auth.apiKey&&!!auth.account?.oId
 function clear(){generation++;pending.value=busy.value=false;error.value='';receipt.value=null}const stop=watch(identity,clear,{flush:'sync'});onScopeDispose(()=>{stop();clear()})
 async function claim(){if(!active()||busy.value||pending.value)return null;const run=generation,reader=identity(),valid=()=>active()&&run===generation&&reader===identity();pending.value=busy.value=true;error.value='';receipt.value=null
 try{const result=await legacyClaimReward();if(valid()){pending.value=false;receipt.value=result;revision.value++;return result}return null}
 catch(e){if(valid())error.value=(e instanceof Error?e.message:'领取失败')+'。本次结果未确认，请先核对奖励状态与积分流水，勿重复领取。';return null}
 finally{if(valid())busy.value=false}}
 function release(){if(!busy.value){pending.value=false;error.value=''}}function dismiss(){if(!busy.value&&!pending.value){receipt.value=null;error.value=''}}
 return{pending,busy,error,receipt,revision,claim,release,dismiss}
})
