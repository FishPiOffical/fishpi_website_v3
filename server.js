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

function injectHtml(template, { appHtml, headPayload, payload }) {
  const head = [
    headPayload.headTags || '',
    headPayload.bodyTagsOpen || '',
  ]
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

async function createServer() {
  const app = express()
  let vite
  let template
  let render

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
      const html = injectHtml(tpl, result)
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
