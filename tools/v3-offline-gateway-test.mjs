import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { ref, watch, reactive, effectScope } from 'vue'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const events=[],originalFetch=globalThis.fetch,originalWindow=globalThis.window
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
globalThis.window={dispatchEvent:e=>events.push(e.type),setTimeout,clearTimeout}
try {
 const source=compile(await fs.readFile('src/api/http.ts','utf8')).replaceAll('import.meta.env.SSR','false').replaceAll('import.meta.env.VITE_API_TARGET',"''").replace("from '@/utils/riskCaptcha'",`from '${url('export async function ensureRiskCaptcha(){throw Error("unexpected captcha")}')}'`)
 const api=await import(url(source))
 for(const status of [502,503,504]) {globalThis.fetch=async()=>new Response('unavailable',{status});const before=events.length;await assert.rejects(api.request('/api/v3/statistics'),e=>e.code==='offline'&&e.status===status);assert.equal(events.length,before+1)}
 for(const status of [401,403,404,422,503]) {globalThis.fetch=async()=>json({code:'resource_error',msg:'resource error'},status);const before=events.length;await assert.rejects(api.request('/api/v3/fixture'),e=>e.code!=='offline');assert.equal(events.length,before)}
 console.log('PASS gateway outage emits offline; permissions and JSON resource 503 stay local')
 for(const response of [()=>new Response('bad',{status:502}),()=>json({code:0},503),()=>new Response('<html>login</html>'),()=>new Response('{',{headers:{'Content-Type':'application/json'}}),()=>json({code:0,data:{}})]) {globalThis.fetch=async()=>response();assert.equal(await api.pingApi(),false)}
 globalThis.fetch=async()=>json({code:0,data:{provider:'geetest4',captchaId:'fixture-id'}});assert.equal(await api.pingApi(),true)
 assert.equal(api.isOfflineError(new api.ApiError('cancel',0,'aborted')),false)
 console.log('PASS reconnect requires complete successful v3 response, not proxy errors or HTML')
 const shell=await fs.readFile('src/layouts/AppShell.vue','utf8'),start=shell.indexOf('const apiOffline ='),end=shell.indexOf('\nonMounted(',start),route=reactive({name:'article',fullPath:'/article/123?p=2#comment456'}),calls=[]
 let finish;const router={replace:target=>{calls.push(target);return new Promise(resolve=>finish=resolve)}}
 const scope=effectScope(),model=scope.run(()=>new Function('ref','watch','auth','route','getAuthContextVersion','router',compile(shell.slice(start,end))+';return {onApiOffline,apiOffline}')(ref,watch,reactive({accessToken:null,account:null}),route,api.getAuthContextVersion,router))
 model.onApiOffline();model.onApiOffline();assert.deepEqual(calls,[{path:'/offline',query:{from:route.fullPath}}]);finish();await Promise.resolve();await Promise.resolve();route.name='offline';model.onApiOffline();assert.equal(calls.length,1);scope.stop()
 console.log('PASS actual shell handler preserves full path and suppresses concurrent/recursive navigation')
} finally {globalThis.fetch=originalFetch;globalThis.window=originalWindow}
