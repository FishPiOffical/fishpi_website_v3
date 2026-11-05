import {ApiError,getAuthContextVersion,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject,legacyDate} from './home'
import {legacyComment,legacyArticleColumnView} from './content'
const bad=()=>new ApiError('旧段评响应格式不正确',502)
function article(value:string){if(typeof value!=='string'||!/^[1-9][0-9]{0,31}$/.test(value))throw new ApiError('文章ID不合法',422);return value}
function anchor(value:string){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new ApiError('段落锚点不合法',422);return value}
function count(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw bad();return value}
function reader(signal?:AbortSignal){
 const key=getLegacyKey(),context=getAuthContextVersion()
 const current=()=>{signal?.throwIfAborted();if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409)}
 current();return{key,current}
}
async function read(path:string,input:Record<string,unknown>,signal?:AbortSignal){
 const {key,current}=reader(signal)
 const value=await request(path,{method:'POST',body:JSON.stringify({...input,...(key?{apiKey:key}:{})}),cache:'no-store',redirect:'error',signal})
 current();const r=legacyObject(value);if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'段评读取失败',400);return r
}
export async function legacyParagraphSummary(articleId:string){const r=await read('/comment/paragraph/summary',{articleId:article(articleId)});if(!Array.isArray(r.paragraphComments)||r.paragraphComments.length>50000)throw bad();const seen=new Set<string>();return r.paragraphComments.map(v=>{const item=legacyObject(v),paragraphId=anchor(item.paragraphId as string);if(seen.has(paragraphId))throw bad();seen.add(paragraphId);return{paragraphId,commentCount:count(item.commentCount)}})}
export async function legacyParagraphComments(articleId:string,paragraphId:string,p=1,sort='oldest',state:'active'|'orphaned'='active'){
 article(articleId);anchor(paragraphId);if(!Number.isSafeInteger(p)||p<1||p>1000000||!['oldest','latest','hot'].includes(sort)||!['active','orphaned'].includes(state))throw new ApiError('段评分页或排序不合法',422)
 if(state==='orphaned')throw new ApiError('旧接口暂不支持按失效段落读取段评，请回到当前段落查看',501)
 const r=await read('/comment/paragraph/thread/parents',{articleId,paragraphId,paginationCurrentPageNum:p,userCommentViewMode:sort==='latest'?1:0,sort:sort==='hot'?'hot':''}),pagination=legacyObject(r.pagination)
 if(r.paragraphId!==paragraphId||typeof r.paragraphSnapshot!=='string'||r.paragraphSnapshot.length>65536||!Array.isArray(r.commentThreadParents)||r.commentThreadParents.length>100)throw bad()
 const current=count(pagination.paginationCurrentPageNum),size=count(pagination.paginationPageSize),total=count(pagination.paginationRecordCount),pages=count(pagination.paginationPageCount)
 if(current!==p)throw new ApiError('段评页码已变化，请返回第一页重读',409)
 if(size<1||size>100||pages!==Math.ceil(total/size)||r.commentThreadParents.length>size||r.commentThreadParents.length>total||total===0&&r.commentThreadParents.length!==0)throw bad()
 const seen=new Set<string>();let budget=0
 function project(v:unknown,depth=0):ReturnType<typeof legacyComment>{if(depth>20||++budget>5000)throw bad();const item=legacyObject(v);if(typeof item.oId!=='string'||seen.has(item.oId)||(item.commentOnArticleId!==undefined&&item.commentOnArticleId!==articleId)||item.commentParagraphId!==paragraphId||item.commentType!==1||item.commentParagraphStatus!==0)throw bad();seen.add(item.oId)
  // Project a single row first so nested replies share one depth/count/identity budget.
  const {commentThreadReplies,...single}=item,result=legacyComment(single)
  if(commentThreadReplies!==undefined){if(!Array.isArray(commentThreadReplies))throw bad();result.commentThreadReplies=commentThreadReplies.map(reply=>project(reply,depth+1))}
  return result
 }
 return{paragraphId,paragraphSnapshot:r.paragraphSnapshot,commentThreadParents:r.commentThreadParents.map(v=>project(v)),pagination:{paginationCurrentPageNum:current,paginationPageCount:pages,paginationRecordCount:total}}
}
export async function legacyArticleNavigation(articleId:string,signal?:AbortSignal):Promise<import('../v3-article-column').ArticleColumnContext>{
 article(articleId);const {key,current}=reader(signal),raw=await request(`/api/article/${articleId}?`+new URLSearchParams({p:'1',...(key?{apiKey:key}:{})}),{signal,cache:'no-store',redirect:'error'});current();const r=legacyObject(raw);if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'章节导航读取失败',400)
 const d=legacyObject(r.data),target=legacyObject(d.article);if(target.oId!==articleId)throw bad()
 if(d.longArticleColumnView===undefined||d.longArticleColumnView===null)return{articleId,column:null,chapterNo:null,previous:null,next:null}
 const view=legacyArticleColumnView(d.longArticleColumnView,articleId),chapter=(value:typeof view.previous)=>value?{id:value.articleId,title:value.articleTitle,chapterNo:value.chapterNo,createdAt:legacyDate(value.articleCreateTime)}:null
 return{articleId,column:{id:view.column.oId,title:view.column.columnTitle,articleCount:view.chapters.length},chapterNo:view.chapterNo!,previous:chapter(view.previous),next:chapter(view.next)}
}


export async function legacyCommentReplies(articleId:string,rootId:string,paragraphId='',p=1,signal?:AbortSignal){
 article(articleId);article(rootId);if(paragraphId)anchor(paragraphId)
 if(!Number.isSafeInteger(p)||p<1||p>1000000)throw new ApiError('回复页码不合法',422)
 const r=await read('/comment/thread/replies',{commentId:rootId,paginationCurrentPageNum:p},signal),page=legacyObject(r.pagination)
 if(r.commentThreadRootId!==rootId||!Array.isArray(r.commentThreadReplies))throw bad()
 const current=count(page.paginationCurrentPageNum),size=count(page.paginationPageSize),total=count(page.paginationRecordCount),pages=count(page.paginationPageCount)
 if(current!==p)throw new ApiError('回复页码已变化，请返回第一页重新读取',409)
 if(size!==20||pages!==Math.ceil(total/size)||r.commentThreadReplyCount!==total||r.commentThreadReplies.length!==Math.max(0,Math.min(size,total-(p-1)*size)))throw bad()
 const seen=new Set<string>()
 const list=r.commentThreadReplies.map(value=>{
  const item=legacyObject(value)
  if(typeof item.oId!=='string'||item.oId===rootId||seen.has(item.oId)||item.commentThreadRootId!==rootId||(item.commentOnArticleId!==undefined&&item.commentOnArticleId!==articleId)||item.commentType!==(paragraphId?1:0)||(paragraphId&&(item.commentParagraphId!==paragraphId||item.commentParagraphStatus!==0))||typeof item.commentOriginalCommentId!=='string'||!item.commentOriginalCommentId||item.commentOriginalCommentId===item.oId)throw bad()
  article(item.commentOriginalCommentId);seen.add(item.oId)
  // Article ownership is scoped by the verified parent query; this legacy projection omits it per row.
  const {commentThreadReplies,...single}=item
  return legacyComment(single)
 })
 return{list,pagination:{p:current,total,pageCount:pages}}
}
