import { ApiError, request } from './http'
export type PointEntry = { time: number; amount: number; operation: '+' | '-'; balance: number; type: number; displayType: string; descriptionHtml: string }
export type PointPage = { list: PointEntry[]; p: number; size: number; total: number; pageCount: number }
type Row = Record<string, unknown>
const invalid = () => new ApiError('积分流水响应格式不正确', 502, 'invalid_response')
function object(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
function integer(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw invalid(); return value }
function count(value: unknown): number { const n = integer(value); if (n < 0) throw invalid(); return n }
function text(value: unknown): string { if (typeof value !== 'string') throw invalid(); return value }
async function data(path: string): Promise<Row> { const body = object(await request(path)); if (body.code !== 0) throw new ApiError(typeof body.msg === 'string' ? body.msg : '积分读取失败', 502); return object(body.data) }
export async function fetchV3PointPage(p = 1, size = 20): Promise<PointPage> {
  if (!Number.isSafeInteger(p) || p < 1 || p > 42949672 || !Number.isSafeInteger(size) || size < 1 || size > 50) throw new ApiError('积分流水分页参数不合法', 422)
  const source = await data(`/api/v3/me/points?p=${p}&size=${size}`), pagination = object(source.pagination)
  if (!Array.isArray(source.list) || source.list.length > size || pagination.p !== p || pagination.size !== size) throw invalid()
  const total = count(pagination.total), pageCount = count(pagination.pageCount)
  if (pageCount !== Math.ceil(total / size)) throw invalid()
  const list = source.list.map((value: unknown): PointEntry => {
    const row = object(value), time = count(row.time)
    if (!Number.isFinite(new Date(time).getTime()) || row.operation !== '+' && row.operation !== '-') throw invalid()
    return { time, amount: integer(row.amount), operation: row.operation, balance: integer(row.balance), type: integer(row.type), displayType: text(row.displayType), descriptionHtml: text(row.descriptionHtml) }
  })
  return { list, p, size, total, pageCount }
}
export async function fetchV3PointBalance(): Promise<number> { return integer((await data('/api/v3/me')).userPoint) }
export function pointChange(row: Pick<PointEntry, 'operation' | 'amount'>): string { const change = row.operation === '-' ? -row.amount : row.amount; return `${change >= 0 ? '+' : ''}${change}` }
export function pointTime(value: number): string { return new Date(value).toLocaleString() }
