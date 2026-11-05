import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { getApiMode } from '@/api/mode'
import { readLegacyArticleVote, toggleLegacyArticleUpVote } from '@/api/legacy/article-votes'
import { useAuthStore } from './auth'
type Command={up:boolean;busy:boolean;error:string;sent:boolean}
export const useLegacyArticleVotesStore=defineStore('legacy-article-votes',()=>{
 const auth=useAuthStore(),commands=ref<Record<string,Command>>({}),lastChange=ref({id:'',revision:0}),errors=ref<Record<string,string>>({});let generation=0
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId]),active=()=>!import.meta.env.SSR&&getApiMode()==='v1'&&!!auth.apiKey&&!!auth.account?.oId
 function clear(){generation++;commands.value={};errors.value={};lastChange.value={id:'',revision:lastChange.value.revision+1}}
 const stop=watch(identity,clear,{flush:'sync'});onScopeDispose(()=>{stop();clear()})
 async function set(id:string,up:boolean){
  if(!active()||commands.value[id]||Object.keys(commands.value).length>=100||!/^[1-9][0-9]{0,18}$/.test(id)||typeof up!=='boolean')return
  const reader=identity(),run=generation,valid=()=>active()&&run===generation&&reader===identity();delete errors.value[id]
  commands.value[id]={up,busy:true,error:'',sent:false};const command=commands.value[id]!
  try{
   const current=await readLegacyArticleVote(id);if(!valid())return
   if((current.vote==='up')!==up){command.sent=true;await toggleLegacyArticleUpVote(id);if(!valid())return}
   delete commands.value[id];lastChange.value={id,revision:lastChange.value.revision+1}
  }catch(failure){if(valid()){const message=failure instanceof Error?failure.message:'赞同操作失败';if(command.sent)command.error=message+'。旧切换结果未确认，已锁定操作；请先重读核对，不能自动重复提交。';else{delete commands.value[id];errors.value[id]=message+'。提交前状态读取失败，尚未发送投票。'}}}
  finally{if(valid()&&commands.value[id]===command)command.busy=false}
 }
 function release(id:string){if(commands.value[id]&&!commands.value[id]?.busy)delete commands.value[id]}
 return{commands,lastChange,errors,set,release}
})
