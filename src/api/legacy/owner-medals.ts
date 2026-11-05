import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
import { legacyMedalImageURL } from './public-medals'
export type LegacyOwnerMedal = { recordId: string; definitionId: string; name: string; description: string; type: string; order: number; displayed: boolean; expiresAt: number; imageURL?: string }
export type LegacyMedalCommand = { definitionId: string; recordId: string } & ({ kind: 'display'; displayed: boolean } | { kind: 'move'; direction: 'up' | 'down' })
const invalid = () => new ApiError('旧本人勋章响应格式不正确', 502)
function text(v: unknown, max = 1024) { if (typeof v !== 'string' || v.length > max) throw invalid(); return v }
function id(v: unknown) { const value = text(v, 19); if (!/^[0-9]{1,19}$/.test(value)) throw invalid(); return value }
function number(v: unknown, max = Number.MAX_SAFE_INTEGER, min = 0) { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) throw invalid(); return v }
async function post(path: string, body: Record<string, unknown>, mutation = false) {
  const apiKey = getLegacyKey()
  if (!apiKey) throw new ApiError('请先登录查看或设置勋章', 401)
  const result = legacyObject(await request(path, { method: 'POST', cache: 'no-store', ...(mutation ? { __captchaRetried: true } : {}), body: JSON.stringify({ apiKey, ...body }) }))
  if (apiKey !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  if (result.code !== 0) throw new ApiError(typeof result.msg === 'string' ? result.msg : '勋章请求未确认', 502)
  return result
}
export async function fetchLegacyOwnerMedals(ownerId: string): Promise<LegacyOwnerMedal[]> {
  id(ownerId)
  const r = await post('/api/medal/my/list', {})
  if (!Array.isArray(r.data) || r.data.length > 1000) throw invalid()
  const list = r.data.map(value => {
    const row = legacyObject(value)
    if (id(row.user_id) !== ownerId || typeof row.display !== 'boolean') throw invalid()
    const imageURL = legacyMedalImageURL(row.medal_attr)
    return { recordId: id(row.user_medal_oId), definitionId: id(row.medal_id), name: text(row.medal_name, 128), description: text(row.medal_description, 8192), type: text(row.medal_type, 128), order: number(row.display_order, 2147483647, -2147483648), displayed: row.display, expiresAt: number(row.expire_time, 8640000000000000, -8640000000000000), ...(imageURL ? { imageURL } : {}) }
  })
  return list.sort((a, b) => a.order - b.order)
}
export function legacyMedalInput(raw: LegacyMedalCommand): LegacyMedalCommand {
  if (!raw) throw new ApiError('勋章操作不合法', 422)
  const definitionId = id(raw.definitionId), recordId = id(raw.recordId)
  if (raw.kind === 'display' && typeof raw.displayed === 'boolean') return { definitionId, recordId, kind: 'display', displayed: raw.displayed }
  if (raw.kind === 'move' && (raw.direction === 'up' || raw.direction === 'down')) return { definitionId, recordId, kind: 'move', direction: raw.direction }
  throw new ApiError('勋章操作不合法', 422)
}
export async function writeLegacyOwnerMedal(raw: LegacyMedalCommand): Promise<{ acknowledged: true }> {
  const command = legacyMedalInput(raw)
  await post(`/api/medal/my/${command.kind === 'display' ? 'display' : 'reorder'}`, { medalId: command.definitionId, ...(command.kind === 'display' ? { display: command.displayed } : { direction: command.direction }) }, true)
  return { acknowledged: true }
}
