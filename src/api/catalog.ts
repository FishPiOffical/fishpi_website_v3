import type { ArticleDetail, ArticleSummary, RankUser } from '@/api/fishpi'
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
