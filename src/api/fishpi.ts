import { md5 } from 'js-md5'
import {
  mockCheckin,
  mockOnline,
  type DomainItem,
} from './catalog'
import { ApiError, request, withKey } from './http'
import { fetchV3FrequentEmotions, fetchV3EmojiGroups, fetchV3GroupEmojis, createV3EmojiGroup, updateV3EmojiGroup, deleteV3EmojiGroup, addV3EmojiURL, removeV3GroupEmoji, emojiOperationKey } from './v3-emojis'
import { fetchNotificationPage, fetchV3UnreadCount, markV3NotificationsRead, notificationReadKey } from './v3-notifications'
import { v3RecentArticles, v3ArticleFeed, v3Search, v3Domains, v3Tags, v3Article } from './v3-content'

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
  userCity?: string
  userQQ?: string
  /** Rhythm 角色，如 adminRole / defaultRole */
  roleId?: string
  userRole?: string
  userAppRole?: number
  userArticleCount?: number
  userCommentCount?: number
  userPhone?: string
  userEmail?: string
  /** 待后端在 /api/user 提供：未绑手机 / 管理组未开两步验证，对应现网首页的安全弹窗。 */
  needBindPhone?: boolean
  need2fa?: boolean
  /** 0 公开 / 1 私密 */
  userGeoStatus?: number
  /** 隐私开关：0 公开 / 1 私密（与现网一致） */
  userArticleStatus?: number
  userCommentStatus?: number
  userFollowingUserStatus?: number
  userFollowingTagStatus?: number
  userFollowingArticleStatus?: number
  userWatchingArticleStatus?: number
  userFollowerStatus?: number
  userBreezemoonStatus?: number
  userPointStatus?: number
  userOnlineStatus?: number
  userJoinPointRank?: number
  userJoinUsedPointRank?: number
  userUAStatus?: number
  userListPageSize?: number
  userCommentViewMode?: number
  userAvatarViewMode?: number
  userListViewMode?: number
  userIndexRedirectURL?: string
  /** 0 开启 / 1 关闭（与现网一致） */
  userNotifyStatus?: number
  userSubMailStatus?: number
  userKeyboardShortcutsStatus?: number
  userReplyWatchArticleStatus?: number
  userForwardPageStatus?: number
  chatRoomPictureStatus?: number
}

/** `/api/v3/me` 的最小公开账户表示，不包含联系方式、会话或旧 apiKey。 */
export interface V3AccountInfo {
  id: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  userPoint?: number
  userIntro?: string
  userURL?: string
  userGuideStep?: number
}

/** 隐私可见性：checkbox checked = 公开（对应 status === 0）。 */
export interface PrivacySettings {
  userArticleStatus: boolean
  userCommentStatus: boolean
  userFollowingUserStatus: boolean
  userFollowingTagStatus: boolean
  userFollowingArticleStatus: boolean
  userWatchingArticleStatus: boolean
  userFollowerStatus: boolean
  userBreezemoonStatus: boolean
  userPointStatus: boolean
  userOnlineStatus: boolean
  userJoinPointRank: boolean
  userJoinUsedPointRank: boolean
  userUAStatus: boolean
}

export interface MetalItem {
  /** 勋章定义 ID，现网用 `/gen?id=` 渲染勋章图 */
  id?: string
  name?: string
  description?: string
  /** 稀有度：普通 / 精良 / 稀有 / 史诗 / 传说 / 神话 / 限定 */
  type?: string
  order?: number
  attr?: string
  /** 解析自 attr，如 url=...&backcolor=...&fontcolor=... */
  url?: string
  backcolor?: string
  fontcolor?: string
}

/** Rhythm 常把 sysMetal 写成 JSON 字符串 `{"list":[...]}`，勿直接当数组遍历。 */
export function normalizeMetals(raw: unknown): MetalItem[] {
  let list: unknown = raw
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return []
    try {
      list = JSON.parse(text)
    } catch {
      return []
    }
  }
  if (list && typeof list === 'object' && !Array.isArray(list) && Array.isArray((list as { list?: unknown[] }).list)) {
    list = (list as { list: unknown[] }).list
  }
  if (!Array.isArray(list)) return []
  const out: MetalItem[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const name = String(row.name || row.metalName || '').trim()
    if (!name) continue
    const attr = String(row.attr || '')
    const parsed: MetalItem = {
      id: String(row.id ?? row.medalId ?? '').trim() || undefined,
      name,
      description: String(row.description || row.desc || ''),
      type: String(row.type || '').trim() || undefined,
      order: Number.isFinite(Number(row.order)) ? Number(row.order) : undefined,
      attr,
    }
    for (const part of attr.split('&')) {
      const i = part.indexOf('=')
      if (i <= 0) continue
      const k = part.slice(0, i)
      const v = decodeURIComponent(part.slice(i + 1))
      if (k === 'url') parsed.url = v
      if (k === 'backcolor') parsed.backcolor = v.startsWith('#') ? v : `#${v}`
      if (k === 'fontcolor') {
        const first = v.split(',')[0] || ''
        parsed.fontcolor = first.startsWith('#') ? first : `#${first}`
      }
    }
    out.push(parsed)
  }
  return out.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export interface UserProfile {
  oId: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  userAvatarURL210?: string
  userAvatarURL48?: string
  userAvatarURL20?: string
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
  cardBg?: string
  userNo?: number | string
  userRole?: string
  mbti?: string
  userOnlineFlag?: boolean
  sysMetal?: MetalItem[]
}

