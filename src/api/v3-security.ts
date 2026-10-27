import { md5 } from 'js-md5'
import { ApiError, request } from './http'
export type SecurityProof = { currentPassword: string; currentTotp?: string }
export type MfaPreparation = { preparationId: string; secret: string; otpauthUri: string; expiresAt: number }
export type ContactKind = 'phone' | 'email'
type Row = Record<string, unknown>
const invalid = () => new ApiError('账号安全响应格式不正确', 502, 'invalid_response')
function object(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
function totp(value: string): string { if (!/^[0-9]{6}$/.test(value)) throw new ApiError('验证码须为6位数字', 422); return value }
function proof(value: SecurityProof): SecurityProof { if (!value || !/^[a-f0-9]{32}$/.test(value.currentPassword)) throw new ApiError('请填写当前密码', 422); return { currentPassword: value.currentPassword, ...(value.currentTotp ? { currentTotp: totp(value.currentTotp) } : {}) } }
export function securityProof(password: string, code: string, enabled: boolean): SecurityProof { if (typeof password !== 'string' || !password.length) throw new ApiError('请填写当前密码', 422); if (enabled && !code) throw new ApiError('请填写当前验证器验证码', 422); return proof({ currentPassword: md5(password), ...(code ? { currentTotp: code } : {}) }) }
export function passwordDigest(password: string): string {
  if (typeof password !== 'string' || password.length < 6 || password.length > 128 || /[\u0000-\u001f\u007f-\u009f]/.test(password) || Array.from(password).some(c => c.length === 1 && /[\ud800-\udfff]/.test(c))) throw new ApiError('新密码须为6至128个字符，不能含控制字符或无效字符', 422)
  return md5(password)
}
async function data(path: string, method = 'GET', body?: Row, key?: string): Promise<Row> {
  if (key !== undefined && !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('操作标识不合法', 422)
  const response = object(await request(path, { method, cache: 'no-store', ...(body ? { headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(body) } : {}) }))
  if (response.code !== 0) throw new ApiError(typeof response.msg === 'string' ? response.msg : '账号安全请求失败', 502)
  return object(response.data)
}
export async function fetchV3MfaState(): Promise<boolean> { const row = await data('/api/v3/me/security/mfa'); if (typeof row.enabled !== 'boolean') throw invalid(); return row.enabled }
export async function changeV3Password(value: SecurityProof, newPassword: string): Promise<void> {
  if (!/^[a-f0-9]{32}$/.test(newPassword)) throw new ApiError('新密码摘要不合法', 422)
  const row = await data('/api/v3/me/settings/password', 'PUT', { ...proof(value), newPassword }); if (row.changed !== true || row.reauthenticationRequired !== true) throw invalid()
}
export async function prepareV3Mfa(value: SecurityProof): Promise<MfaPreparation> {
  const row = await data('/api/v3/me/security/mfa/preparations', 'POST', proof(value))
  if (typeof row.preparationId !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(row.preparationId) || typeof row.secret !== 'string' || !/^[A-Z2-7]{32}$/.test(row.secret) || typeof row.otpauthUri !== 'string' || typeof row.expiresAt !== 'number' || !Number.isSafeInteger(row.expiresAt) || row.expiresAt <= 0) throw invalid()
  let uri: URL
  try { uri = new URL(row.otpauthUri) } catch { throw invalid() }
  if (uri.protocol !== 'otpauth:' || uri.hostname !== 'totp' || uri.username || uri.password || uri.hash || uri.searchParams.get('secret') !== row.secret || uri.searchParams.get('digits') !== '6' || uri.searchParams.get('period') !== '30' || uri.searchParams.get('algorithm') !== 'SHA1' || uri.searchParams.get('issuer') !== 'FishPi' || !/^\/FishPi%3A[1-9][0-9]{0,18}$/.test(uri.pathname) || [...uri.searchParams.keys()].length !== 5 || new Set(uri.searchParams.keys()).size !== 5) throw invalid()
  return { preparationId: row.preparationId, secret: row.secret, otpauthUri: row.otpauthUri, expiresAt: row.expiresAt }
}
export async function setV3Mfa(value: SecurityProof, enabled: boolean, key: string, preparationId?: string, newTotp?: string): Promise<void> {
  const body: Row = proof(value)
  if (enabled) { if (!preparationId || !/^[A-Za-z0-9_-]{43}$/.test(preparationId)) throw new ApiError('请重新准备绑定资料', 422); body.preparationId = preparationId; body.newTotp = totp(newTotp || '') }
  const row = await data('/api/v3/me/security/mfa', enabled ? 'PUT' : 'DELETE', body, key); if (row.enabled !== enabled) throw invalid()
}
export function contactTarget(kind: ContactKind, raw: string): string {
  if (kind !== 'phone' && kind !== 'email' || typeof raw !== 'string' || raw.length > 255) throw new ApiError('联系方式不合法', 422)
  if (kind === 'phone') { if (!/^1[0-9]{10}$/.test(raw)) throw new ApiError('手机号须为11位大陆手机号', 422); return raw }
  const target = raw.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '').toLowerCase()
  if (!target || target.length > 255 || /[\s\u0000-\u001f\u007f-\u009f]/.test(target) || !/^[^@]+@[^@]+$/.test(target)) throw new ApiError('邮箱格式不合法', 422)
  return target
}
export function contactCaptcha(value: unknown): string {
  const row = object(value), fields = ['lot_number', 'captcha_output', 'pass_token', 'gen_time'], result: Row = {}
  for (const field of fields) { const part = row[field]; if (typeof part !== 'string' || !part || part.length > 2048 || /[\u0000-\u001f\u007f-\u009f]/.test(part)) throw new ApiError('极验结果不完整，请重新验证', 422); result[field] = part }
  const serialized = JSON.stringify(result); if (new TextEncoder().encode(serialized).length > 4096) throw new ApiError('极验结果过长，请重新验证', 422); return serialized
}
export async function requestV3ContactCode(kind: ContactKind, target: string, value: SecurityProof, captcha: unknown): Promise<void> { const row = await data(`/api/v3/me/settings/${kind}/verification`, 'POST', { target: contactTarget(kind, target), ...proof(value), captcha: contactCaptcha(captcha) }); if (row.accepted !== true) throw invalid() }
export async function changeV3Contact(kind: ContactKind, target: string, value: SecurityProof, code: string): Promise<void> { const row = await data(`/api/v3/me/settings/${kind}`, 'PUT', { target: contactTarget(kind, target), ...proof(value), code: totp(code) }); if (row.changed !== true || row.reauthenticationRequired !== true) throw invalid() }
