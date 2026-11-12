import { ApiError, request } from './http'

export type AppearanceKind = 'mount' | 'bubble' | 'frame'
export interface ShopProduct {
  id: string; kind: AppearanceKind; styleId: string; name: string
  version: number; price7: number; price30: number; enabled: boolean; revision: number
}
export interface ShopInventory {
  list: { productId: string; expiresAt: number }[]
  mountId: string; serverNow: number; balance: number
}
export type ShopCommand =
  | { kind: 'buy'; productId: string; days: 7 | 30; revision: number; key: string }
  | { kind: 'mount'; productId: string; key: string }
const invalid = () => new ApiError('外观商城数据暂不可用', 502)
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
function number(value: unknown, min = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) throw invalid()
  return value
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.length > 100) throw invalid()
  return value
}
export async function readShop(signal?: AbortSignal): Promise<ShopProduct[]> {
  const response = await request<{ code: number; data: unknown }>('/api/v3/appearance-shop', { signal })
  if (response.code !== 0) throw invalid()
  const data = object(response.data)
  if (!Array.isArray(data.list) || data.list.length > 100) throw invalid()
  return data.list.map(value => {
    const row = object(value)
    if (!['mount', 'bubble', 'frame'].includes(String(row.kind)) || typeof row.enabled !== 'boolean') throw invalid()
    return {
      id: text(row.id), kind: row.kind as AppearanceKind, styleId: text(row.styleId), name: text(row.name),
      version: number(row.version, 1), price7: number(row.price7, 1), price30: number(row.price30, 1),
      enabled: row.enabled, revision: number(row.revision, 1),
    }
  })
}
export async function readShopInventory(signal?: AbortSignal): Promise<ShopInventory> {
  const response = await request<{ code: number; data: unknown }>('/api/v3/me/appearance-items', { signal, cache: 'no-store' })
  if (response.code !== 0) throw invalid()
  const data = object(response.data)
  if (!Array.isArray(data.list) || data.list.length > 100) throw invalid()
  return {
    list: data.list.map(value => { const row = object(value); return { productId: text(row.productId), expiresAt: number(row.expiresAt) } }),
    mountId: text(data.mountId), serverNow: number(data.serverNow), balance: number(data.balance, -2147483648),
  }
}
export async function executeShop(command: ShopCommand) {
  const purchase = command.kind === 'buy'
  const body = purchase ? { productId: command.productId, days: command.days, revision: command.revision } : { productId: command.productId }
  const response = await request<{ code: number; data: unknown }>(`/api/v3/me/${purchase ? 'appearance-purchases' : 'appearance-mount'}`, {
    method: purchase ? 'POST' : 'PUT', headers: { 'Idempotency-Key': command.key }, body: JSON.stringify(body),
  })
  if (response.code !== 0) throw invalid()
  const data = object(response.data)
  if (purchase) {
    if (!/^\d{1,19}$/.test(text(data.id)) || data.productId !== command.productId) throw invalid()
    number(data.paidPoints, 1); number(data.expiresAt, 1)
  } else text(data.mountId)
}
