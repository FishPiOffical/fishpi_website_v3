import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import ts from 'typescript'
import { ref } from 'vue'
import { createPinia, defineStore } from 'pinia'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll("from './mode'", "from 'data:text/javascript,export%20function%20getApiMode()%7Breturn%20%22v3%22%7D'")
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const received=[];let cut=true,bodyReadStarted
const server=http.createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk)
 received.push({path:req.url,method:req.method,key:req.headers['idempotency-key'],body:Buffer.concat(chunks).toString()})
 if(req.url==='/api/v3/auth/refresh'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"code":0,"data":{"accessToken":"synthetic-rotated"}}');return}
 const format=req.url.split('/').pop()
 if(format==='error'){res.writeHead(422,{'Content-Type':'application/json'});res.end('{"code":"invalid_request","msg":"Rejected"}');return}
 if(format==='malformed'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{');return}
 const types={json:'application/json',zip:'application/zip',svg:'image/svg+xml',text:'text/plain',abort:'application/json',reward:'application/json'}
 const bodies={json:'{"code":0,"data":{"id":"2","rewarded":true}}',zip:'fixture private zip',svg:'<svg xmlns="http://www.w3.org/2000/svg"></svg>',text:'complete text',abort:'{"code":0}',reward:'{"code":0,"data":{"id":"2","rewarded":true}}'}
 const body=bodies[format];res.writeHead(200,{'Content-Type':types[format],'Content-Length':Buffer.byteLength(body)})
 if(cut||format==='abort'){
  res.write(body.slice(0,1));res.flushHeaders();setTimeout(()=>res.destroy(),35)
 }else res.end(body)
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const address=server.address(),base=`http://127.0.0.1:${address.port}`
const nativeFetch=globalThis.fetch,oldWindow=globalThis.window;const offline=[]
globalThis.fetch=async(path,init)=>{
 const response=await nativeFetch(new URL(path,base),init)
 if(path.endsWith('/abort')){
  const read=response.text.bind(response)
  response.text=()=>{const pending=read();bodyReadStarted?.();return pending}
 }
 return response
}
globalThis.window={dispatchEvent:event=>offline.push(event.type)}
const source=compile(await fs.readFile('src/api/http.ts','utf8')).replaceAll('import.meta.env.SSR','false').replaceAll('import.meta.env.VITE_API_TARGET',"''").replace("from '@/utils/riskCaptcha'",`from '${url('export async function ensureRiskCaptcha(){throw Error("Unexpected captcha")}')}'`)
try{
 const httpURL=url(source),api=await import(httpURL);api.setAccessToken('synthetic-test-only')
 await assert.rejects(api.request('/api/v3/fixture/json',{method:'POST',headers:{'Idempotency-Key':'original-key'},body:'{}'}),e=>e instanceof api.ApiError&&e.status===0&&e.code==='offline')
 assert.equal(received.length,1);assert.equal(offline.length,1);assert.equal(api.getAccessToken(),'synthetic-test-only')
 cut=false
 assert.deepEqual(await api.request('/api/v3/fixture/json',{method:'POST',headers:{'Idempotency-Key':'original-key'},body:'{}'}),{code:0,data:{id:'2',rewarded:true}})
 assert.equal(received.length,2);assert.ok(received.every(x=>x.key==='original-key'&&x.body==='{}'))
 console.log('PASS HTTP body 1 actual socket closes after JSON headers: stable offline error, no implicit mutation retry/token clearing; explicit retry preserves key/body')
 for(const format of ['zip','svg','text']){
  cut=true;const before=offline.length
  const read=()=>format==='zip'?api.requestZip('/api/v3/fixture/zip'):format==='svg'?api.requestSvg('/api/v3/fixture/svg'):api.requestText('/api/v3/fixture/text')
  await assert.rejects(read(),e=>e instanceof api.ApiError&&e.status===0&&e.code==='offline');assert.equal(offline.length,before+1)
  cut=false;const full=await read();assert.equal(typeof full==='string'?full:await full.text(),format==='zip'?'fixture private zip':format==='svg'?'<svg xmlns="http://www.w3.org/2000/svg"></svg>':'complete text')
 }
 console.log('PASS HTTP body 2 actual truncated ZIP/SVG/text streams return offline instead of partial files/raw exceptions; subsequent full reads succeed')
 const before=offline.length;const controller=new AbortController();const ready=new Promise(resolve=>bodyReadStarted=resolve)
 const cancelled=api.request('/api/v3/fixture/abort',{signal:controller.signal});const rejection=assert.rejects(cancelled,e=>e instanceof api.ApiError&&e.status===0&&e.code==='aborted')
 await ready;controller.abort();await rejection;assert.equal(offline.length,before);bodyReadStarted=null
 console.log('PASS HTTP body 3 cancellation during body read remains aborted and does not publish an offline event')
 await assert.rejects(api.request('/api/v3/fixture/error'),e=>e instanceof api.ApiError&&e.status===422&&e.code==='invalid_request')
 await assert.rejects(api.request('/api/v3/fixture/malformed'),e=>e instanceof api.ApiError&&e.status===200&&e.code!=='offline')
 assert.equal(offline.length,before)
 console.log('PASS HTTP body 4 complete business errors and malformed complete JSON retain existing classification, not network failure')
 const wireMode=url("export const getApiMode=()=> 'v3'"),wireLegacy=url('export async function legacyVersionedRequest(){throw Error("unexpected classic request")}')
 const interactionURL=url(compile(await fs.readFile('src/api/v3-article-interactions.ts','utf8')).replace("from './http'",`from '${httpURL}'`).replace("from './legacy/versioned'",`from '${wireLegacy}'`))
 const useWireAuth=defineStore('wire-auth',()=>({accessToken:ref(api.getAccessToken()),account:ref({oId:'1'}),async reloadAccount(){}}))
 globalThis.__wireAuth=useWireAuth
 const shimAuth=url('export const useAuthStore=globalThis.__wireAuth'),keys=url('export function profileOperationKey(){return "wire-original-key"}')
 let storeCode=compile(await fs.readFile('src/stores/v3ArticleInteractions.ts','utf8')).replaceAll('import.meta.env.SSR','false')
 for(const [name,target]of [['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/mode',wireMode],['@/api/http',httpURL],['@/stores/auth',shimAuth],['@/api/v3-profile',keys],['@/api/v3-article-interactions',interactionURL]])storeCode=storeCode.replaceAll(`from '${name}'`,`from '${target}'`)
 const {useV3ArticleInteractionsStore}=await import(url(storeCode)),pinia=createPinia(),owner=useWireAuth(pinia),store=useV3ArticleInteractionsStore(pinia)
 const stop=api.onAccessTokenChange(value=>owner.accessToken=value)
 const route='/api/v3/articles/2/reward';cut=true
 await assert.rejects(store.set('reward','2',null),e=>e instanceof api.ApiError&&e.code==='offline')
 assert.equal(store.commands['reward:2'].key,'wire-original-key');assert.equal(store.commands['reward:2'].busy,false);assert.match(store.commands['reward:2'].error,/读取中断/)
 const revision=api.getAuthContextVersion();assert.equal(await api.refreshAccessToken(),true);assert.equal(api.getAuthContextVersion(),revision);assert.equal(owner.accessToken,'synthetic-rotated');assert.equal(store.commands['reward:2'].key,'wire-original-key')
 assert.equal(received.filter(x=>x.path===route).length,1)
 cut=false;await store.set('reward','2',null);assert.equal(store.commands['reward:2'],undefined);assert.equal(store.lastChange.targetId,'2')
 const writes=received.filter(x=>x.path===route);assert.equal(writes.length,2);assert.ok(writes.every(x=>x.key==='wire-original-key'&&x.body===''))
 stop();store.$dispose();delete globalThis.__wireAuth
 console.log('PASS HTTP body 5 actual Pinia + production API/transport retain the unknown purchase key across real socket loss and normal token refresh, then explicit same-key recovery clears it')

}finally{globalThis.fetch=nativeFetch;globalThis.window=oldWindow;server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
