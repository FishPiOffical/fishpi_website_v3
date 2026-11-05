import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const oldFetch=globalThis.fetch,oldWindow=globalThis.window
const state=globalThis.__oldPace={mode:'v1'},calls=[]
const mode=url('export const getApiMode=()=>__oldPace.mode'),risk=url('export async function ensureRiskCaptcha(){throw Error("unexpected captcha")}')
const raw=(await fs.readFile('src/api/http.ts','utf8')).replaceAll('import.meta.env.SSR','false').replaceAll('import.meta.env.VITE_API_TARGET','undefined').replaceAll('import.meta.env.VITE_API_V1_TARGET','undefined').replaceAll('import.meta.env.VITE_API_V3_TARGET','undefined')
const compiled=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from './mode'",`from '${mode}'`).replace("from '@/utils/riskCaptcha'",`from '${risk}'`)
globalThis.window={dispatchEvent(){}};let failNext=false,last=0
globalThis.fetch=async(path,init)=>{const now=Date.now(),detail=/^\/api\/article\/[0-9]+(?:\?|$)/.test(path)&&(!init.method||init.method==='GET');calls.push({path,init,now});if(detail){assert.ok(!last||now-last>=1000,'server IP limiter would reject this read');last=now;if(failNext){failNext=false;return new Response(JSON.stringify({code:503,msg:'fixture503'}),{status:503,headers:{'Content-Type':'application/json'}})}}return new Response(JSON.stringify({code:0}),{headers:{'Content-Type':'application/json'}})}
try{
 const http=await import(url(compiled)),started=Date.now()
 await Promise.all([http.request('/api/article/2?p=1'),http.request('/api/article/2?apiKey=synthetic')]);assert.ok(calls[0].now-started>=1000);assert.ok(calls[1].now-calls[0].now>=1000)
 failNext=true;await assert.rejects(http.request('/api/article/2'),/fixture503/);await http.request('/api/article/3');assert.equal(calls.filter(c=>c.path==='/api/article/2').length,1,'failed read is not automatically replayed')
 const oldCount=calls.length,waiting=http.request('/api/article/4?apiKey=old-owner');http.setAccessToken(null);await assert.rejects(waiting,/登录状态/);assert.equal(calls.length,oldCount)
 const abort=new AbortController(),cancelled=http.request('/api/article/5',{signal:abort.signal});abort.abort();await assert.rejects(cancelled,/取消/);assert.equal(calls.length,oldCount)
 const modeRead=http.request('/api/article/6');state.mode='v3';await assert.rejects(modeRead,/登录状态/);assert.equal(calls.length,oldCount)
 const before=Date.now();await http.request('/api/v3/articles/2');await http.request('/vote/up/article',{method:'POST',body:'{}',__captchaRetried:true});assert.ok(Date.now()-before<1000,'v3 or mutation must not enter the classic GET queue')
 console.log('PASS classic article pacing actual HTTP: shared page/vote GET spacing, initial SSR gap, FIFO failure no replay, queued identity/abort/mode fencing, v3 and writes excluded')
}finally{globalThis.fetch=oldFetch;globalThis.window=oldWindow}