export interface SimpleUser {
  oId: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
}

export type NoticeType = 'commented' | 'reply' | 'at' | 'following' | 'point' | 'broadcast' | 'sys-announce' | 'other'

export interface NoticeItem {
  notificationTitle?: string
  contentAvailable?: boolean
  oId?: string
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
  dataId?: string
  dataType?: string | number
}

export interface UnreadCount {
  unreadOtherNotificationCnt?: number
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



export interface ArticleStickState {
  active: boolean
  permanent: boolean
  expiresAt: number | null
}

export interface ArticleSummary {
  articleAnonymous?: number
  stick?: ArticleStickState
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
  columnId?: string
  articleAuthorId?: string
  articleAuthorName?: string
  articleAuthorThumbnailURL48?: string
  articleAuthorThumbnailURL20?: string
  articleAuthorIntro?: string
  articleLatestCmterName?: string
  articleLatestCmtTimeAgo?: string
  articlePreviewContent?: string
  articleTagObjs?: { tagTitle: string; tagURI: string }[]
  articleHeat?: number
}

export interface ArticleComment {
  commentContentVisible?: boolean
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
  sysMetal?: MetalItem[] | string
  commentParagraphId?: string
  commentParagraphStatus?: number
  commentThreadReplies?: ArticleComment[]
}

export interface ParagraphCommentSummary {
  paragraphId: string
  commentCount: number
}

export interface ParagraphCommentPage {
  paragraphSnapshot?: string
  paragraphId?: string
  commentThreadParents?: ArticleComment[]
  pagination?: ArticleDetail['pagination']
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
  articleCity?: string
  articleGoodCnt?: number
  articleThankCnt?: number
  articleCollectCnt?: number
  articleWatchCnt?: number
  articleRewardPoint?: number
  articleRewardContent?: string
  articleQnAOfferPoint?: number
  articleAnonymous?: number
  articleShowInList?: number
  articleStatement?: number
  rewardedCnt?: number
  sysMetal?: MetalItem[]
  articleAuthor?: { sysMetal?: MetalItem[]; userName?: string; userNickname?: string }
  thankedCnt?: number
  /** 0 已赞同，1 已反对，-1 未投票 */
  articleVote?: number
  articleType?: number
  articleHeat?: number
  articleAudioURL?: string
  articleStick?: number
  /** 置顶剩余分钟数 */
  articleStickRemains?: number
  articleRevisionCount?: number
  offered?: boolean
  reactionSummary?: ReactionSummary[]
  currentUserReaction?: string
  /** 长文章所属专栏（接口 data 层字段，前端合并进来） */
  longArticleColumnView?: LongArticleColumnView
  /** 长文阅读激励统计 */
  longArticleReadStat?: {
    registeredUnsettledCnt?: number
    anonymousUnsettledCnt?: number
    registeredTotalCnt?: number
    anonymousTotalCnt?: number
  }
}

export interface LongArticleChapter {
  articleId: string
  articleTitle: string
  articleTitleEmoj?: string
  articleCreateTime?: string
  articlePermalink: string
  chapterNo: number
  articlePreviewContent?: string
}

export interface LongArticleColumnView {
  column: { oId: string; columnTitle: string; columnArticleCount?: number; columnCoverURL?: string }
  chapters: LongArticleChapter[]
  chapterNo?: number
  previous?: LongArticleChapter
  next?: LongArticleChapter
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
  userNickname?: string
  userAvatarURL?: string
  userAvatarURL20?: string
  userAvatarURL48?: string
  userAvatarURL210?: string
  userCheckinStreak?: number
  userCurrentCheckinStreak?: number
  userLongestCheckinStreak?: number
  onlineMinute?: number
  userPoint?: number
  /** 消费榜常见字段 */
  userUsedPoint?: number
  point?: number
  userNo?: number | string
  userIntro?: string
  userURL?: string
  userAppRole?: number
}

interface Envelope<T> {
  code: number
  msg?: string
  Key?: string
  data?: T
}

export async function login(username: string, passwd: string, mfaCode = '') {
  const res = await request<Envelope<{ accessToken?: string }>>('/api/v3/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      nameOrEmail: username,
      userPassword: md5(passwd),
      mfaCode,
    }),
  })
  if (res.code !== 0 || !res.data?.accessToken) {
    throw new ApiError(res.msg || '登录失败', 401, String(res.code || 'login_failed'))
  }
  return res.data.accessToken
}

