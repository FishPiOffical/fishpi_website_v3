import { apiProxy, requestMode, backendTarget } from './server/api-mode.ts'
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
 * 开发时由这里把 /*-channel 与 v3 realtime 的 WebSocket 升级请求隧道到 Rhythm（生产由 nginx 处理）。
 */
function proxyWsUpgrade(req, socket, head) {
  const target = new URL(req.url, backendTarget(requestMode(req, { ...env, ...process.env }), { ...env, ...process.env }))
  const secure = target.protocol === 'https:'
  const upstream = (secure ? https : http).request({
    hostname: target.hostname.startsWith('[') ? target.hostname.slice(1, -1) : target.hostname,
    port: target.port || (secure ? 443 : 80),
    path: target.pathname + target.search,
    method: 'GET',
    headers: {
      ...req.headers,
      host: target.host,
      origin: target.origin,
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
  app.set('trust proxy', 'loopback')
  app.use(apiProxy({ ...env, ...process.env }))
  // Independent feedback service: do not send Rhythm cookies or use its API proxy.
  app.use((req, res, next) => {
    if (!/^\/feedback-api(?:\/|$)/.test(req.url || '')) return next()
    res.setHeader('Cache-Control', 'no-store')
    if ((process.env.VITE_FEEDBACK_ENABLED || env.VITE_FEEDBACK_ENABLED) !== 'true') {
      res.status(503).json({ error: '需求反馈未启用' }); return
    }
    const target = new URL(process.env.FEEDBACK_TARGET || env.FEEDBACK_TARGET || 'http://127.0.0.1:5174')
    const headers = { host: req.headers.host, accept: 'application/json', 'x-forwarded-for': req.ip }
    for (const name of ['authorization', 'content-type', 'content-length', 'idempotency-key', 'origin', 'x-fp-api-mode', 'x-fp-legacy-key']) {
      if (req.headers[name]) headers[name] = req.headers[name]
    }
    const upstream = (target.protocol === 'https:' ? https : http).request({
      hostname: target.hostname, port: target.port, path: req.url, method: req.method, headers,
    }, response => {
      res.statusCode = response.statusCode || 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.on('error', () => res.destroy())
      response.pipe(res)
    })
    upstream.setTimeout(20000, () => upstream.destroy())
    upstream.on('error', () => { if (!res.headersSent) res.status(503).json({ error: '反馈服务暂不可用' }); else res.destroy() })
    req.on('aborted', () => upstream.destroy())
    req.pipe(upstream)
  })
  let vite
  let template
  let render
  /** @type {Record<string, string[]> | null} */
  let ssrManifest = null

  // Keep request bodies untouched for Vite proxies; authentication uses existing v3 endpoints.

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
      const result = await renderFn(pageUrl, requestMode(req, { ...env, ...process.env }))
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
      res.status(status).set({ 'Content-Type': 'text/html', Vary: 'Cookie' }).end(html)
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
    console.log(`FishPi SSR http://127.0.0.1:${port} (v1 → ${backendTarget('v1', { ...env, ...process.env })}, v3 → ${backendTarget('v3', { ...env, ...process.env })})`)
  })
  if (!isProd) {
    server.on('upgrade', (req, socket, head) => {
      if (req.url === '/api/v3/realtime' && requestMode(req, { ...env, ...process.env }) === 'v1') { socket.end('HTTP/1.1 501 Not Implemented\r\n\r\n'); return }
      if (req.url === '/api/v3/realtime' || /^\/[\w-]+-channel(\?|$)/.test(req.url || '')) proxyWsUpgrade(req, socket, head)
    })
  }
}

createServer()
