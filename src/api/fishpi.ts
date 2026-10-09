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
import { ApiError, request, requestText, withKey } from './http'

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
  columnId?: string
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
export async function updatePassword(apiKey: string, oldPassword: string, newPassword: string) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/settings/password', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({
      userPassword: md5(oldPassword),
      userNewPassword: md5(newPassword),
    }),
  })
  if (res.code) throw new Error(res.msg || '修改密码失败')
}

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

/** 修改用户名：POST /settings/username。 */
export async function updateUsername(apiKey: string, userName: string) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/settings/username', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({ userName }),
  })
  if (res.code) throw new Error(res.msg || '修改用户名失败')
}

/** 发送绑定手机短信：GeeTest 结果作 captcha。 */
export async function requestPhoneBindCode(apiKey: string, userPhone: string, captcha: unknown) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/settings/phone/vc', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({ userPhone, captcha }),
  })
  if (res.code) throw new Error(res.msg || '发送短信失败')
  return res.msg || '验证码已发送'
}

/** 提交绑定手机：captcha 为短信验证码。 */
export async function bindPhone(apiKey: string, userPhone: string, captcha: string) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/settings/phone', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({ userPhone, captcha }),
  })
  if (res.code) throw new Error(res.msg || '绑定手机失败')
  return res.msg || '绑定成功'
}

/** 发送绑定邮箱验证码：GeeTest 结果作 captcha。 */
export async function requestEmailBindCode(apiKey: string, userEmail: string, captcha: unknown) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/settings/email/vc', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({ userEmail, captcha }),
  })
  if (res.code) throw new Error(res.msg || '发送邮件失败')
  return res.msg || '验证码已发送'
}

/** 提交绑定邮箱：captcha 为邮件验证码。 */
export async function bindEmail(apiKey: string, userEmail: string, captcha: string) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/settings/email', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({ userEmail, captcha }),
  })
  if (res.code) throw new Error(res.msg || '绑定邮箱失败')
  return res.msg || '绑定成功'
}

/** 国际化：页面态 POST /settings/i18n。 */
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

/** 导出帖子与评论压缩包。 */
export async function exportPosts(apiKey: string): Promise<string> {
  const { ensureCsrfToken } = await import('./pageAuth')
  await ensureCsrfToken(apiKey)
  const res = await request<Envelope<{ url?: string }> & { url?: string }>('/export/posts', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (res.code) throw new Error(res.msg || '导出失败')
  const url = res.url || res.data?.url
  if (!url) throw new Error('未返回导出地址')
  return url
}

/** 官方身份认证提交。 */
export async function submitIdentity(apiKey: string, data: {
  type: string
  idCert: string
  idId?: string
}) {
  const { ensureCsrfToken } = await import('./pageAuth')
  await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/user/identify', {
    method: 'POST',
    body: JSON.stringify({
      type: data.type,
      idCert: data.idCert,
      idId: data.idId || '',
    }),
  })
  if (res.code) throw new Error(res.msg || '提交失败')
  return res.msg || '已提交审核'
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

