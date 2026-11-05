import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
import { inventoryInput, type BagItem, type InventoryCommand } from '../v3-inventory'
export type LegacyInventoryCommand = Exclude<InventoryCommand, { kind: 'nameCard' | 'points'; userName: string }> | { kind: 'nameCard'; userName: string }
export const legacyCardLabels: Record<LegacyInventoryCommand['kind'], string> = { checkin1day: '单日免签卡', checkin2days: '两日免签卡', patchCheckinCard: '补签卡', nameCard: '改名卡' }
function bad() { return new ApiError('旧背包响应格式不正确', 502) }
export function legacyInventoryInput(raw: LegacyInventoryCommand): LegacyInventoryCommand {
  const input = inventoryInput(raw)
  if (input.kind === 'points') throw new ApiError('旧积分改名尚无 apiKey 写入协议', 501)
  return input as LegacyInventoryCommand
}
function bag(value: unknown): BagItem[] {
  const source = legacyObject(value), entries = Object.entries(source)
  if (entries.length > 512) throw bad()
  return entries.map(([code, count]) => {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(code) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 2147483647) throw bad()
    return { code, count }
  })
}
async function read(path: string, init: RequestInit & { __captchaRetried?: boolean } = {}) {
  const apiKey = getLegacyKey()
  if (!apiKey) throw new ApiError('请先登录查看或使用背包', 401)
  const result = legacyObject(await request(path + '?' + new URLSearchParams({ apiKey }), { cache: 'no-store', ...init }))
  if (apiKey !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  return result
}
export async function fetchLegacyBag(): Promise<BagItem[]> {
  const envelope = await read('/api/user/bag')
  if (envelope.code !== 0) throw new ApiError(typeof envelope.msg === 'string' ? envelope.msg : '背包读取失败', 502)
  return bag(envelope.data)
}
/** Three legacy GETs consume a card. Never call from loading, prefetch or automatic retries. */
export async function executeLegacyInventory(raw: LegacyInventoryCommand): Promise<{ kind: LegacyInventoryCommand['kind'] }> {
  const input = legacyInventoryInput(raw)
  let result: Record<string, unknown>
  if (input.kind === 'nameCard') {
    const apiKey = getLegacyKey()
    if (!apiKey) throw new ApiError('请先登录使用改名卡', 401)
    result = legacyObject(await request('/api/bag/nameCard', { method: 'POST', cache: 'no-store', __captchaRetried: true, body: JSON.stringify({ apiKey, userName: input.userName }) }))
    if (apiKey !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  } else {
    const paths = { checkin1day: '1dayCheckin', checkin2days: '2dayCheckin', patchCheckinCard: 'patchCheckin' }
    result = await read(`/api/bag/${paths[input.kind]}`, { __captchaRetried: true })
  }
  if (result.code !== 0) throw new ApiError(typeof result.msg === 'string' ? result.msg : '道具使用结果未确认', 502)
  // An empty renderer or malformed bag is not an acknowledgement. Never project this historical bag as current.
  bag(result.data)
  if (typeof result.msg !== 'string' || !result.msg || result.msg.length > 4000) throw bad()
  return { kind: input.kind }
}
