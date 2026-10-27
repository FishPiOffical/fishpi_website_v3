import { ApiError, request } from './http'
export const usableCards = ['checkin1day', 'checkin2days', 'patchCheckinCard', 'nameCard'] as const
export type CardCode = typeof usableCards[number]
export type BagItem = { code: string; count: number }
export type InventoryCommand = { kind: 'checkin1day' | 'checkin2days' | 'patchCheckinCard' } | { kind: 'nameCard' | 'points'; userName: string }
export type InventoryReceipt = { kind: 'checkin1day' | 'checkin2days'; remainingDays: number; bag: BagItem[] } | { kind: 'patchCheckinCard'; streak: number; streakStart: number; streakEnd: number; longestStreak: number; bag: BagItem[] } | { kind: 'nameCard'; userName: string; bag: BagItem[] } | { kind: 'points'; userName: string; paidPoints: number }
type Row = Record<string, unknown>
const invalid = () => new ApiError('背包或改名响应格式不正确', 502, 'invalid_response')
function object(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
function integer(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw invalid(); return value }
function count(value: unknown): number { const n = integer(value); if (n < 0) throw invalid(); return n }
function userName(value: unknown): string { if (typeof value !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(value)) throw invalid(); return value }
function day(value: unknown): number { const n = integer(value), s = String(n); if (!/^[1-9][0-9]{7}$/.test(s)) throw invalid(); const d = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6)}T00:00:00Z`); if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10).replaceAll('-','') !== s) throw invalid(); return n }
function bag(value: unknown): BagItem[] {
  const source = object(value); if (!Array.isArray(source.list)) throw invalid(); const codes = new Set<string>()
  return source.list.map((item: unknown) => { const row = object(item); if (typeof row.code !== 'string' || !row.code || codes.has(row.code)) throw invalid(); codes.add(row.code); return { code: row.code, count: integer(row.count) } })
}
async function data(path: string, init?: RequestInit): Promise<Row> { const response = object(await request(path, init)); if (response.code !== 0) throw new ApiError(typeof response.msg === 'string' ? response.msg : '背包操作失败', 502); return object(response.data) }
export function inventoryInput(input: InventoryCommand): InventoryCommand {
  if (!input || ![...usableCards, 'points'].includes(input.kind)) throw new ApiError('不支持此操作', 422)
  if (input.kind === 'nameCard' || input.kind === 'points') {
    const name = typeof input.userName === 'string' ? input.userName : ''
    const normalized = input.kind === 'nameCard' ? name.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '') : name
    if (!/^[A-Za-z0-9-]{1,64}$/.test(normalized)) throw new ApiError('用户名须为1至64位英文字母、数字或连字符；积分改名不接受首尾空白', 422)
    return { kind: input.kind, userName: normalized }
  }
  return { kind: input.kind }
}
export async function fetchV3Bag(): Promise<BagItem[]> { return bag(await data('/api/v3/me/bag')) }
export async function executeV3Inventory(raw: InventoryCommand, key: string): Promise<InventoryReceipt> {
  const input = inventoryInput(raw)
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('操作标识不合法', 422)
  const renamed = 'userName' in input, result = await data(input.kind === 'points' ? '/api/v3/me/settings/user-name' : `/api/v3/me/bag/${input.kind}/use`, { method: input.kind === 'points' ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(renamed ? { userName: input.userName } : {}) })
  if (renamed && userName(result.userName) !== input.userName || input.kind !== 'points' && result.itemCode !== input.kind) throw invalid()
  if (input.kind === 'points') return { kind: 'points', userName: userName(result.userName), paidPoints: count(result.paidPoints) }
  const current = bag(result.bag)
  if (input.kind === 'nameCard') return { kind: 'nameCard', userName: userName(result.userName), bag: current }
  if (input.kind === 'patchCheckinCard') return { kind: input.kind, streak: count(result.streak), streakStart: day(result.streakStart), streakEnd: day(result.streakEnd), longestStreak: count(result.longestStreak), bag: current }
  return { kind: input.kind, remainingDays: count(result.remainingDays), bag: current }
}
