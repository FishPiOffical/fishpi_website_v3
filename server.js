import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
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

/**
 * Vite middlewareMode 没有 httpServer，server.proxy 的 ws: true 不生效；
 * 开发时由这里把 /*-channel 的 WebSocket 升级请求隧道到 Rhythm（生产由 nginx 处理）。
 */
function proxyWsUpgrade(req, socket, head) {
  const target = new URL(req.url, apiTarget)
  const secure = target.protocol === 'https:'
  const upstream = (secure ? https : http).request({
    hostname: target.hostname,
    port: target.port || (secure ? 443 : 80),
    path: target.pathname + target.search,
    method: 'GET',
    headers: {
      ...req.headers,
      host: target.host,
      origin: apiTarget,
      'user-agent': FISHPI_UA,
    },
  })
  upstream.on('upgrade', (res, upstreamSocket, upstreamHead) => {
    const lines = [`HTTP/1.1 ${res.statusCode} ${res.statusMessage}`]
    for (let i = 0; i < res.rawHeaders.length; i += 2) lines.push(`${res.rawHeaders[i]}: ${res.rawHeaders[i + 1]}`)
    socket.write(`${lines.join('\r\n')}\r\n\r\n`)
    if (upstreamHead?.length) socket.write(upstreamHead)
    if (head?.length) upstreamSocket.write(head)
    upstreamSocket.on('error', () => socket.destroy())
    upstreamSocket.pipe(socket).pipe(upstreamSocket)
  })
  upstream.on('response', (res) => {
    socket.end(`HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n\r\n`)
  })
  upstream.on('error', () => socket.destroy())
  socket.on('error', () => upstream.destroy())
  upstream.end()
}

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

  // 仅 page-auth 解析 JSON。全局 express.json 会吃掉 body，导致 Vite 代理 POST（勋章/发帖等）一直挂起。
  app.post('/__fp/page-auth', express.json({ limit: '32kb' }), async (req, res) => {
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

  /**
   * 与现网首页 Util.alert 一致：未绑手机 / 管理组未开两步验证。
   * 通过页面会话拉取 Rhythm 首页，读取服务端已算好的条件（不依赖 /api/user 脱敏字段）。
   */
  app.post('/__fp/security-alerts', express.json({ limit: '32kb' }), async (req, res) => {
    try {
      const apiKey = String(req.body?.apiKey || '')
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
      const homeRes = await fetch(`${apiTarget}/`, {
        headers: {
          'User-Agent': FISHPI_UA,
          Cookie: `sym-ce=${symCe}`,
          Referer: `${apiTarget}/`,
        },
      })
      const html = await homeRes.text()
      // 与 skins/classic/*/index.ftl 中 Util.alert 文案对齐
      const needBindPhone = html.includes('您需要绑定手机号后方可正常访问摸鱼派')
      const need2fa =
        html.includes('致管理组成员的重要通知') || html.includes('立即在个人设置-账户中启用两步验证')
      res.status(200).json({ code: 0, csrfToken, needBindPhone, need2fa })
    } catch (e) {
      res.status(502).json({ code: -1, msg: e instanceof Error ? e.message : 'security-alerts 失败' })
    }
  })

  // 缺失 JSON 用前端 gaps.mock，不再 HTML 抓取现网。清单见 docs/MISSING_APIS.md。

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

    async function renderPage(pageUrl) {
      let tpl = template
      let renderFn = render
      if (!isProd) {
        tpl = await vite.transformIndexHtml(pageUrl, template)
        renderFn = (await vite.ssrLoadModule('/src/entry-server.ts')).render
      }
      const result = await renderFn(pageUrl)
      let cssLinks = ''
      if (!isProd && vite) {
        cssLinks = collectDevCssLinks(vite, result.modules)
      } else if (ssrManifest && result.modules) {
        cssLinks = renderProdCssLinks(result.modules, ssrManifest)
      }
      return { html: injectHtml(tpl, { ...result, cssLinks }), status: result.status || 200 }
    }

    try {
      const { html, status } = await renderPage(url)
      res.status(status).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      if (!isProd && vite) vite.ssrFixStacktrace(e)
      console.error(e)
      if (!isProd) {
        res.status(500).end(String(e?.stack || e))
        return
      }
      try {
        const { html } = await renderPage('/error/500')
        res.status(500).set({ 'Content-Type': 'text/html' }).end(html)
      } catch {
        res.status(500).end('500 Internal Server Error')
      }
    }
  })

  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`FishPi SSR http://127.0.0.1:${port} (api → ${apiTarget})`)
  })
  if (!isProd) {
    server.on('upgrade', (req, socket, head) => {
      if (/^\/[\w-]+-channel(\?|$)/.test(req.url || '')) proxyWsUpgrade(req, socket, head)
    })
  }
}

createServer()
