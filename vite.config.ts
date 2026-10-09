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
      // hookable 须一起打包：根目录是 pinia devtools 带来的 5.x，unhead 需要 6.x。
      noExternal: ['@unhead/vue', '@unhead/ssr', 'unhead', 'hookable'],
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
        // Rhythm 风控人机验证页与校验接口（IP 黑名单时接口会 302 → /test）
        '/test': proxy,
        '/validateCaptcha': proxy,
        '/comment': proxy,
        '/verify': proxy,
        '/register2': proxy,
        '/vote': proxy,
        '/breezemoon': {
          ...proxy,
          bypass(req) {
            const path = (req.url || '').split('?')[0] || ''
            // SPA 列表页 /breezemoons；API 为 POST /breezemoon
            if ((req.method === 'GET' || req.method === 'HEAD') && (path === '/breezemoons' || path === '/breezemoons/')) {
              return req.url
            }
          },
        },
        '/follow': {
          ...proxy,
          bypass(req) {
            const path = (req.url || '').split('?')[0] || ''
            // SPA /following；API 为 /follow/...
            if ((req.method === 'GET' || req.method === 'HEAD') && (path === '/following' || path === '/following/')) {
              return req.url
            }
          },
        },
        '/unfollow': proxy,
        '/user': proxy,
        '/users': proxy,
        '/activity': {
          ...proxy,
          bypass(req) {
            const path = (req.url || '').split('?')[0] || ''
            // SPA 活动页；签到/活跃 API 仍走 /activity/*
            if ((req.method === 'GET' || req.method === 'HEAD') && (path === '/activity' || path === '/activity/')) {
              return req.url
            }
          },
        },
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
        '/charge': { ...proxy, bypass: spaGetBypass },
        '/pay': proxy,
        '/getApiKeyInWeb': proxy,
        '/vips': { ...proxy, bypass: spaGetBypass },
        '/games': {
          ...proxy,
          bypass(req) {
            const path = (req.url || '').split('?')[0] || ''
            // SPA 入口 /games；子路径（adarkroom 等）走 Rhythm
            if ((req.method === 'GET' || req.method === 'HEAD') && (path === '/games' || path === '/games/')) {
              return req.url
            }
          },
        },
        '/activities': proxy,
        '/milestones': proxy,
        '/statistic': proxy,
        '/guide': proxy,
        '/column': {
          ...proxy,
          bypass(req) {
            // SPA /column、/column/:id；无公开 JSON 时勿吃掉页面
            if (req.method === 'GET' || req.method === 'HEAD') return req.url
          },
        },
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
        '/forget-pwd': { ...proxy, bypass: spaGetBypass },
        '/reset-pwd': { ...proxy, bypass: spaGetBypass },
        '/invitecode': proxy,
        '/export': proxy,
        '/mfa': proxy,
        '/bag': proxy,
        '/gen': proxy,
        '/settings': {
          ...proxy,
          bypass(req) {
            const path = (req.url || '').split('?')[0] || ''
            // SPA 设置子页；API：POST /settings/password|function|geo/status|privacy|i18n
            if (req.method === 'GET' || req.method === 'HEAD') {
              const spa =
                path === '/settings' ||
                path === '/settings/' ||
                /^\/settings\/(point|account|function|system|profession|privacy|avatar|invite|identity|data|i18n|help)(\/|$)/.test(
                  path,
                )
              if (spa) return req.url
            }
          },
        },
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
