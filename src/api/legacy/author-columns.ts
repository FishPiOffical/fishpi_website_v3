import {ApiError,getAuthContextVersion,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
import {decodeEntities} from '../../utils/text'
import type {AuthorColumnSnapshot} from '../v3-author-columns'
const bad=()=>new ApiError('旧本人专栏响应不正确',502)
export async function legacyAuthorColumns(owner:string,signal?:AbortSignal):Promise<AuthorColumnSnapshot>{
 if(typeof owner!=='string'||!/^[1-9][0-9]{0,18}$/.test(owner))throw new ApiError('本人身份不正确',422)
 const key=getLegacyKey(),context=getAuthContextVersion()
 if(!key)throw new ApiError('请先登录查看本人专栏',401)
 const envelope=legacyObject(await request('/api/columns/mine?'+new URLSearchParams({size:'100',apiKey:key}),{signal,cache:'no-store',redirect:'error'}))
 if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409)
 if(envelope.code!==0)throw new ApiError(typeof envelope.msg==='string'?envelope.msg:'本人专栏读取失败',400)
 if(!Array.isArray(envelope.data)||envelope.data.length>100)throw bad()
 const seen=new Set<string>()
 const list=envelope.data.map(value=>{const c=legacyObject(value)
  if(typeof c.oId!=='string'||!/^[1-9][0-9]{0,18}$/.test(c.oId)||seen.has(c.oId)||c.columnAuthorId!==owner||c.columnStatus!==0||typeof c.columnTitle!=='string'||c.columnTitle.length>65536||typeof c.columnArticleCount!=='number'||!Number.isSafeInteger(c.columnArticleCount)||c.columnArticleCount<0)throw bad()
  seen.add(c.oId);return{id:c.oId,title:decodeEntities(c.columnTitle),articleCount:c.columnArticleCount}
 })
 return{list,pagination:null,limit:100}
}