/** 通过极验结果解除 Rhythm IP 风控黑名单（对应现网 /validateCaptcha） */
export async function validateRiskCaptcha(captcha: unknown) {
  const res = await request<Envelope<unknown>>('/validateCaptcha', {
    method: 'POST',
    body: JSON.stringify({ captcha }),
  })
  if (res.code) throw new Error(res.msg || '人机验证失败，请重试')
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
  userQQ?: string
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

/** 修改密码：页面态 POST /settings/password（MD5 + CSRF）。 */
/** 地理位置公开状态：0 公开 / 1 私密。 */
export async function updateGeoStatus(apiKey: string, userGeoStatus: 0 | 1) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/settings/geo/status', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({ userGeoStatus }),
  })
  if (res.code) throw new Error(res.msg || '地理位置设置失败')
}

export interface FunctionSettings {
  userListPageSize: number
  userCommentViewMode: number
  userAvatarViewMode: number
  userListViewMode: number
  userIndexRedirectURL: string
  userNotifyStatus: boolean
  userSubMailStatus: boolean
  userKeyboardShortcutsStatus: boolean
  userReplyWatchArticleStatus: boolean
  userForwardPageStatus: boolean
  chatRoomPictureStatus: boolean
}

/** 功能偏好：页面态 POST /settings/function。 */
export async function updateFunctionSettings(apiKey: string, data: FunctionSettings) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/settings/function', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify(data),
  })
  if (res.code) throw new Error(res.msg || '功能设置失败')
}

/** 隐私可见性：页面态 POST /settings/privacy（boolean = 是否公开）。 */
export async function updatePrivacySettings(apiKey: string, data: PrivacySettings) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/settings/privacy', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify(data),
  })
  if (res.code) throw new Error(res.msg || '隐私设置失败')
}


export async function updateI18nSettings(
  apiKey: string,
  data: { userLanguage: string; userTimezone: string },
) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/settings/i18n', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify(data),
  })
  if (res.code) throw new Error(res.msg || '国际化设置失败')
}

/** 忘记密码：发送短信（GeeTest4 校验结果作 captcha）。 */
export async function requestForgetPwd(userPhone: string, captcha: unknown) {
  const res = await request<Envelope<unknown>>('/forget-pwd', {
    method: 'POST',
    body: JSON.stringify({ userPhone, captcha }),
  })
  if (res.code) throw new Error(res.msg || '发送失败')
  return res.msg || '验证码已发送'
}

/**
 * 重置密码元数据。现网无 JSON（见 docs/MISSING_APIS.md），使用假数据通 UI。
 * 建议后端：GET /api/reset-pwd/meta?code=
 */
export async function fetchResetPwdMeta(code: string): Promise<{ userId: string; code: string }> {
  try {
    const res = await request<Envelope<{ userId?: string; code?: string }>>(
      `/api/reset-pwd/meta?code=${encodeURIComponent(code)}`,
    )
    if (!res.code && res.data?.userId) {
      return { userId: res.data.userId, code: res.data.code || code }
    }
  } catch {
    /* 接口未开放 */
  }
  const { mockResetPwdMeta } = await import('./gaps.mock')
  return mockResetPwdMeta(code)
}

/** 重置密码：POST /reset-pwd（MD5）。 */
export async function resetPassword(userId: string, code: string, passwd: string) {
  const res = await request<Envelope<unknown>>('/reset-pwd', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      code,
      userPassword: md5(passwd),
    }),
  })
  if (res.code) throw new Error(res.msg || '重置失败')
}

/** 积分兑换邀请码。 */
export async function buyInvitecode(apiKey: string): Promise<string> {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/point/buy-invitecode', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({}),
  })
  if (res.code) throw new Error(res.msg || '兑换失败')
  return res.msg || '兑换成功'
}

/** 查询邀请码状态。code 1=可用，其它多为不可用/错误。 */
export async function queryInvitecode(apiKey: string, invitecode: string): Promise<{ ok: boolean; msg: string }> {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/invitecode/state', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({ invitecode }),
  })
  return { ok: res.code === 1, msg: res.msg || (res.code === 1 ? '可用' : '不可用') }
}

export interface EmojiItem {
  emojiId?: string
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

export function emojiToMarkdown(item: EmojiItem) {
  if (item.url) {
    const name = item.name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\[\]]/g, '\\$&')
    const destination = item.url.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/[()]/g, '\\$&')
    return `![${name}](${destination})`
  }
  return item.text || `:${item.name}:`
}
export async function fetchFrequentEmotions(_apiKey: string): Promise<EmojiItem[]> { return fetchV3FrequentEmotions() }
export async function fetchEmojiGroups(_apiKey: string, p = 1): Promise<EmojiGroup[]> { return (await fetchV3EmojiGroups(p)).list }
export async function fetchGroupEmojis(_apiKey: string, groupId: string, p = 1): Promise<EmojiItem[]> { return (await fetchV3GroupEmojis(groupId, p)).list }
export async function createEmojiGroup(_apiKey: string, name: string, sort = 0, key = emojiOperationKey()) { return createV3EmojiGroup(name, sort, key) }
export async function updateEmojiGroup(_apiKey: string, groupId: string, name: string, sort = 0, key = emojiOperationKey()) { return updateV3EmojiGroup(groupId, name, sort, key) }
export async function deleteEmojiGroup(_apiKey: string, groupId: string, key = emojiOperationKey()) { return deleteV3EmojiGroup(groupId, key) }
export async function addEmojiUrl(_apiKey: string, groupId: string, url: string, sort = 0, name = '', key = emojiOperationKey()) { return addV3EmojiURL(groupId, url, sort, name, key) }
export async function removeGroupEmoji(_apiKey: string, groupId: string, itemId: string, key = emojiOperationKey()) { return removeV3GroupEmoji(groupId, itemId, key) }

