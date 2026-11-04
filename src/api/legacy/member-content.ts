import {ApiError,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject,legacyDate,legacyArticleSummary} from './home'
import {legacyPublicUser} from './public-user'
import {publicUserName} from '../v3-public-user'
import {decodeBreezemoon} from '../v3-breezemoon-data'
import type {MemberContentKind,MemberContentPage} from '../v3-member-content'
const bad=()=>new ApiError('旧用户内容响应不正确',502)
function text(v:unknown,max=262144){if(typeof v!=='string'||v.length>max)throw bad();return v}
function id(v:unknown){const s=text(v,32);if(!/^[1-9][0-9]{0,31}$/.test(s))throw bad();return s}
function count(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw bad();return v}
export async function legacyMemberContent(userName:string,kind:MemberContentKind,p=1):Promise<MemberContentPage>{
 publicUserName(userName);if(!['home','long','comments','breezemoons'].includes(kind)||!Number.isSafeInteger(p)||p<1||p>1000000)throw new ApiError('用户内容参数不合法',422)
 const key=getLegacyKey(),suffix=kind==='home'?'articles':kind,r=legacyObject(await request(`/api/user/${encodeURIComponent(userName)}/${suffix}?`+new URLSearchParams({p:String(p),size:'20',...(key?{apiKey:key}:{})}),{cache:'no-store'}));if(getLegacyKey()!==key)throw new ApiError('登录状态已变化',409);if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'用户内容读取失败',400)
 const d=legacyObject(r.data),meta=legacyObject(d.pagination),total=count(meta.paginationRecordCount),pageCount=count(meta.paginationPageCount),rows=d[kind==='home'||kind==='long'?'articles':kind]
 if(!Array.isArray(rows)||rows.length>20||(pageCount!==Math.ceil(total/20)&&!(total===0&&pageCount===1))||rows.length>total)throw bad()
 // Some old list methods lose total metadata on an empty out-of-range page.
 if(p>1&&rows.length===0&&total===0)throw new ApiError('旧接口没有保留此空页的总数，请返回第一页重读',409)
 if(meta.paginationCurrentPageNum!==undefined&&meta.paginationCurrentPageNum!==p||meta.paginationPageSize!==undefined&&meta.paginationPageSize!==20)throw bad()
 const result:MemberContentPage={p,size:20,total,pageCount,articles:[],comments:[],moons:[]},same=(v:unknown)=>typeof v==='string'&&v.toLowerCase()===userName.toLowerCase()
 if(kind==='home'||kind==='long')result.articles=rows.map(value=>{const article=legacyArticleSummary(value);if(article.articleAnonymous!==0||!same(article.articleAuthorName)||kind==='long'&&article.articleType!==6)throw bad();return article})
 else if(kind==='comments'){
  const owner=await legacyPublicUser(userName)
  result.comments=rows.map(value=>{const c=legacyObject(value),author=legacyObject(c.commenter);if(c.commentAnonymous!==0||c.commentAuthorId!==owner.id||author.oId!==owner.id||!same(author.userName)||![0,1].includes(c.commentVisible as number))throw bad();const commentId=id(c.oId),articleId=id(c.commentOnArticleId),visible=c.commentVisible===0
   return{id:commentId,articleId,article:{oId:articleId,articleTitle:text(c.commentArticleTitle,65536),articleIdentityUnavailable:true},comment:{oId:commentId,commentAuthorId:owner.id,commentAuthorName:owner.userName,commentAuthorNickname:owner.userNickname,commentAuthorThumbnailURL:owner.userAvatarURL,commentCreateTimeStr:new Date(legacyDate(c.commentCreateTimeStr??c.commentCreateTime)).toISOString(),commentContentVisible:visible,commentContent:visible?text(c.commentContent):''}}
  })
 }else{
  const owner=await legacyPublicUser(userName)
  result.moons=rows.map(value=>{const m=legacyObject(value);if(!same(m.breezemoonAuthorName))throw bad();return decodeBreezemoon({id:id(m.oId),content:text(m.breezemoonContentRaw,65536),contentHtml:text(m.breezemoonContent,65536),createdAt:legacyDate(m.breezemoonCreated),updatedAt:legacyDate(m.breezemoonUpdated),author:owner})})
 }
 const ids=[...result.articles.map(a=>a.oId),...result.comments.map(c=>c.id),...result.moons.map(m=>m.id)];if(new Set(ids).size!==ids.length)throw bad();if(getLegacyKey()!==key)throw new ApiError('登录状态已变化',409);return result
}
