import { ApiError, request } from './http'
export type RelationKind = 'following' | 'followers'
export type RelationUser = { id: string; userName: string; userNickname: string; userAvatarURL: string }
export type RelationPage = { list: RelationUser[]; p: number; size: number; total: number; pageCount: number }
const invalid = () => new ApiError('用户列表响应格式不正确', 502, 'invalid_response')
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown> }
function count(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
export function relationUserName(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) }
function avatar(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096) throw invalid()
  if (!value) return ''
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? value : '' } catch { return value.startsWith('/') && !value.startsWith('//') && !/[\\\s]/.test(value) ? value : '' }
}
export function decodeV3RelationUser(value: unknown): RelationUser {
    const row = object(value)
    if (typeof row.id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(row.id) || !relationUserName(row.userName) || typeof row.userNickname !== 'string' || row.userNickname.length > 1024) throw invalid()
    return { id: row.id, userName: row.userName, userNickname: row.userNickname, userAvatarURL: avatar(row.userAvatarURL) }
}
export async function fetchV3UserRelations(userName: string, kind: RelationKind, p = 1, size = 20): Promise<RelationPage> {
  if (!relationUserName(userName) || !['following', 'followers'].includes(kind) || !Number.isSafeInteger(p) || p < 1 || p > 42949672 || !Number.isSafeInteger(size) || size < 1 || size > 50) throw new ApiError('用户列表参数不合法', 422)
  const suffix = kind === 'following' ? 'following/users' : 'followers'
  const result = object(await request(`/api/v3/users/${encodeURIComponent(userName)}/${suffix}?p=${p}&size=${size}`, { cache: 'no-store' }))
  if (result.code !== 0) throw invalid()
  const data = object(result.data), meta = object(data.pagination), total = count(meta.total), pageCount = count(meta.pageCount)
  if (meta.p !== p || meta.size !== size || pageCount !== Math.ceil(total / size) || !Array.isArray(data.list) || data.list.length > size) throw invalid()
  const list = data.list.map(decodeV3RelationUser)
  if (new Set(list.map(user => user.id)).size !== list.length) throw invalid()
  return { list, p, size, total, pageCount }
}
