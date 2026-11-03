import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import ts from 'typescript'
import { ref, reactive, watch, effectScope } from 'vue'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const bodyWaiters=new Map(),requestWaiters=new Map();let refreshCount=0,rejectRefresh=false,heldLoginResponse
const server=http.createServer((req,res)=>{
 if(req.url==='/api/v3/auth/refresh'){if(rejectRefresh){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"code":"unauthorized","msg":"expired"}');return}res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({code:0,data:{accessToken:'synthetic-rotated-'+(++refreshCount)}}));return}
 if(req.url==='/api/v3/auth/login'){heldLoginResponse=res;requestWaiters.get(req.url)?.();requestWaiters.delete(req.url);return}
 if(req.url==='/api/v3/auth/logout'){res.writeHead(200,{'Content-Type':'application/json','Content-Length':50});res.write('{');res.flushHeaders();setTimeout(()=>res.destroy(),40);return}
 const format=req.url.split('/').pop()
 if(format==='fetch-loss'){requestWaiters.get(req.url)?.();requestWaiters.delete(req.url);setTimeout(()=>res.destroy(),30);return}
 const types={json:'application/json',text:'text/plain',zip:'application/zip',svg:'image/svg+xml'},bodies={json:'{"code":0,"data":{}}',text:'text body',zip:'private ZIP fixture',svg:'<svg xmlns="http://www.w3.org/2000/svg"></svg>'}
 assert.ok(types[format]);res.writeHead(200,{'Content-Type':types[format],'Content-Length':Buffer.byteLength(bodies[format])});res.write(bodies[format].slice(0,1));res.flushHeaders();setTimeout(()=>res.destroy(),40)
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port
const originalFetch=globalThis.fetch,oldWindow=globalThis.window,events=[]
globalThis.fetch=async(path,init)=>{
 const response=await originalFetch(new URL(path,base),init),signal=()=>{bodyWaiters.get(path)?.();bodyWaiters.delete(path)}
 const text=response.text.bind(response);response.text=()=>{const pending=text();signal();return pending}
 if(response.body){const getReader=response.body.getReader.bind(response.body);response.body.getReader=(...args)=>{const reader=getReader(...args),read=reader.read.bind(reader);reader.read=(...a)=>{const pending=read(...a);signal();return pending};return reader}}
 return response
}
globalThis.window={dispatchEvent:event=>events.push(event.type)}
try{
 const source=compile(await fs.readFile('src/api/http.ts','utf8')).replaceAll('import.meta.env.SSR','false').replaceAll('import.meta.env.VITE_API_TARGET',"''").replace("from '@/utils/riskCaptcha'",`from '${url('export async function ensureRiskCaptcha(){throw Error("Unexpected captcha")}')}'`),api=await import(url(source))
 const read=(format,path)=>format==='zip'?api.requestZip(path):format==='svg'?api.requestSvg(path):format==='text'?api.requestText(path):api.request(path)
 for(const format of ['json','text','zip','svg']){
  api.setAccessToken('synthetic-old-reader');const before=events.length,path='/api/v3/offline-fixture/'+format,ready=new Promise(resolve=>bodyWaiters.set(path,resolve))
  const pending=read(format,path),rejected=assert.rejects(pending,e=>e instanceof api.ApiError&&e.code==='offline')
  await ready;api.setAccessToken('synthetic-new-reader');await rejected
  assert.equal(events.length,before,'stale '+format+' body failure reached new identity');assert.equal(api.getAccessToken(),'synthetic-new-reader')
 }
 console.log('PASS offline identity 1 actual JSON/text/ZIP/SVG body loss after identity switch still rejects caller but cannot notify the new reader')
 for(const text of [false,true]){
  api.setAccessToken('synthetic-old-reader');const before=events.length,path='/api/v3/offline-fixture/fetch-loss',ready=new Promise(resolve=>requestWaiters.set(path,resolve))
  const pending=text?api.requestText(path):api.request(path),rejected=assert.rejects(pending,e=>e instanceof api.ApiError&&e.code==='offline')
  await ready;api.setAccessToken(null);await rejected;assert.equal(events.length,before)
 }
 console.log('PASS offline identity 2 actual pre-header socket failure after logout is fenced for both JSON and text transports')
 api.setAccessToken('synthetic-current');const before=events.length,version=api.getAuthContextVersion(),path='/api/v3/offline-fixture/json',ready=new Promise(resolve=>bodyWaiters.set(path,resolve))
 const pending=api.request(path),rejected=assert.rejects(pending,e=>e instanceof api.ApiError&&e.code==='offline')
 await ready;assert.equal(await api.refreshAccessToken(),true);await rejected;assert.equal(api.getAuthContextVersion(),version);assert.equal(events.length,before+1)
 console.log('PASS offline identity 3 ordinary token refresh retains identity, so a genuine current-reader failure still notifies once')
 for(const hadToken of [false,true]){
  api.setAccessToken(hadToken?'synthetic-expiring-reader':null)
  const before=events.length,version=api.getAuthContextVersion(),ready=new Promise(resolve=>bodyWaiters.set(path,resolve))
  const pending=api.request(path),rejected=assert.rejects(pending,e=>e instanceof api.ApiError&&e.code==='offline')
  await ready;rejectRefresh=hadToken;assert.equal(await api.refreshAccessToken(),!hadToken);assert.equal(api.getAuthContextVersion(),version);await rejected
  assert.equal(events.length,before,'token-presence identity change leaked stale network notice');assert.equal(Boolean(api.getAccessToken()),!hadToken);rejectRefresh=false
 }
 console.log('PASS offline identity 4 initial credential restore or definitive refresh rejection fences old guest/signed-in requests even without a version increment')

 const shell=await fs.readFile('src/layouts/AppShell.vue','utf8'),start=shell.indexOf('const apiOffline ='),end=shell.indexOf('\nonMounted(',start);assert.ok(start>=0&&end>start)
 api.setAccessToken('synthetic-shell-reader')
 const scope=effectScope(),auth=reactive({accessToken:api.getAccessToken(),account:{oId:'1'}}),route=reactive({name:'home'})
 const stop=api.onAccessTokenChange(token=>auth.accessToken=token)
 const model=scope.run(()=>new Function('ref','watch','auth','route','getAuthContextVersion',compile(shell.slice(start,end))+';return {apiOffline,onApiOffline}')(ref,watch,auth,route,api.getAuthContextVersion))
 model.onApiOffline();assert.equal(model.apiOffline.value,true);await api.refreshAccessToken();assert.equal(model.apiOffline.value,true)
 api.setAccessToken(null);assert.equal(model.apiOffline.value,false)
 model.onApiOffline();api.setAccessToken('synthetic-login-same-actor');assert.equal(model.apiOffline.value,false)
 model.onApiOffline();auth.account={oId:'2'};assert.equal(model.apiOffline.value,false)
 api.setAccessToken(null);model.onApiOffline();await api.refreshAccessToken();assert.equal(model.apiOffline.value,false,'initial restore must clear prior guest notice')
 model.onApiOffline();rejectRefresh=true;await api.refreshAccessToken();assert.equal(model.apiOffline.value,false,'definitive credential loss must clear prior signed-in notice');rejectRefresh=false

 route.name='offline';model.onApiOffline();assert.equal(model.apiOffline.value,false)
 stop();scope.stop()
 console.log('PASS offline identity 5 actual shell notice survives ordinary refresh, clears on logout/relogin/actor switch, and stays hidden on offline route')
 api.setAccessToken('synthetic-before-queue');const oldNoticeCount=events.length
 const loginStarted=new Promise(resolve=>requestWaiters.set('/api/v3/auth/login',resolve)),login=api.request('/api/v3/auth/login',{method:'POST',body:'{}'})
 await loginStarted
 const logout=api.request('/api/v3/auth/logout',{method:'POST'}),queuedFailure=assert.rejects(logout,e=>e instanceof api.ApiError&&e.code==='offline')
 api.setAccessToken('synthetic-after-queue')
 heldLoginResponse.writeHead(200,{'Content-Type':'application/json'});heldLoginResponse.end('{"code":0,"data":{}}');await login;await queuedFailure
 assert.equal(events.length,oldNoticeCount,'queued old credential request borrowed the new identity for its network notice')
 console.log('PASS offline identity 6 serialized credential request keeps caller identity while queued; late failure cannot borrow a newer login identity')

}finally{globalThis.fetch=originalFetch;globalThis.window=oldWindow;server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
