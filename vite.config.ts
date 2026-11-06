import { v3Only } from './server/v3-only.ts'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

const FISHPI_UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_TARGET || 'https://fishpi.cn'

  const proxy: ProxyOptions = {
    target,
    changeOrigin: true,
    secure: true,
    headers: { 'User-Agent': FISHPI_UA, Referer: `${target}/` },
    cookieDomainRewrite: '',
    configure(proxyServer) {
      proxyServer.on('proxyReq', (proxyReq, req) => {
        proxyReq.removeHeader('x-fp-api-mode')
        proxyReq.removeHeader('x-fp-legacy-key')
        if (req.headers.cookie) proxyReq.setHeader('cookie', req.headers.cookie.split(';').filter(value => !value.trim().startsWith('fp.apiMode=')).join(';'))
      })
    },
  }

  return {
    plugins: [vue(), {
      name: 'feedback-deployment-switch',
      configureServer(server) {
        server.middlewares.use(v3Only)
        server.middlewares.use((req, res, next) => {
          if (/^\/feedback-api(?:\/|$)/.test(req.url || '') && env.VITE_FEEDBACK_ENABLED !== 'true') {
            res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
            res.end(JSON.stringify({ error: '需求反馈未启用' }))
            return
          }
          next()
        })
      },
    }],
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
        '/feedback-api': {
          target: env.FEEDBACK_TARGET || 'http://127.0.0.1:5174',
          changeOrigin: false,
          configure(server) {
            server.on('proxyReq', (proxyReq, req) => { proxyReq.removeHeader('cookie'); proxyReq.setHeader('X-Forwarded-For', req.socket.remoteAddress || '127.0.0.1') })
          },
        },
        '/api/v3/realtime': { ...proxy, ws: true },
        '^/api/v3/auth/(?:login|refresh|logout)(?:\\?|$)': {
          ...proxy,
          changeOrigin: false,
          // Keep the browser Host/Origin/Referer tuple for credential-origin checks.
          headers: { 'User-Agent': FISHPI_UA },
        },
        '/api/v3': proxy,
        '/rhypic-upload': {
          target: 'https://pic.fishpi.cn',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/rhypic-upload/, ''),
        },
        '/captcha': proxy,
        '/test': proxy,
        '/validateCaptcha': proxy,
        '/gen': proxy,
        '/games/': proxy,
        '/activities/': proxy,

      },
    },
  }
})
