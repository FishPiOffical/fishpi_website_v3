import { ApiError,request } from './http'
export const tagPrefix=(value:string)=>value.trim()
export function validTagPrefix(value:string){return value.length<=64&&/^[\u4e00-\u9fa5A-Za-z0-9_&#+.\-]*$/u.test(value)}
export async function tagSuggestions(value:string,signal?:AbortSignal):Promise<string[]>{
 const prefix=tagPrefix(value)
 if(!validTagPrefix(prefix))throw new ApiError('标签联想前缀不合法',422)
 const raw=await request<unknown>(`/api/v3/suggestions/tags?prefix=${encodeURIComponent(prefix)}`,{signal,cache:'no-store'})
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ApiError('标签联想响应不正确',502)
 const r=raw as Record<string,unknown>,data=r.data as Record<string,unknown>|null
 if(r.code!==0||!data||!Array.isArray(data.list)||data.list.length>7)throw new ApiError('标签联想响应不正确',502)
 const seen=new Set<string>()
 return data.list.map(value=>{if(typeof value!=='string'||!value||value.length>255||!/^[\u4e00-\u9fa5A-Za-z0-9_&#+.\-]+$/u.test(value)||!value.toLowerCase().startsWith(prefix.toLowerCase())||seen.has(value.toLowerCase()))throw new ApiError('标签联想响应不正确',502);seen.add(value.toLowerCase());return value})
}
