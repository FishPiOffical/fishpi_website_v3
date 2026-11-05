import { ApiError, getAuthContextVersion, request } from '../http'
import { getApiMode } from '../mode'
import { accountCaptcha, accountCode, accountPhone } from '../v3-account-access'
import { passwordDigest } from '../v3-security'
import { legacyObject } from './home'

function legacyOnly() { if (getApiMode() !== 'v1') throw new ApiError('请使用当前版本的账号恢复流程', 409) }
function accepted(value:unknown) {
  const row = legacyObject(value)
  if (row.code !== 0) throw new ApiError(typeof row.msg === 'string' && row.msg ? row.msg : '旧账号接口未确认操作成功', 400)
  return row
}
export async function requestLegacyPasswordReset(phone:string, captcha:unknown, signal?:AbortSignal):Promise<void> {
  legacyOnly()
  const body = { userPhone:accountPhone(phone), captcha:accountCaptcha(captcha) }
  accepted(await request('/forget-pwd', {method:'POST',body:JSON.stringify(body),cache:'no-store',redirect:'error',signal,__captchaRetried:true}))
}
/** Never take the target account from a route, typed ID, current login or public profile. */
export async function resetLegacyPassword(code:string, password:string, signal?:AbortSignal):Promise<void> {
  legacyOnly()
  const sms = accountCode(code), digest = passwordDigest(password), context = getAuthContextVersion()
  const current = () => { signal?.throwIfAborted(); legacyOnly(); if (context !== getAuthContextVersion()) throw new ApiError('登录状态已变化，请重新核对重置操作', 409) }
  current()
  const meta = accepted(await request('/api/reset-pwd/meta?'+new URLSearchParams({code:sms}), {cache:'no-store',redirect:'error',signal})), data = legacyObject(meta.data)
  current()
  if (data.code !== sms || typeof data.userId !== 'string' || !/^[1-9][0-9]{0,18}$/.test(data.userId)) throw new ApiError('重置目标响应不正确，尚未提交新密码', 502)
  try {
    accepted(await request('/reset-pwd', {method:'POST',body:JSON.stringify({userId:data.userId,code:sms,userPassword:digest}),cache:'no-store',redirect:'error',signal,__captchaRetried:true}))
    current()
  } catch {
    // Legacy failures have no reliable commit receipt. Never retain or retry the password/proof.
    throw new ApiError('重置结果未确认，请先尝试使用新密码登录；无法登录时重新获取验证码，不要重复提交。', 0, 'legacy_reset_unknown')
  }
}
