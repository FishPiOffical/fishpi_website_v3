import { md5 } from 'js-md5'
import {
  mockArticle,
  mockCheckin,
  mockDomains,
  mockFeed,
  mockOnline,
  mockProfile,
  type DomainItem,
} from './catalog'
import { request, requestText, withKey } from './http'

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

export interface MetalItem {
  name?: string
  description?: string
  attr?: string
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
  followerCount?: number
  onlineMinute?: number
  userAppRole?: number
  canFollow?: string
  userTags?: string
  userCity?: string
  sysMetal?: MetalItem[]
}

export interface SimpleUser {
  oId: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
}

export interface PointRecord {
  oId?: string
  balance?: number
  sum?: number
  type?: string
  description?: string
  time?: string
  createTime?: string
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
  articleHeat?: number
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
  commentGoodCnt?: number
  commentVote?: number
  rewarded?: boolean
  commentAuthorId?: string
  reactionSummary?: ReactionSummary[]
  currentUserReaction?: string
  commentQnAOffered?: number
}

export interface ArticleDetail extends ArticleSummary {
  articleContent?: string
  articleOriginalContent?: string
  articleToC?: string
  articleCommentable?: boolean
  articleComments?: ArticleComment[]
  articleNiceComments?: ArticleComment[]
  pagination?: { paginationPageCount?: number; paginationCurrentPageNum?: number }
  isFollowing?: boolean
  isWatching?: boolean
  isMyArticle?: boolean
  thanked?: boolean
  rewarded?: boolean
  articleThankCnt?: number
  articleCollectCnt?: number
  articleWatchCnt?: number
  articleRewardPoint?: number
  articleRewardContent?: string
  rewardedCnt?: number
  sysMetal?: MetalItem[]
  articleAuthor?: { sysMetal?: MetalItem[]; userName?: string }
  articleType?: number
  articleHeat?: number
  reactionSummary?: ReactionSummary[]
  currentUserReaction?: string
}

export interface ReactionSummary {
  value: string
  emoji?: string
  count: number
  selected?: boolean
  users?: string[]
}

export const REACTION_EMOJIS: { value: string; emoji: string }[] = [
  { value: 'thumbsup', emoji: '👍' },
  { value: 'plus', emoji: '➕1️⃣' },
  { value: 'thumbsdown', emoji: '👎' },
  { value: 'check', emoji: '✅' },
  { value: 'cross', emoji: '❌' },
  { value: 'star', emoji: '⭐' },
  { value: 'heart', emoji: '❤️' },
  { value: 'fire', emoji: '🔥' },
  { value: 'party', emoji: '🎉' },
  { value: 'laugh', emoji: '😂' },
  { value: 'wow', emoji: '😮' },
  { value: 'clap', emoji: '👏' },
  { value: 'eyes', emoji: '👀' },
  { value: 'thinking', emoji: '🤔' },
  { value: 'cry', emoji: '😢' },
  { value: 'angry', emoji: '😡' },
  { value: 'brokenheart', emoji: '💔' },
  { value: 'heartonfire', emoji: '❤️‍🔥' },
  { value: 'hundred', emoji: '💯' },
  { value: 'rocket', emoji: '🚀' },
  { value: 'salute', emoji: '🖖' },
  { value: 'handshake', emoji: '🤝' },
  { value: 'raisedhands', emoji: '🙌' },
  { value: 'mindblown', emoji: '🤯' },
  { value: 'pray', emoji: '🙏' },
  { value: 'skull', emoji: '💀' },
  { value: 'clown', emoji: '🤡' },
  { value: 'poop', emoji: '💩' },
]

