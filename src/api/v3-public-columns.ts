import { getApiMode } from './mode'
import { ApiError, request } from './http'
import { decodeV3ContentPage } from './v3-content'
export type PublicChapter = { id: string; title: string; chapterNo: number; createdAt: number; preview?: string }
export type PublicColumn = { id: string; title: string; coverURL: string; articleCount: number; updatedAt: number; chapters: PublicChapter[] }
export type ColumnChapterPage = { list: PublicChapter[]; p: number; size: number; total: number; pageCount: number }
const invalid = () => new ApiError('公开专栏响应格式不正确', 502)
function row(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown> }
function text(value: unknown, max = 65536) { if (typeof value !== 'string' || value.length > max) throw invalid(); return value }
function number(value: unknown) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
function time(value: unknown) { const result = number(value); if (result > 8640000000000000) throw invalid(); return result }
export function publicColumnId(value: string) { if (!value || value.length > 64 || /[^A-Za-z0-9_-]/.test(value)) throw new ApiError('专栏ID不合法', 422); return value }
function articleId(value: unknown) { if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value)) throw invalid(); return value }
function image(value: unknown) {
  const raw = text(value, 4096); if (!raw) return ''
  if (/[\\\s\u0000-\u001f\u007f]/.test(raw)) return ''
  try { const parsed = new URL(raw); return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? raw : '' } catch { return raw.startsWith('/') && !raw.startsWith('//') ? raw : '' }
}
function chapter(value: unknown): PublicChapter { const data = row(value); return { id: articleId(data.id), title: text(data.title), chapterNo: number(data.chapterNo), createdAt: time(data.createdAt), ...(data.preview === undefined ? {} : { preview: text(data.preview) }) } }
function chapters(value: unknown) { if (!Array.isArray(value)) throw invalid(); const list = value.map(chapter); if (new Set(list.map(x => x.id)).size !== list.length) throw invalid(); return list }
export function decodePublicColumnCard(value: unknown): PublicColumn {
  const data = row(value), id = publicColumnId(text(data.id, 64)), latest = chapters(data.chapters)
  if (data.columnId !== undefined && data.columnId !== id || latest.length > 2) throw invalid()
  const articleCount = number(data.articleCount)
  if (articleCount < 1 || latest.length < 1 || latest.length > articleCount) throw invalid()
  return { id, title: text(data.title), coverURL: image(data.coverURL), articleCount, updatedAt: time(data.updatedAt), chapters: latest }
}
async function data(path: string) { const envelope = row(await request(path, { cache: 'no-store' })); if (envelope.code !== 0) throw invalid(); return row(envelope.data) }
function paging(p: number, size: number) { if (!Number.isSafeInteger(p) || p < 1 || p > 42949672 || !Number.isSafeInteger(size) || size < 1 || size > 50) throw new ApiError('专栏页码不合法', 422) }
export async function fetchPublicColumnCards(kind: 'latest' | 'hot', p = 1, size = 12) {
  paging(p, size); if (!['latest', 'hot'].includes(kind)) throw new ApiError('专栏排序不合法', 422)
  const page = decodeV3ContentPage(await data(`/api/v3/columns${kind === 'hot' ? '/hot' : ''}?p=${p}&size=${size}`))
  if (page.pagination.p !== p || page.pagination.size !== size) throw invalid()
  const list = page.list.map(decodePublicColumnCard); if (new Set(list.map(x => x.id)).size !== list.length) throw invalid()
  return { ...page.pagination, list }
}
export async function fetchPublicColumnDetail(id: string) {
  if(getApiMode()==='v1') return (await import('./legacy/columns')).legacyColumnDetail(id)
  publicColumnId(id); const result = await data(`/api/v3/columns/${encodeURIComponent(id)}`), meta = decodePublicColumnCard(result.column), list = chapters(result.chapters)
  if (meta.id !== id || meta.articleCount !== list.length || list.some((item, index) => index > 0 && item.chapterNo < list[index - 1]!.chapterNo)) throw invalid()
  return { column: meta, first: list[0] || null, latest: list[list.length - 1] || null }
}
export async function fetchColumnChapters(id: string, p = 1): Promise<ColumnChapterPage> {
  if(getApiMode()==='v1') return (await import('./legacy/columns')).legacyColumnPage(id,p)
  publicColumnId(id); paging(p, 20); const page = decodeV3ContentPage(await data(`/api/v3/columns/${encodeURIComponent(id)}/articles?p=${p}&size=20`))
  if (page.pagination.p !== p || page.pagination.size !== 20) throw invalid()
  return { ...page.pagination, list: chapters(page.list) }
}
