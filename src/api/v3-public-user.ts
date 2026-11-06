import { ApiError, request } from './http'
import { decodeV3RelationUser, type RelationUser } from './v3-user-relations'
export type PublicUser = RelationUser & { userIntro: string; userURL: string; cardBg?: string; userPoint?: number; onlineMinute?: number }
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
  const profile: PublicUser = { ...user, userIntro: row.userIntro, userURL: safeWebsite(row.userURL) }
  if (row.cardBg !== undefined) {
    if (typeof row.cardBg !== 'string' || row.cardBg.length > 2048) throw new ApiError('用户背景响应格式不正确', 502)
    const background = row.cardBg
    const localImage = background.startsWith('/') && !background.startsWith('//') && !/[\\\u0000-\u0020\u007f]/u.test(background)
    profile.cardBg = localImage ? background : safeWebsite(background)
  }
  for (const field of ['userPoint', 'onlineMinute'] as const) {
    if (row[field] === undefined) continue
    const value = row[field]
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || field === 'onlineMinute' && value < 0) throw new ApiError('用户统计响应格式不正确', 502)
    profile[field] = value
  }
  return profile
}
export async function fetchPublicUser(userName: string): Promise<PublicUser> {
  publicUserName(userName)
  const envelope = await request<{ code: number; data: unknown }>(`/api/v3/users/${encodeURIComponent(userName)}`, { cache: 'no-store' })
  if (!envelope || envelope.code !== 0) throw new ApiError('用户资料响应格式不正确', 502)
  return decodePublicUser(envelope.data, userName)
}
