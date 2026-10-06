import { md5 } from 'js-md5'
import {
  mockArticle,
  mockCheckin,
  mockDomains,
  mockFeed,
  mockNotifications,
  mockOnline,
  mockProfile,
  mockUnreadCount,
  mockUserArticles,
  mockWhisperList,
  mockWhisperMessages,
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
  userIntro?: string
  userURL?: string
  userTags?: string
  mbti?: string
}

export interface UserProfile {
  oId: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  userIntro?: string
  userURL?: string
  userPoint?: number
  userArticleCount?: number
  userCommentCount?: number
  followingUserCount?: number
  onlineMinute?: number
  userAppRole?: number
  canFollow?: string
  userTags?: string
  userCity?: string
}

export type NoticeType = 'commented' | 'reply' | 'at' | 'following' | 'point' | 'broadcast' | 'sys-announce'

export interface NoticeItem {
  hasRead?: boolean
  description?: string
  createTime?: string
  commentAuthorName?: string
  commentAuthorThumbnailURL?: string
  commentContent?: string
  commentArticleTitle?: string
  commentSharpURL?: string
  commentCreateTime?: string
  userName?: string
  userAvatarURL?: string
  content?: string
  articleTitle?: string
  authorName?: string
  url?: string
  isComment?: boolean
  thumbnailURL?: string
}

export interface UnreadCount {
  unreadNotificationCnt?: number
  unreadReplyNotificationCnt?: number
  unreadPointNotificationCnt?: number
  unreadAtNotificationCnt?: number
  unreadBroadcastNotificationCnt?: number
  unreadSysAnnounceNotificationCnt?: number
  unreadNewFollowerNotificationCnt?: number
  unreadFollowingNotificationCnt?: number
  unreadCommentedNotificationCnt?: number
}

export interface WhisperMsg {
  oId: string
  toId?: string
  fromId?: string
  preview?: string
  markdown?: string
  content?: string
  time?: string
  senderUserName?: string
  receiverUserName?: string
  senderAvatar?: string
  receiverAvatar?: string
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
  const res = await request<Envelope<AccountInfo & { userTag?: string; mbti?: string }>>(withKey('/api/user', apiKey))
  if (res.code !== 0 || !res.data) throw new Error(res.msg || '密钥无效')
  const data = res.data
  if (!data.userTags && data.userTag) data.userTags = data.userTag
  return data
}

export interface ProfileUpdate {
  userNickname?: string
  userURL?: string
  userIntro?: string
  userTag?: string
  mbti?: string
}

export async function updateProfile(apiKey: string, data: ProfileUpdate) {
  const res = await request<Envelope<unknown>>('/api/settings/profiles', {
    method: 'POST',
    body: JSON.stringify({ apiKey, ...data }),
  })
  if (res.code) throw new Error(res.msg || '保存资料失败')
}

export async function updateAvatar(apiKey: string, userAvatarURL: string) {
  const res = await request<Envelope<unknown>>('/api/settings/avatar', {
    method: 'POST',
    body: JSON.stringify({ apiKey, userAvatarURL }),
  })
  if (res.code) throw new Error(res.msg || '更新头像失败')
}

function extractUploadUrls(json: unknown): string[] {
  if (!json || typeof json !== 'object') return []
  const o = json as Record<string, unknown>
  if (o.succMap && typeof o.succMap === 'object') {
    return Object.values(o.succMap as Record<string, string>).filter(Boolean)
  }
  const data = o.data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (d.succMap && typeof d.succMap === 'object') {
      return Object.values(d.succMap as Record<string, string>).filter(Boolean)
    }
    if (Array.isArray(d.files)) {
      return d.files
        .map((f) => (typeof f === 'string' ? f : String((f as { url?: string }).url || '')))
        .filter(Boolean)
    }
    if (typeof d.url === 'string') return [d.url]
  }
  if (typeof o.url === 'string') return [o.url]
  return []
}

