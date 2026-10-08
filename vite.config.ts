import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import type { IncomingMessage } from 'node:http'

const FISHPI_UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'

function spaGetBypass(req: IncomingMessage) {
  if (req.method === 'GET' || req.method === 'HEAD') return req.url
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_TARGET || 'https://fishpi.cn'

  const proxy: ProxyOptions = {
    target,
    changeOrigin: true,
    secure: true,
    headers: { 'User-Agent': FISHPI_UA, Referer: `${target}/` },
    // Forward page-session cookie + Rhythm CSRF header for profession POSTs.
    cookieDomainRewrite: '',
    configure(proxyServer) {
      proxyServer.on('proxyReq', (proxyReq, req) => {
        const csrf = req.headers.csrftoken || req.headers.csrfToken
        if (csrf && !proxyReq.getHeader('csrfToken')) {
          proxyReq.setHeader('csrfToken', Array.isArray(csrf) ? csrf[0] : csrf)
        }
      })
    },
  }

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      // Client build emits .vite/ssr-manifest.json for SSR CSS link injection.
      ssrManifest: true,
    },
    ssr: {
      noExternal: ['@unhead/vue', '@unhead/ssr', 'unhead'],
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': proxy,
        // apiKey → web session (sym-ce); used by server page-auth and direct clients.
        '/loginWebInApiKey': proxy,
        '/chat-room': { ...proxy, ws: true },
        '/chat-room-channel': { ...proxy, ws: true },
        '/captcha': proxy,
        '/comment': proxy,
        '/verify': proxy,
        '/register2': proxy,
        '/vote': proxy,
        '/breezemoon': proxy,
        '/follow': proxy,
        '/unfollow': proxy,
        '/user': proxy,
        '/users': proxy,
        '/activity': proxy,
        '/notifications': {
          ...proxy,
          bypass(req) {
            const path = (req.url || '').split('?')[0]
            if ((req.method === 'GET' || req.method === 'HEAD') && (path === '/notifications' || path === '/notifications/')) {
              return req.url
            }
          },
        },
        '/chat-channel': { ...proxy, ws: true },
        '/idle-talk': proxy,
        '/idle-talk-channel': { ...proxy, ws: true },
        '/chat': {
          ...proxy,
          bypass(req) {
            const path = (req.url || '').split('?')[0] || ''
            const isApi = /^\/chat\/(get-list|get-message|mark-as-read|has-unread|revoke|send)(\/|$)/.test(path)
            if (isApi) return
            if (req.method === 'GET' || req.method === 'HEAD') return req.url
          },
        },
        '/point': {
          ...proxy,
          bypass(req) {
            const path = (req.url || '').split('?')[0] || ''
            if (path === '/points' || path.startsWith('/points/')) return req.url
          },
        },
        '/upload': proxy,
        '/report': proxy,
        '/markdown': proxy,
        '/user-channel': { ...proxy, ws: true },
        '/logs': {
          ...proxy,
          bypass(req) {
            const path = (req.url || '').split('?')[0] || ''
            if ((req.method === 'GET' || req.method === 'HEAD') && (path === '/logs' || path === '/logs/')) {
              return req.url
            }
          },
        },
        '/tags': {
          ...proxy,
          bypass(req) {
            const path = (req.url || '').split('?')[0] || ''
            if (path === '/tags/query') return
            if (req.method === 'GET' || req.method === 'HEAD') return req.url
          },
        },
        '/cr': {
          ...proxy,
          bypass(req) {
            const path = (req.url || '').split('?')[0] || ''
            if (path.startsWith('/cr/raw/')) return
            if (req.method === 'GET' || req.method === 'HEAD') return req.url
          },
        },
        '/register': { ...proxy, bypass: spaGetBypass },
        '/article-channel': { ...proxy, ws: true },
        '/article': {
          ...proxy,
          bypass(req) {
            const path = (req.url || '').split('?')[0] || ''
            if (path.startsWith('/article-channel')) return
            if (path.startsWith('/article/random')) return
            // 修订历史 JSON：/article/:id/revisions/list|/:revisionId
            if (/^\/article\/[^/]+\/revisions(\/|$)/.test(path)) return
            return spaGetBypass(req)
          },
        },
      },
    },
  }
})
