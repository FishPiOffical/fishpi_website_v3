import {ApiError} from '../http'
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
