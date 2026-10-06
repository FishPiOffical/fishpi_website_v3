import { md5 } from 'js-md5'
import { request, withKey } from './http'

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

/** Rhythm 把 `/api/articles/recent*` 挂了 loginCheck，未登录请用 fetchPublicHome。 */
async function unwrapArticles(path: string, apiKey?: string | null) {
  const res = await request<Envelope<{ articles?: ArticleSummary[] } | ArticleSummary[]>>(withKey(path, apiKey))
  if (res.code !== 0) throw new Error(res.msg || '文章列表失败')
  const data = res.data
  if (Array.isArray(data)) return data
  return data?.articles ?? []
}

export async function fetchRecentArticles(apiKey?: string | null, page = 1, size = 40) {
  return unwrapArticles(`/api/articles/recent?p=${page}&size=${size}`, apiKey)
}

export type ArticleFeedKind = 'recent' | 'hot' | 'long' | 'good' | 'qna' | 'perfect' | 'search'

export async function fetchArticleFeed(
  kind: ArticleFeedKind,
  apiKey: string,
  page = 1,
  size = 40,
  keyword = '',
): Promise<ArticleSummary[]> {
  if (kind === 'hot') return unwrapArticles(`/api/articles/recent/hot?p=${page}&size=${size}`, apiKey)
  if (kind === 'long') return unwrapArticles(`/api/articles/recent/long?p=${page}&size=${size}`, apiKey)
  if (kind === 'good') return unwrapArticles(`/api/articles/recent/good?p=${page}&size=${size}`, apiKey)
  const recent = await unwrapArticles(`/api/articles/recent?p=${page}&size=${size}`, apiKey)
  if (kind === 'qna') return recent.filter((a) => a.articleType === 5)
  if (kind === 'perfect') return recent.filter((a) => Number(a.articlePerfect) === 1)
  if (kind === 'search') {
    const q = keyword.trim().toLowerCase()
    if (!q) return recent
    return recent.filter((a) => (a.articleTitleEmoj || a.articleTitle || '').toLowerCase().includes(q))
  }
  return recent
}

export async function fetchArticle(id: string, apiKey: string, page = 1): Promise<ArticleDetail> {
  const res = await request<Envelope<{ article?: ArticleDetail }>>(
    withKey(`/api/article/${id}?p=${page}`, apiKey),
  )
  if (res.code !== 0 || !res.data?.article) throw new Error(res.msg || '帖子不存在')
  return res.data.article
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

export async function fetchCheckinRank(apiKey?: string | null): Promise<RankUser[]> {
  const res = await request<Envelope<RankUser[] | { users?: RankUser[] }>>(
    withKey('/api/top/checkin?p=1', apiKey),
  )
  if (Array.isArray(res.data)) return res.data
  if (res.data && 'users' in res.data && Array.isArray(res.data.users)) return res.data.users
  return []
}

export async function fetchOnlineRank(apiKey?: string | null): Promise<RankUser[]> {
  const res = await request<Envelope<RankUser[] | { users?: RankUser[] }>>(
    withKey('/api/top/online?p=1', apiKey),
  )
  if (Array.isArray(res.data)) return res.data
  if (res.data && 'users' in res.data && Array.isArray(res.data.users)) return res.data.users
  return []
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
