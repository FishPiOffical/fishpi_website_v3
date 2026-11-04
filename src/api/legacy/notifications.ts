import {ApiError,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject,legacyDate} from './home'
import {notificationLink,type NotificationPage} from '../v3-notifications'
import type {NoticeItem,NoticeType,UnreadCount} from '../fishpi'
export const legacyNoticeCategories=['commented','reply','at','following','point','broadcast','sys-announce','other'] as const
const unreadKeys: (keyof UnreadCount)[]=['unreadNotificationCnt','unreadOtherNotificationCnt','unreadReplyNotificationCnt','unreadPointNotificationCnt','unreadAtNotificationCnt','unreadBroadcastNotificationCnt','unreadSysAnnounceNotificationCnt','unreadNewFollowerNotificationCnt','unreadFollowingNotificationCnt','unreadCommentedNotificationCnt']
function authorized(path:string){const key=getLegacyKey();if(!key)throw new ApiError('请先登录',401);return path+(path.includes('?')?'&':'?')+new URLSearchParams({apiKey:key})}
function count(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new ApiError('旧未读数格式不正确',502);return value}
function optionalText(row:Record<string,unknown>,key:string,max=65536){const v=row[key];if(v===undefined)return undefined;if(typeof v!=='string'||v.length>max)throw new ApiError('旧通知字段格式不正确',502);return v}
export function projectLegacyNotification(value:unknown):NoticeItem {
  const r=legacyObject(value),result:NoticeItem={}
  const rawId=optionalText(r,'oId',64)
  if(rawId!==undefined){if(!/^[1-9][0-9]{0,31}$/.test(rawId))throw new ApiError('旧通知ID无效',502);result.oId=rawId}
  if(typeof r.hasRead==='boolean')result.hasRead=r.hasRead
  for(const key of ['description','commentContent','content','articleTitle','commentArticleTitle','notificationTitle'] as const){const v=optionalText(r,key);if(v!==undefined)result[key]=v}
  const link=notificationLink(r.commentSharpURL ?? r.url)
  if(link)result.url=link
  const time=r.commentCreateTime ?? r.createTime
  if(time!==undefined)result.createTime=new Date(legacyDate(time)).toISOString()
  if(typeof r.dataType==='number'&&Number.isSafeInteger(r.dataType))result.dataType=r.dataType
  if(typeof r.contentAvailable==='boolean')result.contentAvailable=r.contentAvailable
  if(r.contentAvailable===false){result.description='相关内容不存在或不可访问';delete result.commentContent;delete result.content;delete result.articleTitle;delete result.commentArticleTitle;result.url='';return result}
  // A legacy target author is never an actor. Only an explicit actor object can supply action identity.
  if(r.actor && typeof r.actor==='object'&&!Array.isArray(r.actor)) {
    const actor=r.actor as Record<string,unknown>
    if(typeof actor.id==='string'&&/^[1-9][0-9]{0,31}$/.test(actor.id)&&typeof actor.userName==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(actor.userName)) {
      result.authorName=actor.userName
      if(typeof actor.userAvatarURL==='string' && actor.userAvatarURL.length<=2048 && !/[\u0000-\u0020\\]/.test(actor.userAvatarURL)){
        try{const image=new URL(actor.userAvatarURL);if(['http:','https:'].includes(image.protocol)&&!image.username&&!image.password)result.userAvatarURL=actor.userAvatarURL}catch{/* invalid image stays absent */}
      }
    }
  }
  return result
}
export async function legacyNotificationPage(type:NoticeType,p:number,size:number):Promise<NotificationPage> {
  if(!legacyNoticeCategories.includes(type)||!Number.isSafeInteger(p)||p<1||!Number.isSafeInteger(size)||size<1||size>50)throw new ApiError('通知分页参数不合法',422)
  const r=await request<{code:number;msg?:string;data?:unknown}>(authorized('/api/getNotifications?'+new URLSearchParams({type})),{cache:'no-store'})
  if(r.code!==0)throw new ApiError(r.msg || '通知读取失败',400)
  if(!Array.isArray(r.data)||r.data.length>10000)throw new ApiError('旧通知列表格式不正确',502)
  const list=r.data.map(projectLegacyNotification),ids=list.map(x=>x.oId).filter(Boolean)
  if(new Set(ids).size!==ids.length)throw new ApiError('旧通知列表重复',502)
  return {items:list.slice((p-1)*size,p*size),p,size,total:list.length,pageCount:Math.ceil(list.length/size)}
}
export async function legacyUnreadCount():Promise<UnreadCount> {
  const r=await request<Record<string,unknown>>(authorized('/notifications/unread/count'),{cache:'no-store'})
  if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'未读数读取失败',400)
  const source=r.data===undefined?r:legacyObject(r.data),result:UnreadCount={unreadNotificationCnt:count(source.unreadNotificationCnt)}
  for(const key of unreadKeys)if(source[key]!==undefined)result[key]=count(source[key])
  return result
}
export async function markLegacyNotices(type:NoticeType|'all') {
  if(type!=='all'&&!legacyNoticeCategories.includes(type))throw new ApiError('通知类型不合法',422)
  const r=await request<{code:number;msg?:string}>(authorized(type==='all'?'/notifications/all-read':'/notifications/make-read/'+type),{cache:'no-store'})
  if(typeof r.code!=='number')throw new ApiError('旧已读响应不完整',502)
  if(r.code!==0)throw new ApiError(r.msg || '标记已读失败',400)
}
export async function legacyPrivateUnread():Promise<number> {
  const r=await request<{code:number;data?:unknown;msg?:string}>(authorized('/chat/has-unread'),{cache:'no-store'})
  if(r.code!==0)throw new ApiError(r.msg || '私信未读数读取失败',400)
  if(typeof r.data==='number')return count(r.data)
  if(Array.isArray(r.data)&&r.data.length<=10000)return r.data.length
  throw new ApiError('旧私信未读数格式不正确',502)
}
