import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia } from 'pinia'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const apiURL=url(compile((await fs.readFile('src/feedback/api.ts','utf8')).replaceAll("import.meta.env.VITE_FEEDBACK_ENABLED === 'true'",'true').replaceAll('import.meta.env.SSR','false'))),api=await import(apiURL)
const oldFetch=globalThis.fetch,calls=[];let handler,session='guest:00000000-0000-4000-8000-000000000001',sessions=0
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
globalThis.fetch=async(path,options)=>{calls.push({path,options});if(path.endsWith('/session')){sessions++;return response({id:session,displayName:'访客1'})}return handler(path,options)}
const storeSource=compile(await fs.readFile('src/feedback/store.ts','utf8')).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replace("from 'pinia'",`from '${import.meta.resolve('pinia')}'`).replace("from './api'",`from '${apiURL}'`)
const {useFeedbackStore}=await import(url(storeSource)),store=useFeedbackStore(createPinia())
try{
 await Promise.all([api.ensureFeedbackVisitor(),api.ensureFeedbackVisitor()]);assert.equal(sessions,1)
 Object.assign(store.draft,{title:'有效需求标题',description:'一个足够长度的需求描述文本',displayName:'展示名'})
 handler=()=>{throw Error('lost body')};await assert.rejects(store.run({path:'/requests',method:'POST',body:store.draft}));const original=JSON.stringify(store.pending),key=store.pending.key
 store.draft.title='更改草稿不改变冻结命令';assert.equal(JSON.stringify(store.pending),original)
 handler=()=>response({id:'created'});assert.equal((await store.run()).id,'created');assert.equal(calls.at(-1).options.headers['Idempotency-Key'],key);assert.equal(JSON.parse(calls.at(-1).options.body).title,'有效需求标题');assert.equal(store.pending,null);assert.equal(store.draft.displayName,'展示名');store.acknowledge()
 console.log('PASS independent visitor bootstrap deduplicates; unknown write retains exact original content/key; no site identity required')
 handler=()=>response({error:'标题不合法'},422);await assert.rejects(store.run({path:'/requests',method:'POST',body:{title:'x'}}));assert.equal(store.pending,null)
 handler=()=>response({error:'访客已失效'},401);await assert.rejects(store.run({path:'/requests',method:'POST',body:{title:'another'}}));assert.equal(store.pending,null)
 session='guest:00000000-0000-4000-8000-000000000002';await api.ensureFeedbackVisitor();assert.equal(sessions,2)
 handler=()=>response({id:'second'});await store.run({path:'/requests',method:'POST',body:{title:'second request'}});assert.equal(store.result.id,'second');store.acknowledge()
 assert.ok(calls.every(c=>c.path.startsWith('/feedback-api/v1/')));assert.ok(calls.every(c=>c.options.credentials==='same-origin'&&!c.options.headers.Authorization));assert.ok(!calls.some(c=>c.path.includes('/api/v3')))
 console.log('PASS expired visitor boundary clears unknown command; new visitor never replays old command; private and public use only feedback cookie')
 let release;handler=()=>new Promise(r=>release=r);const delayed=api.feedbackApi('/requests/old/me',{private:true});await new Promise(r=>setImmediate(r));handler=()=>response({error:'expired'},401);await assert.rejects(api.feedbackApi('/requests/current/me',{private:true}));release(response({vote:'support',canModerate:true}));await assert.rejects(delayed,/身份已变化/)
 handler=()=>new Promise(r=>release=r);await api.ensureFeedbackVisitor();const stale=api.feedbackApi('/requests/stale/me',{private:true});await new Promise(r=>setImmediate(r));handler=()=>response({error:'expired'},401);await assert.rejects(api.feedbackApi('/requests/new/me',{private:true}));session='guest:00000000-0000-4000-8000-000000000003';await api.ensureFeedbackVisitor();const count=sessions;release(response({error:'old unauthorized'},401));await assert.rejects(stale);await api.ensureFeedbackVisitor();assert.equal(sessions,count)
 console.log('PASS late personal state cannot populate a changed visitor; old admin flag and vote are rejected')
}finally{globalThis.fetch=oldFetch}
