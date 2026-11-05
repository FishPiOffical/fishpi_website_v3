import { ApiError, getAuthContextVersion, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
import { logTime, publicLogCategories, type PublicLogMetadata, type PublicLogPage } from '../v3-discovery-extras'
export async function legacyPublicLogMetadata(p=1):Promise<PublicLogPage>{
 if(!Number.isSafeInteger(p)||p<1||p>1000000)throw new ApiError('旧日志批次不合法',422)
 const key=getLegacyKey(),context=getAuthContextVersion();if(!key)throw new ApiError('请先登录查看公开日志',401)
 let envelope:unknown
 try{envelope=await request('/logs/more?'+new URLSearchParams({page:String(p),pageSize:'20',apiKey:key}),{cache:'no-store',redirect:'error'})}
 catch(error){if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409);throw new ApiError('公开日志读取失败，请稍后重试',error instanceof ApiError?error.status:502)}
 const result=legacyObject(envelope)
 if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409)
 if(result.code!==0)throw new ApiError('公开日志读取失败，请稍后重试',400)
 if(!Array.isArray(result.data)||result.data.length>20)throw new ApiError('旧公开日志响应不正确',502)
 const list:PublicLogMetadata[]=[],seen=new Set<string>()
 for(const value of result.data){
  const row=legacyObject(value),id=row.oId
  if(typeof id!=='string'||!/^[1-9][0-9]{0,18}$/.test(id)||seen.has(id)||row.public!==true)throw new ApiError('旧公开日志范围不正确',502)
  seen.add(id)
  // Unknown event kinds may contain arbitrary data. Do not render their labels or body.
  if(row.type!=='simple'||!publicLogCategories.includes(row.key3 as PublicLogMetadata['category']))continue
  list.push({id,time:logTime(row.key1),category:row.key3 as PublicLogMetadata['category']})
 }
 return{p,size:20,total:null,pageCount:null,sourceCount:result.data.length,list}
}
