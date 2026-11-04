import { getApiMode } from './mode'
import { ApiError, request } from './http'
import { decodeV3RelationUser, type RelationUser } from './v3-user-relations'
export type PublicUser = RelationUser & { userIntro: string; userURL: string }
export function publicUserName(value: string) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64 || /[^A-Za-z0-9_-]/.test(value)) throw new ApiError('用户名不合法', 422)
  return value
}
function safeWebsite(value: string) {
  if (/[\\\u0000-\u0020\u007f]/u.test(value)) return ''
  try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? value : '' } catch { return '' }
}
export function decodePublicUser(value: unknown, expectedName: string): PublicUser {
  publicUserName(expectedName)
  const user = decodeV3RelationUser(value), row = value as Record<string, unknown>
  if (user.userName.toLowerCase() !== expectedName.toLowerCase() || typeof row.userIntro !== 'string' || row.userIntro.length > 65536 || typeof row.userURL !== 'string' || row.userURL.length > 4096) throw new ApiError('用户资料响应格式不正确', 502)
  return { ...user, userIntro: row.userIntro, userURL: safeWebsite(row.userURL) }
}
export async function fetchPublicUser(userName: string): Promise<PublicUser> {
  publicUserName(userName)
  if(getApiMode()==='v1')return (await import('./legacy/public-user')).legacyPublicUser(userName)
  const envelope = await request<{ code: number; data: unknown }>(`/api/v3/users/${encodeURIComponent(userName)}`, { cache: 'no-store' })
  if (!envelope || envelope.code !== 0) throw new ApiError('用户资料响应格式不正确', 502)
  return decodePublicUser(envelope.data, userName)
}