export function applyReactionPayload(
  target: { reactionSummary?: ReactionSummary[]; currentUserReaction?: string },
  payload: { reactionSummary?: ReactionSummary[]; currentUserReaction?: string; summary?: ReactionSummary[] },
) {
  target.reactionSummary = payload.reactionSummary || payload.summary || target.reactionSummary
  if (payload.currentUserReaction != null) target.currentUserReaction = payload.currentUserReaction
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
  userAvatarURL20?: string
  userAvatarURL48?: string
  userCheckinStreak?: number
  userCurrentCheckinStreak?: number
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

export interface EmojiItem {
  oId?: string
  name: string
  url?: string
  text?: string
  sort?: number
}

export interface EmojiGroup {
  oId: string
  name?: string
  type?: number
  sort?: number
}

function mockEmotions(): EmojiItem[] {
  return [
    { name: 'doge', url: 'https://cdn.jsdelivr.net/npm/vditor@3.8.7/dist/images/emoji/doge.png' },
    { name: 'huaji', url: 'https://cdn.jsdelivr.net/npm/vditor@3.8.7/dist/images/emoji/huaji.gif' },
    { name: 'smile', text: '😄' },
    { name: 'thumbsup', text: '👍' },
  ]
}

export function emojiToMarkdown(item: EmojiItem) {
  if (item.url) return `![${item.name}](${item.url})`
  if (item.text) return item.text
  return `:${item.name}:`
}

function parseEmotionValue(name: string, val: unknown): EmojiItem {
  if (val && typeof val === 'object') {
    const o = val as { url?: string; name?: string }
    if (o.url) return { name: o.name || name, url: o.url }
    return { name, text: `:${name}:` }
  }
  const v = String(val ?? '')
  if (v.startsWith('http')) return { name, url: v }
  if (v) return { name, text: v }
  return { name, text: `:${name}:` }
}

function parseEmotionsPayload(data: unknown): EmojiItem[] {
  if (Array.isArray(data)) {
    return data.flatMap((entry) => {
      if (typeof entry === 'string') {
        if (entry.startsWith('http')) return [{ name: 'emoji', url: entry }]
        return [{ name: entry, text: entry.startsWith(':') ? entry : `:${entry}:` }]
      }
      if (entry && typeof entry === 'object') {
        const o = entry as { url?: string; name?: string; oId?: string; sort?: number }
        if (typeof o.url === 'string' && o.url) {
          return [{ oId: o.oId, name: o.name || 'emoji', url: o.url, sort: o.sort }]
        }
        return Object.entries(entry as Record<string, unknown>).map(([n, v]) => parseEmotionValue(n, v))
      }
      return []
    })
  }
  if (data && typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>).map(([n, v]) => parseEmotionValue(n, v))
  }
  return []
}

export async function fetchFrequentEmotions(apiKey: string): Promise<EmojiItem[]> {
  try {
    const res = await request<Envelope<unknown>>(withKey('/users/emotions', apiKey))
    if (res.code) throw new Error(res.msg || '表情失败')
    const items = parseEmotionsPayload(res.data)
    if (items.length) return items
  } catch {
    /* GET /users/emotions */
  }
  return mockEmotions()
}

export async function fetchEmojiGroups(apiKey: string): Promise<EmojiGroup[]> {
  try {
    const res = await request<Envelope<EmojiGroup[]>>(withKey('/api/emoji/groups', apiKey))
    if (!res.code && Array.isArray(res.data)) return res.data
  } catch {
    /* GET /api/emoji/groups */
  }
  return []
}

export async function fetchGroupEmojis(apiKey: string, groupId: string): Promise<EmojiItem[]> {
  try {
    const res = await request<Envelope<unknown>>(
      withKey(`/api/emoji/group/emojis?groupId=${encodeURIComponent(groupId)}`, apiKey),
    )
    if (!res.code) return parseEmotionsPayload(res.data)
  } catch {
    /* GET /api/emoji/group/emojis */
  }
  return []
}

async function emojiPost(path: string, apiKey: string, body: Record<string, unknown>) {
  const res = await request<Envelope<unknown>>(path, {
    method: 'POST',
    body: JSON.stringify({ apiKey, ...body }),
  })
  if (res.code) throw new Error(res.msg || '表情操作失败')
}

export async function createEmojiGroup(apiKey: string, name: string, sort = 0) {
  await emojiPost('/api/emoji/group/create', apiKey, { name, sort })
}

export async function updateEmojiGroup(apiKey: string, groupId: string, name: string, sort = 0) {
  await emojiPost('/api/emoji/group/update', apiKey, { groupId, name, sort })
}

export async function deleteEmojiGroup(apiKey: string, groupId: string) {
  await emojiPost('/api/emoji/group/delete', apiKey, { groupId })
}

export async function addEmojiUrl(apiKey: string, groupId: string, url: string, sort = 0, name = '') {
  await emojiPost('/api/emoji/group/add-url-emoji', apiKey, { groupId, url, sort, name })
}

export async function removeGroupEmoji(apiKey: string, groupId: string, emojiId: string) {
  await emojiPost('/api/emoji/group/remove-emoji', apiKey, { groupId, emojiId })
}

