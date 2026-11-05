import { ApiError,request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
export type LegacyMfaPreparation={secret:string;otpauthUri:string}
function ownerId(owner:string){if(!/^[1-9][0-9]{0,18}$/.test(owner))throw new ApiError('账号身份不正确',422)}
async function call(path:string,params:Record<string,string>={},signal?:AbortSignal){
 const apiKey=getLegacyKey();if(!apiKey)throw new ApiError('请先登录查看两步验证',401)
 const r=legacyObject(await request(path+'?'+new URLSearchParams({apiKey,...params}),{method:'GET',cache:'no-store',headers:{'Cache-Control':'no-store','Pragma':'no-cache'},__captchaRetried:true,redirect:'error',signal}))
 if(apiKey!==getLegacyKey())throw new ApiError('登录状态已变化',409)
 return r
}
export async function readLegacyMfa(signal?:AbortSignal):Promise<boolean>{
 const r=await call('/mfa/enabled',{},signal)
 if(r.code===0&&r.msg==='已绑定2FA')return true
 if(r.code===-1&&r.msg==='未绑定2FA')return false
 throw new ApiError('旧两步验证状态响应不正确',502)
}
export async function prepareLegacyMfa(owner:string,signal?:AbortSignal):Promise<LegacyMfaPreparation>{
 ownerId(owner);const r=await call('/mfa',{},signal)
 if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'两步验证准备失败',400)
 if(r.user!==owner||typeof r.secret!=='string'||!/^[A-Z2-7]{16}$/.test(r.secret))throw new ApiError('旧两步验证绑定资料不正确',502)
 // Ignore qrCodeLink: it transmits this secret to an external image service.
 return{secret:r.secret,otpauthUri:`otpauth://totp/${owner}?secret=${r.secret}&issuer=FishPi`}
}
export function legacyMfaCode(code:string){if(typeof code!=='string'||!/^[0-9]{6}$/.test(code))throw new ApiError('请输入6位验证器验证码',422);return code}
export async function writeLegacyMfa(enable:boolean,code:string,signal?:AbortSignal){
 if(typeof enable!=='boolean')throw new ApiError('两步验证操作不正确',422)
 const params:Record<string,string>=enable?{code:legacyMfaCode(code)}:{}
 const r=await call(enable?'/mfa/verify':'/mfa/remove',params,signal)
 // Legacy verification also catches service exceptions as a generic failure; never auto-replay.
 if(r.code!==0)throw new ApiError('旧两步验证提交未确认，请重新登录核对',502)
}
