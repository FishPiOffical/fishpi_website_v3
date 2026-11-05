import {onMounted,onScopeDispose,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {legacyCheckin,legacyRewardStatus} from '@/api/legacy/activity'
import {useAuthStore} from '@/stores/auth'
import {useLegacyActivityStore} from '@/stores/legacyActivity'
export function useLegacyActivityStatus(){const auth=useAuthStore(),writes=useLegacyActivityStore();let mounted=false
 function resource<T>(fetch:()=>Promise<T>){const value=ref<T|null>(null),loading=ref(false),error=ref('');let sequence=0;function clear(){sequence++;value.value=null;loading.value=false;error.value=''}async function read(){clear();if(!mounted||import.meta.env.SSR||!auth.apiKey||!auth.account?.oId)return;const run=sequence,key=auth.apiKey,actor=auth.account.oId,context=getAuthContextVersion(),valid=()=>mounted&&run===sequence&&key===auth.apiKey&&actor===auth.account?.oId&&context===getAuthContextVersion();loading.value=true;try{const result=await fetch();if(valid())value.value=result}catch(e){if(valid())error.value=e instanceof Error?e.message:'活动状态读取失败'}finally{if(valid())loading.value=false}}return{value,loading,error,read,clear}}
 const checkin=resource(legacyCheckin),reward=resource(legacyRewardStatus),read=()=>{void checkin.read();void reward.read()},stops=[watch([()=>auth.apiKey,()=>auth.account?.oId],read,{flush:'sync'}),watch(()=>writes.revision,read)];onMounted(()=>{mounted=true;read()});onScopeDispose(()=>{mounted=false;stops.forEach(s=>s());checkin.clear();reward.clear()});return{checkin,reward}}
