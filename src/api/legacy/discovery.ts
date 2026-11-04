import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyGet, legacyObject, legacyArticleSummary } from './home'
import { decodeV3RelationUser } from '../v3-user-relations'
import { repeaterEntry, type RepeaterEntry, type RepeaterKind } from '../v3-repeater'
import type { RankingType } from '../v3-rankings'
function privatePath(path:string) {const key=getLegacyKey();return path+(key?(path.includes('?')?'&':'?')+new URLSearchParams({apiKey:key}):'')}
export function legacyRepeaterEntry(value:unknown):RepeaterEntry {
  const r=legacyObject(value)
  return repeaterEntry({id:r.oId,type:r.repeaterContentType,content:r.repeaterContent,likeCount:r.repeaterContentLikeCount,liked:r.repeaterContentLiked,
    createdTime:r.repeaterContentCreatedTime,author:typeof r.repeaterContentAuthorId==='string' && r.repeaterContentAuthorId?{id:r.repeaterContentAuthorId,name:r.repeaterContentAuthorName}:null})
}
export async function legacyRepeaterList(type:RepeaterKind,size:number,signal?:AbortSignal) {
  const q=new URLSearchParams({size:String(size)});if(type)q.set('type',type)
  const key=getLegacyKey();if(key)q.set('apiKey',key)
  const r=await request<{code:number;data?:unknown}>('/api/repeater/items?'+q,{cache:'no-store',signal})
  if(r.code!==0) throw new ApiError('复读机读取失败',400)
  const d=legacyObject(r.data)
  if(!Array.isArray(d.items)||d.items.length>50) throw new ApiError('旧复读机列表格式不正确',502)
  const list=d.items.map(legacyRepeaterEntry)
  if(new Set(list.map(x=>x.id)).size!==list.length||type&&list.some(x=>x.type!==type)) throw new ApiError('旧复读机类型或列表重复',502)
  return list.slice(0,size)
}
export async function legacyRepeaterNext(type:RepeaterKind,exclude:string,signal?:AbortSignal) {
  const q=new URLSearchParams();if(type)q.set('type',type);if(exclude)q.set('excludeId',exclude)
  const r=await request<{code:number;data?:unknown}>(privatePath('/api/repeater/next?'+q),{cache:'no-store',signal})
  if(r.code!==0) throw new ApiError('复读机读取失败',400)
  const d=legacyObject(r.data)
  if(d.item===null)return null
  const item=legacyRepeaterEntry(d.item)
  if(item.id===exclude||type&&item.type!==type)throw new ApiError('旧复读机随机项响应不正确',502)
  return item
}
const metricFields:Partial<Record<RankingType,string>>={checkin:'userCurrentCheckinStreak',online:'onlineMinute',balance:'userPoint',consumption:'userUsedPoint',perfect:'userPerfectArticleCount',invite:'userInviteUserCount'}
const metricNames:Partial<Record<RankingType,string>>={checkin:'streak',online:'minutes',balance:'points',consumption:'points',perfect:'count',invite:'count'}
export async function legacyRanking(type:RankingType,p:number,size:number) {
  const field=metricFields[type],name=metricNames[type]
  if(!field||!name) throw new ApiError('该榜单的 v1 适配尚未完成',501)
  const d=legacyObject(await legacyGet(privatePath('/api/top/'+type)))
  if(!Array.isArray(d.list)||d.list.length>10000) throw new ApiError('旧榜单响应异常',502)
  // Legacy endpoint is a finite snapshot and ignores size/page. Paginate only that actual snapshot.
  const list=d.list.map((item,index)=>{
    const r=legacyObject(item),score=r[field]
    if(typeof score!=='number'||!Number.isSafeInteger(score)||score<0) throw new ApiError('旧榜单数值不可用',502)
    return {rank:index+1,score,metrics:{[name]:score},user:decodeV3RelationUser({id:r.oId,userName:r.userName,userNickname:r.userNickname,userAvatarURL:r.userAvatarURL})}
  })
  if(new Set(list.map(x=>x.user.id)).size!==list.length)throw new ApiError('旧榜单用户重复',502)
  return {type,subType:'',p,size,total:list.length,pageCount:Math.ceil(list.length/size),list:list.slice((p-1)*size,p*size)}
}
export async function legacyRandom(size:number,excludeId:string) {
  const r=await request<{articles?:unknown[];code?:number}>(privatePath(`/article/random/${size}`),{cache:'no-store'})
  if(r.code && r.code!==0 || !Array.isArray(r.articles) || r.articles.length>size)throw new ApiError('旧随机文章响应不正确',502)
  const list=r.articles.map(legacyArticleSummary)
  if(new Set(list.map(x=>x.oId)).size!==list.length) throw new ApiError('旧随机文章列表重复',502)
  return list.filter(x=>x.oId!==excludeId)
}
