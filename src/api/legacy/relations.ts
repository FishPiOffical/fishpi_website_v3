import {ApiError,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject,legacyArticleSummary} from './home'
import {decodeV3RelationUser,relationUserName,type RelationKind,type RelationPage} from '../v3-user-relations'
import type {SavedKind,SavedPage} from '../v3-saved-content'
const bad=()=>new ApiError('旧关系列表响应不正确',502)
function count(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw bad();return v}
function text(v:unknown,max=65536){if(typeof v!=='string'||v.length>max)throw bad();return v}
function id(v:unknown){const s=text(v,32);if(!/^[1-9][0-9]{0,31}$/.test(s))throw bad();return s}
async function read(userName:string,suffix:string,p:number,size:number){if(!relationUserName(userName)||!Number.isSafeInteger(p)||p<1||p>1000000||!Number.isSafeInteger(size)||size<1||size>50)throw new ApiError('用户列表参数不合法',422);const key=getLegacyKey(),r=legacyObject(await request(`/api/user/${encodeURIComponent(userName)}/${suffix}?`+new URLSearchParams({p:String(p),size:String(size),...(key?{apiKey:key}:{})}),{cache:'no-store'}));if(key!==getLegacyKey())throw new ApiError('登录状态已变化',409);if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'用户列表读取失败',400);const data=legacyObject(r.data),meta=legacyObject(data.pagination),total=count(meta.paginationRecordCount),pageCount=count(meta.paginationPageCount);if(pageCount!==Math.ceil(total/size)||meta.paginationCurrentPageNum!==undefined&&meta.paginationCurrentPageNum!==p)throw bad();return{data,p,size,total,pageCount}}
function rows(v:unknown,size:number,total:number){if(!Array.isArray(v)||v.length>size||v.length>total)throw bad();return v}
function unique(list:{id:string}[]){if(new Set(list.map(v=>v.id)).size!==list.length)throw bad()}
export async function legacyUserRelations(userName:string,kind:RelationKind,p=1,size=20):Promise<RelationPage>{if(!['following','followers'].includes(kind))throw new ApiError('关系类型不合法',422);const {data,...pagination}=await read(userName,kind==='following'?'following/users':'followers',p,size),list=rows(data.users,size,pagination.total).map(v=>{const r=legacyObject(v);return decodeV3RelationUser({id:r.oId,userName:r.userName,userNickname:r.userNickname,userAvatarURL:r.userAvatarURL48||r.userAvatarURL})});unique(list);return{...pagination,list}}
export async function legacySavedContent(userName:string,kind:SavedKind,owner:boolean,p=1,size=20):Promise<SavedPage>{
 if(!['tags','collections','subscriptions'].includes(kind)||typeof owner!=='boolean')throw new ApiError('关注内容类型不合法',422)
 if(kind==='subscriptions')throw new ApiError('旧接口没有独立的订阅文章JSON列表；关注动态不能替代订阅记录',501)
 if(owner&&!getLegacyKey())throw new ApiError('请先登录查看本人收藏',401)
 const {data,...pagination}=await read(userName,kind==='tags'?'following/tags':'following/articles',p,size)
 if(kind==='tags'){const list=rows(data.tags,size,pagination.total).map(value=>{const r=legacyObject(value),uri=text(r.tagURI,256);if(!uri||/[\u0000-\u001f\u007f]/u.test(uri))throw bad();return{id:id(r.oId),uri,title:text(r.tagTitle),description:text(r.tagDescription),articleCount:count(r.tagReferenceCount),followerCount:count(r.tagFollowerCount)}});unique(list);return{...pagination,kind,list}}
 const list=rows(data.articles,size,pagination.total).map(value=>{const r=legacyObject(value),articleId=id(r.oId);if(r.articleStatus!==undefined&&![0,1].includes(r.articleStatus as number))throw bad();if(r.articleStatus===1||r.articleType===2)return{id:articleId,available:false as const};const article=legacyArticleSummary(r);return{id:articleId,available:true as const,article}});unique(list);return{...pagination,kind,list}
}
