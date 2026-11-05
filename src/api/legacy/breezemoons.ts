import { ApiError, getAuthContextVersion, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject, legacyDate } from './home'
import { fetchPublicUser } from '../v3-public-user'
import type { RelationUser } from '../v3-user-relations'
export interface LegacyMoon {id:string;content:string;contentHtml:string;createdAt:number;updatedAt:number;author:RelationUser}
export interface LegacyMoonPage {list:LegacyMoon[];p:number;size:number}
function text(value:unknown) {if(typeof value!=='string'||value.length>65536)throw new ApiError('旧清风字段格式不正确',502);return value}
function id(value:unknown) {const s=text(value);if(!/^[1-9][0-9]{0,18}$/.test(s))throw new ApiError('动态ID不合法',422);return s}
export async function legacyMoonPage(p=1,size=20):Promise<LegacyMoonPage> {
  if(!Number.isSafeInteger(p)||p<1||p>1000000||!Number.isSafeInteger(size)||size<1||size>50)throw new ApiError('清风分页参数不合法',422)
  const context=getAuthContextVersion(),key=getLegacyKey()
  const envelope=await request<{code:number;msg?:string;breezemoons?:unknown[]}>(`/api/breezemoons?p=${p}&size=${size}${key?'&'+new URLSearchParams({apiKey:key}):''}`,{cache:'no-store'})
  if(envelope.code!==0)throw new ApiError(envelope.msg || '清风读取失败',400)
  if(!Array.isArray(envelope.breezemoons)||envelope.breezemoons.length>size)throw new ApiError('旧清风列表格式不正确',502)
  return {list:await projectLegacyMoons(envelope.breezemoons,context,key),p,size}
}
export async function projectLegacyMoons(rows:unknown[],context:number,key:string|null):Promise<LegacyMoon[]> {
  if(rows.length>50)throw new ApiError('旧清风列表过大',502)
  const names=new Map<string,Promise<RelationUser>>()
  const raw=rows.map(legacyObject)
  const unique=[...new Set(raw.map(r=>text(r.breezemoonAuthorName)))]
  // Bounded batches, no full legacy profiles or cross-reader cache.
  for(let start=0;start<unique.length;start+=4) {
    if(context!==getAuthContextVersion()||key!==getLegacyKey())throw new ApiError('登录状态已变化',401)
    const batch=unique.slice(start,start+4).map(name=>{const task=fetchPublicUser(name).then(u=>({id:u.id,userName:u.userName,userNickname:u.userNickname,userAvatarURL:u.userAvatarURL}));names.set(name,task);return task})
    await Promise.all(batch)
  }
  const list=await Promise.all(raw.map(async r=>({id:id(r.oId),content:text(r.breezemoonContentRaw),contentHtml:text(r.breezemoonContent),createdAt:legacyDate(r.breezemoonCreated),updatedAt:legacyDate(r.breezemoonUpdated),author:await names.get(text(r.breezemoonAuthorName))!})))
  if(new Set(list.map(x=>x.id)).size!==list.length)throw new ApiError('旧清风列表重复',502)
  if(context!==getAuthContextVersion()||key!==getLegacyKey())throw new ApiError('登录状态已变化',401)
  return list
}
export type LegacyMoonCommand={kind:'create'|'update'|'delete';id:string;content:string}
export async function writeLegacyMoon(command:LegacyMoonCommand) {
  const key=getLegacyKey();if(!key)throw new ApiError('请先登录',401)
  if(!['create','update','delete'].includes(command.kind))throw new ApiError('清风操作不合法',422)
  if(command.kind!=='create')id(command.id)
  if(command.kind!=='delete' && (typeof command.content!=='string'||!command.content.trim()||command.content.length>512))throw new ApiError('内容须为1～512字符',422)
  const path='/breezemoon'+(command.kind==='create'?'':'/'+command.id)
  const response=await request<{code:number;msg?:string}>(path,{method:command.kind==='create'?'POST':command.kind==='update'?'PUT':'DELETE',body:JSON.stringify({apiKey:key,...(command.kind==='delete'?{}:{breezemoonContent:command.content})})})
  if(typeof response.code!=='number')throw new ApiError('旧清风操作响应不完整',502)
  if(response.code!==0)throw new ApiError(response.msg || '清风操作未成功',400)
  return {ok:true}
}
