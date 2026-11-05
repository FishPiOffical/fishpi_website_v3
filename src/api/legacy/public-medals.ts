import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
export type LegacyPublicMedal = { definitionId?: string; name: string; description: string; type: string; expiresOn: string; imageURL?: string }
const bad = () => new ApiError('旧公开勋章响应格式不正确', 502)
function text(value: unknown, max: number) { if (typeof value !== 'string' || value.length > max) throw bad(); return value }
export function legacyMedalImageURL(attr: unknown): string | undefined {
  const raw = text(attr, 8192), match = /(?:^|&)url=(.*?)(?=&(?:backcolor|fontcolor|fontway)=|$)/.exec(raw)
  if (!match || !match[1]) return undefined
  const source = match[1]
  if (/\s|[\u0000-\u001f\u007f]/.test(source)) throw bad()
  let parsed: URL
  try { parsed = new URL(source) } catch { throw bad() }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw bad()
  return source
}
export async function fetchLegacyPublicMedals(name: string): Promise<LegacyPublicMedal[]> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) throw new ApiError('用户名不合法', 422)
  const key = getLegacyKey()
  const envelope = legacyObject(await request(`/user/${encodeURIComponent(name)}/medal`, { cache: 'no-store' }))
  if (key !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  if (envelope.code !== 0) throw new ApiError(typeof envelope.msg === 'string' ? envelope.msg : '公开勋章读取失败', 502)
  const source = legacyObject(envelope.data)
  if (!Array.isArray(source.list) || source.list.length > 1000) throw bad()
  return source.list.map(value => {
    const row = legacyObject(value)
    if (row.enabled !== true) throw bad()
    const expiresOn = text(row.expireDate, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || !Number.isFinite(Date.parse(expiresOn)) || new Date(expiresOn).toISOString().slice(0, 10) !== expiresOn) throw bad()
    const definitionId = row.id === undefined ? undefined : text(row.id, 19)
    if (definitionId !== undefined && !/^[0-9]{1,19}$/.test(definitionId)) throw bad()
    const imageURL = legacyMedalImageURL(row.attr)
    return { ...(definitionId ? { definitionId } : {}), name: text(row.name, 128), description: text(row.description, 4000), type: text(row.type, 32), expiresOn, ...(imageURL ? { imageURL } : {}) }
  })
}
