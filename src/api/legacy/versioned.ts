import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
/** Versioned classic JSON requests use a dedicated header, never an ambient session or Bearer. */
export async function legacyVersionedRequest(path:string,required=true,init:RequestInit={}):Promise<unknown>{
 if(!/^\/api\/v1\/(?:me|users|uploads)\//.test(path))throw new ApiError('接口路径不合法',422)
 const headers:Record<string,string>=init.headers?Object.fromEntries(new Headers(init.headers)):{}
 delete headers.cookie;delete headers.authorization;delete headers['x-fishpi-key']
 const key=getLegacyKey();if(required&&!key)throw new ApiError('请先登录查看本人记录',401)
 if(key)headers['X-Fishpi-Key']=key
 try{
  const result=await request(path,{...init,cache:'no-store',credentials:'omit',__captchaRetried:true,...(Object.keys(headers).length?{headers}:{})})
  if(key!==getLegacyKey())throw new ApiError('登录状态已变化',409)
  return result
 }catch(error){
  if(key!==getLegacyKey())throw new ApiError('登录状态已变化',409)
  if(error instanceof ApiError&&[404,405,501].includes(error.status)&&error.code!=='not_found')throw new ApiError('当前服务器尚未提供此版本的列表服务',404,'v1_saved_unavailable')
  throw error
 }
}
