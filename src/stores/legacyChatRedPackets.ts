import {defineStore,storeToRefs} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {legacyPacketDetail,type LegacyPacketDetail} from '@/api/legacy/chat-red-packets'
import {useChatStore} from './chat'
import {useAuthStore} from './auth'
import {useLegacyChatActionsStore} from './legacyChatActions'
export const useLegacyChatRedPacketsStore=defineStore('legacy-chat-packets',()=>{
 const auth=useAuthStore(),chat=useChatStore(),actions=useLegacyChatActionsStore(),{busy,pending,completed}=storeToRefs(actions),selectedId=ref(''),detail=ref<LegacyPacketDetail|null>(null),loading=ref(false),detailError=ref('')
 let sequence=0,abort:AbortController|null=null
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId||'',auth.account?.userName||''])
 function close(){sequence++;abort?.abort();abort=null;selectedId.value='';detail.value=null;loading.value=false;detailError.value=''}
 async function open(id=selectedId.value){if(import.meta.env.SSR||getApiMode()!=='v1'||!auth.apiKey||!auth.account)return;close();selectedId.value=id;const reader=identity(),run=sequence,controller=new AbortController();abort=controller;loading.value=true;const valid=()=>run===sequence&&reader===identity()&&!controller.signal.aborted
 try{const value=await legacyPacketDetail(id,{id:auth.account.oId,userName:auth.account.userName},controller.signal);if(valid())detail.value=value}catch(e){if(valid())detailError.value=e instanceof Error?e.message:'红包读取失败'}finally{if(valid()){loading.value=false;abort=null}}}
 const stop=watch(identity,close,{flush:'sync'}),stopComplete=watch(completed,command=>{if(command?.kind==='packetClaim'&&selectedId.value===command.id)void open(command.id)})
 const stopChange=watch(()=>chat.changeHint,hint=>{if(selectedId.value&&hint&&(!hint.id||hint.id===selectedId.value))void open()},{flush:'sync'})
 onScopeDispose(()=>{stop();stopComplete();stopChange();close()})
 return{selectedId,detail,loading,detailError,open,close,busy,pending,completed,create:actions.createPacket,claim:actions.claimPacket}
})
