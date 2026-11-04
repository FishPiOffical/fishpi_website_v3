import {defineStore} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {createLegacyReactionReader,legacyToggleReaction,legacyReactionTarget,type LegacyReactionSource} from '@/api/legacy/reactions'
import type {ReactionTarget} from '@/api/v3-reactions'
import {useAuthStore} from './auth'
type Command={value:string;busy:boolean;error:string;verified:boolean}
export const useLegacyReactionsStore=defineStore('legacy-reactions',()=>{
 const auth=useAuthStore(),commands=ref<Record<string,Command>>({}),lastChange=ref({kind:'' as ReactionTarget|'',id:'',revision:0,confirmed:false}),reader=createLegacyReactionReader();let generation=0
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId||'']),active=()=>!import.meta.env.SSR&&getApiMode()==='v1',writable=()=>active()&&!!auth.apiKey&&!!auth.account?.oId
 function reset(){generation++;commands.value={};reader.clear();lastChange.value={kind:'',id:'',revision:lastChange.value.revision+1,confirmed:false}}
 const stop=watch(identity,reset,{flush:'sync'});onScopeDispose(()=>{stop();reset()})
 async function read(kind:ReactionTarget,id:string,source?:LegacyReactionSource){if(!active())throw new ApiError('表态尚未加载',409);const command=commands.value[kind+':'+id],run=generation,actor=identity();if(command)command.verified=false;const result=await reader.current(kind,id,source);if(run!==generation||actor!==identity())throw new ApiError('身份已变化',409);if(command&&!command.busy&&commands.value[kind+':'+id]===command)command.verified=true;return result}
 function invalidate(kind:ReactionTarget,id:string,confirmed=false){legacyReactionTarget(kind,id);reader.clear();lastChange.value={kind,id,confirmed,revision:lastChange.value.revision+1}}
 async function toggle(kind:ReactionTarget,id:string,value:string){if(!writable())return;legacyReactionTarget(kind,id);const key=kind+':'+id;if(commands.value[key])return;if(Object.keys(commands.value).length>=100)throw new ApiError('请先核对未完成的表态',409);const command:Command={value,busy:true,error:'',verified:false};commands.value[key]=command;const run=generation,actor=identity(),valid=()=>writable()&&run===generation&&actor===identity()
 try{await legacyToggleReaction(kind,id,value);if(valid()){delete commands.value[key];invalidate(kind,id,true)}}catch(e){if(valid()){command.error='本次切换结果未确认，请先重读当前表态核对；不要重复提交。';if(e instanceof ApiError&&[401,403,422].includes(e.status)){delete commands.value[key];throw e}}}finally{if(valid()&&commands.value[key])commands.value[key]!.busy=false}}
 function release(kind:ReactionTarget,id:string){const key=kind+':'+id;if(!commands.value[key]?.verified||commands.value[key]?.busy)return;delete commands.value[key];invalidate(kind,id)}
 return{commands,lastChange,read,invalidate,toggle,release}
})
