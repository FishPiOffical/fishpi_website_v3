import { getApiMode } from './mode'
import { ApiError, request } from './http'
import { passwordDigest } from './v3-security'
export type RegistrationOptions = { mode: 'open' | 'invitation' | 'closed'; enabled: boolean; inviteCodeRequired: boolean; referralAccepted: boolean; username: { minLength: number; maxLength: number }; appRoles: { value: number; label: string }[] }
export type RegistrationInput = { userName: string; userPhone: string; invitecode: string; referral: string }
const invalid = () => new ApiError('账号接口响应格式不正确', 502, 'invalid_response')
function row(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown> }
async function data(path: string, body?: Record<string, unknown>) {
  const raw = body ? JSON.stringify(body) : undefined
  if (raw && new TextEncoder().encode(raw).length > (path.endsWith('/request') ? 8192 : 4096)) throw new ApiError('请求内容过长', 422)
  const legacy = getApiMode() === 'v1', target = legacy ? path.replace(/^\/api\/v3\/auth\//, '/api/v1/auth/') : path
  let response: unknown
  try { response = await request(target, { method: body ? 'POST' : 'GET', cache: 'no-store', ...(legacy ? { __captchaRetried: true } : {}), ...(raw ? { headers: { 'Content-Type': 'application/json' }, body: raw } : {}) }) }
  catch (failure) { if (legacy && failure instanceof ApiError && [404,405,501].includes(failure.status)) throw new ApiError('当前服务器尚未提供此版本的账号服务', 404, 'v1_account_unavailable'); throw failure }
  const result = row(response)
  if (result.code !== 0) throw invalid()
  return row(result.data)
}
export function accountPhone(value: string) { const phone = value.trim(); if (!/^1[0-9]{10}$/.test(phone)) throw new ApiError('请输入以1开头的11位手机号', 422); return phone }
export function accountCode(value: string) { const code = value.trim(); if (!/^[0-9]{6}$/.test(code)) throw new ApiError('请输入6位短信验证码', 422); return code }
export function referralName(value: string) { const name = value.trim(); if (name && (name.length > 64 || /[^A-Za-z0-9-]/.test(name))) throw new ApiError('邀请人用户名不合法', 422); return name }
function normalizeRegistration(input: RegistrationInput): RegistrationInput {
  const userName = input.userName.trim(), invitecode = input.invitecode.trim(), referral = referralName(input.referral), userPhone = accountPhone(input.userPhone)
  if (userName.length < 1 || userName.length > 64 || /[^A-Za-z0-9-]/.test(userName)) throw new ApiError('用户名须符合当前长度要求，仅含英文字母、数字或连字符', 422)
  if ((invitecode && !/^[A-Za-z0-9]{16}$/.test(invitecode))) throw new ApiError('请输入有效的16位邀请码', 422)
  return { userName, userPhone, invitecode, referral }
}
export function registrationInput(input: RegistrationInput, options: RegistrationOptions): RegistrationInput {
  const normalized = normalizeRegistration(options.mode === 'open' ? { ...input, invitecode: '' } : input)
  if (!options.enabled) throw new ApiError('当前注册已关闭', 403)
  if (normalized.userName.length < options.username.minLength || normalized.userName.length > options.username.maxLength) throw new ApiError('用户名长度不符合当前要求', 422)
  if (options.inviteCodeRequired && !normalized.invitecode) throw new ApiError('请输入有效的16位邀请码', 422)
  return normalized
}
export async function fetchRegistrationOptions(referral = ''): Promise<RegistrationOptions> {
  const name = referralName(referral), result = await data(`/api/v3/auth/registration-options${name ? `?referral=${encodeURIComponent(name)}` : ''}`), username = row(result.username)
  if (!['open', 'invitation', 'closed'].includes(String(result.mode)) || typeof result.enabled !== 'boolean' || result.enabled !== (result.mode !== 'closed') || typeof result.inviteCodeRequired !== 'boolean' || typeof result.referralAccepted !== 'boolean' || result.inviteCodeRequired !== (result.mode === 'invitation' && !result.referralAccepted) || (result.mode === 'closed' && result.referralAccepted) || !Number.isInteger(username.minLength) || !Number.isInteger(username.maxLength) || Number(username.minLength) < 1 || Number(username.maxLength) > 64 || Number(username.minLength) > Number(username.maxLength) || !Array.isArray(result.appRoles) || result.appRoles.length !== 2) throw invalid()
  const appRoles = result.appRoles.map(value => { const role = row(value); if (![0, 1].includes(role.value as number) || typeof role.label !== 'string' || !role.label || role.label.length > 64) throw invalid(); return { value: role.value as number, label: role.label } })
  if (new Set(appRoles.map(x => x.value)).size !== 2) throw invalid()
  return { mode: result.mode as RegistrationOptions['mode'], enabled: result.enabled, inviteCodeRequired: result.inviteCodeRequired, referralAccepted: result.referralAccepted, username: { minLength: Number(username.minLength), maxLength: Number(username.maxLength) }, appRoles }
}
export async function fetchAccountCaptchaId(): Promise<string> {
  const result = await data('/api/v3/auth/captcha-options')
  if (result.provider !== 'geetest4' || typeof result.captchaId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(result.captchaId)) throw invalid()
  return result.captchaId
}
export function accountCaptcha(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('请完成人机验证', 422)
  const source = value as Record<string, unknown>, proof: Record<string, string> = {}
  for (const key of ['lot_number', 'captcha_output', 'pass_token', 'gen_time']) { if (typeof source[key] !== 'string' || !source[key] || /[\u0000-\u001f\u007f]/.test(source[key])) throw new ApiError('请完成人机验证', 422); proof[key] = source[key] as string }
  const json = JSON.stringify(proof); if (new TextEncoder().encode(json).length > 4096) throw new ApiError('验证结果过长，请重新验证', 422); return json
}
export async function requestRegistration(input: RegistrationInput, captcha: unknown) {
  const result = await data('/api/v3/auth/registration/request', { ...normalizeRegistration(input), captcha: accountCaptcha(captcha) }); if (result.accepted !== true) throw invalid()
}
export async function requestPasswordReset(phone: string, captcha: unknown) {
  const result = await data('/api/v3/auth/password-reset/request', { userPhone: accountPhone(phone), captcha: accountCaptcha(captcha) }); if (result.accepted !== true) throw invalid()
}
export async function completeRegistration(phone: string, code: string, password: string, role: number, referral: string) {
  if (![0, 1].includes(role)) throw new ApiError('请选择有效角色', 422)
  const result = await data('/api/v3/auth/registration/complete', { userPhone: accountPhone(phone), code: accountCode(code), userPassword: passwordDigest(password), userAppRole: role, referral: referralName(referral) })
  if (result.registered !== true || typeof result.userId !== 'string' || !/^[1-9][0-9]{0,18}$/.test(result.userId)) throw invalid()
}
export async function completePasswordReset(phone: string, code: string, password: string) {
  const result = await data('/api/v3/auth/password-reset/complete', { userPhone: accountPhone(phone), code: accountCode(code), userPassword: passwordDigest(password) }); if (result.changed !== true) throw invalid()
}
export function accountOutcomeUnknown(error: unknown) { return !(error instanceof ApiError) || error.status === 0 || error.status >= 500 || error.code === 'invalid_response' }
