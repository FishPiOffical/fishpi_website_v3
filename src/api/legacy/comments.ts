import {ApiError,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
import {commentInput,type CommentInput} from '../v3-comments'
export async function legacyCreateComment(articleId:string,value:CommentInput):Promise<{id?:string}>{
 if(typeof articleId!=='string'||!/^[1-9][0-9]{0,31}$/.test(articleId))throw new ApiError('文章ID不合法',422)
 const input=commentInput('create',value),apiKey=getLegacyKey();if(!apiKey)throw new ApiError('请先登录后评论',401)
 const paragraph=!!input.paragraphId,r=legacyObject(await request(paragraph?'/comment/paragraph':'/comment',{method:'POST',__captchaRetried:true,body:JSON.stringify({apiKey,articleId,commentContent:input.content,commentAnonymous:input.anonymous??false,commentVisible:input.visible??false,userCommentViewMode:0,commentOriginalCommentId:input.parentId||'',...(paragraph?{paragraphId:input.paragraphId}:{})}),cache:'no-store'}))
 if(typeof r.code!=='number')throw new ApiError('评论响应不完整，结果未确认',502)
 if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'评论发布失败',400)
 if(!paragraph)return{}
 if(typeof r.commentId!=='string'||!/^[1-9][0-9]{0,31}$/.test(r.commentId))throw new ApiError('段评编号缺失，结果未确认',502)
 return{id:r.commentId}
}
