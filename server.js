import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { loadEnv } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT || 5173)
const root = __dirname

const env = loadEnv(isProd ? 'production' : 'development', root, '')
const apiTarget = process.env.VITE_API_TARGET || env.VITE_API_TARGET || 'https://fishpi.cn'
process.env.VITE_API_TARGET = apiTarget

const FISHPI_UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'

function extractCsrfToken(html) {
  const m = String(html).match(/csrfToken\s*:\s*['"]([^'"]+)['"]/)
  return m?.[1]?.trim() || ''
}

function parseSetCookie(res) {
  const raw =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie')]
        : []
  const out = {}
  for (const line of raw || []) {
    const m = String(line).match(/^([^=]+)=([^;]+)/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

function parseRequestCookie(header) {
  const out = {}
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=')
    if (i <= 0) continue
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
  }
  return out
}

async function csrfFromSymCe(symCe) {
  const settingsRes = await fetch(`${apiTarget}/settings`, {
    headers: {
      'User-Agent': FISHPI_UA,
      Referer: `${apiTarget}/`,
      Cookie: `sym-ce=${symCe}`,
    },
  })
  if (!settingsRes.ok) return ''
  const html = await settingsRes.text()
  return extractCsrfToken(html)
}

/** apiKey → sym-ce cookie + csrfToken (Rhythm page POSTs, e.g. profession). */
async function exchangePageAuth(apiKey, existingSymCe = '') {
  // Reuse browser cookie when still valid — avoids loginWebInApiKey roundtrip.
  if (existingSymCe) {
    const csrfToken = await csrfFromSymCe(existingSymCe)
    if (csrfToken) return { csrfToken, symCe: existingSymCe, reused: true }
  }

  const loginRes = await fetch(`${apiTarget}/loginWebInApiKey?apiKey=${encodeURIComponent(apiKey)}`, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': FISHPI_UA,
      Referer: `${apiTarget}/login`,
    },
  })
  const cookies = parseSetCookie(loginRes)
  const symCe = cookies['sym-ce']
  if (!symCe) {
    throw new Error('无法换取页面会话，请检查 apiKey')
  }
  const csrfToken = await csrfFromSymCe(symCe)
  if (!csrfToken) {
    throw new Error('设置页未返回 csrfToken')
  }
  return { csrfToken, symCe, reused: false }
}

