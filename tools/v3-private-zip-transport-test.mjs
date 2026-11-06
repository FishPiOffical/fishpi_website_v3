import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__zipCaptcha=0
const risk=url('export async function ensureRiskCaptcha(){globalThis.__zipCaptcha++}')
let code=compile(await fs.readFile('src/api/http.ts','utf8')).replace("from '@/utils/riskCaptcha'",`from '${risk}'`).replaceAll('import.meta.env.SSR','false').replaceAll('import.meta.env.VITE_API_TARGET',"''")
const http=await import(url(code)),original=globalThis.fetch,requests=[],zip=new Uint8Array([0x50,0x4b,3,4,1,2,3,4]),json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
let run=async()=>new Response(zip,{headers:{'Content-Type':'application/zip','Content-Length':String(zip.length)}})
globalThis.fetch=async(path,init)=>{requests.push({path,...init});assert.ok(!Object.hasOwn(init,'__zip')&&!Object.hasOwn(init,'__v3Retried'));return run(path,init)}
try{
 http.setAccessToken('old');const context=http.getAuthContextVersion();run=async(path,init)=>path==='/api/v3/auth/refresh'?json({code:0,data:{accessToken:'new'}}):init.headers.get('Authorization')==='Bearer old'?json({code:'unauthorized'},401):new Response(zip,{headers:{'Content-Type':'application/zip'}})
 const blob=await http.requestZip('/api/v3/me/exports/posts/1/download',{cache:'no-store'});assert.equal(blob.type,'application/zip');assert.equal(blob.size,8);assert.equal(http.getAuthContextVersion(),context);assert.equal(http.getAccessToken(),'new');assert.equal(requests.filter(r=>r.path.endsWith('/download')).length,2);assert.ok(requests.every(r=>!r.path.includes('old')&&!r.path.includes('new')))
 console.log('PASS zip transport 1 real HTTP binary branch refreshes expired Bearer once with same identity and never serializes private init flags/token URL')
 run=async()=>json({code:'expired',msg:'expired'},410);await assert.rejects(http.requestZip('/api/v3/me/exports/posts/1/download'),e=>e.status===410)
 for(const response of [()=>json({code:0,data:{url:'https://public.example'}}),()=>new Response('<html>bad</html>',{headers:{'Content-Type':'text/html'}}),()=>new Response(null,{headers:{'Content-Type':'application/zip'}})]){run=response;await assert.rejects(http.requestZip('/api/v3/me/exports/posts/1/download'))}
 console.log('PASS zip transport 2 JSON errors preserve status; JSON success/HTML/empty body can never be saved as ZIP')
 run=async()=>new Response(zip,{headers:{'Content-Type':'application/zip','Content-Length':String(http.MAX_PRIVATE_ZIP_BYTES+1)}});await assert.rejects(http.requestZip('/api/v3/me/exports/posts/1/download'),e=>e.status===502)
 run=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(http.MAX_PRIVATE_ZIP_BYTES+1));controller.close()}}),{headers:{'Content-Type':'application/zip'}});await assert.rejects(http.requestZip('/api/v3/me/exports/posts/1/download'),e=>e.status===502)
 console.log('PASS zip transport 3 declared and streaming bodies both enforce the backend ZIP budget before retaining an oversized archive')
 let challenge=true;run=async()=>{if(challenge){challenge=false;const response=new Response('captcha',{headers:{'Content-Type':'text/html'}});Object.defineProperty(response,'url',{value:'https://fishpi.cn/test'});return response}return new Response(zip,{headers:{'Content-Type':'application/zip'}})};await http.requestZip('/api/v3/me/exports/posts/1/download');assert.equal(__zipCaptcha,1)
 const ctrl=new AbortController();ctrl.abort();run=async()=>{throw new DOMException('Aborted','AbortError')};await assert.rejects(http.requestZip('/api/v3/me/exports/posts/1/download',{signal:ctrl.signal}),e=>e.code==='aborted');await assert.rejects(http.request('/api/v3/me/exports/posts/1',{signal:ctrl.signal}),e=>e.code==='aborted')
 console.log('PASS zip transport 4 existing captcha retry remains active; explicit ZIP/JSON cancellation is distinct from an offline outage (challenge adapter only)')
}finally{globalThis.fetch=original}
