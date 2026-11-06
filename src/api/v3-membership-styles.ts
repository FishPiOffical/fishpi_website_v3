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
export async function fetchV3MembershipStyles(userIds: string[]): Promise<{ userId: string; style: MembershipStyle }[]> {
  if (!userIds.length || userIds.length > 100 || userIds.some(id => membershipUserId(id) !== id) || new Set(userIds).size !== userIds.length) throw new ApiError('用户ID列表不合法', 422)
  const result = await request<{ code: number; msg?: string; data?: unknown }>(`/api/v3/membership/styles?${new URLSearchParams({ userIds: userIds.join(',') })}`)
  if (result.code !== 0) throw new ApiError(result.msg || '昵称样式读取失败', 400)
  const data = object(result.data)
  if (!Array.isArray(data.list) || data.list.length !== userIds.length) throw invalid()
  return data.list.map((value, index) => { const row = object(value); if (row.userId !== userIds[index]) throw invalid(); return { userId: userIds[index]!, style: style(row.style) } })
}
export async function resolveV3NicknameUser(userName: string): Promise<{ id: string; userName: string }> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userName)) throw new ApiError('用户名不合法', 422)
  const result = await request<{ code: number; msg?: string; data?: unknown }>(`/api/v3/users/${encodeURIComponent(userName)}`)
  if (result.code !== 0) throw new ApiError(result.msg || '用户读取失败', 400)
  const row = object(result.data), id = membershipUserId(row.id)
  if (!id || typeof row.userName !== 'string' || row.userName.toLowerCase() !== userName.toLowerCase()) throw invalid()
  return { id, userName: row.userName }
}