export async function uploadFiles(apiKey: string, files: File[]): Promise<string[]> {
  if (!files.length) return []
  try {
    const ticketRes = await request<Envelope<{ ticket?: string; uploadURL?: string }>>(
      withKey('/api/rhypic/upload-ticket', apiKey),
      { method: 'POST' },
    )
    const ticket = ticketRes.data?.ticket
    const uploadURL = ticketRes.data?.uploadURL
    if (ticketRes.code || !ticket || !uploadURL) throw new Error(ticketRes.msg || '无上传票据')
    const body = new FormData()
    files.forEach((f) => body.append('file', f))
    const res = await fetch(`${String(uploadURL).replace(/\/$/, '')}/api/v1/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ticket}` },
      body,
    })
    const json: unknown = await res.json()
    const urls = extractUploadUrls(json)
    if (urls.length) return urls
    throw new Error('图床未返回文件地址')
  } catch (e) {
    const body = new FormData()
    files.forEach((f) => body.append('file[]', f))
    body.append('apiKey', apiKey)
    const res = await request<Record<string, unknown>>('/upload', { method: 'POST', body })
    const urls = extractUploadUrls(res)
    if (urls.length) return urls
    throw e instanceof Error ? e : new Error('上传失败')
  }
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

export async function fetchUserProfile(userName: string, apiKey?: string | null): Promise<UserProfile> {
  const paths = [`/user/${encodeURIComponent(userName)}`, `/api/user/${encodeURIComponent(userName)}`]
  for (const path of paths) {
    try {
      const res = await request<UserProfile & Envelope<UserProfile>>(withKey(path, apiKey))
      if (res.userName) return res
      if (res.code === 0 && res.data?.userName) return res.data
    } catch {
      /* try next */
    }
  }
  return mockProfile(userName)
}

export async function fetchUserArticles(userName: string, apiKey?: string | null, page = 1, size = 40) {
  const fromApi = await unwrapArticles(
    `/api/user/${encodeURIComponent(userName)}/articles?p=${page}&size=${size}`,
    apiKey,
  )
  if (fromApi.length) return fromApi
  return mockUserArticles(userName, page, size)
}

export async function followUser(apiKey: string, followingId: string) {
  const res = await request<Envelope<unknown>>('/follow/user', {
    method: 'POST',
    body: JSON.stringify({ apiKey, followingId }),
  })
  if (res.code) throw new Error(res.msg || '关注失败')
}

export async function unfollowUser(apiKey: string, followingId: string) {
  const res = await request<Envelope<unknown>>('/unfollow/user', {
    method: 'POST',
    body: JSON.stringify({ apiKey, followingId }),
  })
  if (res.code) throw new Error(res.msg || '取消关注失败')
}

export async function fetchCheckedIn(apiKey: string) {
  const res = await request<{ checkedIn?: boolean }>(withKey('/user/checkedIn', apiKey))
  return Boolean(res.checkedIn)
}

export async function dailyCheckin(apiKey: string) {
  const paths = ['/activity/daily-checkin-api', '/user/checkin']
  let last = '签到失败'
  for (const path of paths) {
    try {
      const res = await request<{ code?: number; random?: number; msg?: string }>(withKey(path, apiKey))
      if (typeof res.random === 'number') return res.random
      if (res.code && res.code !== 0) {
        last = res.msg || last
        continue
      }
      return Number(res.random ?? 0)
    } catch (e) {
      last = e instanceof Error ? e.message : last
    }
  }
  throw new Error(last.includes('非 JSON') ? '签到领取接口尚未开放（GET /activity/daily-checkin-api）' : last)
}

export async function fetchLiveness(apiKey: string) {
  const res = await request<{ liveness?: number }>(withKey('/user/liveness', apiKey))
  return Number(res.liveness ?? 0)
}

