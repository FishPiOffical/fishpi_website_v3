import type { ArticleSummary, RankUser } from '@/api/fishpi'

export interface PublicHomeData {
  articles: ArticleSummary[]
  checkin: RankUser[]
  online: RankUser[]
}

const PUBLIC_HOME = '/__rhythm/'

function text(el: Element | null) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim()
}

function memberName(href: string) {
  const m = href.match(/\/member\/([^/?#]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

function parseCount(raw: string) {
  const n = Number(raw.replace(/[^\d.]/g, '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function parseHomeHtml(html: string): PublicHomeData {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const articles: ArticleSummary[] = []
  const seen = new Set<string>()

  for (const link of doc.querySelectorAll('a.title.fn-ellipsis[href*="/article/"]')) {
    const href = link.getAttribute('href') || ''
    const id = href.match(/\/article\/(\d+)/)?.[1]
    if (!id || seen.has(id)) continue
    seen.add(id)
    const row = link.closest('li')
    articles.push({
      oId: id,
      articleTitle: text(link),
      articleViewCntDisplayFormat: text(row?.querySelector('a.count') ?? null),
      articleStick: row?.querySelector('.cb-stick') ? 1 : 0,
    })
  }

  return {
    articles,
    checkin: parseRank(doc, '今日连签排行', /\/top\/checkin/),
    online: parseRank(doc, '在线时间排行', /\/top\/online/),
  }
}

function parseRank(doc: Document, heading: string, morePath: RegExp): RankUser[] {
  const start = [...doc.querySelectorAll('div')].find((el) => text(el) === heading)
  const panel = start?.parentElement?.nextElementSibling
  const list = panel?.querySelector('ul.module-list')
  if (!list) return []

  const users: RankUser[] = []
  for (const li of list.querySelectorAll(':scope > li')) {
    const nameLink = [...li.querySelectorAll('a[href*="/member/"]')].find((a) => text(a)) ?? null
    const name = memberName(nameLink?.getAttribute('href') || '') || text(nameLink)
    if (!name) continue
    const countEl =
      [...li.querySelectorAll('a.count')].find((a) => morePath.test(a.getAttribute('href') || '')) ??
      li.querySelector('a.count')
    const raw = text(countEl) || countEl?.getAttribute('aria-label') || ''
    const user: RankUser = { userName: name }
    if (/分钟/.test(raw) || morePath.source.includes('online')) user.onlineMinute = parseCount(raw)
    else user.userCheckinStreak = parseCount(raw)
    users.push(user)
  }
  return users
}

export async function fetchPublicHome(): Promise<PublicHomeData> {
  const res = await fetch(PUBLIC_HOME, { headers: { Accept: 'text/html' } })
  const html = await res.text()
  if (!res.ok || html.includes('src="/src/main.ts"')) {
    throw new Error('无法读取公开首页')
  }
  const data = parseHomeHtml(html)
  if (!data.articles.length) throw new Error('公开首页没有解析到帖子')
  return data
}
