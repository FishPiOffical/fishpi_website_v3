import {defineStore} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {legacyGameCommand,legacyWriteGame,type LegacyGameCommand,type LegacyGameReceipt} from '@/api/legacy/fish-game-writes'
import type {GameSubmission} from '@/api/v3-fish-games'
import {useAuthStore} from './auth'
export const useLegacyFishGamesStore=defineStore('legacy-fish-games-write',()=>{
 const auth=useAuthStore(),pending=ref<LegacyGameCommand|null>(null),completed=ref<LegacyGameCommand|null>(null),receipt=ref<LegacyGameReceipt|null>(null),busy=ref(false),error=ref(''),revision=ref(0);let generation=0
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId]),active=()=>!import.meta.env.SSR&&getApiMode()==='v1'&&!!auth.apiKey&&!!auth.account?.oId
 function clear(){generation++;pending.value=completed.value=null;receipt.value=null;busy.value=false;error.value=''}const stop=watch(identity,clear,{flush:'sync'});onScopeDispose(()=>{stop();clear()})
 async function execute(input:LegacyGameCommand){if(!active()||busy.value||pending.value)return null;let command:LegacyGameCommand;try{command=legacyGameCommand(input)}catch(e){error.value=e instanceof Error?e.message:'鱼游内容不合法';return null}const run=generation,reader=identity(),valid=()=>active()&&run===generation&&reader===identity();pending.value=command;completed.value=null;receipt.value=null;busy.value=true;error.value=''
 try{const result=await legacyWriteGame(command);if(!valid())return null;pending.value=null;completed.value=command;receipt.value=result;revision.value++;return result}
 catch(e){if(valid())error.value=(e instanceof Error?e.message:'鱼游操作失败')+'。旧接口没有幂等恢复，请核对后再解除锁定，勿重复提交。';return null}
 finally{if(valid())busy.value=false}}
 const submit=(body:GameSubmission,id='')=>execute({kind:id?'edit':'submit',id,body}),vote=(id:string,value:string)=>value==='like'||value==='dislike'?execute({kind:'vote',id,value}):Promise.resolve(null),comment=(id:string,content:string)=>execute({kind:'comment',id,content})
 function release(){if(!busy.value){pending.value=null;error.value=''}}function dismiss(){if(!busy.value&&!pending.value){completed.value=null;receipt.value=null;error.value=''}}
 return{pending,completed,receipt,busy,error,revision,submit,vote,comment,release,dismiss}
})