export async function fetchCollectedLiveness(apiKey: string) {
  const res = await request<{ isCollectedYesterdayLivenessReward?: boolean }>(
    withKey('/api/activity/is-collected-liveness', apiKey),
  )
  return Boolean(res.isCollectedYesterdayLivenessReward)
}

export async function rewardLiveness(apiKey: string) {
  const res = await request<{ sum?: number }>(withKey('/activity/yesterday-liveness-reward-api', apiKey))
  return Number(res.sum ?? -1)
}

export async function fetchUnreadCount(apiKey: string): Promise<UnreadCount> {
  try {
    const res = await request<UnreadCount & Envelope<UnreadCount>>(withKey('/notifications/unread/count', apiKey))
    if (typeof res.unreadNotificationCnt === 'number') return res
    if (res.data && typeof res.data.unreadNotificationCnt === 'number') return res.data
  } catch {
    /* unread count unavailable */
  }
  return mockUnreadCount()
}

export async function fetchNotifications(apiKey: string, type: NoticeType, page = 1): Promise<NoticeItem[]> {
  try {
    const res = await request<Envelope<NoticeItem[]>>(
      withKey(`/api/getNotifications?type=${encodeURIComponent(type)}&p=${page}`, apiKey),
    )
    if (res.code === 0 && Array.isArray(res.data)) return res.data
  } catch {
    /* GET /api/getNotifications 尚未提供 */
  }
  return mockNotifications(type)
}

export async function markNoticeRead(apiKey: string, type: NoticeType) {
  await request<Envelope<unknown>>(withKey(`/notifications/make-read/${encodeURIComponent(type)}`, apiKey))
}

export async function markAllNoticesRead(apiKey: string) {
  await request<Envelope<unknown>>(withKey('/notifications/all-read', apiKey))
}

function chatOk<T>(res: Envelope<T> & { result?: number }) {
  return !res.code && (res.result === undefined || res.result === 0)
}

export async function fetchWhisperList(apiKey: string): Promise<WhisperMsg[]> {
  try {
    const res = await request<Envelope<WhisperMsg[]>>(withKey('/chat/get-list', apiKey))
    if (chatOk(res) && Array.isArray(res.data)) return res.data
  } catch {
    /* GET /chat/get-list */
  }
  return mockWhisperList()
}

export async function fetchWhisperMessages(apiKey: string, toUser: string, page = 1, size = 20): Promise<WhisperMsg[]> {
  try {
    const res = await request<Envelope<WhisperMsg[]>>(
      withKey(
        `/chat/get-message?toUser=${encodeURIComponent(toUser)}&page=${page}&pageSize=${size}`,
        apiKey,
      ),
    )
    if (chatOk(res) && Array.isArray(res.data)) return res.data
  } catch {
    /* GET /chat/get-message */
  }
  return mockWhisperMessages(toUser)
}

export async function markWhisperRead(apiKey: string, userName: string) {
  const q = `apiKey=${encodeURIComponent(apiKey)}`
  try {
    await request<Envelope<unknown>>(`/chat/mark-as-read?toUser=${encodeURIComponent(userName)}&${q}`)
  } catch {
    await request<Envelope<unknown>>(`/chat/mark-as-read?fromUser=${encodeURIComponent(userName)}&${q}`)
  }
}

export async function fetchWhisperUnread(apiKey: string): Promise<WhisperMsg[]> {
  try {
    const res = await request<Envelope<WhisperMsg[] | number>>(withKey('/chat/has-unread', apiKey))
    if (Array.isArray(res.data)) return res.data
    if (typeof res.data === 'number' && res.data > 0) {
      return Array.from({ length: res.data }, (_, i) => ({ oId: `unread-${i}` }))
    }
  } catch {
    /* GET /chat/has-unread */
  }
  return []
}

export async function revokeWhisper(apiKey: string, oId: string) {
  const res = await request<Envelope<unknown>>(withKey(`/chat/revoke?oId=${encodeURIComponent(oId)}`, apiKey))
  if (res.code) throw new Error(res.msg || '撤回失败')
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
