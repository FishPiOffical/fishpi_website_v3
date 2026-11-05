import { ApiError, request } from '../http'
import { getLegacyKey, legacyAccount } from './auth'
import { legacyObject } from './home'
import { pointTransferInput, type PointTransfer } from '../v3-finance'
export async function readLegacyTransferBalance(ownerId: string): Promise<number> {
  const key = getLegacyKey()
  if (!key) throw new ApiError('请先登录查看余额', 401)
  const user = await legacyAccount(key)
  if (key !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  if (user.oId !== ownerId || typeof user.userPoint !== 'number' || !Number.isSafeInteger(user.userPoint)) throw new ApiError('本人余额响应不正确', 502)
  return user.userPoint
}
export async function transferLegacyPoints(raw: PointTransfer): Promise<{ acknowledged: true }> {
  const input = pointTransferInput(raw), apiKey = getLegacyKey()
  if (!apiKey) throw new ApiError('请先登录转账', 401)
  const response = legacyObject(await request('/point/transfer', { method: 'POST', cache: 'no-store', __captchaRetried: true, body: JSON.stringify({ apiKey, userName: input.userName, amount: input.amount, memo: input.memo }) }))
  if (apiKey !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  if (response.code !== 0) throw new ApiError(typeof response.msg === 'string' ? response.msg : '转账结果未确认', 502)
  return { acknowledged: true }
}
