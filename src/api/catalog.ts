import type {
  ArticleDetail,
  ArticleSummary,
  NoticeItem,
  NoticeType,
  RankUser,
  UserProfile,
  WhisperMsg,
} from '@/api/fishpi'
import catalog from './catalog.mock.json' with { type: 'json' }

export interface DomainItem {
  uri: string
  domainTitle: string
  domainDescription?: string
  domainArticleCount?: number
  domainTags?: string
}

interface CatalogFile {
  articles: (ArticleSummary & { domainUri?: string })[]
  details: Record<string, Partial<ArticleDetail>>
  checkin: RankUser[]
  online: RankUser[]
  domains: DomainItem[]
  profiles?: Record<string, Partial<UserProfile> & { userName: string }>
  notifications?: Record<string, NoticeItem[]>
  whispers?: { list: WhisperMsg[]; messages: Record<string, WhisperMsg[]> }
}

const data = catalog as CatalogFile

export function mockPage<T>(list: T[], page = 1, size = 40) {
  const p = Math.max(1, page)
  const s = Math.max(1, size)
  return list.slice((p - 1) * s, p * s)
}

export function mockArticles() {
  return data.articles
}

export function mockFeed(
  kind: 'recent' | 'hot' | 'long' | 'good' | 'qna' | 'perfect' | 'search' | 'domain',
  page = 1,
  size = 40,
  extra = '',
) {
  let list = [...data.articles]
  if (kind === 'long') list = list.filter((a) => a.articleType === 6)
  else if (kind === 'qna') list = list.filter((a) => a.articleType === 5)
  else if (kind === 'perfect') list = list.filter((a) => Number(a.articlePerfect) === 1)
  else if (kind === 'hot' || kind === 'good') {
    list = [...list].sort((a, b) => (b.articleViewCount || 0) - (a.articleViewCount || 0))
  } else if (kind === 'search') {
    const q = extra.trim().toLowerCase()
    if (q) {
      list = list.filter((a) =>
        `${a.articleTitle} ${a.articleTags || ''} ${a.articleAuthorName || ''}`.toLowerCase().includes(q),
      )
    }
  } else if (kind === 'domain') {
    list = list.filter((a) => a.domainUri === extra)
  }
  return mockPage(list, page, size)
}

export function mockArticle(id: string): ArticleDetail | null {
  const summary = data.articles.find((a) => a.oId === id)
  if (!summary) return null
  const extra = data.details[id] || {
    articleContent: `<p>${summary.articleTitle}</p><p>Rhythm 尚未提供匿名帖子详情，这条是与 <code>GET /api/article/{id}</code> 对齐的 mock 正文。</p>`,
    articleComments: [],
  }
  return {
    ...summary,
    articleCommentable: true,
    ...extra,
  }
}

export function mockCheckin() {
  return data.checkin
}

export function mockOnline() {
  return data.online
}

export function mockDomains() {
  return data.domains
}

export function mockProfile(userName: string): UserProfile {
  const extra = data.profiles?.[userName]
  const articles = data.articles.filter((a) => a.articleAuthorName === userName)
  return {
    oId: extra?.oId || `mock-u-${userName}`,
    userName,
    userNickname: extra?.userNickname || userName,
    userIntro: extra?.userIntro || `${userName} 的 mock 主页，字段对齐 GET /user/{userName}。`,
    userPoint: extra?.userPoint ?? 1000,
    userArticleCount: extra?.userArticleCount ?? articles.length,
    userCommentCount: extra?.userCommentCount ?? 0,
    followingUserCount: extra?.followingUserCount ?? 0,
    onlineMinute: extra?.onlineMinute ?? 0,
    userAppRole: extra?.userAppRole ?? 0,
    canFollow: extra?.canFollow || 'yes',
    userAvatarURL: extra?.userAvatarURL,
  }
}

export function mockUserArticles(userName: string, page = 1, size = 40) {
  return mockPage(
    data.articles.filter((a) => a.articleAuthorName === userName),
    page,
    size,
  )
}

export function mockNotifications(type: NoticeType): NoticeItem[] {
  return data.notifications?.[type] || []
}

export function mockUnreadCount() {
  const n = data.notifications || {}
  const cnt = (t: string) => (n[t] || []).filter((x) => x.hasRead === false).length
  return {
    unreadCommentedNotificationCnt: cnt('commented'),
    unreadReplyNotificationCnt: cnt('reply'),
    unreadAtNotificationCnt: cnt('at'),
    unreadFollowingNotificationCnt: cnt('following'),
    unreadPointNotificationCnt: cnt('point'),
    unreadBroadcastNotificationCnt: cnt('broadcast'),
    unreadSysAnnounceNotificationCnt: cnt('sys-announce'),
    unreadNotificationCnt:
      cnt('commented') +
      cnt('reply') +
      cnt('at') +
      cnt('following') +
      cnt('point') +
      cnt('broadcast') +
      cnt('sys-announce'),
  }
}

export function mockWhisperList() {
  return data.whispers?.list || []
}

export function mockWhisperMessages(userName: string) {
  return data.whispers?.messages[userName] || data.whispers?.list.filter((m) =>
    [m.senderUserName, m.receiverUserName].includes(userName),
  ) || []
}
