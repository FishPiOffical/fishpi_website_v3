import { ApiError, request } from './http'

export type PartnerCommand =
  | { action: 'join' }
  | { action: 'leave' | 'unlock'; revision: number }
  | { action: 'hire'; rateVersion?: number; revision: number; peer: string }
  | { action: 'release'; revision: number; peer: string }

function invalid(): never { throw new ApiError('搭子数据格式异常', 502, 'invalid_response') }
function row(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid()
}
function str(v: unknown) { return typeof v === 'string' ? v : invalid() }
function num(v: unknown) { return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : invalid() }
function bool(v: unknown) { return typeof v === 'boolean' ? v : invalid() }
function list(v: unknown): unknown[] { return Array.isArray(v) ? v : invalid() }

// 金额按十进制字符串处理，完整保留亿以上的身价精度。
function displayValue(value: unknown) {
  if (value === undefined) return undefined
  return typeof value === 'string' && /^[1-9][0-9]{0,41}$/.test(value) ? value : invalid()
}

export function formatPartnerValue(value: string) {
  const places = value.length > 8 ? 8 : 4
  if (value.length <= places) return value
  const fraction = value.slice(-places).replace(/0+$/, '')
  return value.slice(0, -places) + (fraction ? '.' + fraction : '') + (places === 8 ? ' 亿' : ' 万')
}

const base = '/api/v3/me/partners'
async function data(path: string, init: RequestInit) {
  const response = await request<{code: number; data: unknown}>(path, { ...init, signal: AbortSignal.timeout(15000) })
  return response?.code === 0 ? row(response.data) : invalid()
}
function decodeCard(value: unknown) {
  const s = row(value)
  const price = num(s.price)
  const legacy = s.rateVersion === undefined && s.rate === undefined
  return { displayValue: displayValue(s.displayValue), rate: legacy ? 40 + (price - 100) / 10 : num(s.rate),
    rateVersion: legacy ? undefined : num(s.rateVersion), id: str(s.id), name: str(s.name), userName: str(s.userName), avatar: str(s.avatar), price,
    revision: num(s.revision), mine: bool(s.mine), full: bool(s.full), following: bool(s.following) }
}
export async function readPartnerCard(id: string) {
  const r = await data(base + '/card/' + encodeURIComponent(id), { cache: 'no-store' })
  return r.card === null ? null : decodeCard(r.card)
}
export async function readPartners(after = '', peer = '') {
  const query = new URLSearchParams({ sort: 'following' })
  if (after) query.set('after', after)
  if (peer) query.set('peer', peer)
  const r = await data(base + '?' + query, { cache: 'no-store' })
  return {
    displayValue: displayValue(r.displayValue), joined: bool(r.joined), revision: num(r.revision), coins: num(r.coins), today: num(r.today),
    holderName: str(r.holderName), next: str(r.next),
    slots: list(r.slots).map(value => {
      const s = row(value)
      return { peer: str(s.peer), name: s.peer ? str(s.name) : '', rate: num(s.rate), today: num(s.today), usedMs: num(s.usedMs) }
    }),
    list: list(r.list).map(decodeCard),
  }
}
export async function writePartner(cmd: PartnerCommand, key: string) {
  const { action, ...body } = cmd
  const receipt = await data(base + '/' + action, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) })
  if (receipt.action !== action) invalid()
}

export type PartnerFeed = 'events' | 'wallet'
export async function readPartnerActivity(kind: PartnerFeed, before: string) {
  const query = new URLSearchParams({ kind })
  if (before) query.set('before', before)
  const r = await data(base + '/activity?' + query, { cache: 'no-store' })
  return { next: str(r.next), list: list(r.list).map(value => {
    const item = row(value)
    if (typeof item.amount !== 'number' || !Number.isSafeInteger(item.amount)) return invalid()
    return { id: str(item.oId), time: num(item.createdAt), amount: item.amount,
      summary: kind === 'events' ? str(item.summary) : '', operation: kind === 'wallet' ? str(item.operation) : '',
      price: kind === 'events' ? num(item.price) : 0 }
  }) }
}
