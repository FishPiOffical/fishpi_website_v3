import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const env=s=>s.replaceAll('import.meta.env?.VITE_BROWSER_API_ORIGIN',JSON.stringify('https://fishpi.cn/')).replaceAll('import.meta.env.SSR','false').replaceAll('import.meta.env.VITE_API_TARGET',"''")
const oldFetch=globalThis.fetch,oldWindow=globalThis.window,oldSocket=globalThis.WebSocket,calls=[]
globalThis.window={location:{host:'yui.fishpi.cn',protocol:'https:'},dispatchEvent(){},setTimeout,clearTimeout}
globalThis.fetch=async(path,init)=>{calls.push({path,init});return new Response(JSON.stringify({code:0,data:{accessToken:'rotated',provider:'geetest4',captchaId:'fixture'}}),{headers:{'Content-Type':'application/json'}})}
try {
 const api=await import(url(env(compile(await fs.readFile('src/api/http.ts','utf8'))).replace("from '@/utils/riskCaptcha'",`from '${url('export async function ensureRiskCaptcha(){throw Error("unexpected")}')}'`)))
 api.setAccessToken('memory-token');await api.request('/api/v3/statistics');await api.refreshAccessToken();assert.equal(await api.pingApi(),true)
 assert.deepEqual(calls.map(c=>c.path),['https://fishpi.cn/api/v3/statistics','https://fishpi.cn/api/v3/auth/refresh','https://fishpi.cn/api/v3/auth/captcha-options']);assert.ok(calls.every(c=>c.init.credentials==='include'));assert.equal(calls[0].init.headers.get('Authorization'),'Bearer memory-token');assert.equal(calls[1].init.headers.has('Authorization'),false)
 const sockets=[];globalThis.WebSocket=class{constructor(path){this.path=path;sockets.push(this)}close(){}}
 const shim=url(`export class ApiError extends Error{};export const getAccessToken=()=>"token";export async function request(){return {code:0,data:{channel:'messages',path:'/api/v3/realtime',ticket:'FIRST_FRAME_ONLY'}}}`)
 const rt=await import(url(env(compile(await fs.readFile('src/api/v3-realtime.ts','utf8'))).replace("from './http'",`from '${shim}'`).replace("from './v3-chat-messages'",`from '${url('export function decodeChatMessage(){throw Error("unexpected chat frame")}')}'`)))
 const stop=rt.subscribeMessageChanges(()=>{});await new Promise(r=>setImmediate(r));assert.equal(sockets[0].path,'wss://fishpi.cn/api/v3/realtime');assert.ok(!sockets[0].path.includes('FIRST_FRAME'));stop()
 const feedback=await fs.readFile('src/feedback/api.ts','utf8');assert.ok(feedback.includes("fetch('/feedback-api/v1'+path"))
 console.log('PASS production HTTP/refresh/ping and WS directly target fishpi.cn; credentials remain memory/cookie, feedback stays same-origin')
}finally{globalThis.fetch=oldFetch;globalThis.window=oldWindow;globalThis.WebSocket=oldSocket}
