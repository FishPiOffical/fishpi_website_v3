import {ApiError,getAuthContextVersion,request} from '../http'
import {getLegacyKey} from './auth'
import type {ArticleDetail} from '../fishpi'
import type {CommentLocation} from '../v3-comment-location'
/** Classic JSON has no location resource: only the current loaded page can prove placement. */
export function locateLegacyLoadedComment(commentId:string,articleId:string,article:ArticleDetail|null):CommentLocation{
 if(!/^[0-9]{1,19}$/.test(commentId)||!/^[0-9]{1,19}$/.test(articleId))throw new ApiError('评论定位参数不合法',422)
 if(!article||article.oId!==articleId)throw new ApiError('请等待当前文章加载完成后重试定位',409)
 const p=article.pagination?.paginationCurrentPageNum
 if(typeof p!=='number'||!Number.isSafeInteger(p)||p<1||p>Math.floor(2147483647/50)||!Array.isArray(article.articleComments))throw new ApiError('当前评论页信息不可用，请重新读取文章',502)
 const matches=article.articleComments.filter(c=>c.oId===commentId)
 if(matches.length>1)throw new ApiError('当前评论页信息重复，请重新读取文章',502)
 if(matches.length===1&&!matches[0]!.commentParagraphId)return{id:commentId,articleId,type:0,page:p,size:20,paragraph:null}
 throw new ApiError('目标评论不在当前已加载页。旧接口未提供评论位置查询，请翻页后重新定位；段评请从对应段落查看。',501)
}

/** The legacy hint uses root-thread ordering. Prove it against the actual flat article page. */
export async function fetchLegacyCommentLocation(commentId:string,articleId:string,article:ArticleDetail|null,signal?:AbortSignal):Promise<CommentLocation>{
 signal?.throwIfAborted()
 try{return locateLegacyLoadedComment(commentId,articleId,article)}catch(e){if(!(e instanceof ApiError)||e.status!==501)throw e}
 const key=getLegacyKey(),context=getAuthContextVersion()
 const valid=()=>{if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409);signal?.throwIfAborted()}
 const bad=()=>new ApiError('旧评论位置提示不正确',502)
 function row(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw bad();return value as Record<string,unknown>}
 valid()
 const hint=row(await request('/comment/original',{method:'POST',body:JSON.stringify({commentId,userCommentViewMode:0,...(key?{apiKey:key}:{})}),cache:'no-store',redirect:'error',signal}))
 valid()
 if(hint.code!==0)throw new ApiError(typeof hint.msg==='string'?hint.msg:'评论位置读取失败',400)
 const target=row(hint.commentReplies),p=target.paginationCurrentPageNum
 if(target.oId!==commentId||typeof p!=='number'||!Number.isSafeInteger(p)||p<1||p>Math.floor(2147483647/50))throw bad()
 if(p===article?.pagination?.paginationCurrentPageNum)throw new ApiError('评论不在当前页，旧页提示无法核验位置。请重新读取文章或手动翻页后重试。',409)
 const envelope=row(await request(`/api/article/${articleId}?`+new URLSearchParams({p:String(p),...(key?{apiKey:key}:{})}),{cache:'no-store',redirect:'error',signal}))
 valid()
 if(envelope.code!==0)throw new ApiError(typeof envelope.msg==='string'?envelope.msg:'评论候选页读取失败',400)
 const data=row(envelope.data),candidate=row(data.article),pages=row(data.pagination).paginationPageCount
 if(candidate.oId!==articleId||!Array.isArray(candidate.articleComments)||candidate.articleComments.length>20||typeof pages!=='number'||!Number.isSafeInteger(pages)||pages<p)throw bad()
 const matches=candidate.articleComments.map(row).filter(c=>c.oId===commentId)
 if(matches.length!==1||matches[0]!.commentParagraphId||matches[0]!.commentType!==undefined&&matches[0]!.commentType!==0||matches[0]!.commentOnArticleId!==undefined&&matches[0]!.commentOnArticleId!==articleId)throw new ApiError('旧页提示与当前文章评论不一致，无法自动定位。请手动翻页或从对应段落查看。',409)
 return{id:commentId,articleId,type:0,page:p,size:20,paragraph:null}
}
