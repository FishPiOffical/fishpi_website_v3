import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import { once } from 'node:events'
import ts from 'typescript'
import { apiProxy, requestMode, backendTarget } from '../server/api-mode.ts'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const calls=[]
const v1=http.createServer((req,res)=>{calls.push({version:'v1',url:req.url,headers:req.headers});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version:'v1'}))}).listen(0,'127.0.0.1')
const v3=http.createServer((req,res)=>{calls.push({version:'v3',url:req.url,headers:req.headers});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version:'v3'}))}).listen(0,'127.0.0.1')
await Promise.all([once(v1,'listening'),once(v3,'listening')])
const env={VITE_API_MODE:'v1',VITE_API_V1_TARGET:`http://127.0.0.1:${v1.address().port}`,VITE_API_V3_TARGET:`http://127.0.0.1:${v3.address().port}`}
const proxy=http.createServer((req,res)=>apiProxy(env)(req,res,()=>{res.writeHead(404);res.end()})).listen(0,'127.0.0.1');await once(proxy,'listening')
const base=`http://127.0.0.1:${proxy.address().port}`
try {
  const a=await fetch(base+'/api/user',{headers:{Cookie:'fp.apiMode=v1; fp_v3_refresh=synthetic-refresh; harmless=1',Authorization:'Bearer v3-only'}})
  assert.equal((await a.json()).version,'v1');assert.equal(calls.at(-1).headers.authorization,undefined);assert.equal(calls.at(-1).headers.cookie,'harmless=1')
  const b=await fetch(base+'/api/v3/me',{headers:{Cookie:'fp.apiMode=v3',Authorization:'Bearer synthetic-v3'}})
  assert.equal((await b.json()).version,'v3');assert.equal(calls.at(-1).headers.authorization,'Bearer synthetic-v3')
  const before=calls.length,c=await fetch(base+'/api/v3/me',{headers:{Cookie:'fp.apiMode=v1'}})
  assert.equal(c.status,501);assert.equal(calls.length,before)
  assert.equal(requestMode({headers:{cookie:'fp.apiMode=bad'}},env),'v1')
  assert.equal(backendTarget('v3',env),env.VITE_API_V3_TARGET)
  const legacyProfile=await fetch(base+'/user/known',{headers:{Cookie:'fp.apiMode=v1',Authorization:'Bearer must-not-forward'}})
  assert.equal((await legacyProfile.json()).version,'v1');assert.equal(calls.at(-1).headers.authorization,undefined)
  const legacyPost=await fetch(base+'/breezemoon',{method:'POST',headers:{Cookie:'fp.apiMode=v1','Content-Type':'application/json'},body:JSON.stringify({apiKey:'synthetic-legacy',breezemoonContent:'synthetic'})})
  assert.equal((await legacyPost.json()).version,'v1')
  for(const path of ['/article/random/8','/activity/yesterday-liveness-reward-api','/notifications/unread/count','/notifications/all-read','/notifications/make-read/at','/chat/has-unread','/chat/mark-all-as-read','/users/emotions','/chat-room/more?page=1&type=html','/chat-room/node/get']){
    const response=await fetch(base+path+(path.includes('?')?'&':'?')+'apiKey=synthetic',{headers:{Cookie:'fp.apiMode=v1; fp_v3_refresh=private',Authorization:'Bearer must-not-forward'}})
    assert.equal((await response.json()).version,'v1');assert.equal(calls.at(-1).headers.authorization,undefined);assert.ok(!calls.at(-1).headers.cookie?.includes('fp_v3_refresh'))
  }
  for(const path of ['/markdown','/users/names','/follow/user','/unfollow/user','/report','/comment','/comment/paragraph','/article/reaction','/comment/reaction','/comment/paragraph/thread/parents','/comment/paragraph/summary','/comment/thread/replies']){
    const response=await fetch(base+path,{method:'POST',headers:{Cookie:'fp.apiMode=v1; fp_v3_refresh=private',Authorization:'Bearer must-not-forward','Content-Type':'application/json'},body:JSON.stringify({name:'test',markdownText:'read-only fixture'})})
    assert.equal((await response.json()).version,'v1');assert.equal(calls.at(-1).headers.authorization,undefined);assert.ok(!calls.at(-1).headers.cookie?.includes('fp_v3_refresh'))
  }
  console.log('PASS actual dual proxy: deterministic targets, credential isolation, explicit unported capability, invalid mode fallback')
} finally {await Promise.all([proxy,v1,v3].map(s=>new Promise(r=>s.close(r))))}
const originalDocument=globalThis.document,originalLocation=globalThis.location
let reload=0
try {
  globalThis.document={cookie:'fp.apiMode=v1'};globalThis.location={protocol:'http:',reload:()=>reload++}
  const mode=await import(url(compile((await fs.readFile('src/api/mode.ts','utf8')).replaceAll('import.meta.env.SSR','false').replaceAll("import.meta.env.VITE_API_MODE",'"v3"'))))
  assert.equal(mode.getApiMode(),'v1');mode.switchApiMode('v1');assert.equal(reload,0)
  mode.switchApiMode('v3');assert.equal(reload,1);assert.match(document.cookie,/fp.apiMode=v3; Path=\//)
  assert.equal(mode.parseApiMode('unrelated=1','v3'),'v3')
  console.log('PASS mode switch persists only a non-secret preference and reloads the entire application')
} finally {globalThis.document=originalDocument;globalThis.location=originalLocation}
// Exercise actual legacy auth projection with a synthetic transport, never a real login.
globalThis.__legacyAuthCalls=[]
const shim=url(`export class ApiError extends Error{constructor(m,status){super(m);this.status=status}}export async function request(path,init){__legacyAuthCalls.push({path,init});if(path==='/api/getKey')return{code:0,Key:'synthetic-legacy-key'};return{code:0,data:{oId:'7',userName:'test',userPassword:'must-not-project',userNickname:'昵称',userPoint:0}}}`)
const auth=await import(url(compile(await fs.readFile('src/api/legacy/auth.ts','utf8')).replace("from '../http'",`from '${shim}'`).replace("from 'js-md5'",`from '${import.meta.resolve('js-md5')}'`)))
const key=await auth.legacyLogin('test','synthetic-password','')
assert.equal(key,'synthetic-legacy-key');assert.equal(auth.getLegacyKey(),null)
const account=await auth.legacyAccount(key);assert.equal(account.oId,'7');assert.equal(account.userPoint,0);assert.equal(account.userPassword,undefined)
auth.setLegacyKey(key);assert.equal(auth.getLegacyKey(),key);auth.setLegacyKey(null)
console.log('PASS legacy login uses getKey once, only projects shell fields and keeps legacy key separate from Bearer')
// Actual Pinia auth store selects exactly one protocol; no real password login.
const {createPinia}=await import('pinia')
const authState={mode:'v1',context:0,token:null,listeners:[],calls:[],legacy:null}
globalThis.__modeAuth=authState
const modeURL=url('export const getApiMode=()=>__modeAuth.mode')
const httpURL=url(`export class ApiError extends Error{constructor(m,s){super(m);this.status=s}}export const getAccessToken=()=>__modeAuth.token;export function getAuthContextVersion(){return __modeAuth.context}export function setAccessToken(t){__modeAuth.context++;__modeAuth.token=t;for(const f of __modeAuth.listeners)f(t)}export function onAccessTokenChange(f){__modeAuth.listeners.push(f);f(__modeAuth.token);return()=>{}}export async function refreshAccessToken(){__modeAuth.calls.push('refresh');return false}export const wasRefreshRejected=()=>true;export async function request(p){__modeAuth.calls.push(p);if(p==='/api/v3/me')return{code:0,data:{id:'v3-id',userName:'v3-user'}};return{code:0,data:{active:false}}}`)
const legacyURL=url(`export function setLegacyKey(k){__modeAuth.legacy=k}export async function legacyLogin(){__modeAuth.calls.push('legacy-login');return'synthetic-v1'}export async function legacyAccount(k){__modeAuth.calls.push('legacy-me');if(k!=='synthetic-v1')throw Error('wrong protocol');return{oId:'v1-id',userName:'v1-user'}}`)
const fishpiURL=url(`export async function login(){__modeAuth.calls.push('v3-login');return'synthetic-v3'}`)
let authSource=compile((await fs.readFile('src/stores/auth.ts','utf8')).replaceAll('import.meta.env.SSR','false'))
for(const [from,to]of [['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/mode',modeURL],['@/api/http',httpURL],['@/api/legacy/auth',legacyURL],['@/api/fishpi',fishpiURL],['@/utils/swr',url('export function clearCache(){}')]]) authSource=authSource.replaceAll(`from '${from}'`,`from '${to}'`)
const {useAuthStore}=await import(url(authSource)),legacyStore=useAuthStore(createPinia())
await legacyStore.restore();assert.equal(legacyStore.initialized,true);assert.deepEqual(authState.calls,[])
await legacyStore.login('synthetic','synthetic','');assert.equal(legacyStore.isLoggedIn,true);assert.equal(legacyStore.accessToken,null);assert.equal(legacyStore.apiKey,'synthetic-v1');assert.deepEqual(authState.calls,['legacy-login','legacy-me'])
await legacyStore.logout();assert.equal(authState.legacy,null);assert.equal(legacyStore.isLoggedIn,false);assert.ok(!authState.calls.some(x=>x.startsWith('/api/v3')))
authState.mode='v3';authState.calls=[]
const v3Store=useAuthStore(createPinia());await v3Store.login('synthetic','synthetic','');assert.equal(v3Store.isLoggedIn,true);assert.equal(v3Store.apiKey,null);assert.equal(v3Store.accessToken,'synthetic-v3');assert.equal(v3Store.account.oId,'v3-id');assert.ok(!authState.calls.some(x=>x.startsWith('legacy')))
console.log('PASS actual Pinia authentication: v1 restore/login/logout never calls v3; v3 login remains Bearer-only')
const ssrModeURL=url(compile((await fs.readFile('src/api/mode.ts','utf8')).replaceAll('import.meta.env.SSR','true').replaceAll('import.meta.env.VITE_API_MODE','"v3"')))
const ssrMode=await import(ssrModeURL)
const {apiModeContext}=await import(url(compile(await fs.readFile('src/api/server-mode.ts','utf8')).replace("from './mode'",`from '${ssrModeURL}'`)))
let release
const hold=new Promise(r=>release=r)
const older=apiModeContext.run('v1',async()=>{await hold;return ssrMode.getApiMode()})
const newer=await apiModeContext.run('v3',async()=>{await Promise.resolve();return ssrMode.getApiMode()})
release();assert.equal(await older,'v1');assert.equal(newer,'v3');assert.equal(ssrMode.getApiMode(),'v3')
console.log('PASS actual SSR AsyncLocalStorage isolates overlapping v1/v3 renders without a process-global current mode')
