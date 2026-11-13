import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 仅提供本轮美术预览与视频，不加载应用、不代理接口，不占用长跑服务的端口。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.PET_ART_PORT || 5187)
if (!Number.isInteger(port) || port < 1024 || port > 65535 || [5173, 5186, 8081].includes(port)) {
  throw new Error('请使用独立美术预览端口')
}
const app = express()
app.disable('x-powered-by')
app.use((request, response, next) => {
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'; connect-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'")
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('Cache-Control', 'no-store')
  if (!['GET', 'HEAD'].includes(request.method)) return response.sendStatus(405)
  next()
})
app.get('/', (_request, response) => response.redirect('/docs/pets-art/momota-animations-v1/preview.html'))
app.use((request, response) => {
  const file = request.path
  // 白名单限制到已生成的预览及分发素材，源图、提示词、测试报告不由此服务公开。
  const allowed = /^\/docs\/pets-art\/(hexiaotun|momota|yubingmiao|paixiaoyu)-animations-v1\/preview\.html$/.test(file)
    || /^\/public\/images\/pets\/animations\/(hexiaotun|momota|yubingmiao|paixiaoyu)-v1\/(manifest\.json|[a-z]+\.(webm|webp))$/.test(file)
  if (!allowed) return response.sendStatus(404)
  response.sendFile(file.slice(1), { root }, error => {
    if (error && !response.headersSent) response.sendStatus(error.statusCode || 404)
  })
})
const server = app.listen(port, '127.0.0.1', () => console.log(`宠物动作预览 http://127.0.0.1:${port}/`))
server.on('error', error => { console.error(error.code); process.exitCode = 1 })
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)))
