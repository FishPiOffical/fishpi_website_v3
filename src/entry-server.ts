import { fetchDirectoryPage } from './api/v3-directory'
import { fetchHomeBootstrap } from './api/v3-home-reads'
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

async function prefetch(url: string): Promise<SsrPayload> {
  const path = url.split('?')[0] || '/'
  if (!shouldPrefetchSsr(path)) return {}

  try {
    if (path === '/statistic') return { statistics: await fetchStatistics() }
    if (path === '/milestones') return { milestonePage: await listMilestones() }
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

    if (path === '/') {
      const settled = await Promise.allSettled([
        fetchHomeBootstrap(),
        fetchRanking('checkin', 1, undefined, 8),
        fetchRanking('online', 1, undefined, 8),
        fetchRecentMembers(),
        fetchV3Breezemoons(1, 8),
        fetchRepeaterItems(null, 'joke'),
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

    if (path === '/domains') {
      return { directoryPage: await fetchDirectoryPage('domains') }
    }

    if (path === '/tags') {
      return { directoryPage: await fetchDirectoryPage('tags') }
    }

    if (path === '/breezemoons') {
      return { breezemoonPage: await fetchV3Breezemoons(1, 20) }
    }

    const ranking = path.match(/^\/top\/([^/]+)$/)?.[1]
    if (ranking && Object.hasOwn(rankingTitles, ranking)) return { rankingPage: await fetchRanking(ranking as RankingType) }

    if (path === '/repeater') {
      return { repeater: await fetchRepeaterItems(null) }
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
      return { articleListing: await fetchArticleListing(kind) }
    }

    const domainMatch = path.match(/^\/domain\/([^/]+)$/)
    if (domainMatch) {
      return {
        articleListing: await fetchArticleListing('domain', decodeURIComponent(domainMatch[1])),
      }
    }

    const tagMatch = path.match(/^\/tag\/([^/]+)$/)
    if (tagMatch) {
      return {
        articleListing: await fetchArticleListing('tag', decodeURIComponent(tagMatch[1])),
      }
    }
  } catch {
    /* render shell even if prefetch fails */
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
