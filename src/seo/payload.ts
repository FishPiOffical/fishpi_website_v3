import type {
  ArticleDetail,
  ArticleSummary,
  Breezemoon,
  DomainItem,
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
  domains?: DomainItem[]
  tags?: TagItem[]
  tagsTotal?: number
  breezemoons?: Breezemoon[]
  checkinRank?: RankUser[]
  onlineRank?: RankUser[]
  repeater?: RepeaterItem[]
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
