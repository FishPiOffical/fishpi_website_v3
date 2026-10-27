import { ApiError, request } from './http'
export type UserFollowState = { targetId: string; following: boolean }
const validId = (id: string) => /^[1-9][0-9]{0,18}$/.test(id)
function data(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('关注响应格式不正确',502,'invalid_response'); return value as Record<string, unknown> }
export async function readV3UserFollow(targetId: string): Promise<UserFollowState> {
  if (!validId(targetId)) throw new ApiError('目标用户ID不合法',422)
  const envelope = data(await request(`/api/v3/me/follows/users/${targetId}`, { cache:'no-store' })), row = data(envelope.data)
  if (envelope.code !== 0 || row.targetId !== targetId || typeof row.following !== 'boolean') throw new ApiError('关注状态响应不正确',502,'invalid_response')
  return { targetId, following: row.following }
}
export async function setV3UserFollow(targetId: string, following: boolean, key: string): Promise<{ following: boolean; changed: boolean }> {
  if (!validId(targetId) || typeof following !== 'boolean' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('关注参数不合法',422)
  const envelope = data(await request(`/api/v3/me/follows/users/${targetId}`, { method:following?'PUT':'DELETE', headers:{'Idempotency-Key':key} })), row = data(envelope.data)
  if (envelope.code !== 0 || row.following !== following || typeof row.changed !== 'boolean') throw new ApiError('关注结果响应不正确',502,'invalid_response')
  return { following: row.following, changed: row.changed }
}
