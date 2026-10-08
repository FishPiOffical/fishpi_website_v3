import type {
  ArticleDetail,
  ArticleSummary,
  Breezemoon,
  ChatHistoryItem,
  DomainItem,
  LiteUser,
  RankUser,
  RepeaterItem,
  TagItem,
  UserProfile,
} from '@/api/fishpi'

export interface SsrPayload {
  article?: ArticleDetail | null
  member?: UserProfile | null
  feed?: ArticleSummary[]
  feedKind?: string
  hotFeed?: ArticleSummary[]
  longFeed?: ArticleSummary[]
  domains?: DomainItem[]
  tags?: TagItem[]
  tagsTotal?: number
  breezemoons?: Breezemoon[]
  checkinRank?: RankUser[]
  onlineRank?: RankUser[]
  recentUsers?: LiteUser[]
  repeater?: RepeaterItem[]
  chatFeed?: ChatHistoryItem[]
}

const g = globalThis as typeof globalThis & { __FP_SSR_PAYLOAD__?: SsrPayload }

export function setSsrPayload(payload: SsrPayload) {
  g.__FP_SSR_PAYLOAD__ = payload
}

export function getSsrPayload(): SsrPayload {
  return g.__FP_SSR_PAYLOAD__ || {}
}

export function clearSsrPayload() {
  delete g.__FP_SSR_PAYLOAD__
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

export function consumeMemberPayload(userName: string): UserProfile | null {
  const payload = getSsrPayload()
  if (payload.member && payload.member.userName === userName) {
    const member = payload.member
    payload.member = undefined
    return member
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

export function consumeBreezemoonsPayload(): Breezemoon[] | null {
  const v = takeField('breezemoons')
  return Array.isArray(v) ? v : null
}

export function consumeRanksPayload(): { checkin: RankUser[]; online: RankUser[] } | null {
  const checkin = takeField('checkinRank')
  const online = takeField('onlineRank')
  if (!Array.isArray(checkin) && !Array.isArray(online)) return null
  return { checkin: checkin || [], online: online || [] }
}

export function consumeRepeaterPayload(): RepeaterItem[] | null {
  const v = takeField('repeater')
  return Array.isArray(v) ? v : null
}

export function consumeHomeExtrasPayload(): {
  hot?: ArticleSummary[]
  long?: ArticleSummary[]
  checkin?: RankUser[]
  online?: RankUser[]
  recentUsers?: LiteUser[]
  tags?: TagItem[]
  breezemoons?: Breezemoon[]
  chatFeed?: ChatHistoryItem[]
  repeater?: RepeaterItem[]
} | null {
  const hot = takeField('hotFeed')
  const long = takeField('longFeed')
  const checkin = takeField('checkinRank')
  const online = takeField('onlineRank')
  const recentUsers = takeField('recentUsers')
  const tags = takeField('tags')
  const breezemoons = takeField('breezemoons')
  const chatFeed = takeField('chatFeed')
  const repeater = takeField('repeater')
  if (
    !Array.isArray(hot) &&
    !Array.isArray(long) &&
    !Array.isArray(checkin) &&
    !Array.isArray(online) &&
    !Array.isArray(recentUsers) &&
    !Array.isArray(tags) &&
    !Array.isArray(breezemoons) &&
    !Array.isArray(chatFeed) &&
    !Array.isArray(repeater)
  ) {
    return null
  }
  return {
    hot: Array.isArray(hot) ? hot : undefined,
    long: Array.isArray(long) ? long : undefined,
    checkin: Array.isArray(checkin) ? checkin : undefined,
    online: Array.isArray(online) ? online : undefined,
    recentUsers: Array.isArray(recentUsers) ? recentUsers : undefined,
    tags: Array.isArray(tags) ? tags : undefined,
    breezemoons: Array.isArray(breezemoons) ? breezemoons : undefined,
    chatFeed: Array.isArray(chatFeed) ? chatFeed : undefined,
    repeater: Array.isArray(repeater) ? repeater : undefined,
  }
}
