import { ApiError, request } from './http'
export type AnonymousKind = 'articles' | 'comments'
export type AnonymousArticle = { id: string; title: string; type: number; createdAt: number; updatedAt: number }
export type AnonymousComment = { id: string; articleId: string; articleTitle: string; createdAt: number; visibility: 0 | 1 }
export type AnonymousEntry = AnonymousArticle | AnonymousComment
export type AnonymousPage = { list: AnonymousEntry[]; p: number; size: number; total: number; pageCount: number }
type Row = Record<string, unknown>
const invalid = () => new ApiError('匿名内容响应格式不正确', 502, 'invalid_response')
function row(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
function count(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
function time(value: unknown): number { const n = count(value); if (!Number.isFinite(new Date(n).getTime())) throw invalid(); return n }
function id(value: unknown): string { if (typeof value !== 'string' || !/^[0-9]{1,32}$/.test(value)) throw invalid(); return value }
function title(value: unknown): string { if (typeof value !== 'string' || value.length > 255) throw invalid(); return value }
export async function fetchV3AnonymousContent(kind: AnonymousKind, p = 1, size = 20): Promise<AnonymousPage> {
  if (!['articles', 'comments'].includes(kind) || !Number.isSafeInteger(p) || p < 1 || p > 42949672 || !Number.isSafeInteger(size) || size < 1 || size > 50) throw new ApiError('匿名内容分页参数不合法', 422)
  const envelope = row(await request(`/api/v3/me/anonymous-${kind}?p=${p}&size=${size}`, { cache: 'no-store' }))
  if (envelope.code !== 0) throw invalid()
  const data = row(envelope.data), meta = row(data.pagination), total = count(meta.total), pageCount = count(meta.pageCount)
  if (meta.p !== p || meta.size !== size || pageCount !== Math.ceil(total / size) || !Array.isArray(data.list) || data.list.length > size) throw invalid()
  const list = data.list.map(value => {
    const item = row(value), base = { id: id(item.id), createdAt: time(item.createdAt) }
    if (kind === 'articles') { const type = count(item.type); if (type > 6) throw invalid(); return { ...base, title: title(item.title), type, updatedAt: time(item.updatedAt) } }
    if (item.visibility !== 0 && item.visibility !== 1) throw invalid()
    return { ...base, articleId: id(item.articleId), articleTitle: title(item.articleTitle), visibility: item.visibility as 0 | 1 }
  })
  if (new Set(list.map(item => item.id)).size !== list.length) throw invalid()
  return { list, p, size, total, pageCount }
}
