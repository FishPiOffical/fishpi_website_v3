import { decodeHomeBootstrap } from '@/api/v3-home-reads'
import { decodeArticleListing, type ColumnOrder } from '@/api/v3-article-list'
import type { ArticleFeedKind } from '@/api/fishpi'
import { decodeRecentMembers } from '@/api/v3-discovery-extras'
import type { RelationUser } from '@/api/v3-user-relations'
import { decodePublicUser, type PublicUser } from '@/api/v3-public-user'
import type { RankingPage } from '@/api/v3-rankings'
import type { CommunityStatistics } from '@/api/v3-statistics'
import { getCurrentInstance, inject, type InjectionKey } from 'vue'
import type { MilestonePage } from '@/api/v3-milestones'
import type { BreezemoonPage } from '@/api/v3-breezemoons'
import type {
  ArticleDetail,
  ArticleSummary,
  ChatHistoryItem,
  DomainItem,
  RepeaterItem,
  TagItem,
} from '@/api/fishpi'

export interface SsrPayload {
  homeReads?: unknown
  articleListing?: unknown
  recentMembers?: RelationUser[] | null
  statistics?: CommunityStatistics | null
  milestonePage?: MilestonePage | null
  breezemoonPage?: BreezemoonPage | null
  homeBreezemoonPage?: BreezemoonPage | null
  article?: ArticleDetail | null
  member?: PublicUser | null
  feed?: ArticleSummary[]
  feedKind?: string
  hotFeed?: ArticleSummary[]
  longFeed?: ArticleSummary[]
  domains?: DomainItem[]
  tags?: TagItem[]
  tagsTotal?: number
  rankingPage?: RankingPage | null
  homeCheckinRanking?: RankingPage | null
  homeOnlineRanking?: RankingPage | null
  repeater?: RepeaterItem[]
  chatFeed?: ChatHistoryItem[]
}

export const SSR_PAYLOAD_KEY: InjectionKey<SsrPayload> = Symbol('public-ssr-payload')

const g = globalThis as typeof globalThis & { __FP_SSR_PAYLOAD__?: SsrPayload }

export function setSsrPayload(payload: SsrPayload) {
  if (!import.meta.env.SSR) g.__FP_SSR_PAYLOAD__ = payload
}

export function getSsrPayload(): SsrPayload {
  if (import.meta.env.SSR) return getCurrentInstance() ? inject(SSR_PAYLOAD_KEY, {}) : {}
  return g.__FP_SSR_PAYLOAD__ || {}
}

export function clearSsrPayload() {
  if (!import.meta.env.SSR) delete g.__FP_SSR_PAYLOAD__
}

export function takeClientPayload(): SsrPayload {
  if (typeof document === 'undefined') return {}
  const el = document.getElementById('__INITIAL_STATE__')
  if (!el?.textContent) return {}
  try {
    const payload = JSON.parse(el.textContent) as SsrPayload
    el.remove()
    setSsrPayload(payload)
    return payload
  } catch {
    return {}
  }
}

function takeField<K extends keyof SsrPayload>(key: K): SsrPayload[K] | undefined {
  const payload = getSsrPayload()
  const value = payload[key]
  if (value === undefined) return undefined
  delete payload[key]
  return value
}

export function consumeArticlePayload(id: string): ArticleDetail | null {
  const payload = getSsrPayload()
  if (payload.article && payload.article.oId === id) {
    const article = payload.article
    payload.article = undefined
    return article
  }
  return null
}

export function consumeMemberPayload(userName: string): PublicUser | null {
  const payload = getSsrPayload()
  if (payload.member && payload.member.userName === userName) {
    const member = payload.member
    payload.member = undefined
    try { return decodePublicUser(member, userName) } catch { return null }
  }
  return null
}

export function consumeFeedPayload(kind: string): ArticleSummary[] | null {
  const payload = getSsrPayload()
  if (payload.feed && payload.feedKind === kind) {
    const feed = payload.feed
    payload.feed = undefined
    payload.feedKind = undefined
    return feed
  }
  return null
}

export function consumeDomainsPayload(): DomainItem[] | null {
  const v = takeField('domains')
  return Array.isArray(v) ? v : null
}

export function consumeTagsPayload(): { tags: TagItem[]; total: number } | null {
  const tags = takeField('tags')
  if (!Array.isArray(tags)) return null
  const total = takeField('tagsTotal')
  return { tags, total: typeof total === 'number' ? total : tags.length }
}

export function consumeBreezemoonPagePayload(scope: 'global' | 'home'): BreezemoonPage | null {
  return takeField(scope === 'global' ? 'breezemoonPage' : 'homeBreezemoonPage') || null
}

export function consumeRepeaterPayload(): RepeaterItem[] | null {
  const v = takeField('repeater')
  return Array.isArray(v) ? v : null
}

export function consumeHomeExtrasPayload(): {
  hot?: ArticleSummary[]
  long?: ArticleSummary[]
  tags?: TagItem[]
  chatFeed?: ChatHistoryItem[]
  repeater?: RepeaterItem[]
} | null {
  const hot = takeField('hotFeed')
  const long = takeField('longFeed')
  const tags = takeField('tags')
  const chatFeed = takeField('chatFeed')
  const repeater = takeField('repeater')
  if (
    !Array.isArray(hot) &&
    !Array.isArray(long) &&
    !Array.isArray(tags) &&
    !Array.isArray(chatFeed) &&
    !Array.isArray(repeater)
  ) {
    return null
  }
  return {
    hot: Array.isArray(hot) ? hot : undefined,
    long: Array.isArray(long) ? long : undefined,
    tags: Array.isArray(tags) ? tags : undefined,
    chatFeed: Array.isArray(chatFeed) ? chatFeed : undefined,
    repeater: Array.isArray(repeater) ? repeater : undefined,
  }
}

export function consumeMilestonePayload(): MilestonePage | null { return takeField('milestonePage') || null }

export function consumeStatisticsPayload(): CommunityStatistics | null { return takeField('statistics') || null }

export function consumeRankingPayload(): RankingPage | null { return takeField('rankingPage') || null }
export function consumeHomeRankingPayload() { return { checkin: takeField('homeCheckinRanking') || null, online: takeField('homeOnlineRanking') || null } }

export function consumeRecentMembersPayload(): RelationUser[] | null { const value = takeField('recentMembers'); if (value == null) return null; try { return decodeRecentMembers(value) } catch { return null } }

export function consumeArticleListingPayload(kind: ArticleFeedKind, extra: string, order: ColumnOrder) {
  const value = takeField('articleListing')
  try { return decodeArticleListing(value, kind, extra, order) } catch { return null }
}

export function consumeHomeReadsPayload() { return decodeHomeBootstrap(takeField('homeReads')) }
