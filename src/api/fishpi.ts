import {repeaterList,type RepeaterEntry} from './v3-repeater'
import { md5 } from 'js-md5'
import type { DomainItem } from './content-types'
import { ApiError, request } from './http'
import { v3Article } from './v3-content'

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
  /** v3本人账号提供的引导状态；不从旧完整用户对象补值。 */
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
  /** 勋章定义 ID；v3图片仅在明确的本人或公开展示上下文中读取 */
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
  /** Legacy summaries may omit anonymity metadata; do not infer identity from nested aliases. */
  articleIdentityUnavailable?: boolean
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
  articleAuthorNickname?: string
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
  commentAuthorNickname?: string
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
  articleCommentable?: boolean | null
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
  articleStatement?: number | null
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

export interface ProfileUpdate {
  userNickname?: string
  userURL?: string
  userIntro?: string
  userTag?: string
  mbti?: string
  userQQ?: string
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

export interface EmojiItem {
  /** Server-provided display glyph, independent from the canonical insertion alias. */
  label?: string
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

export interface TagItem {
  tagTitle: string
  tagURI: string
  tagIconPath?: string
  tagReferenceCount?: number
  tagDescription?: string
}




export type RepeaterItem = RepeaterEntry
export function fetchRepeaterItems(_apiKey?: string | null, type = '') { return repeaterList(type as import('./v3-repeater').RepeaterKind) }

export async function fetchArticle(id: string, _apiKey?: string | null, page = 1): Promise<ArticleDetail> {
  return v3Article(id, page)
}


export interface LiteUser {
  oId?: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  userAvatarURL48?: string
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

export interface ProfessionMe {
  primaryProfessionId?: string
  progress?: ProfessionProgress[]
  privacyPreset?: string
  availableProfessions?: ProfessionProgress[]
  onboardingState?: string
}

export interface UserNameHit {
  userName: string
  avatar?: string
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


export interface MyMedal {
  medalId: string
  name: string
  description: string
  type: string
  display: boolean
  displayOrder: number
  expireTime: number
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
