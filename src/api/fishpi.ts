import { md5 } from 'js-md5'
import {
  mockArticle,
  mockCheckin,
  mockDomains,
  mockFeed,
  mockOnline,
  type DomainItem,
} from './catalog'
import { request, withKey } from './http'

export type { DomainItem }

export interface AccountInfo {
  oId: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  userPoint?: number
}

export interface ArticleSummary {
  oId: string
  articleTitle: string
  articleTitleEmoj?: string
  articleViewCount?: number
  articleViewCntDisplayFormat?: string
  articleStick?: number
  articleType?: number
  articlePerfect?: number
  articleTags?: string
  articleCommentCount?: number
  articleCreateTimeStr?: string
  timeAgo?: string
  columnTitle?: string
  articleAuthorName?: string
  articleAuthorThumbnailURL48?: string
}

export interface ArticleComment {
  oId: string
  commentAuthorName?: string
  commentAuthorThumbnailURL?: string
  commentContent?: string
  commentCreateTimeStr?: string
  timeAgo?: string
  commentThankCnt?: number
  commentOriginalCommentId?: string
}

export interface ArticleDetail extends ArticleSummary {
  articleContent?: string
  articleToC?: string
  articleCommentable?: boolean
  articleComments?: ArticleComment[]
  articleNiceComments?: ArticleComment[]
  pagination?: { paginationPageCount?: number; paginationCurrentPageNum?: number }
}

export interface Breezemoon {
  oId: string
  breezemoonAuthorName?: string
  breezemoonAuthorThumbnailURL48?: string
  breezemoonContent?: string
  breezemoonCity?: string
  timeAgo?: string
}

export interface RankUser {
  oId?: string
  userName: string
  userAvatarURL?: string
  userCheckinStreak?: number
  onlineMinute?: number
}

interface Envelope<T> {
  code: number
  msg?: string
  Key?: string
  data?: T
}

export async function login(username: string, passwd: string, mfaCode = '') {
  const res = await request<Envelope<never>>('/api/getKey', {
    method: 'POST',
    body: JSON.stringify({
      nameOrEmail: username,
      userPassword: md5(passwd),
      mfaCode,
    }),
  })
  if (res.code !== 0 || !res.Key) throw new Error(res.msg || '登录失败')
  return res.Key
}

export async function fetchAccount(apiKey: string) {
  const res = await request<Envelope<AccountInfo>>(withKey('/api/user', apiKey))
  if (res.code !== 0 || !res.data) throw new Error(res.msg || '密钥无效')
  return res.data
}

/** 匿名读未开放或接口 404 时回退 mock，字段与正式 JSON 对齐。 */
async function unwrapArticles(path: string, apiKey?: string | null, fallback?: () => ArticleSummary[]) {
  try {
    const res = await request<Envelope<{ articles?: ArticleSummary[] } | ArticleSummary[]>>(withKey(path, apiKey))
    if (res.code === 0) {
      const data = res.data
      if (Array.isArray(data) && data.length) return data
      if (data && 'articles' in data && Array.isArray(data.articles) && data.articles.length) return data.articles
    }
  } catch {
    /* 401/404 */
  }
  return fallback ? fallback() : []
}

export async function fetchRecentArticles(apiKey?: string | null, page = 1, size = 40) {
  return unwrapArticles(`/api/articles/recent?p=${page}&size=${size}`, apiKey, () =>
    mockFeed('recent', page, size),
  )
}

export type ArticleFeedKind = 'recent' | 'hot' | 'long' | 'good' | 'qna' | 'perfect' | 'search' | 'domain'

export async function fetchArticleFeed(
  kind: ArticleFeedKind,
  apiKey?: string | null,
  page = 1,
  size = 40,
  extra = '',
): Promise<ArticleSummary[]> {
  if (kind === 'hot') {
    return unwrapArticles(`/api/articles/recent/hot?p=${page}&size=${size}`, apiKey, () => mockFeed('hot', page, size))
  }
  if (kind === 'long') {
    return unwrapArticles(`/api/articles/recent/long?p=${page}&size=${size}`, apiKey, () => mockFeed('long', page, size))
  }
  if (kind === 'good') {
    return unwrapArticles(`/api/articles/recent/good?p=${page}&size=${size}`, apiKey, () => mockFeed('good', page, size))
  }
  if (kind === 'qna') {
    const fromQna = await unwrapArticles(`/api/articles/recent/qna?p=${page}&size=${size}`, apiKey)
    if (fromQna.length) return fromQna
    const fromTag = await unwrapArticles(
      `/api/articles/tag/${encodeURIComponent('Q&A')}?p=${page}&size=${size}`,
      apiKey,
    )
    if (fromTag.length) return fromTag
    return mockFeed('qna', page, size)
  }
  if (kind === 'perfect') {
    const fromPerfect = await unwrapArticles(`/api/articles/recent/perfect?p=${page}&size=${size}`, apiKey)
    if (fromPerfect.length) return fromPerfect
    return mockFeed('perfect', page, size)
  }
  if (kind === 'search') return fetchSearch(extra, apiKey, page, size)
  if (kind === 'domain') {
    const fromDomain = await unwrapArticles(
      `/api/articles/domain/${encodeURIComponent(extra)}?p=${page}&size=${size}`,
      apiKey,
    )
    if (fromDomain.length) return fromDomain
    return mockFeed('domain', page, size, extra)
  }
  return fetchRecentArticles(apiKey, page, size)
}

