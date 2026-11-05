import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
import type { ContentRelationKind, ContentRelationState } from '../v3-content-relations'
const paths={tag:'follows/tags',collection:'collections',subscription:'subscriptions'} as const
const bad=()=>new ApiError('关系响应格式不正确',502,'invalid_response')
function row(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw bad();return value as Record<string,unknown>}
function id(value:string){if(!/^[1-9][0-9]{0,18}$/.test(value))throw new ApiError('关系目标不合法',422);return value}
function path(kind:ContentRelationKind,target:string){if(!Object.hasOwn(paths,kind))throw new ApiError('关系类型不合法',422);return `/api/v1/me/${paths[kind]}/${id(target)}`}
async function data(path:string,init:RequestInit={}){
 const key=getLegacyKey();if(!key)throw new ApiError('请先登录',401)
 let result:unknown
 try{result=await request(path,{...init,cache:'no-store',credentials:'omit',__captchaRetried:true,headers:{...init.headers,'X-Fishpi-Key':key}})}
 catch(error){if(key!==getLegacyKey())throw new ApiError('登录状态已变化',409);if(error instanceof ApiError&&[404,405,501].includes(error.status)&&error.code!=='not_found')throw new ApiError('当前服务器尚未提供此版本的关系服务',404,'v1_relations_unavailable');throw error}
 if(key!==getLegacyKey())throw new ApiError('登录状态已变化',409)
 const envelope=row(result);if(envelope.code!==0)throw bad();return row(envelope.data)
}
export async function resolveLegacyContentRelationTarget(kind:ContentRelationKind,value:string){
 if(kind!=='tag'){path(kind,value);return value}
 if(/^[1-9][0-9]{0,18}$/.test(value))return value
 if(!value||value.length>256||/[\u0000-\u001f\u007f]/.test(value))throw new ApiError('标签目标不合法',422)
 const result=await data('/api/v1/me/tag-target?'+new URLSearchParams({tag:value}));if(typeof result.targetId!=='string')throw bad();return id(result.targetId)
}
export async function readLegacyContentRelation(kind:ContentRelationKind,target:string):Promise<ContentRelationState>{const result=await data(path(kind,target));if(result.targetId!==target||typeof result.following!=='boolean')throw bad();return{targetId:target,following:result.following}}
export async function setLegacyContentRelation(kind:ContentRelationKind,target:string,following:boolean,key:string){
 if(typeof following!=='boolean'||!/^[A-Za-z0-9._:-]{1,128}$/.test(key))throw new ApiError('关系操作参数不合法',422)
 const result=await data(path(kind,target),{method:following?'PUT':'DELETE',headers:{'Idempotency-Key':key}})
 if(result.following!==following||typeof result.changed!=='boolean')throw bad()
}