export async function transferPoints(apiKey: string, userName: string, amount: number, memo: string) {
  const res = await request<Envelope<unknown>>('/point/transfer', {
    method: 'POST',
    body: JSON.stringify({ apiKey, userName, amount, memo }),
  })
  if (res.code) throw new Error(res.msg || '转账失败')
}

/** 请求失败（401/404/code≠0）返回 null，与成功的空列表区分。 */
async function tryArticles(path: string, apiKey?: string | null): Promise<ArticleSummary[] | null> {
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
  return null
}

/** 匿名读未开放或接口 404 时可选回退 mock；成功但空列表不再当成失败。 */
async function unwrapArticles(path: string, apiKey?: string | null, fallback?: () => ArticleSummary[]) {
  return (await tryArticles(path, apiKey)) ?? (fallback ? fallback() : [])
}

export async function fetchRecentArticles(_apiKey?: string | null, page = 1, size = 40) {
  return v3RecentArticles(page, size)
}

export type ArticleFeedKind =
  | 'recent'
  | 'hot'
  | 'long'
  | 'good'
  | 'reply'
  | 'qna'
  | 'perfect'
  | 'search'
  | 'domain'
  | 'tag'

export async function fetchArticleFeed(
  kind: ArticleFeedKind,
  _apiKey?: string | null,
  page = 1,
  size = 40,
  extra = '',
): Promise<ArticleSummary[]> {
  return v3ArticleFeed(kind, page, size, extra)
}

export async function fetchSearch(q: string, _apiKey?: string | null, page = 1, size = 40) {
  return v3Search(q, page, size)
}

export async function fetchDomains(_apiKey?: string | null): Promise<DomainItem[]> {
  return v3Domains()
}

export interface TagItem {
  tagTitle: string
  tagURI: string
  tagIconPath?: string
  tagReferenceCount?: number
  tagDescription?: string
}

export async function fetchTags(_apiKey?: string | null, page = 1, size = 50): Promise<{ tags: TagItem[]; total: number }> {
  return v3Tags(page, size)
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

export async function fetchArticle(id: string, _apiKey?: string | null, page = 1): Promise<ArticleDetail> {
  return v3Article(id, page)
}

export async function fetchBreezemoons(page = 1, size = 20) {
  const res = await request<{
    code: number
    msg?: string
    breezemoons?: Breezemoon[]
    data?: { breezemoons?: Breezemoon[] } | Breezemoon[]
  }>(`/api/breezemoons?p=${page}&size=${size}`)
  if (res.code !== 0) throw new Error(res.msg || '清风明月失败')
  if (Array.isArray(res.breezemoons)) return res.breezemoons
  if (Array.isArray(res.data)) return res.data
  if (res.data && Array.isArray(res.data.breezemoons)) return res.data.breezemoons
  return []
}


type TopRankPayload = RankUser[] | { users?: RankUser[]; list?: RankUser[] }

/** 现网 /api/top/* 返回 `data.list`；兼容数组与 `data.users`。 */
function rankUsersOf(data: TopRankPayload | undefined): RankUser[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.list)) return data.list
  if (data && Array.isArray(data.users)) return data.users
  return []
}

/** 请求失败时才回退演示榜单，成功的空榜单原样返回。 */
export async function fetchCheckinRank(apiKey?: string | null): Promise<RankUser[]> {
  try {
    const res = await request<Envelope<TopRankPayload>>(withKey('/api/top/checkin?p=1', apiKey))
    if (!res.code) return rankUsersOf(res.data)
  } catch {
    /* anonymous top not ready */
  }
  return mockCheckin()
}

export async function fetchOnlineRank(apiKey?: string | null): Promise<RankUser[]> {
  try {
    const res = await request<Envelope<TopRankPayload>>(withKey('/api/top/online?p=1', apiKey))
    if (!res.code) return rankUsersOf(res.data)
  } catch {
    /* anonymous top not ready */
  }
  return mockOnline()
}

async function unwrapTopRank(path: string, apiKey?: string | null): Promise<RankUser[]> {
  try {
    const res = await request<Envelope<TopRankPayload>>(withKey(path, apiKey))
    return rankUsersOf(res.data)
  } catch {
    /* login required or unavailable */
  }
  return []
}

