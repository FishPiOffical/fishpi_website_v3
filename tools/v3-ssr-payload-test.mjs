import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createSSRApp,h } from 'vue'
import { renderToString } from '@vue/server-renderer'
const source=await fs.readFile('src/seo/payload.ts','utf8'),url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
function module(ssr){return import(url(ts.transpileModule(source.replaceAll('import.meta.env.SSR',String(ssr)),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from 'vue'",`from '${import.meta.resolve('vue')}'`)))}
const server=await module(true),client=await module(false)
client.setSsrPayload({breezemoonPage:{list:[{id:'BAD_GLOBAL'}]}});assert.deepEqual(server.getSsrPayload(),{})
const page=id=>({list:[{id}],p:1,size:20,total:1,pageCount:1})
let release;const barrier=new Promise(resolve=>release=resolve)
function app(id,slow){const payload={breezemoonPage:page(id),homeBreezemoonPage:page(id+'_HOME')},copy=JSON.parse(JSON.stringify(payload));const Read={setup(){const value=server.consumeBreezemoonPagePayload('global'),home=server.consumeBreezemoonPagePayload('home');assert.equal(server.consumeBreezemoonPagePayload('global'),null);return()=>h('p',value.list[0].id+' '+home.list[0].id)}};const root={async setup(){if(slow)await barrier;return()=>h(Read)}};const app=createSSRApp(root);app.provide(server.SSR_PAYLOAD_KEY,payload);return{app,payload,copy}}
const a=app('A_ONLY',true),b=app('B_ONLY',false),ra=renderToString(a.app),rb=await renderToString(b.app);release();const htmlA=await ra
assert.match(htmlA,/A_ONLY A_ONLY_HOME/);assert.ok(!htmlA.includes('B_ONLY')&&!htmlA.includes('BAD_GLOBAL'));assert.match(rb,/B_ONLY B_ONLY_HOME/);assert.ok(!rb.includes('A_ONLY'));assert.equal(a.payload.breezemoonPage,undefined);assert.equal(a.copy.breezemoonPage.list[0].id,'A_ONLY')
console.log('PASS SSR payload 1 overlapping actual Vue renders keep per-app global/home content, ignore process-global data and preserve the pre-render client clone')
client.setSsrPayload({breezemoonPage:page('GLOBAL'),homeBreezemoonPage:page('HOME')});assert.equal(client.consumeBreezemoonPagePayload('home').list[0].id,'HOME');assert.equal(client.consumeBreezemoonPagePayload('global').list[0].id,'GLOBAL');assert.equal(client.consumeBreezemoonPagePayload('home'),null);client.clearSsrPayload();assert.deepEqual(client.getSsrPayload(),{})
console.log('PASS SSR payload 2 browser bootstrap consumes each scope once and clears normally; SSR never uses browser-global state')
const entry=await fs.readFile('src/entry-server.ts','utf8');assert.ok(entry.includes('app.provide(SSR_PAYLOAD_KEY, payload)')&&!entry.includes('setSsrPayload(')&&!entry.includes('fetchBreezemoons('));assert.ok(entry.includes('homeBreezemoonPage: val(7, null)')&&entry.includes('breezemoonPage: await fetchV3Breezemoons(1, 20)'))
console.log('PASS SSR payload 3 actual entry wires request-owned payload and v3 public prefetch for both home and global page')
for(const id of ['A','B']){const payload={article:{oId:id,title:id},member:{userName:id},feed:[{oId:id}],feedKind:'recent',domains:[{id}],tags:[{id}],tagsTotal:1};const app=createSSRApp({setup(){assert.equal(server.consumeArticlePayload('other'),null);assert.equal(server.consumeArticlePayload(id).title,id);assert.equal(server.consumeArticlePayload(id),null);assert.equal(server.consumeMemberPayload(id).userName,id);assert.equal(server.consumeFeedPayload('recent')[0].oId,id);assert.equal(server.consumeDomainsPayload()[0].id,id);assert.equal(server.consumeTagsPayload().tags[0].id,id);return()=>h('p',id)}});app.provide(server.SSR_PAYLOAD_KEY,payload);assert.equal(await renderToString(app),'<p>'+id+'</p>')}
console.log('PASS SSR payload 4 existing article/member/feed/domain/tag consumers keep target binding and one-time consumption within each application')
