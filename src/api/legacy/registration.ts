import { ApiError, getAuthContextVersion, request } from '../http'
import { getApiMode } from '../mode'
import { accountCaptcha, accountCode, accountPhone, referralName } from '../v3-account-access'
import { passwordDigest } from '../v3-security'
import { legacyObject } from './home'
export type LegacyRegistrationInput={userName:string;userPhone:string;invitecode:string;referral:string;userAppRole:number}
function legacyOnly(){if(getApiMode()!=='v1')throw new ApiError('请使用当前版本的注册流程',409)}
function role(value:number){if(value!==0&&value!==1)throw new ApiError('请选择有效角色',422);return value}
function path(base:string,referral:string){return base+(referral?'?'+new URLSearchParams({r:referral}):'')}
function accepted(value:unknown){const row=legacyObject(value);if(row.code!==0)throw new ApiError(typeof row.msg==='string'&&row.msg?row.msg:'注册操作未确认成功',400);return row}
export function legacyRegistrationInput(value:LegacyRegistrationInput):LegacyRegistrationInput{
 const userName=value.userName.trim(),invitecode=value.invitecode.trim()
 if(!/^[A-Za-z0-9-]{1,64}$/.test(userName))throw new ApiError('用户名须为1至64位英文字母、数字或连字符',422)
 if(invitecode&&!/^[A-Za-z0-9]{16}$/.test(invitecode))throw new ApiError('邀请码须为16位字母或数字',422)
 return{userName,userPhone:accountPhone(value.userPhone),invitecode,referral:referralName(value.referral),userAppRole:role(value.userAppRole)}
}
export async function requestLegacyRegistration(input:LegacyRegistrationInput,proof:unknown,signal?:AbortSignal):Promise<void>{
 legacyOnly();const{referral,...fields}=legacyRegistrationInput(input)
 accepted(await request(path('/register',referral),{method:'POST',body:JSON.stringify({...fields,captcha:accountCaptcha(proof)}),cache:'no-store',redirect:'error',signal,__captchaRetried:true}))
}
/** The classic verification response is root JSON; never infer the ID from a public user or typed name. */
export async function completeLegacyRegistration(code:string,password:string,userAppRole:number,referral:string,signal?:AbortSignal):Promise<void>{
 legacyOnly();const sms=accountCode(code),digest=passwordDigest(password),appRole=role(userAppRole),referrer=referralName(referral),context=getAuthContextVersion()
 const current=()=>{signal?.throwIfAborted();legacyOnly();if(context!==getAuthContextVersion())throw new ApiError('登录状态已变化，请重新核对注册',409)}
 current();const target=accepted(await request('/verify?'+new URLSearchParams({code:sms}),{cache:'no-store',redirect:'error',signal}));current()
 if(typeof target.userId!=='string'||!/^[1-9][0-9]{0,18}$/.test(target.userId))throw new ApiError('注册验证目标响应不正确，尚未提交激活',502)
 try{
  accepted(await request(path('/register2',referrer),{method:'POST',body:JSON.stringify({userId:target.userId,code:sms,userPassword:digest,userAppRole:appRole,mbti:''}),cache:'no-store',redirect:'error',signal,__captchaRetried:true}));current()
 }catch{throw new ApiError('注册结果未确认，请先尝试登录；不要直接重复激活，无法登录时再核对验证码或重新申请。',0,'legacy_registration_unknown')}
}
