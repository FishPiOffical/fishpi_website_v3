import {getApiMode} from '@/api/mode'
import {useLegacyRepeaterStore} from '@/stores/legacyRepeater'
import {onMounted,onScopeDispose,ref,watch,type Ref} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {repeaterInitial,repeaterList,repeaterNext,type RepeaterEntry,type RepeaterKind} from '@/api/v3-repeater'
import {useAuthStore} from '@/stores/auth'
import {useV3RepeaterStore} from '@/stores/v3Repeater'
export function useRepeaterFeed(type:Ref<RepeaterKind>,initial:unknown){
 const credential=()=>getApiMode()==='v1'?auth.apiKey:auth.accessToken
 const auth=useAuthStore(),writes=getApiMode()==='v1'?useLegacyRepeaterStore():useV3RepeaterStore(),items=ref<RepeaterEntry[]>([]),loading=ref(false),error=ref(''),ready=ref(false)
 let mounted=false,sequence=0,abort:AbortController|null=null,attempt:{kind:'list'}|{kind:'next';exclude:string}={kind:'list'},hasInitial=false
 try{if(initial!==null&&initial!==undefined){items.value=repeaterInitial(initial).map(v=>({...v,liked:false}));if(type.value&&items.value.some(v=>v.type!==type.value))throw Error('初始复读类型不匹配');hasInitial=true;ready.value=true}}catch{items.value=[]}
 function clear(){sequence++;abort?.abort();abort=null;items.value=[];loading.value=false;error.value='';ready.value=false}
 async function read(command:typeof attempt={kind:'list'}){if(import.meta.env.SSR||!mounted)return;clear();const run=sequence,reader=getAuthContextVersion(),owner=auth.account?.oId,credentialValue=credential(),kind=type.value,controller=new AbortController();abort=controller;attempt=command;loading.value=true;const valid=()=>mounted&&sequence===run&&!controller.signal.aborted&&reader===getAuthContextVersion()&&owner===auth.account?.oId&&credentialValue===credential()&&kind===type.value
 try{const result=command.kind==='list'?await repeaterList(kind,12,controller.signal):await repeaterNext(kind,command.exclude,controller.signal);if(valid()){items.value=Array.isArray(result)?result:result?[result]:[];ready.value=true}}catch(e){if(valid())error.value=e instanceof Error?e.message:'复读机读取失败'}finally{if(valid()){loading.value=false;abort=null}}}
 const stop=watch([credential,()=>auth.account?.oId,type],()=>{clear();if(mounted)void read()},{flush:'sync'}),stopWrites=watch(()=>writes.revision,()=>{if(mounted)void read()})
 onMounted(()=>{mounted=true;if(credential()||!hasInitial)void read()})
 onScopeDispose(()=>{mounted=false;stop();stopWrites();clear()})
 return{items,loading,error,ready,refresh:()=>read(),next:()=>read({kind:'next',exclude:items.value[0]?.id||''}),retry:()=>read(attempt)}
}
