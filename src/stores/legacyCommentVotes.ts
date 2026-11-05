import {defineStore} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {createLegacyCommentVoteReader,toggleLegacyCommentVote} from '@/api/legacy/comment-votes'
import type {LegacyReactionSource} from '@/api/legacy/reactions'
import {useAuthStore} from './auth'
type Command={choice:'up'|'down'|null;busy:boolean;error:string;sent:boolean;verified:boolean}
export const useLegacyCommentVotesStore=defineStore('legacy-comment-votes',()=>{
 const auth=useAuthStore(),commands=ref<Record<string,Command>>({}),errors=ref<Record<string,string>>({}),lastChange=ref({id:'',revision:0}),reader=createLegacyCommentVoteReader();let generation=0
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId]),active=()=>!import.meta.env.SSR&&getApiMode()==='v1'&&!!auth.apiKey&&!!auth.account?.oId
 function clear(){generation++;commands.value={};errors.value={};reader.clear();lastChange.value={id:'',revision:lastChange.value.revision+1}}
 const stop=watch(identity,clear,{flush:'sync'});onScopeDispose(()=>{stop();clear()})
 async function read(id:string,source:LegacyReactionSource){if(!active())throw new ApiError('请先登录查看评论投票',401);const actor=identity(),run=generation,command=commands.value[id];if(command)command.verified=false;const state=await reader.read(id,source);if(!active()||actor!==identity()||run!==generation)throw new ApiError('身份已变化',409);if(command&&!command.busy&&commands.value[id]===command)command.verified=true;return state}
 async function set(id:string,choice:'up'|'down'|null,source:LegacyReactionSource){
  if(!active()||commands.value[id]||Object.keys(commands.value).length>=100||!/^[1-9][0-9]{0,31}$/.test(id)||!['up','down',null].includes(choice))return
  const actor=identity(),run=generation,valid=()=>active()&&actor===identity()&&run===generation,origin={...source}
  delete errors.value[id];commands.value[id]={choice,busy:true,error:'',sent:false,verified:false};const command=commands.value[id]!
  try{const current=await reader.read(id,origin);if(!valid())return
   if(current.vote!==choice){const toggle=choice??current.vote;if(toggle){command.sent=true;await toggleLegacyCommentVote(id,toggle);if(!valid())return}}
   delete commands.value[id];reader.clear();lastChange.value={id,revision:lastChange.value.revision+1}
  }catch(e){if(valid()){const message=e instanceof Error?e.message:'评论投票失败';if(command.sent)command.error=message+'。旧切换结果未确认，请重读核对，不要重复提交。';else{delete commands.value[id];errors.value[id]=message+'。提交前读取失败，尚未发送投票。'}}}
  finally{if(valid()&&commands.value[id]===command)command.busy=false}
 }
 function release(id:string){if(commands.value[id]?.verified&&!commands.value[id]?.busy){delete commands.value[id];lastChange.value={id,revision:lastChange.value.revision+1}}}
 return{commands,errors,lastChange,read,set,release}
})
