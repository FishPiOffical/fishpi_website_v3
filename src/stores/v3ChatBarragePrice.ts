import {defineStore,storeToRefs} from 'pinia'
import {ref,watch,onScopeDispose} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {barragePrice,type ChatBarragePrice} from '@/api/v3-chat-barrage'
import {useAuthStore} from '@/stores/auth'
export const useV3ChatBarragePriceStore=defineStore('v3-chat-barrage-price',()=>{
 const {accessToken,account}=storeToRefs(useAuthStore()),price=ref<ChatBarragePrice|null>(null),loading=ref(false),error=ref('')
 let sequence=0,abort:AbortController|null=null
 function clear(){sequence++;abort?.abort();abort=null;price.value=null;loading.value=false;error.value=''}
 async function read(){if(import.meta.env.SSR||!accessToken.value||!account.value?.oId)return;clear();const run=sequence,context=getAuthContextVersion(),owner=account.value.oId,controller=new AbortController();abort=controller;loading.value=true
 const valid=()=>run===sequence&&!controller.signal.aborted&&context===getAuthContextVersion()&&!!accessToken.value&&owner===account.value?.oId
 try{const result=await barragePrice(controller.signal);if(valid())price.value=result}catch(e){if(valid())error.value=e instanceof Error?e.message:'弹幕价格读取失败'}finally{if(valid()){loading.value=false;abort=null}}}
 const stop=watch([accessToken,()=>account.value?.oId],()=>{clear()},{flush:'sync'})
 onScopeDispose(()=>{stop();clear()});return{price,loading,error,read}
})
