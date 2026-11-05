import {ApiError,getAuthContextVersion,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
export type LegacyArticleReward={id:string;price:number;anonymous:boolean;rewarded:boolean;html:string}
export function legacyRewardId(id:string){if(typeof id!=='string'||!/^[1-9][0-9]{0,18}$/.test(id))throw new ApiError('文章ID不合法',422);return id}
export async function readLegacyArticleReward(id:string,signal?:AbortSignal):Promise<LegacyArticleReward>{
 legacyRewardId(id);const key=getLegacyKey(),context=getAuthContextVersion();if(!key)throw new ApiError('请先登录读取打赏状态',401)
 const result=legacyObject(await request(`/api/article/${id}?`+new URLSearchParams({p:'1',apiKey:key}),{cache:'no-store',redirect:'error',signal}))
 if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409)
 if(result.code!==0)throw new ApiError(typeof result.msg==='string'?result.msg:'打赏状态读取失败',400)
 const row=legacyObject(legacyObject(result.data).article),price=row.articleRewardPoint
 if(row.oId!==id||typeof price!=='number'||!Number.isSafeInteger(price)||price<0||price>2147483647||![0,1].includes(row.articleAnonymous as number)||typeof row.rewarded!=='boolean')throw new ApiError('旧打赏状态响应不正确',502)
 let html=''
 if(row.rewarded&&price>0){if(typeof row.articleRewardContent!=='string'||row.articleRewardContent.length>2097152)throw new ApiError('当前付费区响应不正确',502);html=row.articleRewardContent}
 return{id,price,anonymous:row.articleAnonymous===1,rewarded:row.rewarded,html}
}
export async function purchaseLegacyArticleReward(id:string):Promise<void>{
 legacyRewardId(id);const key=getLegacyKey(),context=getAuthContextVersion();if(!key)throw new ApiError('请先登录后打赏',401)
 const result=legacyObject(await request('/article/reward?'+new URLSearchParams({articleId:id}),{method:'POST',cache:'no-store',redirect:'error',__captchaRetried:true,body:JSON.stringify({apiKey:key})}))
 if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409)
 if(result.code!==0)throw new ApiError(typeof result.msg==='string'?result.msg:'旧打赏请求未确认',502)
 // The response may contain paid HTML. Only a separate current GET may render it.
}
