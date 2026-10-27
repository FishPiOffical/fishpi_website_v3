import { ApiError, request } from './http'
export const membershipEffects = ['rainbow','neon','fire','ocean','forest','sunset','metal','galaxy'] as const
export type MembershipConfig = { bold?: boolean; underline?: boolean; color?: string; autoCheckin?: boolean; checkinCard?: number; metal?: boolean; jointVip?: boolean }
export type MembershipDisplay = Pick<MembershipConfig, 'bold' | 'underline' | 'color'>
export type MembershipState = { active: boolean; levelCode: string; expiresAt: number; config: MembershipConfig }
export type MembershipLevel = { id: string; code: string; name: string; price: number; durationType: string; durationValue: number; benefits: MembershipConfig }
export type MembershipOpening = { levelId: string; couponCode: string }
export type MembershipReceipt = { id: string; levelCode: string; paidPoints: number; expiresAt: number }
type Row = Record<string, unknown>
const invalid = () => new ApiError('会员响应格式不正确', 502, 'invalid_response')
const object = (value: unknown): Row => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
const text = (value: unknown, max: number): string => { if (typeof value !== 'string' || value.length > max) throw invalid(); return value }
const number = (value: unknown): number => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
function id(value: unknown): string { const result = text(value, 19); if (!/^[1-9][0-9]{0,18}$/.test(result)) throw invalid(); return result }
export function membershipColor(value: string): boolean { return /^#[0-9a-fA-F]{6}$/.test(value) || (membershipEffects as readonly string[]).includes(value) }
function config(value: unknown, displayOnly = false): MembershipConfig {
  const source = object(value), result: MembershipConfig = {}
  for (const key of (displayOnly ? ['bold','underline'] : ['bold','underline','autoCheckin','metal','jointVip']) as (keyof MembershipConfig)[]) {
    if (key in source) { if (typeof source[key] !== 'boolean') throw invalid(); Object.assign(result, { [key]: source[key] }) }
  }
  if ('color' in source) { const color = text(source.color, 32); if (!membershipColor(color)) throw invalid(); result.color = color }
  if (!displayOnly && 'checkinCard' in source) { const count = number(source.checkinCard); if (count > 2147483647) throw invalid(); result.checkinCard = count }
  return result
}
async function data(path: string, init?: RequestInit): Promise<Row> {
  const response = await request<{ code: number; msg?: string; data?: unknown }>(path, init)
  if (response.code !== 0) throw new ApiError(response.msg || '会员操作失败', 400)
  return object(response.data)
}
export async function fetchV3Membership(): Promise<MembershipState> {
  const value = await data('/api/v3/me/membership')
  if (typeof value.active !== 'boolean') throw invalid()
  const levelCode = text(value.levelCode, 32), expiresAt = number(value.expiresAt), configuration = config(value.config)
  if (value.active ? !levelCode : levelCode !== '' || expiresAt !== 0 || Object.keys(configuration).length > 0) throw invalid()
  return { active: value.active, levelCode, expiresAt, config: configuration }
}
export async function fetchV3MembershipLevels(): Promise<MembershipLevel[]> {
  const result: MembershipLevel[] = [], seen = new Set<string>()
  let total: number | undefined, pages: number | undefined
  for (let p = 1; p <= (pages ?? 1); p++) {
    const value = await data(`/api/v3/membership/levels?p=${p}&size=50`), pagination = object(value.pagination)
    const count = number(pagination.total), pageCount = number(pagination.pageCount)
    if (pagination.p !== p || pagination.size !== 50 || pageCount !== Math.ceil(count / 50) || total !== undefined && count !== total || pages !== undefined && pages !== pageCount || !Array.isArray(value.list) || value.list.length !== Math.max(0, Math.min(50, count - (p - 1) * 50))) throw invalid()
    if (pageCount > 20) throw new ApiError('会员档位暂无法完整读取，请稍后重试', 503)
    total = count; pages = pageCount
    for (const item of value.list) {
      const row = object(item), key = id(row.id), duration = number(row.durationValue), price = number(row.price)
      if (seen.has(key) || duration < 1 || duration > 2147483647 || price > 2147483647) throw invalid()
      seen.add(key)
      result.push({ id: key, code: text(row.code, 32), name: text(row.name, 64), price, durationType: text(row.durationType, 16), durationValue: duration, benefits: config(row.benefits) })
    }
  }
  if (result.length !== total) throw invalid()
  return result
}
export function membershipDisplayFields(levels: MembershipLevel[], state: MembershipState): (keyof MembershipDisplay)[] {
  if (!state.active) return []
  const matches = levels.filter(level => level.code === state.levelCode)
  if (!matches.length) throw new ApiError('未找到当前档位的展示定义，请重新读取会员档位', 503)
  const fields = (level: MembershipLevel) => (['bold','underline','color'] as const).filter(key => Object.hasOwn(level.benefits, key))
  const selected = fields(matches[0]!)
  if (matches.some(level => fields(level).join(',') !== selected.join(','))) throw new ApiError('当前档位的展示定义不一致，暂不能编辑', 503)
  return [...selected]
}
function headers(key: string) { if (!/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('操作标识不合法', 422); return { 'Content-Type': 'application/json', 'Idempotency-Key': key } }
export async function saveV3MembershipDisplay(changes: MembershipDisplay, key: string): Promise<MembershipDisplay> {
  if (!Object.keys(changes).length || Object.keys(changes).some(field => !['bold','underline','color'].includes(field))) throw new ApiError('展示设置不合法', 422)
  const body = config(changes, true)
  const result = await data('/api/v3/me/membership/config', { method: 'PUT', headers: headers(key), body: JSON.stringify(body) })
  return config(result.config, true)
}
export function membershipOpening(levelId: string, rawCoupon: string): MembershipOpening {
  if (!/^[1-9][0-9]{0,18}$/.test(levelId) || typeof rawCoupon !== 'string' || rawCoupon.length > 128 || /[\u0000-\u001f\u007f-\u009f]/.test(rawCoupon)) throw new ApiError('档位或优惠券格式不合法', 422)
  const couponCode = rawCoupon.replace(/^ +| +$/g, '')
  if (couponCode && (couponCode.length < 8 || couponCode.length > 32 || Array.from(couponCode).some(char => char.length === 1 && /[\ud800-\udfff]/.test(char)))) throw new ApiError('优惠券应为8至32个字符', 422)
  return { levelId, couponCode }
}
export async function openV3Membership(input: MembershipOpening, key: string): Promise<MembershipReceipt> {
  const body = membershipOpening(input.levelId, input.couponCode)
  const result = await data('/api/v3/me/membership', { method: 'POST', headers: headers(key), body: JSON.stringify(body) })
  const expiresAt = number(result.expiresAt)
  if (!expiresAt) throw invalid()
  return { id: id(result.id), levelCode: text(result.levelCode, 32), paidPoints: number(result.paidPoints), expiresAt }
}
