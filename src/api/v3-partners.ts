import { ApiError, request } from './http'

export type PartnerCommand =
  | { action: 'join' }
  | { action: 'leave' | 'unlock'; revision: number }
  | { action: 'hire' | 'release'; revision: number; peer: string }

function invalid(): never { throw new ApiError('搭子数据格式异常', 502, 'invalid_response') }
function row(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid()
}
function str(v: unknown) { return typeof v === 'string' ? v : invalid() }
function num(v: unknown) { return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : invalid() }
function bool(v: unknown) { return typeof v === 'boolean' ? v : invalid() }
function list(v: unknown): unknown[] { return Array.isArray(v) ? v : invalid() }

const base = '/api/v3/me/partners'
async function data(path: string, init: RequestInit) {
  const response = await request<{code: number; data: unknown}>(path, { ...init, signal: AbortSignal.timeout(15000) })
  return response?.code === 0 ? row(response.data) : invalid()
}
export async function readPartners(after = '') {
  const r = await data(base + (after ? '?after=' + encodeURIComponent(after) : ''), { cache: 'no-store' })
  return {
    joined: bool(r.joined), revision: num(r.revision), coins: num(r.coins), today: num(r.today),
    holderName: str(r.holderName), next: str(r.next),
    slots: list(r.slots).map(value => {
      const s = row(value)
      return { peer: str(s.peer), name: s.peer ? str(s.name) : '', rate: num(s.rate), today: num(s.today), usedMs: num(s.usedMs) }
    }),
    list: list(r.list).map(value => {
      const s = row(value)
      return { id: str(s.id), name: str(s.name), userName: str(s.userName), avatar: str(s.avatar), price: num(s.price), revision: num(s.revision), mine: bool(s.mine), full: bool(s.full) }
    }),
  }
}
export async function writePartner(cmd: PartnerCommand, key: string) {
  const { action, ...body } = cmd
  const receipt = await data(base + '/' + action, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) })
  if (receipt.action !== action) invalid()
}
