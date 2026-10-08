/**
 * Generate public/sitemap.xml from Rhythm recent / hot feeds.
 * Usage: node scripts/generate-sitemap.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const origin = (process.env.VITE_SITE_ORIGIN || 'https://fishpi.cn').replace(/\/$/, '')
const api = (process.env.VITE_API_TARGET || origin).replace(/\/$/, '')

const staticPaths = [
  '/',
  '/hot',
  '/recent/long',
  '/qna',
  '/perfect',
  '/good',
  '/domains',
  '/tags',
  '/breezemoons',
  '/top',
  '/repeater',
]

async function fetchArticles(path) {
  try {
    const res = await fetch(`${api}${path}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
      },
    })
    if (!res.ok) return []
    const json = await res.json()
    const data = json?.data
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.articles)) return data.articles
    return []
  } catch (e) {
    console.warn('sitemap fetch failed', path, e.message)
    return []
  }
}

function urlEntry(loc, changefreq = 'daily', priority = '0.7') {
  return `  <url>
    <loc>${origin}${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

const recent = await fetchArticles('/api/articles/recent?p=1&size=50')
const hot = await fetchArticles('/api/articles/recent/hot?p=1&size=50')
const ids = new Set()
for (const a of [...recent, ...hot]) {
  if (a?.oId && !String(a.oId).startsWith('mock-')) ids.add(String(a.oId))
}

const urls = [
  ...staticPaths.map((p) => urlEntry(p, p === '/' ? 'hourly' : 'daily', p === '/' ? '1.0' : '0.8')),
  ...[...ids].map((id) => urlEntry(`/article/${id}`, 'weekly', '0.6')),
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`

const out = path.join(root, 'public', 'sitemap.xml')
fs.writeFileSync(out, xml)
console.log(`Wrote ${out} (${urls.length} urls)`)
