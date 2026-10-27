import { ApiError, request } from './http'
import { decodeV3ContentPage } from './v3-content'
import { breezemoonId, decodeBreezemoon, type V3Breezemoon } from './v3-breezemoon-data'
export type BreezemoonPage={list:V3Breezemoon[];p:number;size:number;total:number;pageCount:number}
function row(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError('清风明月响应格式不正确',502);return value as Record<string,unknown>}
async function data(path:string,init?:Parameters<typeof request>[1]){const envelope=row(await request(path,init));if(envelope.code!==0)throw new ApiError('清风明月操作失败',400);return envelope.data}
function inputId(value:string):string{try{return breezemoonId(value)}catch{throw new ApiError('动态ID不合法',422)}}
export function trimBreezemoonInput(value:string):string{return value.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g,'')}
export function breezemoonContent(value:string):string{
  if(typeof value!=='string')throw new ApiError('内容不合法',422)
  const content=trimBreezemoonInput(value);if(!content||content.length>512||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(content)||Array.from(content).some(c=>c.length===1&&/[\ud800-\udfff]/u.test(c)))throw new ApiError('内容须为1至512个UTF-16字符，不含无效字符',422)
  return content
}
export async function fetchV3Breezemoons(p=1,size=20):Promise<BreezemoonPage>{
  if(!Number.isSafeInteger(p)||p<1||p>42949672||!Number.isSafeInteger(size)||size<1||size>50)throw new ApiError('分页参数不合法',422)
  const value=decodeV3ContentPage(await data(`/api/v3/breezemoons?p=${p}&size=${size}`,{cache:'no-store'}));if(value.pagination.p!==p||value.pagination.size!==size)throw new ApiError('分页响应不正确',502)
  const list=value.list.map(decodeBreezemoon);if(new Set(list.map(x=>x.id)).size!==list.length)throw new ApiError('清风明月列表重复',502)
  return{...value.pagination,list}
}
export async function fetchV3Breezemoon(id:string){return decodeBreezemoon(await data(`/api/v3/breezemoons/${inputId(id)}`,{cache:'no-store'}))}
export async function writeV3Breezemoon(operation:'create'|'update'|'delete',id:string,content:string,key:string):Promise<{id:string;authorId?:string}>{
  if(!['create','update','delete'].includes(operation)||!/^[A-Za-z0-9._:-]{1,128}$/.test(key))throw new ApiError('操作参数不合法',422)
  const target=operation==='create'?'':inputId(id),body=operation==='delete'?undefined:JSON.stringify({content:breezemoonContent(content)})
  const result=await data(`/api/v3/breezemoons${target?'/'+target:''}`,{method:operation==='create'?'POST':operation==='update'?'PUT':'DELETE',headers:{'Idempotency-Key':key},...(body===undefined?{}:{body})})
  if(operation==='delete'){row(result);return{id:target}}
  const value=decodeBreezemoon(result);if(target&&value.id!==target)throw new ApiError('操作目标响应不一致',502)
  return{id:value.id,authorId:value.author.id}
}
