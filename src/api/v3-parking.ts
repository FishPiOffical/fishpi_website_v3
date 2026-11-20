import { ApiError, request } from './http'

export type ParkingInput =
  | { action: 'starter'; car: string }
  | { action: 'buy'; car: string; expectedPrice: number }
  | { action: 'park'; car: string; hostId: string; note?: string; petId?: string }
  | { action: 'collect' | 'ticket' | 'pardon'; sessionId: string }
export interface ParkingCar { id: string; name: string; starter: boolean; enabled: boolean; price: number; rate: number }
export interface ParkingSession { id: string; car: string; startedAt: number; rate: number; earned: number; otherName: string; note: string; mountStyle: string; passengerSpecies: string | null; pardoned: boolean }

function invalid(): never { throw new ApiError('停车数据格式异常', 502, 'invalid_response') }
function row(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return invalid()
}
function str(v: unknown) { return typeof v === 'string' && v.length <= 256 ? v : invalid() }
function num(v: unknown) { return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : invalid() }
function list(v: unknown): unknown[] { return Array.isArray(v) ? v : invalid() }
function carId(v: unknown) { const id = str(v); return /^[a-z]{1,24}$/.test(id) ? id : invalid() }
function id(v: unknown) { const raw = str(v); return /^[1-9][0-9]{0,18}$/.test(raw) ? raw : invalid() }
function session(v: unknown): ParkingSession | null {
  if (v === null) return null
  const s = row(v)
  return { passengerSpecies: s.passengerSpecies == null ? null : str(s.passengerSpecies), id: id(s.id), car: carId(s.car), otherName: str(s.otherName), note: str(s.note ?? ''), mountStyle: str(s.mountStyle ?? ''), pardoned: s.pardoned === true, rate: num(s.rate), startedAt: num(s.startedAt), earned: num(s.earned) }
}
async function data(path: string, init: RequestInit) {
  const envelope = await request<{ code: number; data: unknown }>(path, { ...init, signal: AbortSignal.timeout(15_000) })
  if (envelope?.code !== 0) invalid()
  return row(envelope.data)
}
const base = '/api/v3/me/parking'
export async function readParking(after = '', scope: 'all' | 'following' = 'all', host = '') {
  const query = new URLSearchParams()
  if (after) query.set('after', after)
  if (scope === 'following') query.set('scope', scope)
  if (host) query.set('host', host)
  const r = await data(base + (query.size ? '?' + query : ''), { cache: 'no-store' })
  const catalog: ParkingCar[] = list(r.catalog).map(v => {
    const c = row(v)
    if (typeof c.starter !== 'boolean') invalid()
    return { id: carId(c.id), name: str(c.name), rate: num(c.rate), price: num(c.price), starter: c.starter, enabled: c.enabled !== false }
  })
  const spaces = list(r.spaces).map(v => { const s = row(v); return { id: id(s.id), name: str(s.name), free: s.free !== false } })
  const recent = list(r.recent).map(v => {
    const s = row(v)
    if (s.ending !== 'collect' && s.ending !== 'ticket') invalid()
    return { id: id(s.oId), car: carId(s.car), endedAt: num(s.endedAt), ending: s.ending, paid: num(s.paid) }
  })
  const pet = r.availablePet == null ? null : row(r.availablePet)
  const availablePet = pet && { id: id(pet.id), speciesId: str(pet.speciesId) }
  return { availablePet, catalog, recent, coins: num(r.coins), owned: list(r.owned).map(carId), serverNow: num(r.serverNow),
    occupant: session(r.occupant), driving: session(r.driving), spaces, next: r.next === '' ? '' : id(r.next) }
}
export type ParkingState = Awaited<ReturnType<typeof readParking>>
export async function writeParking(input: ParkingInput, key: string) {
  const { action, ...body } = input
  const r = await data(base + '/' + action, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) })
  if (r.action !== action || typeof r.amount !== 'number' || !Number.isSafeInteger(r.amount)) invalid()
  return r.amount
}

export async function readParkingWeekly() {
  const r = await data(base + '/weekly', { cache: 'no-store' })
  return { start: num(r.weekStart), rows: list(r.list).map(v => {
    const entry = row(v)
    return { name: str(entry.name), userName: str(entry.userName), income: num(entry.income) }
  }) }
}
