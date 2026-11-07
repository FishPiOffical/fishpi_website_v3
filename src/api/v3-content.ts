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
async function get(path: string, credentials?: RequestCredentials): Promise<unknown> {
  const envelope = row(await request(path, { cache: 'no-store', ...(credentials ? { credentials } : {}) }))
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
    ...(data.perfect === undefined ? {} : { articlePerfect: bool(data.perfect) ? 1 : 0 }),
    stick: data.stick === undefined ? undefined : stick(data.stick),
    oId: id(data.id), articleTitle: text(data.title), articleType: number(data.type),
    articleTags: text(data.tags), articlePreviewContent: text(data.preview),
    articleViewCount: number(data.viewCount), articleCommentCount: number(data.commentCount),
    articleCreateTimeStr: date(data.createdAt),
    // Anonymous identity is never recovered from any optional legacy aliases.
    articleAuthorId: anonymous ? '' : text(author.id),
    articleAuthorName: anonymous ? '匿名用户' : text(author.userName),
    articleAuthorNickname: anonymous ? '匿名用户' : text(author.userNickname),
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
    commentAuthorNickname: anonymous ? '匿名用户' : text(author.userNickname),
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
async function directory(kind: 'tags' | 'domains', credentials?: RequestCredentials): Promise<Row[]> {
  const list: Row[] = []
  for (let p = 1; ; p++) {
    // Fail explicitly rather than return a misleading truncated directory.
    if (p > 1000) throw new ApiError('目录过大，请稍后再试', 503, 'directory_unavailable')
    const page = decodeV3ContentPage(await get(`/api/v3/${kind}?${params(p, 50)}`, credentials))
    list.push(...page.list)
    if (p >= page.pagination.pageCount) return list
  }
}
// Published system-announcement tag ID. Keep old permalinks working without a directory read.
const ANNOUNCEMENT_TAG_ID = '1630398858319'
const ALIAS_PAGE_LIMIT = 4
const aliasCache = new Map<string, { id: string; expires: number }>()
const aliasFlights = new Map<string, Promise<string>>()

async function findDirectoryId(kind: 'tags' | 'domains', value: string) {
  const titleMatches = new Set<string>()
  for (let p = 1; p <= ALIAS_PAGE_LIMIT; p++) {
    const page = decodeV3ContentPage(await get(`/api/v3/${kind}?${params(p, 50)}`, 'omit'))
    if (page.pagination.p !== p || page.pagination.size !== 50) throw invalid()
    const uriMatches = page.list.filter(item => item.uri === value)
    if (uriMatches.length === 1) return pathId(id(uriMatches[0]!.id))
    if (uriMatches.length > 1) throw new ApiError('目录别名不唯一，请从目录重新进入', 409)
    for (const item of page.list) if (item.title === value) titleMatches.add(pathId(id(item.id)))
    if (p >= page.pagination.pageCount) {
      if (titleMatches.size === 1) return [...titleMatches][0]!
      if (titleMatches.size > 1) throw new ApiError('目录名称不唯一，请从目录重新进入', 409)
      throw new ApiError('目录不存在', 404, 'not_found')
    }
  }
  throw new ApiError('无法快速解析旧目录链接，请从标签或领域目录重新进入', 422, 'directory_alias_unresolved')
}

async function resolveDirectoryId(kind: 'tags' | 'domains', value: string) {
  if (/^\d{1,32}$/.test(value)) return pathId(value)
  if (kind === 'tags' && value === 'announcement') return ANNOUNCEMENT_TAG_ID
  const key = JSON.stringify([kind, value])
  const cached = aliasCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.id
  let flight = aliasFlights.get(key)
  if (!flight) {
    flight = findDirectoryId(kind, value).then(id => {
      aliasCache.delete(key)
      if (aliasCache.size >= 128) aliasCache.delete(aliasCache.keys().next().value!)
      aliasCache.set(key, { id, expires: Date.now() + 300_000 })
      return id
    }).finally(() => aliasFlights.delete(key))
    aliasFlights.set(key, flight)
  }
  return flight
}
export async function resolveV3TagId(value: string): Promise<string> { return resolveDirectoryId('tags', value) }
async function articleFeedPath(kind: ArticleFeedKind, page: number, size: number, extra: string): Promise<string | null> {
  const paging = params(page, size)
  if (kind === 'search') {
    const q = extra.trim()
    if (q.length > 100 || /[\u0000-\u001f\u007f-\u009f\p{Surrogate}]/u.test(q)) throw new ApiError('搜索关键词不合法（最多100个字符）', 422)
    return q ? `/api/v3/search?${paging}&q=${encodeURIComponent(q)}&sort=latest&type=all` : null
  }
  if (kind === 'domain' || kind === 'tag') {
    const plural = kind === 'domain' ? 'domains' : 'tags'
    const resolved = await resolveDirectoryId(plural, extra)
    return `/api/v3/${plural}/${resolved}/articles?${paging}&sort=latest&type=all`
  }
  const sort = kind === 'hot' ? 'month-comments' : kind === 'good' ? 'hot' : kind === 'reply' ? 'active' : 'latest'
  const type = kind === 'long' || kind === 'qna' || kind === 'perfect' ? kind : 'recent'
  if (!['recent', 'hot', 'long', 'good', 'reply', 'qna', 'perfect'].includes(kind)) {
    throw new ApiError('文章分类不合法', 422, 'invalid_request')
  }
  return `/api/v3/articles?${paging}&sort=${sort}&type=${type}`
}
export async function v3ArticleFeed(kind: ArticleFeedKind, page = 1, size = 40, extra = ''): Promise<ArticleSummary[]> {
  const path = await articleFeedPath(kind, page, size, extra)
  return path ? articleList(path) : []
}
export type V3ArticleFeedPage = { list: ArticleSummary[]; p: number; size: number; total: number; pageCount: number }
export async function v3ArticleFeedPage(kind: ArticleFeedKind, page = 1, size = 20, extra = '', credentials?: RequestCredentials): Promise<V3ArticleFeedPage> {
  if (page > 42949672) throw new ApiError('页码不合法', 422)
  const path = await articleFeedPath(kind, page, size, extra)
  if (!path) throw new ApiError('请输入搜索关键词', 422)
  const data = decodeV3ContentPage(await get(path, credentials))
  if (data.pagination.p !== page || data.pagination.size !== size) throw invalid()
  const list = data.list.map(adaptV3Article)
  if (new Set(list.map(item => item.oId)).size !== list.length) throw invalid()
  return { ...data.pagination, list }
}
export async function v3Domains(): Promise<DomainItem[]> { return (await directory('domains')).map(adaptV3Domain) }
export async function v3Tags(page = 1, size = 50, credentials?: RequestCredentials): Promise<{ tags: TagItem[]; total: number }> {
  const data = decodeV3ContentPage(await get(`/api/v3/tags?${params(page, size)}`, credentials))
  return { tags: data.list.map(adaptV3Tag), total: data.pagination.total }
}
export async function v3Article(articleId: string, page = 1): Promise<ArticleDetail> {
  const path = pathId(articleId), paging = params(page, 20)
  if (page > 42949672) throw new ApiError('页码不合法', 422)
  const [raw, rawComments] = await Promise.all([
    get(`/api/v3/articles/${path}`),
    get(`/api/v3/articles/${path}/comments?${paging}&sort=oldest`),
  ])
  const detail = row(raw), comments = decodeV3ContentPage(rawComments)
  if (detail.id !== articleId || comments.pagination.p !== page || comments.pagination.size !== 20) throw invalid()
  const seen = new Set<string>()
  const commentList = comments.list.map(item => {
    if (item.articleId !== articleId) throw invalid()
    const result = adaptV3Comment(item)
    if (seen.has(result.oId)) throw invalid()
    seen.add(result.oId)
    return result
  })
  const format = text(detail.contentFormat)
  if (format !== 'markdown' && format !== 'thought') throw invalid()
  const rewarded = bool(detail.rewarded)
  const commentable = detail.commentable == null ? null : bool(detail.commentable)
  const statement = detail.statement == null ? null : number(detail.statement)
  if (statement !== null && statement > 3) throw invalid()
  const type = number(detail.type)
  let question: Pick<ArticleDetail, 'articleQnAOfferPoint' | 'offered'> = {}
  // An older server may omit the additive field; never invent a zero offer or unresolved state.
  if (detail.qna !== undefined) {
    if (type === 5) {
      const qna = row(detail.qna)
      question = { articleQnAOfferPoint: number(qna.offerPoint), offered: bool(qna.accepted) }
    } else if (detail.qna !== null) throw invalid()
  }
  const contentHtml=number(detail.type)===6 ? await (await import('./v3-comments')).v3ParagraphContent(articleId) : text(detail.contentHtml)
  return {
    ...adaptV3Article(detail), articleAnonymous: bool(detail.anonymous) ? 1 : 0,
    articleContent: contentHtml, articleOriginalContent: text(detail.content),
    articleCommentable: commentable, articleStatement: statement,
    articleRewardPoint: number(detail.rewardPoint), rewarded,
    articleRewardContent: rewarded ? text(detail.rewardContentHtml) : '',
    ...question,
    articleComments: commentList,
    pagination: { paginationCurrentPageNum: comments.pagination.p, paginationPageCount: comments.pagination.pageCount },
  }
}
