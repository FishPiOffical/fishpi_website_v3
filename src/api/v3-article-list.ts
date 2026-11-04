import { getApiMode } from './mode'
import { ApiError } from './http'
import { adaptV3Article, v3ArticleFeedPage } from './v3-content'
import { decodePublicColumnCard, fetchPublicColumnCards, type PublicColumn } from './v3-public-columns'
import type { ArticleFeedKind, ArticleSummary } from './fishpi'
export type ColumnOrder = 'recent' | 'hot'
type Metadata = { kind: ArticleFeedKind; extra: string; order: ColumnOrder; p: number; size: number; total: number | null; pageCount: number }
export type ArticleListing = Metadata & ({ resource: 'articles'; list: ArticleSummary[] } | { resource: 'columns'; list: PublicColumn[] })
const kinds = ['recent', 'hot', 'good', 'reply', 'long', 'qna', 'perfect', 'search', 'domain', 'tag']
const invalid = () => new ApiError('文章列表响应格式不正确', 502)
function row(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown> }
function integer(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
/** Reproject an already adapted public SSR article. Never serialize arbitrary legacy aliases. */
export function decodePublicArticleSummary(value: unknown): ArticleSummary {
  const r = row(value)
  if (r.articleAnonymous !== 0 && r.articleAnonymous !== 1 || typeof r.articleCreateTimeStr !== 'string') throw invalid()
  if (!Number.isFinite(Date.parse(r.articleCreateTimeStr)) || new Date(r.articleCreateTimeStr).toISOString() !== r.articleCreateTimeStr) throw invalid()
  if (r.articlePerfect !== undefined && r.articlePerfect !== 0 && r.articlePerfect !== 1) throw invalid()
  const result = adaptV3Article({ id: r.oId, title: r.articleTitle, preview: r.articlePreviewContent, tags: r.articleTags,
    type: r.articleType, anonymous: r.articleAnonymous === 1, createdAt: Date.parse(r.articleCreateTimeStr), viewCount: r.articleViewCount,
    commentCount: r.articleCommentCount, author: { id: r.articleAuthorId, userName: r.articleAuthorName, userNickname: r.articleAuthorNickname ?? '', userAvatarURL: r.articleAuthorThumbnailURL48 },
    ...(r.stick === undefined ? {} : { stick: r.stick }),
    ...(r.articlePerfect === undefined ? {} : { perfect: r.articlePerfect === 1 }) })
  return result
}
export function decodeArticleListing(value: unknown, kind: ArticleFeedKind, extra: string, order: ColumnOrder, p = 1): ArticleListing {
  const r = row(value), size = kind === 'long' ? 12 : 20
  if (!Number.isSafeInteger(p) || p < 1 || p > 42949672 || !['recent', 'hot'].includes(order) || !kinds.includes(kind) || r.kind !== kind || r.extra !== extra || r.order !== order || r.p !== p || r.size !== size || !Array.isArray(r.list) || r.list.length > size) throw invalid()
  const total = getApiMode()==='v1' && r.total===null ? null : integer(r.total), pageCount = integer(r.pageCount)
  if (total!==null && pageCount !== Math.ceil(total / size)) throw invalid()
  const meta: Metadata = { kind, extra, order, p, size, total, pageCount }
  if (kind === 'long') {
    if (r.resource !== 'columns') throw invalid()
    const list = r.list.map(decodePublicColumnCard); if (new Set(list.map(x => x.id)).size !== list.length) throw invalid()
    return { ...meta, resource: 'columns', list }
  }
  if (r.resource !== 'articles') throw invalid()
  const list = r.list.map(decodePublicArticleSummary); if (new Set(list.map(x => x.oId)).size !== list.length) throw invalid()
  return { ...meta, resource: 'articles', list }
}
export async function fetchArticleListing(kind: ArticleFeedKind, extra = '', order: ColumnOrder = 'recent', p = 1): Promise<ArticleListing> {
  if (!kinds.includes(kind) || !['recent', 'hot'].includes(order) || typeof extra !== 'string' || !Number.isSafeInteger(p) || p < 1 || p > 42949672) throw new ApiError('文章列表参数不合法', 422)
  if(getApiMode()==='v1') {const value=await (await import('./legacy/content')).legacyListing(kind,extra,p);return decodeArticleListing({...value,kind,extra,order,resource:'articles'},kind,extra,order,p)}
  const meta = { kind, extra, order }
  const raw = kind === 'long' ? { ...meta, resource: 'columns', ...await fetchPublicColumnCards(order === 'recent' ? 'latest' : 'hot', p, 12) }
    : { ...meta, resource: 'articles', ...await v3ArticleFeedPage(kind, p, 20, extra) }
  return decodeArticleListing(raw, kind, extra, order, p)
}
