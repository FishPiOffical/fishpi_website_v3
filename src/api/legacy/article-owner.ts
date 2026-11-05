import {ApiError,getAuthContextVersion,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
export type LegacyOwnerKind='delete'|'stick'
export type LegacyOwnerCommand={kind:LegacyOwnerKind;id:string}
export type LegacyOwnerProof={id:string;status:number;stick:'none'|'temporary'|'permanent'|'unknown'}
function id(value:string){if(typeof value!=='string'||!/^[1-9][0-9]{0,18}$/.test(value))throw new ApiError('文章编号不合法',422);return value}
const bad=()=>new ApiError('旧文章管理响应格式不正确',502)
async function call(path:string,init:Parameters<typeof request>[1],key:string){const context=getAuthContextVersion(),result=legacyObject(await request(path,init));if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409);if(result.code!==0)throw new ApiError(typeof result.msg==='string'?result.msg:'文章操作未确认',400);return result}
function credential(){const key=getLegacyKey();if(!key)throw new ApiError('请先登录',401);return key}
export async function legacyOwnerProof(target:string,owner:string,signal?:AbortSignal):Promise<LegacyOwnerProof>{
 id(target);id(owner);const key=credential(),result=await call('/api/article/'+target+'?'+new URLSearchParams({p:'1',apiKey:key}),{cache:'no-store',redirect:'error',...(signal?{signal}:{})},key),article=legacyObject(legacyObject(result.data).article)
 if(article.oId!==target||article.articleAuthorId!==owner||article.articleAnonymous!==0)throw new ApiError('当前无法核验为本人的署名文章',403)
 if(typeof article.articleStatus!=='number'||!Number.isSafeInteger(article.articleStatus)||article.articleStatus<0)throw bad()
 let stick:LegacyOwnerProof['stick']='unknown'
 // Classic JSON serializes Java Long.MAX_VALUE as a number; only classify it as a blocked sentinel.
 if(article.articleStick===Number('9223372036854775807'))stick='permanent'
 else if(typeof article.articleStick==='number'&&Number.isSafeInteger(article.articleStick)&&article.articleStick>=0&&article.articleStick<=8640000000000000)stick=article.articleStick===0?'none':'temporary'
 return{id:target,status:article.articleStatus,stick}
}
export async function writeLegacyOwner(input:LegacyOwnerCommand):Promise<LegacyOwnerCommand>{
 const target=id(input.id);if(!['delete','stick'].includes(input.kind))throw new ApiError('文章操作不合法',422)
 const key=credential(),result=await call(input.kind==='delete'?`/article/${target}/remove`:'/api/article/stick?'+new URLSearchParams({articleId:target}),{method:'POST',body:JSON.stringify({apiKey:key}),cache:'no-store',redirect:'error',__captchaRetried:true},key)
 if(input.kind==='delete'&&result.articleId!==target)throw bad()
 // The stick response only acknowledges success: no current state, charge or timestamp is returned.
 return{kind:input.kind,id:target}
}
