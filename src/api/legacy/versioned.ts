import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
/** Versioned classic JSON requests use a dedicated header, never an ambient session or Bearer. */
export async function legacyVersionedRequest(path:string,required=true):Promise<unknown>{
 if(!/^\/api\/v1\/(?:me|users)\//.test(path))throw new ApiError('接口路径不合法',422)
 const key=getLegacyKey();if(required&&!key)throw new ApiError('请先登录查看本人记录',401)
 try{
  const result=await request(path,{cache:'no-store',credentials:'omit',__captchaRetried:true,...(key?{headers:{'X-Fishpi-Key':key}}:{})})
  if(key!==getLegacyKey())throw new ApiError('登录状态已变化',409)
  return result
 }catch(error){
  if(key!==getLegacyKey())throw new ApiError('登录状态已变化',409)
  if(error instanceof ApiError&&[404,405,501].includes(error.status)&&error.code!=='not_found')throw new ApiError('当前服务器尚未提供此版本的列表服务',404,'v1_saved_unavailable')
  throw error
 }
}
