import { formatDateTime } from '@/utils/time'
import { ApiError, request } from './http'
export type PointChange = { time: number; amount: number; operation: '+' | '-'; balance: number; type: number; displayType: string }
export type PointEntry = PointChange & { descriptionHtml: string }
export type PointPage<T = PointEntry> = { list: T[]; p: number; size: number; total: number; pageCount: number }
type Row = Record<string, unknown>
const invalid = () => new ApiError('积分流水响应格式不正确', 502, 'invalid_response')
function object(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
function integer(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw invalid(); return value }
function count(value: unknown): number { const n = integer(value); if (n < 0) throw invalid(); return n }
function text(value: unknown): string { if (typeof value !== 'string') throw invalid(); return value }
async function data(path: string, signal?: AbortSignal): Promise<Row> { const body = object(await request(path, signal ? { signal, cache: 'no-store' } : undefined)); if (body.code !== 0) throw new ApiError(typeof body.msg === 'string' ? body.msg : '积分读取失败', 502); return object(body.data) }
function pointRow(row: Row): PointChange {
  const time = count(row.time)
  if (!Number.isFinite(new Date(time).getTime()) || row.operation !== '+' && row.operation !== '-') throw invalid()
  return { time, amount: integer(row.amount), operation: row.operation, balance: integer(row.balance), type: integer(row.type), displayType: text(row.displayType) }
}

async function readPointPage<T>(path: string, p: number, size: number, project: (row: Row) => T, signal?: AbortSignal): Promise<PointPage<T>> {
  if (!Number.isSafeInteger(p) || p < 1 || p > 42949672 || !Number.isSafeInteger(size) || size < 1 || size > 50) throw new ApiError('积分流水分页参数不合法', 422)
  const source = await data(`${path}?p=${p}&size=${size}`, signal), pagination = object(source.pagination)
  if (!Array.isArray(source.list) || source.list.length > size || pagination.p !== p || pagination.size !== size) throw invalid()
  const total = count(pagination.total), pageCount = count(pagination.pageCount)
  if (pageCount !== Math.ceil(total / size)) throw invalid()
  return { list: source.list.map(value => project(object(value))), p, size, total, pageCount }
}

export function fetchV3PointPage(p = 1, size = 20): Promise<PointPage> {
  return readPointPage('/api/v3/me/points', p, size, row => ({ ...pointRow(row), descriptionHtml: text(row.descriptionHtml) }))
}

export function fetchV3MemberPoints(userName: string, page: number, signal: AbortSignal): Promise<PointPage<PointChange>> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userName)) throw new ApiError('用户名不合法', 422)
  return readPointPage(`/api/v3/users/${encodeURIComponent(userName)}/points`, page, 20, pointRow, signal)
}
export async function fetchV3PointBalance(): Promise<number> { return integer((await data('/api/v3/me')).userPoint) }
export function pointChange(row: Pick<PointEntry, 'operation' | 'amount'>): string { const change = row.operation === '-' ? -row.amount : row.amount; return `${change >= 0 ? '+' : ''}${change}` }
export function pointTime(value: number): string { return formatDateTime(value) }