/** 财富榜；现网匿名常 401，需登录。 */
export async function fetchBalanceRank(apiKey?: string | null) {
  return unwrapTopRank('/api/top/balance?p=1', apiKey)
}

/** 消费榜；现网匿名常 401，需登录。 */
export async function fetchConsumptionRank(apiKey?: string | null) {
  return unwrapTopRank('/api/top/consumption?p=1', apiKey)
}

export interface DonateRankEntry {
  userId?: string
  total: number
  totalCount: number
  profile: RankUser
}

export interface DonateRankData {
  totalAmount: number
  donateMakeDays: number
  data: DonateRankEntry[]
}

export interface CountRankEntry {
  userId?: string
  toId?: string
  count?: number
  c?: number
  profile: RankUser
}

export interface GameRankEntry {
  uname?: string
  userName?: string
  userNickname?: string
  userAvatarURL?: string
  userIntro?: string
  userNo?: number
  score?: number | string
  rank?: number
  ancestry?: string
  gongfa?: string
}

export async function fetchDonateRank(apiKey?: string | null): Promise<DonateRankData> {
  try {
    const res = await request<Envelope<{ data?: DonateRankEntry[]; totalData?: { totalAmount?: number; donateMakeDays?: number } }>>(
      withKey('/api/top/donate?p=1', apiKey),
    )
    if (res.data && Array.isArray(res.data.data)) {
      return {
        totalAmount: Number(res.data.totalData?.totalAmount || 0),
        donateMakeDays: Number(res.data.totalData?.donateMakeDays || 0),
        data: res.data.data,
      }
    }
  } catch {
    /* login required or unavailable */
  }
  return { totalAmount: 0, donateMakeDays: 0, data: [] }
}

export async function fetchPerfectRank(apiKey?: string | null): Promise<CountRankEntry[]> {
  try {
    const res = await request<Envelope<CountRankEntry[] | { data?: CountRankEntry[] }>>(
      withKey('/api/top/perfect?p=1', apiKey),
    )
    if (Array.isArray(res.data)) return res.data
    if (res.data && 'data' in res.data && Array.isArray(res.data.data)) return res.data.data
  } catch {
    /* login required or unavailable */
  }
  return []
}

export async function fetchInviteRank(apiKey?: string | null): Promise<CountRankEntry[]> {
  try {
    const res = await request<Envelope<CountRankEntry[] | { data?: CountRankEntry[] }>>(
      withKey('/api/top/invite?p=1', apiKey),
    )
    if (Array.isArray(res.data)) return res.data
    if (res.data && 'data' in res.data && Array.isArray(res.data.data)) return res.data.data
  } catch {
    /* login required or unavailable */
  }
  return []
}

export async function fetchGameRank(game: string, apiKey?: string | null): Promise<GameRankEntry[]> {
  try {
    const res = await request<Envelope<GameRankEntry[] | { data?: GameRankEntry[] }>>(
      withKey(`/api/top/${encodeURIComponent(game)}?p=1`, apiKey),
    )
    if (Array.isArray(res.data)) return res.data
    if (res.data && 'data' in res.data && Array.isArray(res.data.data)) return res.data.data
  } catch {
    /* login required or unavailable */
  }
  return []
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
  userAvatarURL48?: string
  userAvatarURL?: string
  professionId?: string
  professionName?: string
  displayName?: string
  levelName?: string
  totalExperience?: number
  iconUrl?: string
  primaryColor?: string
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

export async function fetchRandomArticles(size = 8, apiKey?: string | null) {
  try {
    const res = await request<{ articles?: ArticleSummary[] }>(withKey(`/article/random/${size}`, apiKey))
    return res.articles ?? []
  } catch {
    return []
  }
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
  description?: string
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
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<ProfessionMe>>('/api/profession/me/primary', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({ professionId }),
  })
  if (res.code) throw new Error(res.msg || '设置主职业失败')
  return res.data ?? null
}

export async function setProfessionPrivacy(apiKey: string, preset: string) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<ProfessionMe>>('/api/profession/me/privacy', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({ preset }),
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
    return normalizeMetals(
      list.map((item) =>
        item && typeof item === 'object' && !(item as { name?: unknown }).name
          ? { ...(item as object), name: (item as { metal?: unknown }).metal }
          : item,
      ),
    )
  } catch {
    return []
  }
}

export interface UserNameHit {
  userName: string
  avatar?: string
}

export async function searchUsers(apiKey: string, name: string): Promise<UserNameHit[]> {
  const res = await request<Envelope<unknown[] | { userNames?: unknown[] }>>('/users/names', {
    method: 'POST',
    body: JSON.stringify({ apiKey, name }),
  })
  if (res.code) return []
  const data = res.data
  const rows = Array.isArray(data) ? data : data && Array.isArray(data.userNames) ? data.userNames : []
  return rows
    .map((r) => {
      if (typeof r === 'string') return { userName: r }
      const o = r as { userName?: string; userAvatarURL48?: string; userAvatarURL20?: string; userAvatarURL?: string }
      return { userName: o.userName || '', avatar: o.userAvatarURL48 || o.userAvatarURL20 || o.userAvatarURL }
    })
    .filter((u) => u.userName)
}

