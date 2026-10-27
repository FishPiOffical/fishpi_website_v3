import { defineStore, storeToRefs } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { profileOperationKey } from '@/api/v3-profile'
import { reactionOptions, writeReaction, type ReactionOption, type ReactionTarget } from '@/api/v3-reactions'
import { useAuthStore } from '@/stores/auth'
type Command={choice:string|null;key:string;busy:boolean;error:string}
export const useV3ReactionsStore=defineStore('v3-reactions',()=>{
  const { accessToken,account }=storeToRefs(useAuthStore())
  const options=ref<ReactionOption[]>([]),commands=ref<Record<string,Command>>({})
  const lastChange=ref({kind:'' as ReactionTarget|'',id:'',confirmed:false,revision:0})
  let generation=0,boundary=getAuthContextVersion(),owner=account.value?.oId,flight:Promise<ReactionOption[]>|null=null
  function reset(){generation++;commands.value={};options.value=[];flight=null;lastChange.value={kind:'',id:'',confirmed:false,revision:lastChange.value.revision+1}}
  const stop=watch([accessToken,()=>account.value?.oId],()=>{const next=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||next!==boundary||owner!==actor)reset();boundary=next;owner=actor},{flush:'sync'})
  onScopeDispose(()=>{stop();reset()})
  async function loadOptions(){
    if(import.meta.env.SSR)throw new ApiError('表态目录尚未加载',409)
    if(options.value.length)return options.value
    if(flight)return flight
    const current=generation,context=getAuthContextVersion()
    const task=reactionOptions().then(value=>{if(current!==generation||context!==getAuthContextVersion())throw new ApiError('身份已变化，请重新读取',409);options.value=value;return value})
    flight=task
    try{return await task}finally{if(flight===task)flight=null}
  }
  function invalidate(kind:ReactionTarget,id:string,confirmed=false){if(!['article','comment','chat'].includes(kind)||typeof id!=='string'||! /^[1-9][0-9]{0,18}$/.test(id))return;lastChange.value={kind,id,confirmed,revision:lastChange.value.revision+1}}
  async function set(kind:ReactionTarget,id:string,choice:string|null){
    const actor=account.value?.oId,current=generation,context=getAuthContextVersion()
    const valid=()=>!import.meta.env.SSR&&!!accessToken.value&&!!actor&&actor===account.value?.oId&&current===generation&&context===getAuthContextVersion()
    if(!valid())return
    if(!['article','comment','chat'].includes(kind)||typeof id!=='string'||! /^[1-9][0-9]{0,18}$/.test(id))throw new ApiError('表态目标不合法',422)
    const identity=kind+':'+id,previous=commands.value[identity],recovering=!!previous
    if(previous?.busy)return
    if(previous&&previous.choice!==choice)throw new ApiError('请先确认上一次表态操作的结果',409)
    if(!previous&&Object.keys(commands.value).length>=100)throw new ApiError('请先恢复未完成的表态操作',409)
    if(!previous&&choice!==null&&!options.value.some(o=>o.value===choice))throw new ApiError('请选择目录中的表情',422)
    commands.value[identity]=previous||{choice,key:profileOperationKey(),busy:false,error:''}
    const command=commands.value[identity]!;command.busy=true;command.error=''
    try{await writeReaction(kind,id,command.choice,command.key,options.value);if(valid()){delete commands.value[identity];invalidate(kind,id,true)}}
    catch(reason){if(valid()){command.error=reason instanceof Error?reason.message:'表态失败';if(!recovering&&reason instanceof ApiError&&reason.status>=400&&reason.status<500)delete commands.value[identity];throw reason}}
    finally{if(valid()&&commands.value[identity]===command)command.busy=false}
  }
  return{options,commands,lastChange,loadOptions,invalidate,set}
})
