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
  const paths:Partial<Record<ArticleFeedKind,string>>={recent:'/api/articles/recent',hot:'/api/articles/recent/hot',long:'/api/articles/recent/long',good:'/api/articles/recent/good',reply:'/api/articles/recent/reply',qna:'/api/articles/qna',perfect:'/api/articles/perfect'}
  const searching=kind==='search'
  if(searching && (!extra.trim() || extra.length>100 || /[\u0000-\u001f\u007f]/.test(extra))) throw new ApiError('搜索关键词不合法',422)
  const scoped=kind==='tag'||kind==='domain'
  if(scoped && (!extra || extra.length>256 || /[\u0000-\u001f\u007f]/.test(extra)))throw new ApiError('目录地址不合法',422)
  const path=searching?'/api/search':scoped?`/api/articles/${kind}/${encodeURIComponent(extra)}`:paths[kind]
  if(!path) throw new ApiError('该列表的 v1 适配尚未完成',501)
  if(extra && !scoped && !searching) throw new ApiError('该列表不接受额外参数',422)
  const d=legacyObject(await legacyGet(privatePath(`${path}?p=${p}&size=20${searching?'&'+new URLSearchParams({key:extra.trim()}):''}`)))
  if(!Array.isArray(d.articles) || d.articles.length>20) throw new ApiError('旧文章列表响应不正确',502)
  const pagination=legacyObject(d.pagination)
  return {list:d.articles.map(x=>legacyArticleSummary(x,searching)),p,size:20,total:(d.total ?? pagination.paginationRecordCount)===undefined?null:count(d.total ?? pagination.paginationRecordCount),pageCount:count(pagination.paginationPageCount)}
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
  if(d.longArticleColumnView!==undefined&&d.longArticleColumnView!==null)result.longArticleColumnView=legacyArticleColumnView(d.longArticleColumnView,articleId)
  return result
}

/** The classic article response contains a complete visible chapter view. Whitelist it before SSR. */
export function legacyArticleColumnView(value:unknown,articleId:string):NonNullable<ArticleDetail['longArticleColumnView']>{
 const v=legacyObject(value),c=legacyObject(v.column);if(!Array.isArray(v.chapters)||!v.chapters.length||v.chapters.length>10000)throw new ApiError('旧章节目录不完整',502)
 const chapters=v.chapters.map(item=>{const r=legacyObject(item),articleId=id(text(r.articleId)),chapterNo=count(r.chapterNo);if(chapterNo<1)throw new ApiError('旧章节序号不合法',502);const result={articleId,articleTitle:text(r.articleTitle),chapterNo,articlePermalink:`/article/${articleId}`,...(r.articleCreateTime===undefined?{}:{articleCreateTime:new Date(legacyDate(r.articleCreateTime)).toISOString()}),...(typeof r.articlePreviewContent==='string'?{articlePreviewContent:r.articlePreviewContent}:{})};return result})
 if(new Set(chapters.map(ch=>ch.articleId)).size!==chapters.length||chapters.some((ch,i)=>i>0&&ch.chapterNo<chapters[i-1]!.chapterNo)||count(c.columnArticleCount)!==chapters.length)throw new ApiError('旧章节目录与计数不一致',502)
 const index=chapters.findIndex(ch=>ch.articleId===articleId);if(index<0||v.chapterNo!==chapters[index]!.chapterNo)throw new ApiError('当前章节与目录不一致',502)
 for(const [key,expected] of [['previous',chapters[index-1]],['next',chapters[index+1]]] as const){const actual=v[key];if(expected?(!actual||legacyObject(actual).articleId!==expected.articleId):actual!==undefined&&actual!==null)throw new ApiError('相邻章节与目录不一致',502)}
 return{column:{oId:id(text(c.oId)),columnTitle:text(c.columnTitle),columnArticleCount:chapters.length,...(typeof c.columnCoverURL==='string'?{columnCoverURL:c.columnCoverURL}:{})},chapters,chapterNo:chapters[index]!.chapterNo,...(chapters[index-1]?{previous:chapters[index-1]}:{}),...(chapters[index+1]?{next:chapters[index+1]}:{})}
}
