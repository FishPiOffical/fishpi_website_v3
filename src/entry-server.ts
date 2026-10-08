import { renderToString } from 'vue/server-renderer'
import { renderSSRHead } from '@unhead/vue/server'
import { createFishpiApp } from './app'
import {
  fetchArticle,
  fetchArticleFeed,
  fetchBreezemoons,
  fetchChatHistory,
  fetchChatOnlineUsers,
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
import { clearSsrPayload, setSsrPayload, type SsrPayload } from './seo/payload'
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
        fetchBreezemoons(1, 8),
        fetchChatHistory(null, 1),
        fetchRepeaterItems(null),
        fetchChatOnlineUsers(null),
      ])
      const val = <T>(i: number, fallback: T): T =>
        settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<T>).value : fallback
      const tagData = val(6, { tags: [], total: 0 })
      const onlineSnap = val(10, {} as Awaited<ReturnType<typeof fetchChatOnlineUsers>>)
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
        breezemoons: val(7, []),
        chatFeed: val(8, []).slice(0, 12),
        repeater: val(9, []),
        chatOnline: onlineSnap,
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
      return { breezemoons: await fetchBreezemoons(1, 30) }
    }

    if (path === '/top') {
      const [checkinRank, onlineRank] = await Promise.all([fetchCheckinRank(null), fetchOnlineRank(null)])
      return { checkinRank, onlineRank }
    }

    if (path === '/repeater') {
      return { repeater: await fetchRepeaterItems(null) }
    }

    const listMap: Record<string, ArticleFeedKind> = {
      '/hot': 'hot',
      '/recent/long': 'long',
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

    const tagMatch = path.match(/^\/tags\/([^/]+)$/)
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
  clearSsrPayload()
  const payload = await prefetch(url)
  // Clone before render — views consume the live payload during SSR.
  const clientPayload = JSON.parse(JSON.stringify(payload)) as typeof payload
  setSsrPayload(payload)

  const { app, router, head } = createFishpiApp()
  await router.push(url)
  await router.isReady()

  const ctx: { modules?: Set<string> } = {}
  const appHtml = await renderToString(app, ctx)
  const headPayload = await renderSSRHead(head)

  clearSsrPayload()
  return {
    appHtml,
    headPayload,
    payload: clientPayload,
    modules: ctx.modules || new Set<string>(),
  }
}
