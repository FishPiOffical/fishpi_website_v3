import {ApiError,getAuthContextVersion,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyArticleSummary,legacyObject} from './home'
import {projectLegacyMoons} from './breezemoons'
import type {FollowingSource,FollowingFeedResult} from '../v3-following-feed'
const bad=()=>new ApiError('旧关注动态响应格式不正确',502)
function count(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw bad();return v}
export async function legacyFollowingFeed(userName:string,source:FollowingSource,p=1,size=20):Promise<FollowingFeedResult>{
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(userName)||!['tags','users','breezemoons'].includes(source)||!Number.isSafeInteger(p)||p<1||p>42949672||!Number.isSafeInteger(size)||size<1||size>50)throw new ApiError('关注动态参数不合法',422)
  const key=getLegacyKey(),context=getAuthContextVersion()
  if(!key)throw new ApiError('请先登录查看关注动态',401)
  if(source!=='breezemoons'&&p!==1)throw new ApiError('旧接口仅提供最近一页文章动态，没有后续分页',501)
  const path=source==='breezemoons'?'/api/watch/breezemoons':`/api/user/${encodeURIComponent(userName)}/watching`
  const envelope=legacyObject(await request(path+'?'+new URLSearchParams({p:String(p),size:String(size),apiKey:key}),{cache:'no-store',redirect:'error'}))
  if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409)
  if(envelope.code!==0)throw new ApiError(typeof envelope.msg==='string'?envelope.msg:'关注动态读取失败',envelope.msg==='对方设置了隐私权限'?403:400)
  const data=legacyObject(envelope.data)
  if(source!=='breezemoons'){
    const rows=data[source==='tags'?'followingTagArticles':'followingUserArticles']
    if(!Array.isArray(rows)||rows.length>size)throw bad()
    const list=rows.map(value=>legacyArticleSummary(value))
    if(new Set(list.map(value=>value.oId)).size!==list.length)throw bad()
    return{source,list,p:1,size,total:null,pageCount:null}
  }
  const meta=legacyObject(data.pagination),total=count(meta.paginationRecordCount),pageCount=count(meta.paginationPageCount),rows=data.breezemoons
  if(!Array.isArray(rows)||pageCount!==Math.ceil(total/size)||rows.length>size)throw bad()
  if(p>1&&!rows.length&&total===0)throw new ApiError('旧接口未保留空页总数，请返回第一页重读',409)
  if(rows.length!==Math.max(0,Math.min(size,total-(p-1)*size))||meta.paginationCurrentPageNum!==undefined&&meta.paginationCurrentPageNum!==p||meta.paginationPageSize!==undefined&&meta.paginationPageSize!==size)throw bad()
  const list=(await projectLegacyMoons(rows,context,key)).map(({content,...summary})=>summary)
  return{source,list,p,size,total,pageCount}
}
