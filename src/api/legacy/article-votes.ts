import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
export type LegacyArticleVote={id:string;vote:'up'|'down'|null;upCount:number;downCount:number}
function target(id:string){if(!/^[1-9][0-9]{0,18}$/.test(id))throw new ApiError('文章ID不合法',422)}
function count(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw new ApiError('旧文章票数缺失或不正确',502);return v}
export async function readLegacyArticleVote(id:string):Promise<LegacyArticleVote>{
 target(id);const apiKey=getLegacyKey();if(!apiKey)throw new ApiError('请先登录查看文章投票',401)
 const r=legacyObject(await request(`/api/article/${id}?`+new URLSearchParams({apiKey}),{cache:'no-store'}))
 if(apiKey!==getLegacyKey())throw new ApiError('登录状态已变化',409)
 if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'旧文章投票状态读取失败',400)
 const a=legacyObject(legacyObject(r.data).article)
 if(a.oId!==id||![-1,0,1].includes(a.articleVote as number))throw new ApiError('旧文章投票目标或状态不正确',502)
 return{id,vote:a.articleVote===0?'up':a.articleVote===1?'down':null,upCount:count(a.articleGoodCnt),downCount:count(a.articleBadCnt)}
}
export async function toggleLegacyArticleUpVote(id:string){
 target(id);const apiKey=getLegacyKey();if(!apiKey)throw new ApiError('请先登录',401)
 const r=legacyObject(await request('/vote/up/article',{method:'POST',cache:'no-store',__captchaRetried:true,body:JSON.stringify({apiKey,dataId:id})}))
 if(apiKey!==getLegacyKey())throw new ApiError('登录状态已变化',409)
 if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'赞同结果未确认',502)
 // The old response's type is the pre-write vote, not the current state.
}
