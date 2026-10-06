import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

const FISHPI_UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_TARGET || 'https://fishpi.cn'

  const proxy = {
    target,
    changeOrigin: true,
    secure: true,
    headers: { 'User-Agent': FISHPI_UA, Referer: `${target}/` },
  }

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': proxy,
        '/chat-room': { ...proxy, ws: true },
        '/chat-room-channel': { ...proxy, ws: true },
        '/captcha': proxy,
        '/comment': proxy,
        '/__rhythm': {
          ...proxy,
          rewrite: (path) => {
            const rest = path.replace(/^\/__rhythm/, '')
            return rest.length ? rest : '/'
          },
        },
      },
    },
  }
})
