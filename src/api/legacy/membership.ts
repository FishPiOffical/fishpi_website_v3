import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
export const legacyBenefitLabels = { bold: '昵称加粗', underline: '昵称下划线', color: '昵称颜色', autoCheckin: '自动签到', checkinCard: '签到卡数量', metal: '勋章权益', jointVip: '联合会员权益' }
export type LegacyBenefits = Record<string, boolean | number | string>
export type LegacyMemberLevel = { id: string; code: string; name: string; price: number; durationType: string; durationValue: number; benefits: LegacyBenefits; unsupported: boolean }
export type LegacyMemberState = { active: boolean; code?: string; expiresAt?: number; config: LegacyBenefits; unsupported: boolean }
export type LegacyMemberCommand = { kind: 'open'; levelId: string; coupon: string } | { kind: 'config'; config: LegacyBenefits }
const bad = () => new ApiError('旧会员响应格式不正确', 502)
function text(v: unknown, max = 128) { if (typeof v !== 'string' || v.length > max) throw bad(); return v }
function id(v: unknown) { const value = text(v, 19); if (!/^[1-9][0-9]{0,18}$/.test(value)) throw bad(); return value }
function number(v: unknown, max = 2147483647) { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > max) throw bad(); return v }
function config(raw: unknown) {
  const value = text(raw, 65536)
  let source: Record<string, unknown>
  try { source = value === '' ? {} : legacyObject(JSON.parse(value)) } catch { throw bad() }
  const output: LegacyBenefits = {}; let unsupported = false
  for (const [key, v] of Object.entries(source)) {
    if (!Object.hasOwn(legacyBenefitLabels, key)) { unsupported = true; continue }
    if (key === 'color') output[key] = text(v, 64)
    else if (key === 'checkinCard') output[key] = number(v)
    else if (typeof v === 'boolean') output[key] = v
    else if (key === 'autoCheckin' && typeof v === 'number') output[key] = number(v)
    else throw bad()
  }
  return { values: output, unsupported }
}
async function read(path: string) {
  const key = getLegacyKey(), r = legacyObject(await request(path, { cache: 'no-store' }))
  if (key !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  if (r.code !== 0) throw new ApiError(typeof r.msg === 'string' ? r.msg : '会员读取失败', 502)
  return r.data
}
export async function fetchLegacyMemberLevels(): Promise<LegacyMemberLevel[]> {
  const source = await read('/api/membership/levels')
  if (!Array.isArray(source) || source.length > 512) throw bad()
  const result = source.map(v => { const row = legacyObject(v), benefits = config(row.benefits); const durationValue = number(row.durationValue); if (!durationValue) throw bad(); return { id: id(row.oId), code: text(row.lvCode, 64), name: text(row.lvName), price: number(row.price), durationType: text(row.durationType, 32), durationValue, benefits: benefits.values, unsupported: benefits.unsupported } })
  if (new Set(result.map(row => row.id)).size !== result.length) throw bad()
  return result
}
export async function fetchLegacyMemberState(ownerId: string): Promise<LegacyMemberState> {
  const row = legacyObject(await read(`/api/membership/${id(ownerId)}`))
  if (row.state === 0) return { active: false, config: {}, unsupported: false }
  if (row.state !== 1 || row.userId !== ownerId) throw bad()
  const decoded = config(row.configJson)
  return { active: true, code: text(row.lvCode, 64), expiresAt: number(row.expiresAt, 8640000000000000), config: decoded.values, unsupported: decoded.unsupported }
}
export function legacyMemberInput(raw: LegacyMemberCommand): LegacyMemberCommand {
  if (raw.kind === 'open') {
    const levelId = id(raw.levelId), coupon = text(raw.coupon, 128).trim()
    if (/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/.test(coupon)) throw new ApiError('优惠券格式不合法', 422)
    return { kind: 'open', levelId, coupon }
  }
  if (raw.kind === 'config') {
    const decoded = config(JSON.stringify(raw.config))
    if (decoded.unsupported || !Object.keys(decoded.values).length) throw new ApiError('配置不能为空或包含未知字段', 422)
    return { kind: 'config', config: decoded.values }
  }
  throw new ApiError('会员操作不合法', 422)
}
export async function writeLegacyMember(raw: LegacyMemberCommand): Promise<{ acknowledged: true }> {
  const input = legacyMemberInput(raw), apiKey = getLegacyKey()
  if (!apiKey) throw new ApiError('请先登录操作会员', 401)
  const result = legacyObject(await request(input.kind === 'open' ? '/api/membership/open' : '/api/membership/config', { method: input.kind === 'open' ? 'POST' : 'PUT', cache: 'no-store', __captchaRetried: true, body: JSON.stringify({ apiKey, ...(input.kind === 'open' ? { oId: input.levelId, couponCode: input.coupon, configJson: '' } : { configJson: JSON.stringify(input.config) }) }) }))
  if (apiKey !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  if (result.code !== 0) throw new ApiError(typeof result.msg === 'string' ? result.msg : '会员操作结果未确认', 502)
  return { acknowledged: true }
}
