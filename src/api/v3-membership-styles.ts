import { ApiError, request } from './http'
export type MembershipStyle = { bold?: boolean; underline?: boolean; color?: string }
const effects = ['rainbow','neon','fire','ocean','forest','sunset','metal','galaxy']
const invalid = () => new ApiError('昵称样式响应格式不正确', 502, 'invalid_response')
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown> }
export function membershipUserId(value: unknown): string {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 1)) return ''
  return (typeof value === 'string' || typeof value === 'number') && /^[1-9][0-9]{0,18}$/.test(String(value)) ? String(value) : ''
}
function style(value: unknown): MembershipStyle {
  const row = object(value), result: MembershipStyle = {}
  for (const field of ['bold','underline'] as const) if (field in row) { if (typeof row[field] !== 'boolean') throw invalid(); result[field] = row[field] }
  if ('color' in row) { if (typeof row.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(row.color) && !effects.includes(row.color)) throw invalid(); result.color = row.color }
  return result
}
export type MembershipStylesSnapshot = {
  version: string
  maxAgeMs: number
} & ({ unchanged: true } | { unchanged: false; list: { userId: string; style: MembershipStyle | null }[] })
export async function fetchV3MembershipStyles(version?: string): Promise<MembershipStylesSnapshot> {
  if (version !== undefined && !/^[0-9a-f]{64}$/.test(version)) throw new ApiError('样式版本不合法', 422)
  const query = version ? `?${new URLSearchParams({ version })}` : ''
  const result = await request<{ code: number; msg?: string; data?: unknown }>(`/api/v3/membership/styles${query}`)
  if (result.code !== 0) throw new ApiError(result.msg || '昵称样式读取失败', 400)
  const data = object(result.data)
  if (typeof data.version !== 'string' || !/^[0-9a-f]{64}$/.test(data.version) || typeof data.unchanged !== 'boolean'
    || typeof data.maxAgeMs !== 'number' || !Number.isSafeInteger(data.maxAgeMs) || data.maxAgeMs < 0 || data.maxAgeMs > 30_000) throw invalid()
  if (data.unchanged) {
    if (version !== data.version || 'list' in data) throw invalid()
    return { version: data.version, maxAgeMs: data.maxAgeMs, unchanged: true }
  }
  if (!Array.isArray(data.list) || data.list.length > 10_000) throw invalid()
  const seen = new Set<string>()
  const list = data.list.map(value => {
    const row = object(value), id = membershipUserId(row.userId)
    if (!id || typeof row.userId !== 'string' || seen.has(id)) throw invalid()
    seen.add(id)
    if (row.configJson === null) return { userId: id, style: null }
    if (typeof row.configJson !== 'string' || row.configJson.length > 2048) throw invalid()
    let config: Record<string, unknown>
    try { config = object(JSON.parse(row.configJson)) } catch { throw invalid() }
    if (Object.keys(config).some(key => !['bold', 'underline', 'color'].includes(key))) throw invalid()
    return { userId: id, style: style(config) }
  })
  return { version: data.version, maxAgeMs: data.maxAgeMs, unchanged: false, list }
}
export async function resolveV3NicknameUser(userName: string): Promise<{ id: string; userName: string }> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userName)) throw new ApiError('用户名不合法', 422)
  const result = await request<{ code: number; msg?: string; data?: unknown }>(`/api/v3/users/${encodeURIComponent(userName)}`)
  if (result.code !== 0) throw new ApiError(result.msg || '用户读取失败', 400)
  const row = object(result.data), id = membershipUserId(row.id)
  if (!id || typeof row.userName !== 'string' || row.userName.toLowerCase() !== userName.toLowerCase()) throw invalid()
  return { id, userName: row.userName }
}
