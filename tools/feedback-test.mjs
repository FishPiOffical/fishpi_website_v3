import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia } from 'pinia'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const state={context:1,token:'first',listeners:[],calls:[],handler:null}
globalThis.__feedback=state
const http=url(`export const getAuthContextVersion=()=>__feedback.context;export const getAccessToken=()=>__feedback.token;export async function refreshAccessToken(){__feedback.token='rotated';for(const f of __feedback.listeners)f();return true}export function onAccessTokenChange(f){__feedback.listeners.push(f);f();return()=>{__feedback.listeners=__feedback.listeners.filter(v=>v!==f)}}`)
const apiSource=(await fs.readFile('src/feedback/api.ts','utf8')).replaceAll("import.meta.env.VITE_FEEDBACK_ENABLED === 'true'",'true').replaceAll('import.meta.env.SSR','false')
const apiURL=url(compile(apiSource).replace("from '@/api/http'",`from '${http}'`))
const api=await import(apiURL)
const oldFetch=globalThis.fetch
globalThis.fetch=async(path,options)=>{state.calls.push({path,options});return state.handler(path,options)}
const storeSource=compile(await fs.readFile('src/feedback/store.ts','utf8')).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replace("from 'pinia'",`from '${import.meta.resolve('pinia')}'`).replace("from '@/api/http'",`from '${http}'`).replace("from './api'",`from '${apiURL}'`)
const {useFeedbackStore}=await import(url(storeSource)),store=useFeedbackStore(createPinia())
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
try {
  Object.assign(store.draft,{title:'有效需求标题',description:'一个足够长度的需求描述文本'})
  state.handler=()=>{throw new Error('body interrupted')}
  await assert.rejects(store.run({path:'/requests',method:'POST',body:store.draft}))
  const original=JSON.stringify(store.pending),key=store.pending.key
  state.token='second';state.listeners.forEach(f=>f())
  assert.equal(JSON.stringify(store.pending),original)
  assert.equal(store.draft.title,'有效需求标题')
  state.handler=()=>response({id:'created'})
  const result=await store.run()
  assert.equal(result.id,'created');assert.equal(state.calls.at(-1).options.headers['Idempotency-Key'],key)
  assert.equal(store.pending,null);assert.equal(store.draft.title,'');store.acknowledge()
  console.log('PASS unknown command keeps frozen body/key through normal token rotation and resumes once')
  let resolve
  state.handler=()=>new Promise(r=>resolve=r)
  const flight=store.run({path:'/requests',method:'POST',body:{title:'another',category:'feature',description:'long enough'}})
  state.context++;state.token='new-owner';state.listeners.forEach(f=>f())
  resolve(response({id:'old-owner'}))
  await assert.rejects(flight)
  assert.equal(store.pending,null);assert.equal(store.result,null);assert.equal(store.busy,false)
  console.log('PASS identity boundary rejects late result and clears pending/private draft')
  state.handler=()=>response({error:'标题不合法'},422)
  await assert.rejects(store.run({path:'/requests',method:'POST',body:{title:'x'}}))
  assert.equal(store.pending,null)
  console.log('PASS pre-commit validation errors allow correcting draft')
  let count=0;state.handler=()=>++count===1?response({error:'expired'},401):response({vote:'none',canModerate:false})
  await api.feedbackApi('/requests/id/me',{private:true})
  assert.equal(state.calls.at(-1).options.headers.Authorization,'Bearer rotated')
  assert.equal(state.calls.at(-1).options.credentials,'omit')
  state.handler=()=>response({items:[],total:0})
  await api.feedbackApi('/requests')
  assert.equal(state.calls.at(-1).options.headers.Authorization,undefined)
  assert.ok(state.calls.every(c=>c.path.startsWith('/feedback-api/v1/')))
  console.log('PASS private requests refresh memory token, omit cookies; public reads omit Bearer')
} finally {globalThis.fetch=oldFetch}
