import { setSsrReadGate } from './api/http'
import { createSsrUpstreamGate } from './seo/ssrUpstreamGate'
import { fetchDirectoryPage } from './api/v3-directory'
import { fetchHomeBootstrap, fetchHomeRead } from './api/v3-home-reads'
import { createPublicHomeCache } from './seo/publicHomeCache'
import { fetchArticleListing } from './api/v3-article-list'
import { fetchRecentMembers } from './api/v3-discovery-extras'
import { fetchPublicUser } from './api/v3-public-user'
import { fetchRanking, rankingTitles, type RankingType } from './api/v3-rankings'
import { fetchStatistics } from './api/v3-statistics'
import { renderToString } from 'vue/server-renderer'
import { renderSSRHead } from '@unhead/vue/server'
import { createFishpiApp } from './app'
import {
  fetchArticle,
  fetchRepeaterItems,
  type ArticleFeedKind,
} from './api/fishpi'
import { SSR_PAYLOAD_KEY, type SsrPayload } from './seo/payload'
import { fetchV3Breezemoons } from './api/v3-breezemoons'
import { listMilestones } from './api/v3-milestones'
import { shouldPrefetchSsr } from './seo/ssrRoutes'

setSsrReadGate(createSsrUpstreamGate())
const readPublicHome = createPublicHomeCache()
const readPublicDirectory = createPublicHomeCache(1_800_000, 8)
const readPublicListing = createPublicHomeCache(300_000, 64)
const readPublicOverview = createPublicHomeCache(300_000, 24)
const homeStaleKeys = new Set(['recent', 'hot', 'columnsRecent', 'columnsHot', 'tags', 'ranking:checkin:8', 'ranking:online:8', 'recent-members'])
const upstreamOrigin = () => process.env.VITE_API_TARGET || process.env.API_TARGET || 'https://fishpi.cn'
function homeRead<T>(key: string, load: () => Promise<T>) {
  return readPublicHome(`${upstreamOrigin()}:${key}`, load, homeStaleKeys.has(key)).catch(error => {
    if (error?.code === 'ssr_deferred') throw error
    // Resource and status only: never log upstream bodies, credentials or request headers.
    console.warn('[SSR homepage] preload failed', key, typeof error?.status === 'number' ? error.status : 'network')
    throw error
  })
}

const SSR_PREFETCH_BUDGET_MS = 750
type WithinBudget = <T>(task: Promise<T>) => Promise<T>

async function prefetchHome(withinBudget: WithinBudget): Promise<SsrPayload> {
  const settled = await Promise.allSettled([
    fetchHomeBootstrap(key => withinBudget(homeRead(key, () => fetchHomeRead(key)))),
    withinBudget(homeRead('ranking:checkin:8', () => fetchRanking('checkin', 1, undefined, 8))),
    withinBudget(homeRead('ranking:online:8', () => fetchRanking('online', 1, undefined, 8))),
    withinBudget(homeRead('recent-members', () => fetchRecentMembers())),
    withinBudget(homeRead('breezemoons:8', () => fetchV3Breezemoons(1, 8))),
    withinBudget(homeRead('repeater:joke', () => fetchRepeaterItems('joke'))),
  ])
  const val = <T>(i: number, fallback: T): T =>
    settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<T>).value : fallback
  return {
    homeReads: val(0, null),
    homeCheckinRanking: val(1, null),
    homeOnlineRanking: val(2, null),
    recentMembers: val(3, null),
    homeBreezemoonPage: val(4, null),
    repeater: val(5, undefined),
  }
}

async function prefetch(url: string): Promise<SsrPayload> {
  const path = url.split('?')[0] || '/'
  if (!shouldPrefetchSsr(path)) return {}

  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('SSR prefetch deadline')), SSR_PREFETCH_BUDGET_MS)
  })
  const withinBudget: WithinBudget = task => Promise.race([task, deadline])
  try {
    // Each home resource shares the deadline but keeps its own successful result.
    if (path === '/') return await prefetchHome(withinBudget)
    return await withinBudget(prefetchPage(path))
  } catch {
    return {}
  } finally {
    clearTimeout(timer)
  }
}

function publicListing(kind: ArticleFeedKind, extra = '') {
  return readPublicListing(JSON.stringify([upstreamOrigin(), kind, extra]), () => fetchArticleListing(kind, extra), true)
}

async function prefetchPage(path: string): Promise<SsrPayload> {
  if (path === '/statistic') return { statistics: await fetchStatistics() }
  if (path === '/milestones') return { milestonePage: await readPublicOverview(`${upstreamOrigin()}:milestones`, () => listMilestones(), true) }
  const articleMatch = path.match(/^\/article\/([^/]+)$/)
  if (articleMatch) {
    const article = await fetchArticle(articleMatch[1])
    return { article }
  }

  const memberMatch = path.match(/^\/member\/([^/]+)$/)
  if (memberMatch) {
    const member = await fetchPublicUser(decodeURIComponent(memberMatch[1]))
    return { member }
  }

  if (path === '/domains' || path === '/tags') {
    const kind = path === '/domains' ? 'domains' : 'tags'
    return { directoryPage: await readPublicDirectory(`${upstreamOrigin()}:${kind}:1`, () => fetchDirectoryPage(kind), true) }
  }

  if (path === '/breezemoons') {
    return { breezemoonPage: await fetchV3Breezemoons(1, 20) }
  }

  const ranking = path.match(/^\/top\/([^/]+)$/)?.[1]
  if (ranking && Object.hasOwn(rankingTitles, ranking)) return { rankingPage: await readPublicOverview(`${upstreamOrigin()}:ranking:${ranking}`, () => fetchRanking(ranking as RankingType), true) }

  if (path === '/repeater') {
    return { repeater: await fetchRepeaterItems() }
  }

  const listMap: Record<string, ArticleFeedKind> = {
    '/hot': 'hot',
    '/recent': 'recent',
    '/recent/long': 'long',
    '/recent/hot': 'hot',
    '/recent/good': 'good',
    '/recent/reply': 'reply',
    '/column': 'long',
    '/qna': 'qna',
    '/perfect': 'perfect',
    '/good': 'good',
  }
  if (listMap[path]) {
    const kind = listMap[path]
    return { articleListing: await publicListing(kind) }
  }

  const domainMatch = path.match(/^\/domain\/([^/]+)$/)
  if (domainMatch) {
    return {
      articleListing: await publicListing('domain', decodeURIComponent(domainMatch[1])),
    }
  }

  const tagMatch = path.match(/^\/tag\/([^/]+)$/)
  if (tagMatch) {
    return {
      articleListing: await publicListing('tag', decodeURIComponent(tagMatch[1])),
    }
  }
  return {}
}

export async function render(url: string) {
  const payload = await prefetch(url)
  // Clone before render — views consume the live payload during SSR.
  const clientPayload = JSON.parse(JSON.stringify(payload)) as typeof payload

  const { app, router, head } = createFishpiApp()
  app.provide(SSR_PAYLOAD_KEY, payload)
  await router.push(url)
  await router.isReady()

  const ctx: { modules?: Set<string> } = {}
  const appHtml = await renderToString(app, ctx)
  const headPayload = await renderSSRHead(head)

  return {
    appHtml,
    headPayload,
    payload: clientPayload,
    modules: ctx.modules || new Set<string>(),
    status: Number(router.currentRoute.value.meta.errorCode) || 200,
  }
}