export async function fetchSearch(q: string, apiKey?: string | null, page = 1, size = 40) {
  const query = q.trim()
  try {
    const res = await request<Envelope<{ articles?: ArticleSummary[] }>>(
      withKey(`/api/search?q=${encodeURIComponent(query)}&p=${page}&size=${size}`, apiKey),
    )
    if (res.code === 0 && Array.isArray(res.data?.articles)) return res.data.articles
  } catch {
    /* GET /api/search 尚未提供 */
  }
  return mockFeed('search', page, size, query)
}

export async function fetchDomains(apiKey?: string | null): Promise<DomainItem[]> {
  try {
    const res = await request<Envelope<{ domains?: DomainItem[] } | DomainItem[]>>(withKey('/api/domains', apiKey))
    if (res.code === 0) {
      const data = res.data
      if (Array.isArray(data) && data.length) return data
      if (data && 'domains' in data && Array.isArray(data.domains) && data.domains.length) return data.domains
    }
  } catch {
    /* GET /api/domains 尚未提供 */
  }
  return mockDomains()
}

export async function fetchArticle(id: string, apiKey?: string | null, page = 1): Promise<ArticleDetail> {
  try {
    const res = await request<Envelope<{ article?: ArticleDetail }>>(withKey(`/api/article/${id}?p=${page}`, apiKey))
    if (res.code === 0 && res.data?.article) return res.data.article
  } catch {
    /* 匿名详情未开放 */
  }
  const local = mockArticle(id)
  if (local) return local
  throw new Error('帖子不存在或需要登录')
}