export async function searchUserNames(apiKey: string, name: string): Promise<string[]> {
  return (await searchUsers(apiKey, name)).map((u) => u.userName)
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
  let lastError: unknown
  for (const path of paths) {
    try {
      const res = await request<UserProfile & Envelope<UserProfile> & { sysMetal?: unknown }>(withKey(path, apiKey))
      const profile = res.userName ? res : res.code === 0 && res.data?.userName ? res.data : null
      if (!profile) throw new Error('用户资料响应无效')
      profile.sysMetal = normalizeMetals((profile as { sysMetal?: unknown }).sysMetal)
      return profile
    } catch (error) {
      lastError = error
    }
  }
  // 资料会被设置页回填后提交，失败时不能用假资料顶替；对外消息不含请求地址或 API Key。
  throw new Error('用户资料加载失败', { cause: lastError })
}

export async function fetchUserArticles(userName: string, apiKey?: string | null, page = 1, size = 40) {
  // 需登录；失败或空列表不返回 mock，避免访客看到假帖。
  return unwrapArticles(`/api/user/${encodeURIComponent(userName)}/articles?p=${page}&size=${size}`, apiKey)
}


export async function fetchUserPoint(userName: string, apiKey?: string | null) {
  try {
    const res = await request<Envelope<{ userPoint?: number; userName?: string }>>(
      withKey(`/user/${encodeURIComponent(userName)}/point`, apiKey),
    )
    if (res.code === 0 && res.data) {
      return {
        userName: res.data.userName || userName,
        userPoint: Number(res.data.userPoint || 0),
      }
    }
  } catch {
    /* optional */
  }
  return null
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

/** Rhythm 对 GET /user/liveness 限流：每用户 9 分钟 1 次，超出直接 500 空响应。 */
const LIVENESS_TTL = 9 * 60 * 1000
const LIVENESS_STORE = 'fp.liveness'

function livenessScope(apiKey: string) {
  let h = 5381
  for (let i = 0; i < apiKey.length; i++) h = ((h << 5) + h + apiKey.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

interface LivenessRecord {
  scope: string
  /** 最近一次成功拿到的值 */
  value: number | null
  /** 最近一次实际发出请求的时间（无论成败） */
  at: number
}

let livenessInflight: Promise<number> | null = null

function readLiveness(scope: string): LivenessRecord | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const s = JSON.parse(localStorage.getItem(LIVENESS_STORE) || 'null') as LivenessRecord | null
    return s && s.scope === scope && typeof s.at === 'number' ? s : null
  } catch {
    return null
  }
}

function saveLiveness(rec: LivenessRecord) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(LIVENESS_STORE, JSON.stringify(rec))
}

export async function fetchLiveness(apiKey: string): Promise<number> {
  const scope = livenessScope(apiKey)
  const saved = readLiveness(scope)
  if (saved && Date.now() - saved.at < LIVENESS_TTL) {
    if (saved.value !== null) return saved.value
    throw new Error('活跃度查询过于频繁，请稍后再试')
  }
  if (livenessInflight) return livenessInflight
  const prev = saved?.value ?? null
  saveLiveness({ scope, value: prev, at: Date.now() })
  livenessInflight = (async () => {
    try {
      const res = await request<{ liveness?: number }>(withKey('/user/liveness', apiKey))
      const value = Number(res.liveness ?? 0)
      saveLiveness({ scope, value, at: Date.now() })
      return value
    } finally {
      livenessInflight = null
    }
  })()
  return livenessInflight
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

export async function fetchUnreadCount(_apiKey: string): Promise<UnreadCount> { return fetchV3UnreadCount() }
export async function fetchNotifications(_apiKey: string, type: NoticeType, page = 1): Promise<NoticeItem[]> {
  return (await fetchNotificationPage(type, page)).items
}
export async function markNoticeRead(_apiKey: string, type: NoticeType, key = notificationReadKey()) {
  return markV3NotificationsRead(type, key)
}
export async function markAllNoticesRead(_apiKey: string, key = notificationReadKey()) {
  return markV3NotificationsRead('all', key)
}

export interface MembershipLevel {
  oId: string
  lvName: string
  lvCode: string
  price: number
  durationType: string
  durationValue: number
  benefits?: string
  openedMemberCount?: number
}

export interface MembershipStatus {
  state?: number
  expiresAt?: number
  lvCode?: string
  configJson?: string
  isVip: boolean
}

export async function fetchMembershipLevels(): Promise<MembershipLevel[]> {
  const res = await request<Envelope<MembershipLevel[]>>('/api/membership/levels')
  if (res.code !== 0) throw new Error(res.msg || '获取会员等级失败')
  return Array.isArray(res.data) ? res.data : []
}

export async function fetchMembershipDetail(userId: string): Promise<MembershipStatus> {
  const res = await request<Envelope<Omit<MembershipStatus, 'isVip'> & { isActive?: boolean }>>(
    `/api/membership/${userId}`,
  )
  if (res.code !== 0) return { isVip: false }
  const data = res.data || {}
  const expiresAt = Number(data.expiresAt || 0)
  const isVip =
    Number(data.state) === 1 || Boolean(data.isActive) || (expiresAt > Date.now() && expiresAt > 0)
  return {
    state: data.state,
    expiresAt: expiresAt || undefined,
    lvCode: data.lvCode,
    configJson: data.configJson,
    isVip,
  }
}

/** @deprecated 使用 fetchMembershipDetail；保留兼容 auth store */
export async function fetchMembership(userId: string) {
  return fetchMembershipDetail(userId)
}

/** 积分开通 VIP：`POST /api/membership/open`（body 含 apiKey） */
export async function openMembership(apiKey: string, levelOId: string, couponCode = '') {
  const res = await request<Envelope<unknown>>('/api/membership/open', {
    method: 'POST',
    body: JSON.stringify({
      apiKey,
      oId: levelOId,
      couponCode: couponCode || '',
      configJson: '',
    }),
  })
  if (res.code) throw new Error(res.msg || '开通失败')
  return res.data
}

export async function submitFishGame(
  apiKey: string,
  payload: {
    fishGameName: string
    fishGameDescription?: string
    fishGameUrl: string
    fishGameIconUrl?: string
  },
) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/api/fish-games', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({ ...payload, apiKey }),
  })
  if (res.code) throw new Error(res.msg || '投稿失败')
  return res.data
}