function injectHtml(template, { appHtml, headPayload, payload, cssLinks }) {
  const head = [cssLinks || '', headPayload.headTags || '', headPayload.bodyTagsOpen || '']
    .filter(Boolean)
    .join('\n')
  let html = template.replace('<!--app-head-->', head)
  html = html.replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`)
  html = html.replace(
    '<script id="__INITIAL_STATE__" type="application/json">{}</script>',
    `<script id="__INITIAL_STATE__" type="application/json">${JSON.stringify(payload || {}).replace(/</g, '\\u003c')}</script>`,
  )
  if (headPayload.bodyTags) {
    html = html.replace('</body>', `${headPayload.bodyTags}\n</body>`)
  }
  return html
}

/** @param {import('vite').ViteDevServer} vite */
function collectDevCssLinks(vite, modules) {
  const urls = new Set()
  const seen = new Set()

  function visit(mod) {
    if (!mod || seen.has(mod.id)) return
    seen.add(mod.id)
    const id = mod.id || ''
    const isCss =
      id.includes('.css') ||
      id.includes('type=style') ||
      id.includes('.scss') ||
      id.includes('.sass') ||
      id.includes('.less')
    if (isCss) {
      const url = mod.url || id.split('?')[0]
      if (url && !url.includes('\0')) {
        const href = url.startsWith('/') ? url : `/${url}`
        // Prefer the full virtual id for Vue SFC styles so Vite can resolve them.
        const linkHref = id.includes('type=style') ? (mod.url || id) : href
        const normalized = linkHref.startsWith('/') ? linkHref : `/${linkHref}`
        urls.add(normalized)
      }
    }
    for (const child of mod.importedModules || []) visit(child)
    for (const child of mod.ssrImportedModules || []) visit(child)
  }

  for (const id of modules || []) {
    const mod = vite.moduleGraph.getModuleById(id)
    if (mod) visit(mod)
  }

  // Walk entry graph so global CSS is covered even if ctx.modules is sparse.
  for (const [id, mod] of vite.moduleGraph.idToModuleMap) {
    if (id.includes('entry-server') || id.includes('/src/app.ts') || id.endsWith('/src/app.ts')) {
      visit(mod)
    }
  }

  // Skip URLs already present as blocking links in index.html.
  const skip = new Set([
    '/src/styles/base.css',
    '/src/packs/themes/classic-dark/style.css',
    '/src/packs/themes/classic-light/style.css',
    '/src/packs/bubbles/classic/style.css',
    '/src/packs/bubbles/candy/style.css',
    '/src/packs/frames/none/style.css',
    '/src/packs/frames/gold/style.css',
  ])
  return [...urls]
    .filter((href) => !skip.has(href.split('?')[0]))
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join('\n')
}

function renderProdCssLinks(modules, manifest) {
  if (!manifest || !modules?.size) return ''
  const seen = new Set()
  let links = ''
  for (const id of modules) {
    const files = manifest[id]
    if (!files) continue
    for (const file of files) {
      if (seen.has(file)) continue
      seen.add(file)
      if (file.endsWith('.css')) {
        links += `<link rel="stylesheet" href="/${file.replace(/^\//, '')}">\n`
      }
    }
  }
  return links
}

async function createServer() {
  const app = express()
  let vite
  let template
  let render
  /** @type {Record<string, string[]> | null} */
  let ssrManifest = null

  app.use(express.json({ limit: '32kb' }))

  app.post('/__fp/page-auth', async (req, res) => {
    try {
      const apiKey = String(req.body?.apiKey || '')
      if (!apiKey) {
        res.status(400).json({ code: -1, msg: '缺少 apiKey' })
        return
      }
      const existingSymCe = parseRequestCookie(req.headers.cookie)['sym-ce'] || ''
      const { csrfToken, symCe, reused } = await exchangePageAuth(apiKey, existingSymCe)
      // Same cookie name as Rhythm so Vite/nginx proxy forwards it upstream.
      if (!reused || symCe !== existingSymCe) {
        res.setHeader(
          'Set-Cookie',
          `sym-ce=${symCe}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
        )
      }
      res.status(200).json({ code: 0, csrfToken, reused: Boolean(reused) })
    } catch (e) {
      res.status(502).json({ code: -1, msg: e instanceof Error ? e.message : 'page-auth 失败' })
    }
  })

  /** Scrape upstream home HTML for 长篇专区 carousels (no public JSON). */
  function parseHomeColumns(html) {
    function parseCarousel(id) {
      const marker = `id="${id}"`
      const start = html.indexOf(marker)
      if (start < 0) return []
      const slice = html.slice(start, start + 12000)
      const cards = []
      const re =
        /long-column-card__title[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>\s*<span class="long-column-card__count">([^<]+)/g
      let m
      while ((m = re.exec(slice))) {
        const href = m[1]
        const columnId = (href.match(/\/column\/([^/?#]+)/) || [])[1] || ''
        const countText = m[3] || ''
        const count = Number((countText.match(/\d+/) || [])[0] || 0)
        const cardStart = m.index
        const cardEnd = slice.indexOf('long-column-card', cardStart + 10)
        const body = slice.slice(cardStart, cardEnd > cardStart ? cardEnd : cardStart + 1800)
        const chapters = []
        const cre =
          /long-column-card__chapter[^>]*href="([^"]+)"[\s\S]*?long-column-card__chapter-no[^>]*>([^<]+)[\s\S]*?long-column-card__chapter-title[^>]*>([^<]+)/g
        let cm
        while ((cm = cre.exec(body))) {
          const articleHref = cm[1]
          const articleId = (articleHref.match(/\/article\/([^/?#]+)/) || [])[1] || ''
          chapters.push({
            articleId,
            permalink: articleHref.replace(/^https?:\/\/[^/]+/, '') || articleHref,
            chapterNo: cm[2].trim(),
            title: cm[3].trim(),
          })
        }
        cards.push({
          columnId,
          columnTitle: m[2].trim(),
          columnArticleCount: count,
          chapters,
          latestChapter: chapters[0] || null,
        })
      }
      return cards
    }
    return {
      recent: parseCarousel('long-recent'),
      hot: parseCarousel('long-hot'),
    }
  }

  app.get('/__fp/home-columns', async (_req, res) => {
    try {
      const upstream = await fetch(`${apiTarget}/`, {
        headers: { 'User-Agent': FISHPI_UA, Referer: `${apiTarget}/` },
      })
      const html = await upstream.text()
      if (!upstream.ok) {
        res.status(502).json({ code: -1, msg: '无法读取首页专栏' })
        return
      }
      const columns = parseHomeColumns(html)
      res.status(200).json({ code: 0, data: columns })
    } catch (e) {
      res.status(502).json({ code: -1, msg: e instanceof Error ? e.message : 'home-columns 失败' })
    }
  })

  /** Settings account page → sysBag JSON (背包). */
  app.get('/__fp/account-bag', async (req, res) => {
    try {
      const apiKey = String(req.query?.apiKey || '').trim()
      if (!apiKey) {
        res.status(400).json({ code: -1, msg: '缺少 apiKey' })
        return
      }
      const existingSymCe = parseRequestCookie(req.headers.cookie)['sym-ce'] || ''
      const { csrfToken, symCe, reused } = await exchangePageAuth(apiKey, existingSymCe)
      if (!reused || symCe !== existingSymCe) {
        res.setHeader(
          'Set-Cookie',
          `sym-ce=${symCe}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
        )
      }
      const upstream = await fetch(`${apiTarget}/settings/account`, {
        headers: {
          'User-Agent': FISHPI_UA,
          Referer: `${apiTarget}/settings`,
          Cookie: `sym-ce=${symCe}`,
        },
      })
      const html = await upstream.text()
      if (!upstream.ok) {
        res.status(502).json({ code: -1, msg: '无法读取账号页' })
        return
      }
      const m = html.match(/Settings\.initBag\((\{[\s\S]*?\})\);/)
      if (!m) {
        res.status(200).json({ code: 0, csrfToken, data: {} })
        return
      }
      let bag = {}
      try {
        bag = JSON.parse(m[1])
      } catch {
        res.status(502).json({ code: -1, msg: '背包数据解析失败' })
        return
      }
      res.status(200).json({ code: 0, csrfToken, data: bag })
    } catch (e) {
      res.status(502).json({ code: -1, msg: e instanceof Error ? e.message : 'account-bag 失败' })
    }
  })

  /** Upstream reset-pwd HTML → userId for SPA password reset. */
  app.get('/__fp/reset-pwd-meta', async (req, res) => {
    try {
      const code = String(req.query?.code || '').trim()
      if (!code) {
        res.status(400).json({ code: -1, msg: '缺少短信验证码' })
        return
      }
      const upstream = await fetch(`${apiTarget}/reset-pwd?code=${encodeURIComponent(code)}`, {
        headers: {
          'User-Agent': FISHPI_UA,
          Referer: `${apiTarget}/forget-pwd`,
        },
        redirect: 'manual',
      })
      const html = await upstream.text()
      if (!upstream.ok) {
        res.status(502).json({ code: -1, msg: '无法校验验证码' })
        return
      }
      const userId =
        html.match(/id=["']rpwdUserId["'][^>]*value=["']([^"']+)["']/)?.[1] ||
        html.match(/value=["']([^"']+)["'][^>]*id=["']rpwdUserId["']/)?.[1] ||
        ''
      const resetCode =
        html.match(/id=["']code["'][^>]*value=["']([^"']+)["']/)?.[1] ||
        html.match(/value=["']([^"']+)["'][^>]*id=["']code["']/)?.[1] ||
        code
      if (!userId) {
        res.status(400).json({ code: -1, msg: '验证码无效或已过期' })
        return
      }
      res.status(200).json({ code: 0, userId, resetCode })
    } catch (e) {
      res.status(502).json({ code: -1, msg: e instanceof Error ? e.message : 'reset-pwd-meta 失败' })
    }
  })

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite')
    vite = await createViteServer({
      root,
      server: { middlewareMode: true },
      appType: 'custom',
    })
    app.use(vite.middlewares)
    template = fs.readFileSync(path.resolve(root, 'index.html'), 'utf-8')
  } else {
    const compression = (await import('compression')).default
    const sirv = (await import('sirv')).default
    app.use(compression())
    app.use(sirv(path.resolve(root, 'dist/client'), { extensions: [] }))
    template = fs.readFileSync(path.resolve(root, 'dist/client/index.html'), 'utf-8')
    render = (await import('./dist/server/entry-server.js')).render
    const manifestPath = path.resolve(root, 'dist/client/.vite/ssr-manifest.json')
    if (fs.existsSync(manifestPath)) {
      ssrManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    }
  }

  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    const url = req.originalUrl
    // Let Vite / static handle assets and API proxies (dev proxies are on vite.middlewares).
    if (
      url.startsWith('/__fp/') ||
      url.startsWith('/src/') ||
      url.startsWith('/@') ||
      url.startsWith('/node_modules/') ||
      url.startsWith('/assets/') ||
      url.includes('.')
    ) {
      return next()
    }

    try {
      let tpl = template
      let renderFn = render
      if (!isProd) {
        tpl = await vite.transformIndexHtml(url, template)
        renderFn = (await vite.ssrLoadModule('/src/entry-server.ts')).render
      }
      const result = await renderFn(url)
      let cssLinks = ''
      if (!isProd && vite) {
        cssLinks = collectDevCssLinks(vite, result.modules)
      } else if (ssrManifest && result.modules) {
        cssLinks = renderProdCssLinks(result.modules, ssrManifest)
      }
      const html = injectHtml(tpl, { ...result, cssLinks })
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      if (!isProd && vite) vite.ssrFixStacktrace(e)
      console.error(e)
      res.status(500).end(String(e?.stack || e))
    }
  })

  app.listen(port, '127.0.0.1', () => {
    console.log(`FishPi SSR http://127.0.0.1:${port} (api → ${apiTarget})`)
  })
}

createServer()
