import {getApiMode} from './mode'
import { ApiError, request } from './http'
import { publicUserName } from './v3-public-user'
import { adaptV3Article, adaptV3Comment, decodeV3ContentPage } from './v3-content'
import { decodeBreezemoon, type V3Breezemoon } from './v3-breezemoon-data'
import { fetchV3Breezemoon } from './v3-breezemoons'
import type { ArticleSummary, ArticleComment } from './fishpi'
export type MemberContentKind = 'home' | 'long' | 'comments' | 'breezemoons'
export type MemberComment = { id: string; articleId: string; article: ArticleSummary; comment: ArticleComment }
export type MemberContentPage = { p: number; size: number; total: number; pageCount: number; articles: ArticleSummary[]; comments: MemberComment[]; moons: V3Breezemoon[] }
const invalid = () => new ApiError('用户内容响应格式不正确', 502)
export async function fetchMemberContent(userName: string, kind: MemberContentKind, p = 1): Promise<MemberContentPage> {
  publicUserName(userName)
  if (!['home', 'long', 'comments', 'breezemoons'].includes(kind) || !Number.isSafeInteger(p) || p < 1 || p > 42949672) throw new ApiError('用户内容参数不合法', 422)
  if(getApiMode()==='v1')return(await import('./legacy/member-content')).legacyMemberContent(userName,kind,p)
  const suffix = kind === 'home' || kind === 'long' ? 'articles' : kind
  const envelope = await request<{ code: number; data: unknown }>(`/api/v3/users/${encodeURIComponent(userName)}/${suffix}?p=${p}&size=20${suffix === 'articles' ? `&sort=latest&type=${kind === 'long' ? 'long' : 'recent'}` : ''}`, { cache: 'no-store' })
  if (!envelope || envelope.code !== 0) throw invalid()
  const page = decodeV3ContentPage(envelope.data)
  if (page.pagination.p !== p || page.pagination.size !== 20) throw invalid()
  const result: MemberContentPage = { ...page.pagination, articles: [], comments: [], moons: [] }
  const authorMatches = (name: string) => name.toLowerCase() === userName.toLowerCase()
  if (suffix === 'articles') result.articles = page.list.map(value => { const article = adaptV3Article(value); if (article.articleAnonymous || !authorMatches(article.articleAuthorName || '')) throw invalid(); return article })
  if (kind === 'breezemoons') result.moons = page.list.map(value => { const moon = decodeBreezemoon(value); if (!authorMatches(moon.author.userName)) throw invalid(); return moon })
  if (kind === 'comments') result.comments = page.list.map(value => {
    const comment = adaptV3Comment(value), article = adaptV3Article(value.article)
    if (value.anonymous !== false || !authorMatches(comment.commentAuthorName || '') || typeof value.articleId !== 'string' || value.articleId !== article.oId || ![0, 1].includes(value.type as number)) throw invalid()
    return { id: comment.oId, articleId: article.oId, article, comment }
  })
  const ids = [...result.articles.map(x => x.oId), ...result.comments.map(x => x.id), ...result.moons.map(x => x.id)]
  if (new Set(ids).size !== ids.length) throw invalid()
  return result
}
export async function fetchMemberMoon(userName: string, id: string) {
  publicUserName(userName)
  if(getApiMode()==='v1')throw new ApiError('旧接口不支持按编号读取单条用户清风，请返回用户清风列表查看',501)
  const moon = await fetchV3Breezemoon(id)
  if (moon.author.userName.toLowerCase() !== userName.toLowerCase()) throw new ApiError('这条清风明月不属于当前用户', 404)
  return moon
}
