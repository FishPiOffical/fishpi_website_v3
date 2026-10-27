import { ApiError, request } from './http'

export type OwnerMedal = { id: string; name: string; type: string; description: string; order: number; expiresAt: number; displayed: boolean }
export type MedalPage = { list: OwnerMedal[]; pagination: { p: number; size: number; total: number; pageCount: number } }
type Row = Record<string, unknown>
const invalid = () => new ApiError('勋章响应格式不正确', 502, 'invalid_response')
const object = (v: unknown): Row => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid(); return v as Row }
const string = (v: unknown, max: number): string => { if (typeof v !== 'string' || v.length > max) throw invalid(); return v }
const integer = (v: unknown): number => { if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw invalid(); return v }
function id(value: unknown): string { const v = string(value, 128); if (!v || /[\u0000-\u001f\u007f]/.test(v)) throw invalid(); return v }
async function data(path: string, init?: RequestInit): Promise<Row> {
  const result = await request<{ code: number; msg?: string; data?: unknown }>(path, init)
  if (result.code !== 0) throw new ApiError(result.msg || '勋章操作失败', 400)
  return object(result.data)
}
const base = '/api/v3/me/medals'
export async function fetchV3OwnerMedals(p = 1, size = 20): Promise<MedalPage> {
  if (!Number.isSafeInteger(p) || p < 1 || !Number.isInteger(size) || size < 1 || size > 50) throw new ApiError('页码不合法', 422)
  const result = await data(`${base}?p=${p}&size=${size}`), page = object(result.pagination)
  const pagination = { p: integer(page.p), size: integer(page.size), total: integer(page.total), pageCount: integer(page.pageCount) }
  if (pagination.p !== p || pagination.size !== size || pagination.total < 0 || pagination.pageCount !== Math.ceil(pagination.total / size) || !Array.isArray(result.list) || result.list.length > size) throw invalid()
  const seen = new Set<string>()
  const list = result.list.map(value => {
    const row = object(value), key = id(row.id)
    if (seen.has(key) || typeof row.displayed !== 'boolean') throw invalid()
    seen.add(key)
    return { id: key, name: string(row.name, 128), type: string(row.type, 128), description: string(row.description, 1024), order: integer(row.order), expiresAt: integer(row.expiresAt), displayed: row.displayed }
  })
  return { list, pagination }
}
async function mutate(medal: string, resource: string, method: string, body: Row, key: string): Promise<Row> {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('操作标识不合法', 422)
  return data(`${base}/${encodeURIComponent(id(medal))}/${resource}`, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) })
}
export async function setV3MedalDisplayed(medal: string, displayed: boolean, key: string): Promise<{ id: string; displayed: boolean }> {
  if (typeof displayed !== 'boolean') throw new ApiError('展示状态不合法', 422)
  const result = await mutate(medal, 'display', 'PUT', { displayed }, key)
  if (id(result.id) !== medal || result.displayed !== displayed) throw invalid()
  return { id: medal, displayed }
}
export async function moveV3Medal(medal: string, direction: 'up' | 'down', key: string): Promise<{ id: string; direction: 'up' | 'down'; order: number }> {
  if (direction !== 'up' && direction !== 'down') throw new ApiError('移动方向不合法', 422)
  const result = await mutate(medal, 'move', 'POST', { direction }, key)
  const order = integer(result.order)
  if (id(result.id) !== medal || result.direction !== direction || order < 0) throw invalid()
  return { id: medal, direction, order }
}
