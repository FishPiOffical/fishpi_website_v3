import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const state=globalThis.__legacyHeat={calls:[],dispatch:null}
const shim=url(`export class ApiError extends Error{constructor(m,status){super(m);this.status=status}}export async function request(path,init){__legacyHeat.calls.push({path,init});return __legacyHeat.dispatch(path,init)}`),mode=url("export const getApiMode=()=> 'v1'")
const api=await import(url(compile(await fs.readFile('src/api/v3-article-heat.ts','utf8')).replace("from './http'",`from '${shim}'`).replace("from './mode'",`from '${mode}'`)))
state.dispatch=async()=>({articleHeat:0});assert.equal(await api.articleHeat('123'),0);assert.equal(state.calls.at(-1).path,'/api/article/heat/123');assert.equal(state.calls.at(-1).init.cache,'no-store');assert.equal(state.calls.at(-1).init.redirect,'error');assert.equal(state.calls.at(-1).init.headers,undefined)
for(const value of [null,{},[],{articleHeat:-1},{articleHeat:'4'},{articleHeat:1.5},{articleHeat:Infinity},{code:0,data:{heat:3}}]){state.dispatch=async()=>value;await assert.rejects(()=>api.articleHeat('123'),e=>e.status===502)}
state.dispatch=async()=>{throw Error('read failed')};await assert.rejects(()=>api.articleHeat('123'),/read failed/);const before=state.calls.length;await assert.rejects(()=>api.articleHeat('../3'),e=>e.status===422);assert.equal(state.calls.length,before)
console.log('PASS legacy heat exact existing public JSON path, no credentials or synthetic membership, real zero versus malformed/error, bounded integer and invalid ID')
const source=await fs.readFile('src/views/ArticleView.vue','utf8'),read=source.slice(source.indexOf('async function refreshHeat()'),source.indexOf('\nasync function load(force=false,')),connect=source.slice(source.indexOf('function connectHeat()'),source.indexOf('\nasync function readArticleChanges()'))
function harness(){const cell=value=>({value}),env={heat:cell(null),heatError:cell(''),viewerIdentity:cell('owner-A'),id:cell('123'),article:cell({oId:'123'}),apiKey:cell('synthetic-key'),accessToken:cell(null),ssr:false,calls:[],dispatch:async()=>4}
const fn=new Function('env',`const {heat,heatError,viewerIdentity,id,article,apiKey,accessToken}=env;let heatRequest=null,heatSequence=0;const getApiMode=()=> 'v1',articleHeat=async(...args)=>{env.calls.push(args);return env.dispatch(...args)};${compile((read+'\n'+connect).replaceAll('import.meta.env.SSR','env.ssr'))};return{refreshHeat,connectHeat,cancel(){heatSequence++;heatRequest?.abort();heatRequest=null;heat.value=null;heatError.value=''}}`)(env);return Object.assign(env,fn)}
let v=harness();await v.refreshHeat();assert.equal(v.heat.value,4);assert.equal(v.calls.length,1);v.connectHeat();assert.equal(v.calls.length,1)
v.dispatch=async()=>{throw Error('unavailable')};await v.refreshHeat();assert.equal(v.heat.value,null);assert.equal(v.heatError.value,'热度暂不可用');v.dispatch=async()=>0;await v.refreshHeat();assert.equal(v.heat.value,0);assert.equal(v.heatError.value,'')
let finish;v.dispatch=()=>new Promise(r=>finish=r);const late=v.refreshHeat();v.viewerIdentity.value='owner-B';finish(7);await late;assert.equal(v.heat.value,null)
const cancelled=v.refreshHeat();const signal=v.calls.at(-1)[1];v.cancel();assert.equal(signal.aborted,true);finish(9);await cancelled;assert.equal(v.heat.value,null)
for(const setup of [v=>v.apiKey.value=null,v=>v.ssr=true,v=>v.article.value=null,v=>v.article.value={oId:'999'}]){v=harness();setup(v);await v.refreshHeat();assert.equal(v.calls.length,0)}
assert.ok(source.includes("getApiMode()==='v1'?'经典节点':'本节点'"));assert.equal((source.match(/heatNodeLabel }}约/g)||[]).length,2)
console.log('PASS actual parent v1 key without Bearer reads heat, zero preserved/error retry, reader/abort discard, guest/SSR/wrong target zero read, no legacy socket and both readers use accurate classic-node label')
