import { ApiError, request } from './http'
export type ReactionTarget = 'article' | 'comment' | 'chat'
export type ReactionOption = { value:string; emoji:string }
export type ReactionState = { targetId:string; targetType:ReactionTarget; currentUserReaction:string; summary:{ value:string; emoji:string; count:number; selected:boolean; users:string[] }[] }
const bad=()=>new ApiError('表态响应不正确',502)
function row(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw bad();return v as Record<string,unknown>}
function string(v:unknown,max:number){if(typeof v!=='string'||!v.length||v.length>max||/[\u0000-\u001f\u007f-\u009f]/u.test(v))throw bad();return v}
function data(raw:unknown){const value=row(raw);if(value.code!==0)throw bad();return row(value.data)}
function path(kind:ReactionTarget,id:string){if(!['article','comment','chat'].includes(kind)||typeof id!=='string'||! /^[1-9][0-9]{0,18}$/.test(id))throw new ApiError('表态目标不合法',422);return `/api/v3/${kind==='chat'?'chat/messages':kind+'s'}/${id}/reactions`}
export async function reactionOptions():Promise<ReactionOption[]>{
  const list=data(await request('/api/v3/reactions/emojis',{cache:'no-store'})).list
  if(!Array.isArray(list)||!list.length||list.length>256)throw bad()
  const seen=new Set<string>()
  return list.map(v=>{const r=row(v),value=string(r.value,32),emoji=string(r.emoji,128);if(value!==value.trim()||seen.has(value))throw bad();seen.add(value);return{value,emoji}})
}
function decode(raw:unknown,kind:ReactionTarget,id:string,options:ReactionOption[]):ReactionState{
  const r=data(raw),catalog=new Map(options.map(o=>[o.value,o.emoji]))
  if(r.targetId!==id||r.targetType!==kind||r.groupType!=='emoji'||typeof r.currentUserReaction!=='string'||r.currentUserReaction!==''&&!catalog.has(r.currentUserReaction)||!Array.isArray(r.summary)||r.summary.length>options.length)throw bad()
  const current=r.currentUserReaction,seen=new Set<string>()
  const summary=r.summary.map(v=>{const s=row(v);if(typeof s.value!=='string'||!catalog.has(s.value)||seen.has(s.value)||typeof s.count!=='number'||!Number.isSafeInteger(s.count)||s.count<1||typeof s.selected!=='boolean'||s.selected!==(s.value===current)||!Array.isArray(s.users)||s.users.length>10000)throw bad();seen.add(s.value)
    return{value:s.value,emoji:catalog.get(s.value)!,count:s.count,selected:s.value===current,users:s.users.map(u=>string(u,1024))}
  })
  if(current&&!seen.has(current))throw bad()
  return{targetId:id,targetType:kind,currentUserReaction:current,summary}
}
export async function readReactions(kind:ReactionTarget,id:string,options:ReactionOption[]){return decode(await request(path(kind,id),{cache:'no-store'}),kind,id,options)}
export async function writeReaction(kind:ReactionTarget,id:string,choice:string|null,key:string,options:ReactionOption[]):Promise<void>{
  if(!/^[A-Za-z0-9._:-]{1,128}$/.test(key)||choice!==null&&!options.some(o=>o.value===choice))throw new ApiError('表态参数不合法',422)
  const raw=await request(path(kind,id),{method:choice===null?'DELETE':'PUT',headers:{'Idempotency-Key':key},...(choice===null?{}:{body:JSON.stringify({value:choice})})})
  const state=decode(raw,kind,id,options)
  if(typeof data(raw).changed!=='boolean'||state.currentUserReaction!==(choice??''))throw bad()
}
