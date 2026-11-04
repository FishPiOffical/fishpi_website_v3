import { ApiError } from '../http'
import { getLegacyKey } from './auth'
import { legacyGet, legacyObject, legacyDate, legacyArticleSummary } from './home'
import type { ArticleComment, ArticleDetail, ArticleFeedKind } from '../fishpi'
function id(value:string) {if(!/^[1-9][0-9]{0,31}$/.test(value)) throw new ApiError('内容ID不合法',422);return value}
function page(value:number) {if(!Number.isSafeInteger(value) || value<1 || value>1000000) throw new ApiError('页码不合法',422);return value}
function text(value:unknown) {if(typeof value!=='string') throw new ApiError('旧内容响应格式不正确',502);return value}
function count(value:unknown) {if(typeof value!=='number' || !Number.isSafeInteger(value) || value<0) throw new ApiError('旧分页响应不正确',502);return value}
function privatePath(path:string) {const key=getLegacyKey();return path+(key?'&'+new URLSearchParams({apiKey:key}):'')}
export async function legacyListing(kind:ArticleFeedKind,extra:string,p:number) {
  page(p)
  const paths:Partial<Record<ArticleFeedKind,string>>={recent:'/api/articles/recent',hot:'/api/articles/recent/hot',good:'/api/articles/recent/good',reply:'/api/articles/recent/reply',qna:'/api/articles/qna',perfect:'/api/articles/perfect'}
  const path=paths[kind]
  if(!path) throw new ApiError('该列表的 v1 适配尚未完成',501)
  if(extra) throw new ApiError('该列表不接受额外参数',422)
  const d=legacyObject(await legacyGet(privatePath(`${path}?p=${p}&size=20`)))
  if(!Array.isArray(d.articles) || d.articles.length>20) throw new ApiError('旧文章列表响应不正确',502)
  const pagination=legacyObject(d.pagination)
  return {list:d.articles.map(legacyArticleSummary),p,size:20,total:pagination.paginationRecordCount===undefined?null:count(pagination.paginationRecordCount),pageCount:count(pagination.paginationPageCount)}
}
export function legacyComment(value:unknown):ArticleComment {
  const r=legacyObject(value)
  if(r.commentAnonymous!==0 && r.commentAnonymous!==1) throw new ApiError('旧评论匿名标记缺失',502)
  const anonymous=r.commentAnonymous===1
  const result:ArticleComment={oId:id(text(r.oId)),commentContent:text(r.commentContent),commentCreateTimeStr:new Date(legacyDate(r.commentCreateTimeStr)).toISOString(),
    commentAuthorId:anonymous?'':text(r.commentAuthorId),commentAuthorName:anonymous?'匿名用户':text(r.commentAuthorName),
    commentAuthorNickname:anonymous?'匿名用户':typeof r.commentAuthorNickName==='string'?r.commentAuthorNickName:'',commentAuthorThumbnailURL:anonymous?'':text(r.commentAuthorThumbnailURL)}
  for(const key of ['commentOriginalCommentId','commentParagraphId'] as const) if(typeof r[key]==='string') result[key]=r[key]
  for(const key of ['commentThankCnt','commentGoodCnt','commentQnAOffered','commentParagraphStatus'] as const) if(typeof r[key]==='number') result[key]=count(r[key])
  if(Array.isArray(r.commentThreadReplies)) result.commentThreadReplies=r.commentThreadReplies.map(legacyComment)
  return result
}
export async function legacyArticle(articleId:string,p=1):Promise<ArticleDetail> {
  id(articleId);page(p)
  const d=legacyObject(await legacyGet(privatePath(`/api/article/${articleId}?p=${p}`))),r=legacyObject(d.article)
  if(r.oId!==articleId) throw new ApiError('旧文章目标不匹配',502)
  if(!Array.isArray(r.articleComments)) throw new ApiError('旧评论列表缺失',502)
  const result:ArticleDetail={...legacyArticleSummary(r),articleContent:text(r.articleContent),articleComments:r.articleComments.map(legacyComment),
    pagination:{paginationCurrentPageNum:p,paginationPageCount:count(legacyObject(d.pagination).paginationPageCount)}}
  // Only explicitly returned current state is projected; no fee/permission or original-source guesses.
  if(typeof r.articleCommentable==='boolean') result.articleCommentable=r.articleCommentable
  for(const key of ['articleRewardPoint','articleQnAOfferPoint','articleStatement'] as const) if(typeof r[key]==='number') result[key]=count(r[key])
  if(typeof r.offered==='boolean') result.offered=r.offered
  if(typeof r.rewarded==='boolean') result.rewarded=r.rewarded
  if(r.rewarded===true && typeof r.articleRewardContent==='string') result.articleRewardContent=r.articleRewardContent
  return result
}
