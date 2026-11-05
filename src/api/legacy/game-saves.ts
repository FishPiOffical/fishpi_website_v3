import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
import { GAME_ID, gameSaveData } from '../v3-game-saves'
export async function fetchLegacyGameSave(): Promise<string> {
  const apiKey = getLegacyKey()
  if (!apiKey) throw new ApiError('请先登录查看本人存档', 401)
  const result = legacyObject(await request('/api/cloud/get', { method: 'POST', cache: 'no-store', body: JSON.stringify({ apiKey, gameId: GAME_ID }) }))
  if (apiKey !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  if (result.code !== 0 || typeof result.data !== 'string') throw new ApiError('旧存档响应格式不正确', 502)
  try { return gameSaveData(result.data) } catch { throw new ApiError('旧存档超出本页安全读取范围或含无效Unicode', 502) }
}
export async function saveLegacyGameSave(raw: string): Promise<{ acknowledged: true }> {
  const data = gameSaveData(raw), apiKey = getLegacyKey()
  if (!apiKey) throw new ApiError('请先登录保存本人存档', 401)
  const result = legacyObject(await request('/api/cloud/sync', { method: 'POST', cache: 'no-store', __captchaRetried: true, body: JSON.stringify({ apiKey, gameId: GAME_ID, data }) }))
  if (apiKey !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  if (result.code !== 0) throw new ApiError(typeof result.msg === 'string' ? result.msg : '存档保存结果未确认', 502)
  return { acknowledged: true }
}