/** RhyPic：先取一次性票据，再直传图床。不再使用旧版 POST /upload。 */
export async function uploadFiles(apiKey: string, files: File[]): Promise<string[]> {
  if (!files.length) return []
  const ticketRes = await request<Envelope<{ ticket?: string; uploadURL?: string }>>(
    withKey('/api/rhypic/upload-ticket', apiKey),
    { method: 'POST' },
  )
  const ticket = ticketRes.data?.ticket
  const uploadURL = ticketRes.data?.uploadURL
  if (ticketRes.code || !ticket || !uploadURL) {
    throw new Error(ticketRes.msg || '获取 RhyPic 上传票据失败')
  }
  const body = new FormData()
  files.forEach((f) => body.append('file', f, f.name))
  const res = await fetch(`${String(uploadURL).replace(/\/$/, '')}/api/v1/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ticket}` },
    body,
  })
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new Error(res.ok ? '图床响应无法解析' : `图床上传失败（HTTP ${res.status}）`)
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && 'msg' in json
        ? String((json as { msg?: unknown }).msg || '')
        : ''
    throw new Error(msg || `图床上传失败（HTTP ${res.status}）`)
  }
  const envelope = json as { code?: number; msg?: string }
  if (typeof envelope.code === 'number' && envelope.code !== 0) {
    throw new Error(envelope.msg || '图床上传失败')
  }
  const urls = extractUploadUrls(json)
  if (!urls.length) throw new Error('图床未返回文件地址')
  return urls
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
  if (kind === 'reply') {
    return unwrapArticles(`/api/articles/recent/reply?p=${page}&size=${size}`, apiKey)
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
  if (!query) return []
  try {
    // Rhythm 现网参数名为 key（非 q/keyword）；空结果也是合法响应，勿回退 mock。
    const res = await request<Envelope<{ articles?: ArticleSummary[]; key?: string; total?: number }>>(
      withKey(`/api/search?key=${encodeURIComponent(query)}&p=${page}&size=${size}`, apiKey),
    )
    if (res.code === 0 && res.data) {
      return Array.isArray(res.data.articles) ? res.data.articles : []
    }
    if (res.code === -1) throw new Error(res.msg || '搜索请求过于频繁，请稍后再试')
  } catch (e) {
    if (e instanceof Error && (e.message.includes('频繁') || e.message.includes('搜索'))) throw e
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
  articleDraftRewardContent?: string
  articleDraftRewardPoint?: number
  articleDraftAnonymous?: boolean
  articleDraftCommentable?: boolean
  articleDraftNotifyFollowers?: boolean
  articleDraftShowInList?: number
  articleDraftStatement?: number
  articleDraftColumnId?: string
  articleDraftColumnTitle?: string
  articleDraftChapterNo?: string
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

export async function saveArticleDraft(apiKey: string, payload: ArticlePayload & { articleDraftId?: string }) {
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
  let transient = false
  try {
    const res = await request<Envelope<{
      article?: ArticleDetail
      pagination?: ArticleDetail['pagination']
      longArticleColumnView?: LongArticleColumnView
    }>>(withKey(`/api/article/${id}?p=${page}`, apiKey))
    if (res.code === 0 && res.data?.article) {
      const { article, pagination, longArticleColumnView } = res.data
      return { ...article, pagination: { ...pagination, paginationCurrentPageNum: page }, longArticleColumnView }
    }
  } catch (e) {
    /* 匿名详情未开放时为 401/403；网络错误或 5xx 属于临时故障 */
    transient = !(e instanceof ApiError) || e.status >= 500
  }
  const local = mockArticle(id)
  if (local) return local
  throw new Error(transient ? '网络异常，帖子加载失败' : '帖子不存在或需要登录')
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

export async function postBreezemoon(apiKey: string, content: string) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/breezemoon', {
    method: 'POST',
    headers: { csrfToken },
    // Page session cookie carries auth; apiKey kept as fallback for some Rhythm builds.
    body: JSON.stringify({ apiKey, breezemoonContent: content }),
  })
  if (res.code) throw new Error(res.msg || '发布失败')
}

