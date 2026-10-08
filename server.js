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