export interface ChatNodeOption {
  node: string
  name: string
  online?: number
  weight?: number
}

export interface ChatNodeBundle {
  /** 推荐连接的完整 WS URL（已含加密 apiKey） */
  data: string
  /** 当前推荐节点显示名 */
  msg: string
  /** 节点切换用的加密 key（拼到 node 后） */
  apiKey: string
  avaliable: ChatNodeOption[]
}

/** 聊天室节点：推荐 WS + 可选列表。 */
export async function fetchChatNodeBundle(apiKey: string): Promise<ChatNodeBundle> {
  const res = await request<{
    code: number
    msg?: string
    data?: string
    apiKey?: string
    avaliable?: ChatNodeOption[]
  }>('/chat-room/node/get?apiKey=' + encodeURIComponent(apiKey))
  if (res.code !== 0 || !res.data) throw new Error(res.msg || '获取节点失败')
  return {
    data: res.data,
    msg: res.msg || '默认节点',
    apiKey: res.apiKey || '',
    avaliable: Array.isArray(res.avaliable) ? res.avaliable : [],
  }
}

/** @deprecated 使用 fetchChatNodeBundle；保留兼容旧调用。 */
export async function fetchChatNode(apiKey: string) {
  const bundle = await fetchChatNodeBundle(apiKey)
  return bundle.data
}

