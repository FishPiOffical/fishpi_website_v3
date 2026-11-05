import { ApiError, getAuthContextVersion, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
import { displayAvatar } from '../v3-profile'
export type LegacyOwnerProfile = { userName: string; nickname: string; intro: string; website: string; avatar: string }
export async function fetchLegacyOwnerProfile(ownerId: string, signal?:AbortSignal): Promise<LegacyOwnerProfile> {
  if (!/^[1-9][0-9]{0,18}$/.test(ownerId)) throw new ApiError('用户ID不合法', 422)
  signal?.throwIfAborted()
  const key = getLegacyKey(), context = getAuthContextVersion()
  if (!key) throw new ApiError('请先登录查看本人资料', 401)
  const envelope = legacyObject(await request('/api/user?' + new URLSearchParams({ apiKey: key }), { cache: 'no-store', redirect:'error', signal }))
  signal?.throwIfAborted()
  if (key !== getLegacyKey() || context !== getAuthContextVersion()) throw new ApiError('登录状态已变化', 409)
  if (envelope.code !== 0) throw new ApiError(typeof envelope.msg === 'string' ? envelope.msg : '本人资料读取失败', 502)
  const row = legacyObject(envelope.data)
  function text(value: unknown, max: number) { if (typeof value !== 'string' || value.length > max) throw new ApiError('旧本人资料响应格式不正确', 502); return value }
  if (row.oId !== ownerId || typeof row.userName !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(row.userName)) throw new ApiError('本人资料身份不一致', 502)
  const avatar = text(row.userAvatarURL, 8192), safeAvatar = displayAvatar(avatar)
  if (avatar && !safeAvatar) throw new ApiError('本人头像地址不合法', 502)
  return { userName: row.userName, nickname: text(row.userNickname, 4096), intro: text(row.userIntro, 8192), website: text(row.userURL, 8192), avatar: safeAvatar }
}
