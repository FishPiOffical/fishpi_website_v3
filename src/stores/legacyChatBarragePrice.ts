import {defineStore,storeToRefs} from 'pinia'
import {ref,watch,onScopeDispose} from 'vue'
import {getApiMode} from '@/api/mode'
import {getAuthContextVersion} from '@/api/http'
import {legacyBarragePrice} from '@/api/legacy/chat-barrage'
import {useAuthStore} from '@/stores/auth'
export const useLegacyChatBarragePriceStore=defineStore('legacy-chat-barrage-price',()=>{
 const {apiKey,account}=storeToRefs(useAuthStore()),price=ref<{amount:number;unit:string}|null>(null),loading=ref(false),error=ref('')
 let sequence=0,abort:AbortController|null=null
 function clear(){sequence++;abort?.abort();abort=null;price.value=null;loading.value=false;error.value=''}
 async function read(){if(import.meta.env.SSR||getApiMode()!=='v1'||!apiKey.value||!account.value?.oId)return;clear();const credential=apiKey.value,run=sequence,context=getAuthContextVersion(),owner=account.value.oId,controller=new AbortController();abort=controller;loading.value=true
 const valid=()=>run===sequence&&!controller.signal.aborted&&context===getAuthContextVersion()&&credential===apiKey.value&&owner===account.value?.oId
 try{const result=await legacyBarragePrice(controller.signal);if(valid())price.value=result}catch(e){if(valid())error.value=e instanceof Error?e.message:'弹幕价格读取失败'}finally{if(valid()){loading.value=false;abort=null}}}
 const stop=watch([apiKey,()=>account.value?.oId],()=>{clear()},{flush:'sync'})
 onScopeDispose(()=>{stop();clear()});return{price,loading,error,read}
})