export async function postComment(apiKey: string, articleId: string, content: string, replyId = '') {
  const body: Record<string, unknown> = {
    apiKey,
    articleId,
    commentContent: content,
    commentAnonymous: false,
    commentVisible: false,
  }
  if (replyId) body.commentOriginalCommentId = replyId
  const res = await request<Envelope<unknown>>('/comment', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (res.code) throw new Error(res.msg || '评论失败')
}

export async function fetchBreezemoons(page = 1, size = 20) {
  const res = await request<{ code: number; msg?: string; breezemoons?: Breezemoon[] }>(
    `/api/breezemoons?p=${page}&size=${size}`,
  )
  if (res.code !== 0) throw new Error(res.msg || '清风明月失败')
  return res.breezemoons ?? []
}

export async function postBreezemoon(apiKey: string, content: string) {
  const res = await request<Envelope<unknown>>('/breezemoon', {
    method: 'POST',
    body: JSON.stringify({ apiKey, breezemoonContent: content }),
  })
  if (res.code) throw new Error(res.msg || '发布失败')
}

export async function fetchCheckinRank(apiKey?: string | null): Promise<RankUser[]> {
  try {
    const res = await request<Envelope<RankUser[] | { users?: RankUser[] }>>(
      withKey('/api/top/checkin?p=1', apiKey),
    )
    if (Array.isArray(res.data) && res.data.length) return res.data
    if (res.data && 'users' in res.data && Array.isArray(res.data.users) && res.data.users.length) {
      return res.data.users
    }
  } catch {
    /* anonymous top not ready */
  }
  return mockCheckin()
}

export async function fetchOnlineRank(apiKey?: string | null): Promise<RankUser[]> {
  try {
    const res = await request<Envelope<RankUser[] | { users?: RankUser[] }>>(
      withKey('/api/top/online?p=1', apiKey),
    )
    if (Array.isArray(res.data) && res.data.length) return res.data
    if (res.data && 'users' in res.data && Array.isArray(res.data.users) && res.data.users.length) {
      return res.data.users
    }
  } catch {
    /* anonymous top not ready */
  }
  return mockOnline()
}

export async function postArticle(
  apiKey: string,
  payload: {
    articleTitle: string
    articleContent: string
    articleTags: string
    articleType: number
    articleQnAOfferPoint?: number
  },
) {
  const res = await request<Envelope<unknown> & { articleId?: string }>('/article', {
    method: 'POST',
    body: JSON.stringify({
      apiKey,
      articleTitle: payload.articleTitle,
      articleContent: payload.articleContent,
      articleTags: payload.articleTags,
      articleType: payload.articleType,
      articleCommentable: true,
      articleAnonymous: false,
      articleRewardPoint: 0,
      articleQnAOfferPoint: payload.articleQnAOfferPoint || 0,
    }),
  })
  if (res.code) throw new Error(res.msg || '发帖失败')
  return String(res.articleId || (res.data as { oId?: string } | undefined)?.oId || '')
}

export async function voteArticle(apiKey: string, oId: string) {
  const res = await request<Envelope<unknown> & { type?: number }>('/vote/up/article', {
    method: 'POST',
    body: JSON.stringify({ apiKey, dataId: oId }),
  })
  if (res.code) throw new Error(res.msg || '点赞失败')
  return res.type
}

export async function thankArticle(apiKey: string, oId: string) {
  const res = await request<Envelope<unknown>>(`/article/thank?articleId=${encodeURIComponent(oId)}`, {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  })
  if (res.code) throw new Error(res.msg || '感谢失败')
}

export async function requestSms(payload: {
  userName: string
  userPhone: string
  captcha: string
  invitecode?: string
}) {
  const res = await request<Envelope<unknown>>('/register', {
    method: 'POST',
    body: JSON.stringify({
      userName: payload.userName,
      userPhone: payload.userPhone,
      captcha: payload.captcha,
      invitecode: payload.invitecode || '',
    }),
  })
  if (res.code) throw new Error(res.msg || '发送验证码失败')
}

export async function verifySms(code: string) {
  const res = await request<Envelope<{ userId?: string }> & { userId?: string }>(
    `/verify?code=${encodeURIComponent(code)}`,
  )
  const userId = res.userId || res.data?.userId
  if (res.code !== 0 || !userId) throw new Error(res.msg || '短信验证失败')
  return String(userId)
}

export async function finishRegister(payload: {
  userId: string
  passwd: string
  userAppRole: number
  referrer?: string
}) {
  const r = payload.referrer ? `?r=${encodeURIComponent(payload.referrer)}` : ''
  const res = await request<Envelope<unknown>>(`/register2${r}`, {
    method: 'POST',
    body: JSON.stringify({
      userId: payload.userId,
      userPassword: md5(payload.passwd),
      userAppRole: payload.userAppRole,
      r: payload.referrer || '',
    }),
  })
  if (res.code) throw new Error(res.msg || '注册失败')
}

export async function fetchMembership(userId: string) {
  const res = await request<Envelope<{ expiresAt?: number; status?: string; isActive?: boolean }>>(
    `/api/membership/${userId}`,
  )
  if (res.code !== 0) return { isVip: false }
  const data = res.data
  const expiresAt = Number(data?.expiresAt || 0)
  const isVip = Boolean(data?.isActive) || (expiresAt > Date.now())
  return { isVip, expiresAt }
}

export async function fetchChatHistory(apiKey: string, page = 1) {
  const res = await request<Envelope<ChatHistoryItem[]>>(
    withKey(`/chat-room/more?page=${page}&type=html`, apiKey),
  )
  if (res.code !== 0) throw new Error(res.msg || '聊天记录失败')
  return res.data ?? []
}

export async function sendChat(apiKey: string, content: string) {
  const res = await request<Envelope<unknown>>('/chat-room/send', {
    method: 'POST',
    body: JSON.stringify({
      content,
      client: 'Web/v3',
      apiKey,
    }),
  })
  if (res.code) throw new Error(res.msg || '发送失败')
}

export async function openRedPacket(apiKey: string, oId: string, gesture?: number) {
  const res = await request<Envelope<Record<string, unknown>>>('/chat-room/red-packet/open', {
    method: 'POST',
    body: JSON.stringify({ oId, gesture, apiKey }),
  })
  if (res.code) throw new Error(res.msg || '领取失败')
  return res
}

export async function fetchMutes() {
  const res = await request<Envelope<MuteItem[]>>('/chat-room/si-guo-list')
  if (res.code) return []
  return res.data ?? []
}

export async function fetchChatNode(apiKey: string) {
  const res = await request<{ code: number; msg?: string; data?: string }>('/chat-room/node/get?apiKey=' + apiKey)
  if (res.code !== 0 || !res.data) throw new Error(res.msg || '获取节点失败')
  return res.data
}

export interface ChatHistoryItem {
  oId: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  content: string | RedPacketContent
  md?: string
  time?: string
  type?: string
}

export interface RedPacketContent {
  msgType?: string
  money?: number
  count?: number
  got?: number
  msg?: string
  type?: string
}

export interface MuteItem {
  userName: string
  userAvatarURL?: string
  time?: string
}