export async function transferPoints(apiKey: string, userName: string, amount: number, memo: string) {
  const res = await request<Envelope<unknown>>('/point/transfer', {
    method: 'POST',
    body: JSON.stringify({ apiKey, userName, amount, memo }),
  })
  if (res.code) throw new Error(res.msg || '转账失败')
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

/** 匿名读未开放或接口 404 时可选回退 mock；成功但空列表不再当成失败。 */
async function unwrapArticles(path: string, apiKey?: string | null, fallback?: () => ArticleSummary[]) {
  try {
    const res = await request<Envelope<{ articles?: ArticleSummary[] } | ArticleSummary[]>>(withKey(path, apiKey))
    if (res.code === 0) {
      const data = res.data
      if (Array.isArray(data)) return data
      if (data && 'articles' in data && Array.isArray(data.articles)) return data.articles
      return []
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

export type ArticleFeedKind = 'recent' | 'hot' | 'long' | 'good' | 'qna' | 'perfect' | 'search' | 'domain' | 'tag'

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
    const fromQna = await unwrapArticles(`/api/articles/qna?p=${page}&size=${size}`, apiKey)
    if (fromQna.length) return fromQna
    const fromTag = await unwrapArticles(`/api/articles/tag/${encodeURIComponent('q&a')}?p=${page}&size=${size}`, apiKey)
    if (fromTag.length) return fromTag
    return mockFeed('qna', page, size)
  }
  if (kind === 'perfect') {
    const fromPerfect = await unwrapArticles(`/api/articles/perfect?p=${page}&size=${size}`, apiKey)
    if (fromPerfect.length) return fromPerfect
    return mockFeed('perfect', page, size)
  }
  if (kind === 'tag') {
    const fromTag = await unwrapArticles(
      `/api/articles/tag/${encodeURIComponent(extra)}?p=${page}&size=${size}`,
      apiKey,
    )
    if (fromTag.length) return fromTag
    return mockFeed('tag', page, size, extra)
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

function normalizeDomain(raw: DomainItem): DomainItem | null {
  const uri = String(raw.uri || raw.domainURI || '').trim()
  if (!uri) return null
  return {
    ...raw,
    uri,
    domainTitle: raw.domainTitle || uri,
    domainArticleCount: raw.domainArticleCount ?? raw.articleCnt ?? 0,
    domainIconPath: raw.domainIconPath,
  }
}

export async function fetchDomains(apiKey?: string | null): Promise<DomainItem[]> {
  try {
    const res = await request<Envelope<{ domains?: DomainItem[] } | DomainItem[]>>(withKey('/api/domains', apiKey))
    if (res.code === 0) {
      const data = res.data
      const list = Array.isArray(data)
        ? data
        : data && 'domains' in data && Array.isArray(data.domains)
          ? data.domains
          : []
      const normalized = list.map(normalizeDomain).filter((d): d is DomainItem => Boolean(d))
      if (normalized.length) return normalized
    }
  } catch {
    /* GET /api/domains 尚未提供 */
  }
  return mockDomains()
}

export interface TagItem {
  tagTitle: string
  tagURI: string
  tagIconPath?: string
  tagReferenceCount?: number
  tagDescription?: string
}

export async function fetchTags(apiKey?: string | null, page = 1, size = 50): Promise<{ tags: TagItem[]; total: number }> {
  try {
    const res = await request<Envelope<{ tags?: TagItem[]; total?: number }>>(
      withKey(`/api/tags?p=${page}&size=${size}`, apiKey),
    )
    if (res.code === 0 && Array.isArray(res.data?.tags)) {
      return { tags: res.data.tags, total: Number(res.data.total || res.data.tags.length) }
    }
  } catch {
    /* tags wall unavailable */
  }
  return { tags: [], total: 0 }
}

export async function toggleReaction(
  apiKey: string,
  kind: 'article' | 'comment' | 'chat',
  id: string,
  value: string,
) {
  const path =
    kind === 'article' ? '/article/reaction' : kind === 'comment' ? '/comment/reaction' : '/chat-room/reaction'
  const body: Record<string, string> = { apiKey, groupType: 'emoji', value }
  if (kind === 'article') body.articleId = id
  else if (kind === 'comment') body.commentId = id
  else body.oId = id
  const res = await request<
    Envelope<
      | ReactionSummary[]
      | { reactionSummary?: ReactionSummary[]; summary?: ReactionSummary[]; currentUserReaction?: string }
    >
  >(path, { method: 'POST', body: JSON.stringify(body) })
  if (res.code) throw new Error(res.msg || '表情失败')
  const data = res.data
  if (Array.isArray(data)) return { reactionSummary: data, currentUserReaction: '' }
  return {
    reactionSummary: data?.reactionSummary || data?.summary || [],
    currentUserReaction: data?.currentUserReaction || '',
  }
}

export interface ArticleDraft {
  oId?: string
  articleDraftId?: string
  articleDraftTitle?: string
  articleDraftSummary?: string
  articleDraftContent?: string
  articleDraftTags?: string
  articleDraftType?: number
  articleDraftQnAOfferPoint?: number
  articleDraftUpdatedTime?: number
  articleTitle?: string
  articleContent?: string
  articleTags?: string
  articleType?: number
}

export async function fetchArticleDrafts(apiKey: string) {
  const res = await request<Envelope<{ drafts?: ArticleDraft[] }>>(withKey('/api/article-drafts', apiKey))
  if (res.code) throw new Error(res.msg || '草稿列表失败')
  return res.data?.drafts ?? []
}

export async function fetchArticleDraft(apiKey: string, id: string) {
  const res = await request<Envelope<{ draft?: ArticleDraft }>>(
    withKey(`/api/article-drafts/${encodeURIComponent(id)}`, apiKey),
  )
  if (res.code || !res.data?.draft) throw new Error(res.msg || '草稿不存在')
  return res.data.draft
}

export async function saveArticleDraft(
  apiKey: string,
  payload: {
    articleDraftId?: string
    articleTitle: string
    articleContent: string
    articleTags: string
    articleType: number
    articleQnAOfferPoint?: number
  },
) {
  const res = await request<Envelope<{ draft?: ArticleDraft }>>('/api/article-drafts', {
    method: 'POST',
    body: JSON.stringify({ apiKey, ...payload }),
  })
  if (res.code) throw new Error(res.msg || '保存草稿失败')
  return res.data?.draft
}

export async function removeArticleDraft(apiKey: string, id: string) {
  const res = await request<Envelope<unknown>>(withKey(`/api/article-drafts/${encodeURIComponent(id)}`, apiKey), {
    method: 'DELETE',
  })
  if (res.code) throw new Error(res.msg || '删除草稿失败')
}

export async function fetchArticleHeat(id: string, apiKey?: string | null) {
  const res = await request<{ articleHeat?: number; code?: number; msg?: string }>(
    withKey(`/api/article/heat/${encodeURIComponent(id)}`, apiKey),
  )
  if (res.code) throw new Error(res.msg || '热度失败')
  return Number(res.articleHeat || 0)
}

export async function reportContent(
  apiKey: string,
  payload: { reportDataId: string; reportDataType: number; reportType: number; reportMemo: string },
) {
  const res = await request<Envelope<unknown>>('/report', {
    method: 'POST',
    body: JSON.stringify({ apiKey, ...payload }),
  })
  if (res.code) throw new Error(res.msg || '举报失败')
}

export interface RepeaterItem {
  oId: string
  repeaterContent?: string
  repeaterContentType?: string
  repeaterContentTypeLabel?: string
  repeaterContentAuthorName?: string
  repeaterContentLikeCount?: number
  repeaterContentLiked?: boolean
  repeaterContentCreatedTime?: number
}

export async function fetchRepeaterItems(apiKey?: string | null, type = '') {
  const q = type ? `?type=${encodeURIComponent(type)}` : ''
  const res = await request<Envelope<{ items?: RepeaterItem[] }>>(withKey(`/api/repeater/items${q}`, apiKey))
  if (res.code) throw new Error(res.msg || '复读机加载失败')
  return res.data?.items ?? []
}

export async function likeRepeater(apiKey: string, id: string) {
  const res = await request<Envelope<{ liked?: boolean; likeCount?: number }>>(
    `/api/repeater/${encodeURIComponent(id)}/like`,
    { method: 'POST', body: JSON.stringify({ apiKey }) },
  )
  if (res.code) throw new Error(res.msg || '点赞失败')
  return res.data
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

export interface ArticleRevisionMeta {
  revisionId: string
  revisionTimeStr?: string
  revisionTime?: number
  revisionIndex?: number
  revisionAuthorId?: string
  current?: boolean
}

export interface ArticleRevisionDetail extends ArticleRevisionMeta {
  revisionData?: {
    articleTitle?: string
    articleContent?: string
  }
}

export async function fetchArticleRevisions(apiKey: string, id: string): Promise<ArticleRevisionMeta[]> {
  const res = await request<{ code?: number; msg?: string; revisions?: ArticleRevisionMeta[] }>(
    withKey(`/article/${encodeURIComponent(id)}/revisions/list`, apiKey),
  )
  if (res.code) throw new Error(res.msg || '修订历史加载失败')
  return res.revisions ?? []
}

export async function fetchArticleRevision(apiKey: string, id: string, revisionId: string) {
  const res = await request<{ code?: number; msg?: string; revision?: ArticleRevisionDetail }>(
    withKey(`/article/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}`, apiKey),
  )
  if (res.code || !res.revision) throw new Error(res.msg || '修订内容加载失败')
  return res.revision
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

export interface LiteUser {
  oId?: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  userAvatarURL48?: string
}

export async function fetchRecentRegister(apiKey?: string | null) {
  try {
    const res = await request<Envelope<LiteUser[]>>(withKey('/api/user/recentReg', apiKey))
    const list = Array.isArray(res.data) ? res.data : []
    return list.filter((u) => u?.userName).slice(0, 20)
  } catch {
    return []
  }
}

export interface ProfessionRankEntry {
  rank?: number
  userName?: string
  userNickname?: string
  professionId?: string
  professionName?: string
  displayName?: string
  levelName?: string
  totalExperience?: number
}

export interface ProfessionRanking {
  selectedProfession?: { professionId?: string; displayName?: string; professionName?: string }
  professions?: { professionId?: string; displayName?: string; professionName?: string }[]
  entries?: ProfessionRankEntry[]
}

export async function fetchProfessionRanking(apiKey?: string | null, professionId?: string) {
  const q = new URLSearchParams({ dark: 'false' })
  if (professionId) q.set('professionId', professionId)
  const res = await request<Envelope<ProfessionRanking>>(withKey(`/api/profession/ranking?${q}`, apiKey))
  if (res.code) throw new Error(res.msg || '职业榜加载失败')
  return res.data ?? { entries: [], professions: [] }
}

export async function fetchBarrageCost(apiKey?: string | null) {
  const res = await request<Envelope<string | { cost?: number }>>(withKey('/chat-room/barrager/get', apiKey))
  if (typeof res.data === 'string' && res.data) return res.data
  if (res.data && typeof res.data === 'object' && res.data.cost != null) return `${res.data.cost}积分`
  return String(res.msg || '')
}

export async function fetchChatRaw(apiKey: string, oId: string) {
  const text = await requestText(withKey(`/cr/raw/${encodeURIComponent(oId)}`, apiKey))
  return text.split('<!--')[0].trim()
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

export async function fetchArticleMd(apiKey: string, id: string) {
  const res = await request<
    Envelope<{
      articleTitle?: string
      articleContent?: string
      articleTags?: string
      articleType?: number
      articleQnAOfferPoint?: number
    }> & {
      articleTitle?: string
      articleContent?: string
      articleTags?: string
      articleType?: number
    }
  >(withKey(`/api/article/md/${encodeURIComponent(id)}`, apiKey))
  if (res.code) throw new Error(res.msg || '无法读取原文')
  const data = res.data || res
  return {
    articleTitle: String(data.articleTitle || ''),
    articleContent: String(data.articleContent || ''),
    articleTags: String(data.articleTags || ''),
    articleType: Number(data.articleType || 0),
    articleQnAOfferPoint: Number((data as { articleQnAOfferPoint?: number }).articleQnAOfferPoint || 0),
  }
}

export async function updateArticle(
  apiKey: string,
  id: string,
  payload: {
    articleTitle: string
    articleContent: string
    articleTags: string
    articleType: number
    articleQnAOfferPoint?: number
  },
) {
  const res = await request<Envelope<unknown> & { articleId?: string }>(`/article/${encodeURIComponent(id)}`, {
    method: 'PUT',
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
  if (res.code) throw new Error(res.msg || '更新失败')
  return String(res.articleId || id)
}

export async function removeComment(apiKey: string, id: string) {
  const res = await request<Envelope<unknown>>(`/comment/${encodeURIComponent(id)}/remove`, {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  })
  if (res.code) throw new Error(res.msg || '删除评论失败')
}

export async function fetchCommentContent(apiKey: string, id: string) {
  const res = await request<{ code?: number; msg?: string; commentContent?: string }>(
    withKey(`/comment/${encodeURIComponent(id)}/content`, apiKey),
  )
  if (res.code) throw new Error(res.msg || '无法读取评论原文')
  return String(res.commentContent || '')
}

export async function updateComment(apiKey: string, id: string, commentContent: string) {
  const res = await request<Envelope<unknown> & { commentContent?: string }>(`/comment/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ apiKey, commentContent, commentVisible: false }),
  })
  if (res.code) throw new Error(res.msg || '更新评论失败')
  return res.commentContent
}

export async function acceptComment(apiKey: string, commentId: string) {
  const res = await request<Envelope<unknown>>('/comment/accept', {
    method: 'POST',
    body: JSON.stringify({ apiKey, commentId }),
  })
  if (res.code) throw new Error(res.msg || '采纳失败')
}

export async function queryTags(apiKey: string, title: string) {
  const res = await request<{ code?: number; tags?: string[] }>(
    withKey(`/tags/query?title=${encodeURIComponent(title)}`, apiKey),
  )
  return res.tags ?? []
}

export async function fetchRandomArticles(size = 8, apiKey?: string | null) {
  try {
    const res = await request<{ articles?: ArticleSummary[] }>(withKey(`/article/random/${size}`, apiKey))
    return res.articles ?? []
  } catch {
    return []
  }
}

export async function previewMarkdown(markdownText: string) {
  const res = await request<Envelope<string> & { html?: string }>('/markdown', {
    method: 'POST',
    body: JSON.stringify({ markdownText }),
  })
  if (typeof res.data === 'string' && res.data) return res.data
  return String(res.html || '')
}

export interface PublicLog {
  oId?: string
  key1?: string
  key2?: string
  key3?: string
  data?: string
}

export async function fetchPublicLogs(apiKey: string, page = 1, pageSize = 20) {
  const res = await request<Envelope<PublicLog[]>>(
    withKey(`/logs/more?page=${page}&pageSize=${pageSize}`, apiKey),
  )
  if (res.code) throw new Error(res.msg || '日志加载失败')
  return Array.isArray(res.data) ? res.data : []
}

export interface ProfessionProgress {
  professionId?: string
  displayName?: string
  shortName?: string
  levelName?: string
  totalExperience?: number
}

export interface PublicProfessionProfile {
  primaryProfession?: ProfessionProgress | null
  professions?: ProfessionProgress[]
}

export async function fetchPublicProfession(userName: string, apiKey?: string | null) {
  const paths = [
    `/api/user/${encodeURIComponent(userName)}/profession?position=profile&dark=false`,
    `/api/user/${encodeURIComponent(userName)}/profession`,
  ]
  for (const path of paths) {
    try {
      const res = await request<Envelope<PublicProfessionProfile>>(withKey(path, apiKey))
      if (res.code) continue
      if (res.data) return res.data
    } catch {
      /* try next */
    }
  }
  return null
}

export interface ProfessionMe {
  primaryProfessionId?: string
  progress?: ProfessionProgress[]
  privacyPreset?: string
  availableProfessions?: ProfessionProgress[]
  onboardingState?: string
}

export async function fetchProfessionMe(apiKey: string): Promise<ProfessionMe | null> {
  try {
    const res = await request<Envelope<ProfessionMe>>(withKey('/api/profession/me', apiKey))
    if (res.code) return null
    return res.data ?? null
  } catch {
    return null
  }
}

export async function setProfessionPrimary(apiKey: string, professionId: string) {
  const res = await request<Envelope<ProfessionMe>>('/api/profession/me/primary', {
    method: 'POST',
    body: JSON.stringify({ apiKey, professionId }),
  })
  if (res.code) throw new Error(res.msg || '设置主职业失败')
  return res.data ?? null
}

export async function setProfessionPrivacy(apiKey: string, preset: string) {
  const res = await request<Envelope<ProfessionMe>>('/api/profession/me/privacy', {
    method: 'POST',
    body: JSON.stringify({ apiKey, preset }),
  })
  if (res.code) throw new Error(res.msg || '设置职业隐私失败')
  return res.data ?? null
}

export async function fetchUserBreezemoons(userName: string, apiKey?: string | null, page = 1, size = 20) {
  try {
    const res = await request<Envelope<{ breezemoons?: Breezemoon[] }>>(
      withKey(`/api/user/${encodeURIComponent(userName)}/breezemoons?p=${page}&size=${size}`, apiKey),
    )
    if (res.code === 0 && Array.isArray(res.data?.breezemoons)) return res.data.breezemoons
  } catch {
    /* login required */
  }
  return []
}

export async function fetchUserMedals(apiKey: string, userName: string) {
  try {
    const res = await request<Envelope<unknown>>('/api/medal/user/list', {
      method: 'POST',
      body: JSON.stringify({ apiKey, userName }),
    })
    if (res.code) return []
    const raw = res.data
    const list = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && Array.isArray((raw as { list?: unknown[] }).list)
        ? (raw as { list: unknown[] }).list
        : []
    const medals: MetalItem[] = []
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const name = String(row.name || row.metalName || row.metal || '')
      if (!name) continue
      medals.push({
        name,
        description: String(row.description || row.desc || ''),
        attr: String(row.attr || ''),
      })
    }
    return medals
  } catch {
    return []
  }
}

export async function searchUserNames(apiKey: string, name: string): Promise<string[]> {
  const res = await request<Envelope<string[] | { userNames?: string[] }>>('/users/names', {
    method: 'POST',
    body: JSON.stringify({ apiKey, name }),
  })
  if (res.code) return []
  const data = res.data
  if (Array.isArray(data)) return data.map(String)
  if (data && Array.isArray(data.userNames)) return data.userNames.map(String)
  return []
}

export async function revokeChat(apiKey: string, oId: string) {
  const res = await request<Envelope<unknown>>('/chat-room/revoke', {
    method: 'POST',
    body: JSON.stringify({ apiKey, oId }),
  })
  if (res.code) throw new Error(res.msg || '撤回失败')
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

export async function followArticle(apiKey: string, followingId: string) {
  const res = await request<Envelope<unknown>>('/follow/article', {
    method: 'POST',
    body: JSON.stringify({ apiKey, followingId }),
  })
  if (res.code) throw new Error(res.msg || '收藏失败')
}

export async function unfollowArticle(apiKey: string, followingId: string) {
  const res = await request<Envelope<unknown>>('/unfollow/article', {
    method: 'POST',
    body: JSON.stringify({ apiKey, followingId }),
  })
  if (res.code) throw new Error(res.msg || '取消收藏失败')
}

export async function watchArticle(apiKey: string, followingId: string) {
  const res = await request<Envelope<unknown>>('/follow/article-watch', {
    method: 'POST',
    body: JSON.stringify({ apiKey, followingId }),
  })
  if (res.code) throw new Error(res.msg || '关注帖子失败')
}

export async function unwatchArticle(apiKey: string, followingId: string) {
  const res = await request<Envelope<unknown>>('/unfollow/article-watch', {
    method: 'POST',
    body: JSON.stringify({ apiKey, followingId }),
  })
  if (res.code) throw new Error(res.msg || '取消关注失败')
}

export async function rewardArticle(apiKey: string, oId: string) {
  const res = await request<Envelope<unknown>>(`/article/reward?articleId=${encodeURIComponent(oId)}`, {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  })
  if (res.code) throw new Error(res.msg || '打赏失败')
}

export async function thankComment(apiKey: string, commentId: string) {
  const res = await request<Envelope<unknown>>('/comment/thank', {
    method: 'POST',
    body: JSON.stringify({ apiKey, commentId }),
  })
  if (res.code) throw new Error(res.msg || '感谢评论失败')
}

export async function voteComment(apiKey: string, oId: string) {
  const res = await request<Envelope<unknown> & { type?: number }>('/vote/up/comment', {
    method: 'POST',
    body: JSON.stringify({ apiKey, dataId: oId }),
  })
  if (res.code) throw new Error(res.msg || '点赞评论失败')
  return res.type
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
  // 需登录；失败或空列表不返回 mock，避免访客看到假帖。
  return unwrapArticles(`/api/user/${encodeURIComponent(userName)}/articles?p=${page}&size=${size}`, apiKey)
}

async function unwrapUsers(paths: string[], apiKey?: string | null): Promise<SimpleUser[]> {
  for (const path of paths) {
    try {
      const res = await request<Envelope<SimpleUser[] | { users?: SimpleUser[]; followingUsers?: SimpleUser[] }>>(
        withKey(path, apiKey),
      )
      const data = res.data
      if (Array.isArray(data) && data.length) return data
      if (data && !Array.isArray(data) && Array.isArray(data.users) && data.users.length) return data.users
      if (data && !Array.isArray(data) && Array.isArray(data.followingUsers) && data.followingUsers.length) {
        return data.followingUsers
      }
    } catch {
      /* try next */
    }
  }
  return []
}

export async function fetchCollectedArticles(apiKey?: string | null, page = 1, size = 40) {
  if (!apiKey) return []
  return unwrapArticles(`/api/articles/collected?p=${page}&size=${size}`, apiKey)
}

export async function fetchFollowingArticles(apiKey?: string | null, page = 1, size = 40) {
  if (!apiKey) return []
  return unwrapArticles(`/api/user/following/articles?p=${page}&size=${size}`, apiKey)
}

export async function fetchFollowingUsers(userName: string, apiKey?: string | null, page = 1) {
  return unwrapUsers(
    [
      `/api/user/${encodeURIComponent(userName)}/following?p=${page}`,
      `/follow/users?p=${page}&followingId=${encodeURIComponent(userName)}`,
    ],
    apiKey,
  )
}

export async function fetchFollowers(userName: string, apiKey?: string | null, page = 1) {
  return unwrapUsers(
    [
      `/api/user/${encodeURIComponent(userName)}/followers?p=${page}`,
      `/follow/followers?p=${page}&followingId=${encodeURIComponent(userName)}`,
    ],
    apiKey,
  )
}

export async function fetchPointRecords(apiKey: string, page = 1): Promise<PointRecord[]> {
  const paths = [`/api/point/records?p=${page}`, `/api/user/points?p=${page}`, `/activity/point?p=${page}`]
  for (const path of paths) {
    try {
      const res = await request<Envelope<PointRecord[] | { records?: PointRecord[] }>>(withKey(path, apiKey))
      const data = res.data
      if (Array.isArray(data) && data.length) return data
      if (data && !Array.isArray(data) && Array.isArray(data.records) && data.records.length) return data.records
    } catch {
      /* try next */
    }
  }
  const notices = await fetchNotifications(apiKey, 'point', page)
  return notices.map((n, i) => ({
    oId: `notice-${i}`,
    description: n.description || n.content || '积分变动',
    time: n.createTime,
  }))
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
  return {}
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
  return []
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
  return []
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
  return []
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

export async function fetchChatHistory(apiKey?: string | null, page = 1) {
  const res = await request<Envelope<ChatHistoryItem[]>>(
    withKey(`/chat-room/more?page=${page}&type=html`, apiKey),
  )
  if (res.code !== 0) throw new Error(res.msg || '聊天记录失败')
  return res.data ?? []
}

export interface ChatOnlineSnapshot {
  discussing?: string
  onlineChatCnt?: number
  users?: { userName?: string; userNickname?: string; userAvatarURL?: string }[]
}

export async function fetchChatOnlineUsers(apiKey?: string | null): Promise<ChatOnlineSnapshot> {
  try {
    const res = await request<Envelope<ChatOnlineSnapshot>>(withKey('/chat-room/online-users', apiKey))
    if (res.code !== 0) return {}
    return res.data ?? {}
  } catch {
    return {}
  }
}

/** mode: 0 context, 1 before, 2 after */
export async function fetchChatAround(apiKey: string, oId: string, mode: 0 | 1 | 2 = 0, size = 16) {
  const res = await request<Envelope<ChatHistoryItem[]>>(
    withKey(
      `/chat-room/getMessage?oId=${encodeURIComponent(oId)}&mode=${mode}&size=${size}&type=html`,
      apiKey,
    ),
  )
  if (res.code !== 0) throw new Error(res.msg || '附近消息失败')
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
  reactionSummary?: ReactionSummary[]
  currentUserReaction?: string
}

export interface RedPacketContent {
  msgType?: string
  money?: number
  count?: number
  got?: number
  msg?: string
  type?: string
  recivers?: string[]
}

export interface MuteItem {
  userName: string
  userAvatarURL?: string
  time?: string
}
