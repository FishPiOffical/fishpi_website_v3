import { renderToString } from 'vue/server-renderer'
import { renderSSRHead } from '@unhead/vue/server'
import { createFishpiApp } from './app'
import {
  fetchArticle,
  fetchArticleFeed,
  fetchCheckinRank,
  fetchDomains,
  fetchOnlineRank,
  fetchRecentArticles,
  fetchRecentRegister,
  fetchRepeaterItems,
  fetchTags,
  fetchUserProfile,
  type ArticleFeedKind,
} from './api/fishpi'
import { SSR_PAYLOAD_KEY, type SsrPayload } from './seo/payload'
import { fetchV3Breezemoons } from './api/v3-breezemoons'
import { shouldPrefetchSsr } from './seo/ssrRoutes'

async function prefetch(url: string): Promise<SsrPayload> {
  const path = url.split('?')[0] || '/'
  if (!shouldPrefetchSsr(path)) return {}

  try {
    const articleMatch = path.match(/^\/article\/([^/]+)$/)
    if (articleMatch) {
      const article = await fetchArticle(articleMatch[1])
      return { article }
    }

    const memberMatch = path.match(/^\/member\/([^/]+)$/)
    if (memberMatch) {
      const member = await fetchUserProfile(decodeURIComponent(memberMatch[1]))
      return { member }
    }

    if (path === '/') {
      const settled = await Promise.allSettled([
        fetchRecentArticles(null, 1, 40),
        fetchArticleFeed('hot', null, 1, 12),
        fetchArticleFeed('long', null, 1, 12),
        fetchCheckinRank(null),
        fetchOnlineRank(null),
        fetchRecentRegister(null),
        fetchTags(null, 1, 24),
        fetchV3Breezemoons(1, 8),
        fetchRepeaterItems(null),
      ])
      const val = <T>(i: number, fallback: T): T =>
        settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<T>).value : fallback
      const tagData = val(6, { tags: [], total: 0 })

      return {
        feed: val(0, []),
        feedKind: 'recent',
        hotFeed: val(1, []),
        longFeed: val(2, []),
        checkinRank: val(3, []),
        onlineRank: val(4, []),
        recentUsers: val(5, []),
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

    if (
      path === '/top' ||
      path === '/top/checkin' ||
      path === '/top/online' ||
      path === '/top/balance' ||
      path === '/top/consumption' ||
      path === '/top/profession'
    ) {
      const [checkinRank, onlineRank] = await Promise.all([fetchCheckinRank(null), fetchOnlineRank(null)])
      return { checkinRank, onlineRank }
    }

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