export async function fetchAppLoginQr(apiKey: string): Promise<string> {
  const { ensureCsrfToken } = await import('./pageAuth')
  await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown> & { apiKey?: string }>('/getApiKeyInWeb')
  if (res.code || !res.apiKey) throw new Error(res.msg || '获取 APP 登录码失败')
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`login:${res.apiKey}`)}`
}

export interface MyMedal {
  medalId: string
  name: string
  description: string
  type: string
  display: boolean
  displayOrder: number
  expireTime: number
}

/** 现网勋章图（需页面会话，未登录时返回 0×0 空图）；mini 为聊天室用的无文字小图 */
export function medalImageUrl(medalId: string, mini = false) {
  if (!medalId) return ''
  return `/gen?${mini ? 'mini=yes&' : ''}id=${encodeURIComponent(medalId)}`
}

export async function fetchMyMedals(apiKey: string): Promise<MyMedal[]> {
  const { ensureCsrfToken } = await import('./pageAuth')
  await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/api/medal/my/list', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (res.code) throw new Error(res.msg || '加载勋章失败')
  const raw = res.data
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { list?: unknown[] }).list)
      ? (raw as { list: unknown[] }).list
      : []
  const medals: MyMedal[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const medalId = String(row.medal_id || row.medalId || '')
    if (!medalId) continue
    medals.push({
      medalId,
      name: String(row.medal_name || row.name || ''),
      description: String(row.medal_description || row.description || ''),
      type: String(row.medal_type || row.type || '普通'),
      display: typeof row.display === 'boolean' ? row.display : true,
      displayOrder: typeof row.display_order === 'number' ? row.display_order : Number(row.displayOrder || 0),
      expireTime: Number(row.expire_time || row.expireTime || 0),
    })
  }
  medals.sort((a, b) => a.displayOrder - b.displayOrder)
  return medals
}

export async function setMyMedalDisplay(apiKey: string, medalId: string, display: boolean) {
  const { ensureCsrfToken } = await import('./pageAuth')
  await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/api/medal/my/display', {
    method: 'POST',
    body: JSON.stringify({ medalId, display }),
  })
  if (res.code) throw new Error(res.msg || '操作失败')
}

export async function reorderMyMedal(apiKey: string, medalId: string, direction: 'up' | 'down') {
  const { ensureCsrfToken } = await import('./pageAuth')
  await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/api/medal/my/reorder', {
    method: 'POST',
    body: JSON.stringify({ medalId, direction }),
  })
  if (res.code) throw new Error(res.msg || '排序失败')
}

export async function saveVipConfigApi(apiKey: string, config: { bold?: boolean; underline?: boolean; color?: string }) {
  const { ensureCsrfToken } = await import('./pageAuth')
  await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/api/membership/config', {
    method: 'POST',
    body: JSON.stringify(config),
  })
  if (res.code) throw new Error(res.msg || '保存配置失败')
}

export interface HomeColumnChapter {
  articleId: string
  permalink: string
  chapterNo: string
  title: string
  preview?: string
  createdAt?: string
}

export interface HomeColumnCard {
  columnId: string
  columnTitle: string
  columnArticleCount: number
  columnCoverURL?: string
  chapters: HomeColumnChapter[]
  latestChapter?: HomeColumnChapter | null
}

interface RawColumnChapter {
  id?: string
  articleId?: string
  chapterNo?: number | string
  title?: string
  articleTitle?: string
  articlePermalink?: string
  permalink?: string
  articlePreviewContent?: string
  preview?: string
  createdAt?: string
}

interface RawColumnCard {
  id?: string
  columnId?: string
  oId?: string
  title?: string
  columnTitle?: string
  coverURL?: string
  articleCount?: number
  columnArticleCount?: number
  columnCoverURL?: string
  chapters?: RawColumnChapter[]
  latestChapter?: RawColumnChapter | null
  secondLatestChapter?: RawColumnChapter | null
}

function normalizeChapter(ch: RawColumnChapter): HomeColumnChapter {
  const no = ch.chapterNo
  return {
    articleId: String(ch.id || ch.articleId || ''),
    permalink: ch.articlePermalink || ch.permalink || (ch.articleId ? `/article/${ch.articleId}` : ''),
    chapterNo: typeof no === 'number' ? `第 ${no} 章` : String(no ?? ''),
    title: ch.title || ch.articleTitle || '',
    preview: ch.preview || ch.articlePreviewContent || '',
    createdAt: ch.createdAt || '',
  }
}

function normalizeColumnCard(c: RawColumnCard): HomeColumnCard {
  const raw = c.chapters?.length ? c.chapters : [c.latestChapter, c.secondLatestChapter]
  const chapters = raw.filter((ch): ch is RawColumnChapter => Boolean(ch)).map(normalizeChapter)
  return {
    columnId: String(c.id || c.columnId || c.oId || ''),
    columnTitle: c.title || c.columnTitle || '',
    columnArticleCount: Number(c.articleCount ?? c.columnArticleCount ?? 0),
    columnCoverURL: c.coverURL || c.columnCoverURL || '',
    chapters,
    latestChapter: chapters[0] || null,
  }
}

interface RawColumnDetail {
  column?: RawColumnCard
  chapters?: RawColumnChapter[]
}

export async function fetchColumnDetail(columnId: string): Promise<HomeColumnCard> {
  const res = await request<Envelope<RawColumnDetail>>(`/api/v3/columns/${encodeURIComponent(columnId)}`)
  if (res.code !== 0 || !res.data?.column) throw new Error(res.msg || '专栏不存在')
  const column = normalizeColumnCard({ ...res.data.column, chapters: res.data.chapters || [] })
  if (!column.columnArticleCount) column.columnArticleCount = column.chapters.length
  return column
}

export async function fetchHomeColumns(): Promise<{ recent: HomeColumnCard[]; hot: HomeColumnCard[] }> {
  const [latest, hot] = await Promise.all([
    request<Envelope<{ list?: RawColumnCard[] }>>('/api/v3/columns?size=12'),
    request<Envelope<{ list?: RawColumnCard[] }>>('/api/v3/columns/hot?size=12'),
  ])
  if (latest.code !== 0 || hot.code !== 0) throw new Error('加载专栏失败')
  return {
    recent: (latest.data?.list || []).map(normalizeColumnCard),
    hot: (hot.data?.list || []).map(normalizeColumnCard),
  }
}

export interface ChatHistoryItem {
  oId: string
  userOId?: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  content: string | RedPacketContent
  md?: string
  time?: string
  type?: string
  reactionSummary?: ReactionSummary[]
  currentUserReaction?: string
  sysMetal?: MetalItem[] | string
}

export interface RedPacketContent {
  msgType?: string
  money?: number
  count?: number
  got?: number
  msg?: string
  type?: string
  recivers?: string[]
  senderId?: string
  who?: { userId?: string; userName?: string; money?: number; gesture?: number }[]
}

export interface MuteItem {
  userName: string
  userAvatarURL?: string
  time?: string
}
