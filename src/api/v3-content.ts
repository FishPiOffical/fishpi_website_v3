import { ApiError, request } from './http'
import type { ArticleComment, ArticleDetail, ArticleFeedKind, ArticleSummary, DomainItem, TagItem } from './fishpi'

type Row = Record<string, unknown>
interface Page { list: Row[]; pagination: { p: number; size: number; total: number; pageCount: number } }
const invalid = () => new ApiError('内容接口响应格式不正确', 502, 'invalid_response')
function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Row
}
function text(value: unknown): string { if (typeof value !== 'string') throw invalid(); return value }
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid()
  return value
}
function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw invalid(); return value }
function id(value: unknown): string { const result = text(value); if (!/^\d{1,32}$/.test(result)) throw invalid(); return result }
function pathId(value: string): string {
  if (!/^\d{1,32}$/.test(value)) throw new ApiError('内容 ID 格式不正确', 422, 'invalid_request')
  return encodeURIComponent(value)
}
function params(p: number, size: number) {
  if (!Number.isSafeInteger(p) || p < 1 || !Number.isSafeInteger(size) || size < 1 || size > 50) {
    throw new ApiError('分页参数不合法（每页最多50条）', 422, 'invalid_request')
  }
  return `p=${p}&size=${size}`
}
async function get(path: string): Promise<unknown> {
  const envelope = row(await request(path))
  if (envelope.code !== 0) throw new ApiError(typeof envelope.msg === 'string' ? envelope.msg : '内容加载失败', 400, String(envelope.code))
  return envelope.data
}
export function decodeV3ContentPage(value: unknown): Page {
  const data = row(value), pagination = row(data.pagination)
  if (!Array.isArray(data.list)) throw invalid()
  const result = { p: number(pagination.p), size: number(pagination.size), total: number(pagination.total), pageCount: number(pagination.pageCount) }
  if (result.p < 1 || result.size < 1 || result.size > 50 || data.list.length > result.size || result.pageCount !== Math.ceil(result.total / result.size)) throw invalid()
  return { list: data.list.map(row), pagination: result }
}
function date(value: unknown): string {
  const millis = number(value), converted = new Date(millis)
  if (!Number.isFinite(converted.getTime())) throw invalid()
  return converted.toISOString()
}
function stick(value: unknown): NonNullable<ArticleSummary['stick']> {
  const data = row(value), active = bool(data.active), permanent = bool(data.permanent)
  const expiresAt = data.expiresAt === null ? null : number(data.expiresAt)
  if (permanent ? !active || expiresAt !== null : expiresAt === null) throw invalid()
  return { active, permanent, expiresAt }
}
export function adaptV3Article(value: unknown): ArticleSummary {
  const data = row(value), author = row(data.author), anonymous = bool(data.anonymous)
  return {
    articleAnonymous: anonymous ? 1 : 0,
    stick: data.stick === undefined ? undefined : stick(data.stick),
    oId: id(data.id), articleTitle: text(data.title), articleType: number(data.type),
    articleTags: text(data.tags), articlePreviewContent: text(data.preview),
    articleViewCount: number(data.viewCount), articleCommentCount: number(data.commentCount),
    articleCreateTimeStr: date(data.createdAt),
    // Anonymous identity is never recovered from any optional legacy aliases.
    articleAuthorId: anonymous ? '' : text(author.id),
    articleAuthorName: anonymous ? '匿名用户' : text(author.userName),
    articleAuthorThumbnailURL48: anonymous ? '' : text(author.userAvatarURL),
    articleAuthorThumbnailURL20: anonymous ? '' : text(author.userAvatarURL),
  }
}
export function adaptV3Comment(value: unknown): ArticleComment {
  const data = row(value), author = row(data.author), visible = bool(data.contentVisible), anonymous = bool(data.anonymous)
  return {
    commentContentVisible: visible,
    oId: id(data.id), commentOriginalCommentId: text(data.parentId),
    commentContent: visible ? text(data.contentHtml) : '', commentCreateTimeStr: date(data.createdAt),
    commentAuthorId: anonymous ? '' : text(author.id),
    commentAuthorName: anonymous ? '匿名用户' : text(author.userName),
    commentAuthorThumbnailURL: anonymous ? '' : text(author.userAvatarURL),
  }
}
export function adaptV3Domain(value: unknown): DomainItem {
  const data = row(value)
  return { uri: id(data.id), domainURI: text(data.uri), domainTitle: text(data.title), domainDescription: text(data.description), domainIconPath: text(data.iconURL) }
}
export function adaptV3Tag(value: unknown): TagItem {
  const data = row(value)
  return { tagURI: id(data.id), tagTitle: text(data.title), tagIconPath: text(data.iconURL), tagDescription: text(data.description), tagReferenceCount: number(data.articleCount) }
}
async function articleList(path: string) { return decodeV3ContentPage(await get(path)).list.map(adaptV3Article) }
export async function v3RecentArticles(page = 1, size = 40): Promise<ArticleSummary[]> {
  return articleList(`/api/v3/articles?${params(page, size)}&sort=latest&type=recent`)
}
export async function v3Search(query: string, page = 1, size = 40): Promise<ArticleSummary[]> {
  const q = query.trim()
  if (!q) return []
  return articleList(`/api/v3/search?${params(page, size)}&q=${encodeURIComponent(q)}&sort=latest&type=all`)
}
async function directory(kind: 'tags' | 'domains'): Promise<Row[]> {
  const list: Row[] = []
  for (let p = 1; ; p++) {
    // Fail explicitly rather than return a misleading truncated directory.
    if (p > 1000) throw new ApiError('目录过大，请稍后再试', 503, 'directory_unavailable')
    const page = decodeV3ContentPage(await get(`/api/v3/${kind}?${params(p, 50)}`))
    list.push(...page.list)
    if (p >= page.pagination.pageCount) return list
  }
}
async function resolveDirectoryId(kind: 'tags' | 'domains', value: string): Promise<string> {
  if (/^\d{1,32}$/.test(value)) return pathId(value)
  const matches = (await directory(kind)).filter(item => item.uri === value || item.title === value)
  if (matches.length !== 1) throw new ApiError(matches.length ? '目录名称不唯一，请从目录重新进入' : '目录不存在', matches.length ? 409 : 404, 'not_found')
  return pathId(id(matches[0]!.id))
}
export async function resolveV3TagId(value: string): Promise<string> { return resolveDirectoryId('tags', value) }
export async function v3ArticleFeed(kind: ArticleFeedKind, page = 1, size = 40, extra = ''): Promise<ArticleSummary[]> {
  const paging = params(page, size)
  if (kind === 'search') return v3Search(extra, page, size)
  if (kind === 'domain' || kind === 'tag') {
    const plural = kind === 'domain' ? 'domains' : 'tags'
    const resolved = await resolveDirectoryId(plural, extra)
    return articleList(`/api/v3/${plural}/${resolved}/articles?${paging}&sort=latest&type=all`)
  }
  const sort = kind === 'hot' ? 'month-comments' : kind === 'good' ? 'hot' : kind === 'reply' ? 'active' : 'latest'
  const type = kind === 'long' || kind === 'qna' || kind === 'perfect' ? kind : 'recent'
  if (!['recent', 'hot', 'long', 'good', 'reply', 'qna', 'perfect'].includes(kind)) {
    throw new ApiError('文章分类不合法', 422, 'invalid_request')
  }
  return articleList(`/api/v3/articles?${paging}&sort=${sort}&type=${type}`)
}
export async function v3Domains(): Promise<DomainItem[]> { return (await directory('domains')).map(adaptV3Domain) }
export async function v3Tags(page = 1, size = 50): Promise<{ tags: TagItem[]; total: number }> {
  const data = decodeV3ContentPage(await get(`/api/v3/tags?${params(page, size)}`))
  return { tags: data.list.map(adaptV3Tag), total: data.pagination.total }
}
export async function v3Article(articleId: string, page = 1): Promise<ArticleDetail> {
  const path = pathId(articleId)
  const [raw, rawComments] = await Promise.all([
    get(`/api/v3/articles/${path}`),
    get(`/api/v3/articles/${path}/comments?${params(page, 20)}&sort=oldest`),
  ])
  const detail = row(raw), comments = decodeV3ContentPage(rawComments)
  const format = text(detail.contentFormat)
  if (format !== 'markdown' && format !== 'thought') throw invalid()
  const rewarded = bool(detail.rewarded)
  const contentHtml=number(detail.type)===6 ? await (await import('./v3-comments')).v3ParagraphContent(articleId) : text(detail.contentHtml)
  return {
    ...adaptV3Article(detail), articleAnonymous: bool(detail.anonymous) ? 1 : 0,
    articleContent: contentHtml, articleOriginalContent: text(detail.content),
    articleRewardPoint: number(detail.rewardPoint), rewarded,
    articleRewardContent: rewarded ? text(detail.rewardContentHtml) : '',
    articleComments: comments.list.map(adaptV3Comment),
    pagination: { paginationCurrentPageNum: comments.pagination.p, paginationPageCount: comments.pagination.pageCount },
  }
}
