import type { IncomingMessage, ServerResponse } from 'node:http'

/** Old mode cookies/headers cannot re-enable the retired website API adapter. */
export function v3Only(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const path = (req.url || '').split('?')[0] || ''
  if (!/^\/api(?:\/|$)/.test(path) || /^\/api\/v3(?:\/|$)/.test(path)) return next()
  res.writeHead(410, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify({ code: 410, msg: '当前站点仅支持 v3 接口' }))
}
