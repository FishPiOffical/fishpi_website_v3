import http from 'node:http'
import https from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
export type Mode = 'v1' | 'v3'
export function requestMode(req: IncomingMessage, env: Record<string,string|undefined>): Mode {
  const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s=>s.startsWith('fp.apiMode='))?.slice(11)
  return cookie === 'v1' || cookie === 'v3' ? cookie : env.VITE_API_MODE === 'v1' ? 'v1' : 'v3'
}
export function backendTarget(mode: Mode, env: Record<string,string|undefined>) {
  return mode === 'v1' ? env.VITE_API_V1_TARGET || 'https://fishpi.cn' : env.VITE_API_V3_TARGET || env.VITE_API_TARGET || 'http://127.0.0.1:8081'
}
export function apiProxy(env: Record<string,string|undefined>) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path=(req.url || '').split('?')[0] || ''
    const legacyResource=/^\/user\/[A-Za-z0-9_-]+$/.test(path) && ['GET','HEAD'].includes(req.method || '') || /^\/breezemoon(?:\/[0-9]+)?$/.test(path) && !['GET','HEAD'].includes(req.method || '')
    if (!/^\/api(?:\/|$)/.test(req.url || '') && !legacyResource) return next()
    const mode = requestMode(req,env)
    if(mode === 'v1' && /^\/api\/v3(?:\/|$)/.test(req.url || '')) {
      res.writeHead(501,{'Content-Type':'application/json','Cache-Control':'no-store'})
      res.end(JSON.stringify({code:501,msg:'该功能的 v1 适配尚未完成，可切换 v3 模式使用'})); return
    }
    const target = new URL(backendTarget(mode,env)), headers = {...req.headers}
    delete headers['x-fp-api-mode']
    if (mode === 'v1') delete headers.authorization
    // Do not send the browser's non-secret local mode preference upstream.
    if(headers.cookie) headers.cookie=headers.cookie.split(';').filter(x=>!x.trim().startsWith('fp.apiMode=') && !(mode==='v1' && x.trim().startsWith('fp_v3_refresh='))).join(';')
    if (!/^\/api\/v3\/auth\//.test(req.url || '')) headers.host=target.host
    headers['user-agent']='Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'
    const upstream=(target.protocol==='https:'?https:http).request({hostname:target.hostname.replace(/^\[|\]$/g,''),port:target.port,path:req.url,method:req.method,headers}, response=>{
      const outgoing={...response.headers}
      if(outgoing['set-cookie']) outgoing['set-cookie']=outgoing['set-cookie'].map(cookie=>cookie.replace(/;\s*Domain=[^;]+/gi,''))
      res.writeHead(response.statusCode || 502,outgoing)
      response.on('error',()=>res.destroy());response.pipe(res)
    })
    upstream.setTimeout(20000,()=>upstream.destroy())
    upstream.on('error',()=>{if(!res.headersSent){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({code:503,msg:`${mode} 后端不可用，请检查该模式的代理目标`}))}else res.destroy()})
    req.on('aborted',()=>upstream.destroy());req.pipe(upstream)
  }
}
