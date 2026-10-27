import { fetchRecentMembers } from './api/v3-discovery-extras'
import { fetchPublicUser } from './api/v3-public-user'
import { fetchRanking, rankingTitles, type RankingType } from './api/v3-rankings'
import { fetchStatistics } from './api/v3-statistics'
import { renderToString } from 'vue/server-renderer'
import { renderSSRHead } from '@unhead/vue/server'
import { createFishpiApp } from './app'
import {
  fetchArticle,
  fetchArticleFeed,
  fetchDomains,
  fetchRecentArticles,
  fetchRepeaterItems,
  fetchTags,
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
        fetchRecentArticles(null, 1, 40),
        fetchArticleFeed('hot', null, 1, 12),
        fetchArticleFeed('long', null, 1, 12),
        fetchRanking('checkin', 1, undefined, 8),
        fetchRanking('online', 1, undefined, 8),
        fetchRecentMembers(),
        fetchTags(null, 1, 24),
        fetchV3Breezemoons(1, 8),
        fetchRepeaterItems(null, 'joke'),
      ])
      const val = <T>(i: number, fallback: T): T =>
        settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<T>).value : fallback
      const tagData = val(6, { tags: [], total: 0 })

      return {
        feed: val(0, []),
        feedKind: 'recent',
        hotFeed: val(1, []),
        longFeed: val(2, []),
        homeCheckinRanking: val(3, null),
        homeOnlineRanking: val(4, null),
        recentMembers: val(5, null),
        tags: tagData.tags,
        tagsTotal: tagData.total,
        homeBreezemoonPage: val(7, null),
        repeater: val(8, []),
      }
    }

    if (path === '/domains') {
      return { domains: await fetchDomains(null) }
    }

    if (path === '/tags') {
      const data = await fetchTags(null, 1, 50)
      return { tags: data.tags, tagsTotal: data.total }
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
      return { feed: await fetchArticleFeed(kind, null, 1, 40), feedKind: kind }
    }

    const domainMatch = path.match(/^\/domain\/([^/]+)$/)
    if (domainMatch) {
      return {
        feed: await fetchArticleFeed('domain', null, 1, 40, decodeURIComponent(domainMatch[1])),
        feedKind: 'domain',
      }
    }

    const tagMatch = path.match(/^\/tag\/([^/]+)$/)
    if (tagMatch) {
      return {
        feed: await fetchArticleFeed('tag', null, 1, 40, decodeURIComponent(tagMatch[1])),
        feedKind: 'tag',
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