export async function removeBreezemoon(apiKey: string, id: string) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>(`/breezemoon/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { csrfToken },
  })
  if (res.code) throw new Error(res.msg || '删除失败')
}

type TopRankPayload = RankUser[] | { users?: RankUser[]; list?: RankUser[] }

/** 现网 /api/top/* 返回 `data.list`；兼容数组与 `data.users`。 */
function rankUsersOf(data: TopRankPayload | undefined): RankUser[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.list)) return data.list
  if (data && Array.isArray(data.users)) return data.users
  return []
}

export async function fetchCheckinRank(apiKey?: string | null): Promise<RankUser[]> {
  try {
    const res = await request<Envelope<TopRankPayload>>(withKey('/api/top/checkin?p=1', apiKey))
    const list = rankUsersOf(res.data)
    if (list.length) return list
  } catch {
    /* anonymous top not ready */
  }
  return mockCheckin()
}

export async function fetchOnlineRank(apiKey?: string | null): Promise<RankUser[]> {
  try {
    const res = await request<Envelope<TopRankPayload>>(withKey('/api/top/online?p=1', apiKey))
    const list = rankUsersOf(res.data)
    if (list.length) return list
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
    if (res.data && Array.isArray(res.data.data) && res.data.data.length) {
      return {
        totalAmount: Number(res.data.totalData?.totalAmount || 0),
        donateMakeDays: Number(res.data.totalData?.donateMakeDays || 0),
        data: res.data.data,
      }
    }
  } catch {
    /* fallback mock */
  }
  return {
    totalAmount: 18888,
    donateMakeDays: 3777,
    data: [
      {
        total: 2333,
        totalCount: 16,
        profile: { userName: 'Vanessa', userNickname: 'Vanessa', userNo: 2, userAppRole: 1, userIntro: '开源与社区建设者' },
      },
      {
        total: 1888,
        totalCount: 12,
        profile: { userName: 'D', userNickname: 'D', userNo: 1, userAppRole: 0, userIntro: '摸鱼派发起人' },
      },
      {
        total: 1280,
        totalCount: 9,
        profile: { userName: 'csfwff', userNickname: 'csfwff', userNo: 168, userAppRole: 0, userIntro: '全栈摸鱼老哥' },
      },
      {
        total: 999,
        totalCount: 6,
        profile: { userName: 'Yui', userNickname: 'Yui', userNo: 66, userAppRole: 1, userIntro: '机器人维护者' },
      },
      {
        total: 666,
        totalCount: 4,
        profile: { userName: 'adventext', userNickname: 'adventext', userNo: 888, userAppRole: 0, userIntro: '摸鱼常驻大佬' },
      },
    ],
  }
}

export async function fetchPerfectRank(apiKey?: string | null): Promise<CountRankEntry[]> {
  try {
    const res = await request<Envelope<CountRankEntry[] | { data?: CountRankEntry[] }>>(
      withKey('/api/top/perfect?p=1', apiKey),
    )
    if (Array.isArray(res.data) && res.data.length) return res.data
    if (res.data && 'data' in res.data && Array.isArray(res.data.data) && res.data.data.length) return res.data.data
  } catch {
    /* fallback */
  }
  return [
    { count: 48, profile: { userName: 'D', userNickname: 'D', userNo: 1, userAppRole: 0, userIntro: '摸鱼派发起人' } },
    { count: 32, profile: { userName: 'Vanessa', userNickname: 'Vanessa', userNo: 2, userAppRole: 1, userIntro: '开源与社区建设者' } },
    { count: 26, profile: { userName: 'csfwff', userNickname: 'csfwff', userNo: 168, userAppRole: 0, userIntro: '高质量文章作者' } },
    { count: 18, profile: { userName: 'Yui', userNickname: 'Yui', userNo: 66, userAppRole: 1, userIntro: '技术干货分享' } },
  ]
}

export async function fetchInviteRank(apiKey?: string | null): Promise<CountRankEntry[]> {
  try {
    const res = await request<Envelope<CountRankEntry[] | { data?: CountRankEntry[] }>>(
      withKey('/api/top/invite?p=1', apiKey),
    )
    if (Array.isArray(res.data) && res.data.length) return res.data
    if (res.data && 'data' in res.data && Array.isArray(res.data.data) && res.data.data.length) return res.data.data
  } catch {
    /* fallback */
  }
  return [
    { count: 120, c: 120, profile: { userName: 'csfwff', userNickname: 'csfwff', userNo: 168, userAppRole: 0, userIntro: '邀请了 120 位小伙伴' } },
    { count: 96, c: 96, profile: { userName: 'Yui', userNickname: 'Yui', userNo: 66, userAppRole: 1, userIntro: '邀请了 96 位小伙伴' } },
    { count: 64, c: 64, profile: { userName: 'Vanessa', userNickname: 'Vanessa', userNo: 2, userAppRole: 1, userIntro: '社区引路人' } },
  ]
}

export async function fetchGameRank(game: string, apiKey?: string | null): Promise<GameRankEntry[]> {
  try {
    const res = await request<Envelope<GameRankEntry[] | { data?: GameRankEntry[] }>>(
      withKey(`/api/top/${encodeURIComponent(game)}?p=1`, apiKey),
    )
    if (Array.isArray(res.data) && res.data.length) return res.data
    if (res.data && 'data' in res.data && Array.isArray(res.data.data) && res.data.data.length) return res.data.data
  } catch {
    /* fallback */
  }
  return [
    { userName: 'csfwff', userNickname: 'csfwff', score: 9999, rank: 1, userIntro: '无敌大玩家' },
    { userName: 'Yui', userNickname: 'Yui', score: 8888, rank: 2, userIntro: '修仙榜霸' },
    { userName: 'Vanessa', userNickname: 'Vanessa', score: 7777, rank: 3, userIntro: '摸鱼高手' },
  ]
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

/** 0 帖子 / 1 机要 / 2 同城广播 / 5 问答 / 6 长文章 */
export interface ArticlePayload {
  articleTitle: string
  articleContent: string
  articleTags: string
  articleType: number
  articleQnAOfferPoint?: number
  articleRewardContent?: string
  articleRewardPoint?: number
  articleAnonymous?: boolean
  articleCommentable?: boolean
  articleNotifyFollowers?: boolean
  articleShowInList?: boolean
  /** 0 无 / 1 AI 辅助 / 2 剧透 / 3 虚构 */
  articleStatement?: number
  /** 长文章专栏：'' 独立长文，'__NEW__' 新建（需 columnTitle），否则为已有专栏 ID */
  columnId?: string
  columnTitle?: string
  /** 留空则排到专栏末尾 */
  chapterNo?: string
  columnCoverURL?: string
}

/** 字段取舍对齐现网 add-article.js：问答只带悬赏，其他类型带打赏与匿名。 */
function articleBody(apiKey: string, p: ArticlePayload) {
  const body: Record<string, unknown> = {
    apiKey,
    articleTitle: p.articleTitle,
    articleContent: p.articleContent,
    articleTags: p.articleTags,
    articleType: p.articleType,
    articleCommentable: p.articleCommentable ?? true,
    articleNotifyFollowers: p.articleNotifyFollowers ?? false,
    articleShowInList: p.articleShowInList === false ? 0 : 1,
    articleStatement: p.articleStatement ?? 0,
  }
  if (p.articleType === 5) {
    body.articleQnAOfferPoint = p.articleQnAOfferPoint || 0
  } else {
    body.articleRewardContent = p.articleRewardContent || ''
    body.articleRewardPoint = p.articleRewardContent?.trim() ? p.articleRewardPoint || 0 : 0
    body.articleAnonymous = p.articleAnonymous ?? false
  }
  if (p.articleType === 6) {
    body.columnId = p.columnId || ''
    body.columnTitle = p.columnId === '__NEW__' ? p.columnTitle || '' : ''
    body.chapterNo = p.columnId ? p.chapterNo || '' : ''
    body.columnCoverURL = p.columnCoverURL || ''
  }
  return body
}

export async function postArticle(apiKey: string, payload: ArticlePayload) {
  const res = await request<Envelope<unknown> & { articleId?: string }>('/article', {
    method: 'POST',
    body: JSON.stringify(articleBody(apiKey, payload)),
  })
  if (res.code) throw new Error(res.msg || '发帖失败')
  return String(res.articleId || (res.data as { oId?: string } | undefined)?.oId || '')
}

/** 编辑用：`/api/article/md/{id}` 现网返回 Markdown 纯文本，元数据取自帖子详情。 */
export async function fetchArticleMd(apiKey: string, id: string): Promise<ArticlePayload> {
  const [md, detail] = await Promise.all([
    requestText(withKey(`/api/article/md/${encodeURIComponent(id)}`, apiKey)),
    fetchArticle(id, apiKey),
  ])
  return {
    articleTitle: String(detail.articleTitle || ''),
    articleContent: md || String(detail.articleOriginalContent || ''),
    articleTags: String(detail.articleTags || ''),
    articleType: Number(detail.articleType || 0),
    articleQnAOfferPoint: Number(detail.articleQnAOfferPoint || 0),
    articleRewardContent: String(detail.articleRewardContent || ''),
    articleRewardPoint: Number(detail.articleRewardPoint || 0),
    articleAnonymous: Number(detail.articleAnonymous || 0) === 1,
    articleCommentable: detail.articleCommentable !== false,
    articleShowInList: Number(detail.articleShowInList ?? 1) !== 0,
    articleStatement: Number(detail.articleStatement || 0),
    columnId: detail.longArticleColumnView?.column.oId || '',
    chapterNo: detail.longArticleColumnView?.chapterNo ? String(detail.longArticleColumnView.chapterNo) : '',
    columnCoverURL: detail.longArticleColumnView?.column.columnCoverURL || '',
  }
}

export async function updateArticle(apiKey: string, id: string, payload: ArticlePayload) {
  const res = await request<Envelope<unknown> & { articleId?: string }>(`/article/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(articleBody(apiKey, payload)),
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

/** Vditor `hint.emoji` 格式：`{ name: unicode 或图片 URL }`，即用户在设置里配置的常用表情。 */
export async function fetchVditorEmoji(apiKey: string): Promise<Record<string, string>> {
  const res = await request<Envelope<unknown>>(withKey('/users/emotions', apiKey))
  if (res.code || !Array.isArray(res.data)) return {}
  const out: Record<string, string> = {}
  for (const item of res.data) {
    if (item && typeof item === 'object') {
      for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
        if (typeof v === 'string') out[k] = v
      }
    }
  }
  return out
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

/** 成功后返回渲染好的打赏区 HTML */
export async function rewardArticle(apiKey: string, oId: string): Promise<string> {
  const res = await request<Envelope<unknown> & { articleRewardContent?: string }>(
    `/article/reward?articleId=${encodeURIComponent(oId)}`,
    {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    },
  )
  if (res.code) throw new Error(res.msg || '打赏失败')
  return String(res.articleRewardContent || '')
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
      const res = await request<UserProfile & Envelope<UserProfile> & { sysMetal?: unknown }>(withKey(path, apiKey))
      const profile = res.userName ? res : res.code === 0 && res.data?.userName ? res.data : null
      if (!profile) continue
      profile.sysMetal = normalizeMetals((profile as { sysMetal?: unknown }).sysMetal)
      return profile
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

function parsePointNotice(description: string): { sum?: number; operation?: '+' | '-' } {
  const text = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const m = text.match(/(-?\d+)\s*积分/)
  if (!m) return {}
  const n = Number(m[1])
  if (!Number.isFinite(n)) return {}
  if (text.includes('扣除') || text.includes('支付') || text.includes('转出') || n < 0) {
    return { sum: Math.abs(n), operation: '-' }
  }
  return { sum: Math.abs(n), operation: '+' }
}

export async function fetchPointRecords(apiKey: string, page = 1): Promise<PointRecord[]> {
  // Rhythm 暂无 apiKey 版独立积分流水 JSON；OpenID `/openid/user/points` 需 OAuth。
  // apiKey 路径：积分通知列表（与现网客户端一致的可读流水来源）。
  const notices = await fetchNotifications(apiKey, 'point', page)
  return notices.map((n, i) => {
    const description = n.description || n.content || '积分变动'
    const parsed = parsePointNotice(description)
    return {
      oId: n.oId || `notice-${i}`,
      description,
      time: n.createTime,
      sum: parsed.sum,
      type: parsed.operation,
    }
  })
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

export async function markWhisperRead(apiKey: string, fromUser: string) {
  await request<Envelope<unknown>>(withKey(`/chat/mark-as-read?fromUser=${encodeURIComponent(fromUser)}`, apiKey))
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
export async function fetchChatAround(apiKey: string | null | undefined, oId: string, mode: 0 | 1 | 2 = 0, size = 16) {
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

export async function fetchMfaEnabled(apiKey: string): Promise<boolean> {
  const { ensureCsrfToken } = await import('./pageAuth')
  await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/mfa/enabled')
  return res.code === 0
}

export async function fetchMfaSetup(apiKey: string): Promise<{ qrCodeLink: string; secret: string }> {
  const { ensureCsrfToken } = await import('./pageAuth')
  await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown> & { qrCodeLink?: string; secret?: string }>('/mfa')
  if (res.code || !res.qrCodeLink) throw new Error(res.msg || '获取两步验证信息失败')
  return { qrCodeLink: res.qrCodeLink, secret: res.secret || '' }
}

export async function verifyMfa(apiKey: string, code: string) {
  const { ensureCsrfToken } = await import('./pageAuth')
  await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>(`/mfa/verify?code=${encodeURIComponent(code)}`)
  if (res.code) throw new Error(res.msg || '验证失败')
  return res.msg || '绑定成功'
}

export async function removeMfa(apiKey: string) {
  const { ensureCsrfToken } = await import('./pageAuth')
  await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/mfa/remove')
  if (res.code) throw new Error(res.msg || '解绑失败')
  return res.msg || '已解绑'
}

/** 官方 APP 扫码登录：页面会话下 GET /getApiKeyInWeb → QR data `login:{apiKey}` */
export async function fetchAppLoginQr(apiKey: string): Promise<string> {
  const { ensureCsrfToken } = await import('./pageAuth')
  await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown> & { apiKey?: string }>('/getApiKeyInWeb')
  if (res.code || !res.apiKey) throw new Error(res.msg || '获取 APP 登录码失败')
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`login:${res.apiKey}`)}`
}

export interface UserBag {
  checkin1day?: number
  checkin2days?: number
  nameCard?: number
  metalTicket?: number
  patchCheckinCard?: number
  patchStart?: string
  sysCheckinRemain?: number
  [key: string]: unknown
}

/**
 * 用户背包。现网无读 JSON（见 docs/MISSING_APIS.md），使用假数据。
 * 建议后端：GET /api/user/bag?apiKey=
 */
export async function fetchUserBag(apiKey: string): Promise<UserBag> {
  if (!apiKey) return {}
  try {
    const res = await request<Envelope<UserBag>>(withKey('/api/user/bag', apiKey))
    if (!res.code && res.data && typeof res.data === 'object') return res.data
  } catch {
    /* 接口未开放 */
  }
  const { mockUserBag } = await import('./gaps.mock')
  return { ...mockUserBag }
}

async function bagGet(apiKey: string, path: string) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>(path, {
    method: 'GET',
    headers: { csrfToken },
  })
  if (res.code) throw new Error(res.msg || '使用失败')
  return res.msg || '已使用'
}

export async function useBag1dayCheckin(apiKey: string) {
  return bagGet(apiKey, '/bag/1dayCheckin')
}

export async function useBag2dayCheckin(apiKey: string) {
  return bagGet(apiKey, '/bag/2dayCheckin')
}

export async function useBagPatchCheckin(apiKey: string) {
  return bagGet(apiKey, '/bag/patchCheckin')
}

export async function useBagNameCard(apiKey: string, userName: string) {
  const { ensureCsrfToken } = await import('./pageAuth')
  const csrfToken = await ensureCsrfToken(apiKey)
  const res = await request<Envelope<unknown>>('/bag/nameCard', {
    method: 'POST',
    headers: { csrfToken },
    body: JSON.stringify({ userName }),
  })
  if (res.code) throw new Error(res.msg || '改名失败')
  return res.msg || '改名成功'
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
}

export interface HomeColumnCard {
  columnId: string
  columnTitle: string
  columnArticleCount: number
  chapters: HomeColumnChapter[]
  latestChapter?: HomeColumnChapter | null
}

/**
 * 首页专栏货架。现网无 JSON（见 docs/MISSING_APIS.md），使用假数据。
 * 建议后端：GET /api/columns/latest|hot?size=
 */
interface RawColumnChapter {
  articleId?: string
  chapterNo?: number | string
  articleTitle?: string
  title?: string
  articlePermalink?: string
  permalink?: string
}

interface RawColumnCard {
  columnId?: string
  oId?: string
  columnTitle?: string
  columnArticleCount?: number
  chapters?: RawColumnChapter[]
  latestChapter?: RawColumnChapter | null
  secondLatestChapter?: RawColumnChapter | null
}

function normalizeChapter(ch: RawColumnChapter): HomeColumnChapter {
  const no = ch.chapterNo
  return {
    articleId: String(ch.articleId || ''),
    permalink: ch.articlePermalink || ch.permalink || (ch.articleId ? `/article/${ch.articleId}` : ''),
    chapterNo: typeof no === 'number' ? `第 ${no} 章` : String(no ?? ''),
    title: ch.articleTitle || ch.title || '',
  }
}

/** 现网 /api/columns/* 只给 latestChapter / secondLatestChapter，没有 chapters 数组。 */
function normalizeColumnCard(c: RawColumnCard): HomeColumnCard {
  const raw = c.chapters?.length ? c.chapters : [c.latestChapter, c.secondLatestChapter]
  const chapters = raw.filter((ch): ch is RawColumnChapter => Boolean(ch)).map(normalizeChapter)
  return {
    columnId: String(c.columnId || c.oId || ''),
    columnTitle: c.columnTitle || '',
    columnArticleCount: Number(c.columnArticleCount || 0),
    chapters,
    latestChapter: chapters[0] || null,
  }
}

export async function fetchHomeColumns(): Promise<{ recent: HomeColumnCard[]; hot: HomeColumnCard[] }> {
  try {
    const [latest, hot] = await Promise.all([
      request<Envelope<RawColumnCard[]>>('/api/columns/latest?size=12'),
      request<Envelope<RawColumnCard[]>>('/api/columns/hot?size=12'),
    ])
    if (!latest.code && !hot.code && Array.isArray(latest.data) && Array.isArray(hot.data)) {
      return { recent: latest.data.map(normalizeColumnCard), hot: hot.data.map(normalizeColumnCard) }
    }
  } catch {
    /* 接口未开放 */
  }
  const { mockHomeColumns } = await import('./gaps.mock')
  return {
    recent: mockHomeColumns.recent.map((c) => ({ ...c, chapters: [...c.chapters] })),
    hot: mockHomeColumns.hot.map((c) => ({ ...c, chapters: [...c.chapters] })),
  }
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
