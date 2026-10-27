import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3Breezemoons, type BreezemoonPage } from '@/api/v3-breezemoons'
import { useAuthStore } from '@/stores/auth'
import { useV3BreezemoonStore } from '@/stores/v3Breezemoons'
export function useBreezemoonFeed(size:number,bootstrap:BreezemoonPage|null=null){
  const {accessToken,account}=storeToRefs(useAuthStore()),operations=useV3BreezemoonStore()
  const mounted=ref(false),result=ref<BreezemoonPage|null>(bootstrap),loading=ref(!bootstrap),error=ref(''),page=ref(1)
  let sequence=0,boundary=''
  function identity(){return `${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId||''}`}
  function clear(){sequence++;result.value=null;loading.value=false;error.value=''}
  async function load(afterWrite=false){
    if(!mounted.value||loading.value)return
    const current=++sequence,reader=identity(),requested=page.value;loading.value=true;result.value=null;error.value=''
    const valid=()=>mounted.value&&sequence===current&&reader===identity()
    try{const value=await fetchV3Breezemoons(requested,size);if(valid())result.value=value}
    catch(err){if(valid()){const message=err instanceof Error?err.message:'清风明月读取失败';error.value=afterWrite?`操作已确认，列表读取失败：${message}`:message}}
    finally{if(valid())loading.value=false}
  }
  function move(value:number){if(loading.value||!result.value||value<1||value>Math.min(result.value.pageCount,42949672))return;page.value=value;void load()}
  function home(){page.value=1;void load()}
  watch([accessToken,()=>account.value?.oId],()=>{const next=identity();if(next===boundary)return;boundary=next;clear();page.value=1;void load()},{flush:'sync'})
  watch(()=>operations.revision,()=>{if(!mounted.value||!operations.lastOperation)return;clear();if(operations.lastOperation==='create')page.value=1;void load(true)},{flush:'sync'})
  onMounted(()=>{mounted.value=true;boundary=identity();loading.value=false;void load()})
  onBeforeUnmount(()=>{mounted.value=false;clear()})
  return{mounted,result,loading,error,page,load,move,home}
}
