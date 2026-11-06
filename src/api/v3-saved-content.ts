import { ApiError, request } from './http'
import { adaptV3Article, decodeV3ContentPage } from './v3-content'
import { relationUserName } from './v3-user-relations'
import type { ArticleSummary } from './fishpi'
export type SavedKind = 'tags' | 'collections' | 'subscriptions'
export type SavedTag = { id: string; title: string; description: string; articleCount: number; followerCount: number }
export type SavedArticle = { id: string; available: false } | { id: string; available: true; article: ArticleSummary }
export type SavedPage = { p: number; size: number; total: number; pageCount: number } & ({ kind:'tags'; list:SavedTag[] } | { kind:'collections' | 'subscriptions'; list:SavedArticle[] })
const invalid = () => new ApiError('关注内容响应格式不正确',502,'invalid_response')
function object(value: unknown): Record<string,unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string,unknown> }
function text(value: unknown): string { if (typeof value !== 'string') throw invalid(); return value }
function id(value: unknown): string { const valueId=text(value); if (!/^[1-9][0-9]{0,18}$/.test(valueId)) throw invalid(); return valueId }
function count(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
export async function fetchV3SavedContent(userName: string, kind: SavedKind, owner: boolean, p=1, size=20): Promise<SavedPage> {
  if (!relationUserName(userName) || !['tags','collections','subscriptions'].includes(kind) || typeof owner !== 'boolean' || !Number.isSafeInteger(p) || p<1 || p>42949672 || !Number.isSafeInteger(size) || size<1 || size>50) throw new ApiError('关注内容参数不合法',422)
  const suffix = kind === 'tags' ? 'following/tags' : kind === 'collections' ? 'following/articles' : 'watching/articles'
  const path = owner ? `/api/v3/me/${kind==='tags'?'follows/tags':kind}` : `/api/v3/users/${encodeURIComponent(userName)}/${suffix}`
  const envelope = object(await request(`${path}?p=${p}&size=${size}`,{cache:'no-store'}))
  if (envelope.code !== 0) throw invalid()
  const data = decodeV3ContentPage(envelope.data), meta = data.pagination
  if (meta.p !== p || meta.size !== size) throw invalid()
  const seen = new Set<string>()
  function unique(value: unknown) { const key=id(value); if (seen.has(key)) throw invalid(); seen.add(key); return key }
  if (kind === 'tags') return { ...meta, kind, list:data.list.map(row=>({id:unique(row.id),title:text(row.title),description:text(row.description),articleCount:count(row.articleCount),followerCount:count(row.followerCount)})) }
  const list: SavedArticle[] = data.list.map(row=>{
    const articleId=unique(row.id)
    if (owner) {
      if (typeof row.available !== 'boolean') throw invalid()
      if (!row.available) return {id:articleId,available:false}
    } else if ('available' in row) throw invalid()
    return {id:articleId,available:true,article:adaptV3Article(row)}
  })
  return {...meta,kind,list}
}
