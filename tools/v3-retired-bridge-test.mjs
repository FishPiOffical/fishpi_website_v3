import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import { spawn } from 'node:child_process'
import path from 'node:path'
import ts from 'typescript'
const root=process.cwd(),calls=[]
const upstream=http.createServer(async(req,res)=>{let body='';for await(const b of req)body+=b;calls.push({url:req.url,method:req.method,body});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:0,data:{fixture:true}}))})
await new Promise(r=>upstream.listen(0,'127.0.0.1',r));const target=`http://127.0.0.1:${upstream.address().port}`
async function unusedPort(){const s=http.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p}
async function start(mode){const port=await unusedPort(),child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,NODE_ENV:mode,PORT:String(port),VITE_API_TARGET:target},stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{clearInterval(poll);reject(Error('server startup timeout: '+log.slice(-1000)))},20000),poll=setInterval(()=>{if(log.includes('FishPi SSR http://127.0.0.1:'+port)){clearInterval(poll);clearTimeout(timeout);resolve()}},20);child.once('exit',code=>{clearInterval(poll);clearTimeout(timeout);reject(Error('server exited '+code+': '+log.slice(-1000)))})}).catch(async e=>{child.kill('SIGTERM');throw e});return{child,url:`http://127.0.0.1:${port}`}}
async function stop(child){if(child.exitCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await done}
try{
 for(const mode of ['production','development']){
  const {child,url}=await start(mode)
  try{
   const before=calls.length
   for(const method of ['GET','HEAD','POST']){const response=await fetch(url+'/__fp/page-auth',{method,...(method==='POST'?{headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:'RETIRED_BRIDGE_SENTINEL'})}:{})});assert.equal(response.status,404);assert.equal(response.headers.get('set-cookie'),null);await response.text()}
   assert.equal(calls.length,before);console.log('PASS retired bridge '+(mode==='production'?1:2)+' actual '+mode+' Node server rejects GET/HEAD/POST bridge with no cookie or upstream exchange')
   if(mode==='development'){
    const before=calls.length
    const legacy=await fetch(url+'/loginWebInApiKey?apiKey=RETIRED_BRIDGE_SENTINEL');assert.equal(legacy.status,404);assert.equal(legacy.headers.get('set-cookie'),null);await legacy.text();assert.equal(calls.length,before)
    console.log('PASS retired bridge 3 actual Vite middleware no longer forwards the legacy cookie exchange route')
    const body=JSON.stringify({probe:'UNCONSUMED_BODY'});const api=await fetch(url+'/api/v3/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(api.status,200);assert.deepEqual(calls.at(-1),{url:'/api/v3/auth/logout',method:'POST',body})
    const captcha=await fetch(url+'/validateCaptcha',{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(captcha.status,200);assert.deepEqual(calls.at(-1),{url:'/validateCaptcha',method:'POST',body});console.log('PASS retired bridge 4 existing v3 and captcha development proxies preserve POST body to isolated upstream')
   }
  }finally{await stop(child)}
 }
 const source=await fs.readFile('src/api/fishpi.ts','utf8'),tree=ts.createSourceFile('fishpi.ts',source,ts.ScriptTarget.Latest,true),remaining=tree.statements.filter(ts.isFunctionDeclaration).filter(n=>n.modifiers?.some(x=>x.kind===ts.SyntaxKind.ExportKeyword)).map(n=>n.name.text).sort();assert.deepEqual(remaining,['emojiToMarkdown','fetchArticle','fetchRepeaterItems','login','normalizeMetals','validateRiskCaptcha'].sort());for(const token of ["'./pageAuth'",'/api/user',"'/api/settings",'/api/membership','/api/medal','/api/profession','/api/breezemoons'])assert.ok(!source.includes(token));console.log('PASS retired bridge 5 compatibility module keeps only six current helpers, no retired business API implementation')
 const shell=await fs.readFile('src/layouts/AppShell.vue','utf8'),server=await fs.readFile('server.js','utf8'),vite=await fs.readFile('vite.config.ts','utf8'),nginx=await fs.readFile('docs/nginx.example.conf','utf8');assert.ok(!shell.includes('pageAuth')&&!shell.includes('openRhythm')&&!shell.includes('auth.apiKey'));for(const value of ['exchangePageAuth','csrfFromSymCe','extractCsrfToken','loginWebInApiKey','express.json('])assert.ok(!server.includes(value));assert.ok(server.includes("value.startsWith('fp_feedback_visitor=')"));assert.ok(!vite.includes('loginWebInApiKey')&&!nginx.includes('loginWebInApiKey'));await assert.rejects(fs.access('src/api/pageAuth.ts'));console.log('PASS retired bridge 6 shell uses native anchors and bridge/HTML scraping/session storage/cookie issuance removed from source and proxy templates')
}finally{await new Promise(r=>upstream.close(r))}
