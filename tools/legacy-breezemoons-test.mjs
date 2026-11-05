import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import {createPinia,defineStore} from 'pinia'
import {ref} from 'vue'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const replace=(s,pairs)=>{for(const[a,b]of pairs)s=s.replaceAll(`from '${a}'`,`from '${b}'`);return s}
const state=globalThis.__legacyMoon={calls:[],version:1,key:'synthetic-legacy',dispatch:null,profiles:[],profileDispatch:null}
const http=url(`export class ApiError extends Error{constructor(m,s){super(m);this.status=s}}export const getAuthContextVersion=()=>__legacyMoon.version;export async function request(p,init){__legacyMoon.calls.push({p,init});return __legacyMoon.dispatch(p,init)}`)
const auth=url('export const getLegacyKey=()=>__legacyMoon.key')
const home=url(`export function legacyObject(v){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid');return v}export function legacyDate(v){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw Error('invalid');return v}`)
const profiles=url(`export async function fetchPublicUser(name){__legacyMoon.profiles.push(name);if(__legacyMoon.profileDispatch)return __legacyMoon.profileDispatch(name);return{id:'7',userName:name,userNickname:'昵称',userAvatarURL:'https://example.invalid/a.png',userIntro:'do not carry',userURL:'https://example.invalid'}}`)
const moonURL=url(replace(compile(await fs.readFile('src/api/legacy/breezemoons.ts','utf8')),[['../http',http],['./auth',auth],['./home',home],['../v3-public-user',profiles]])),api=await import(moonURL)
const row=(id,name)=>({oId:id,breezemoonContentRaw:'原始Markdown',breezemoonContent:'<p>服务端HTML</p>',breezemoonCreated:1000,breezemoonUpdated:2000,breezemoonAuthorName:name,userPassword:'private'})
state.dispatch=()=>({code:0,breezemoons:[row('100','one'),row('101','one')]})
let value=await api.legacyMoonPage(2,8)
assert.equal(value.p,2);assert.equal(value.list.length,2);assert.equal(value.total,undefined);assert.equal(value.pageCount,undefined);assert.deepEqual(state.profiles,['one']);assert.equal(value.list[0].author.id,'7');assert.equal(value.list[0].author.userIntro,undefined);assert.equal(value.list[0].userPassword,undefined)
assert.ok(state.calls[0].p.includes('apiKey=synthetic-legacy'))
console.log('PASS old list binds page/size and projects real resolved public IDs once per name; total stays unknown, private fields dropped')
let release
state.profileDispatch=()=>new Promise(r=>release=r)
const stale=api.legacyMoonPage(1,8)
await new Promise(r=>setImmediate(r));state.version++;state.key='another-key';release({id:'8',userName:'one',userNickname:'new',userAvatarURL:''})
await assert.rejects(stale)
state.profileDispatch=null;state.dispatch=()=>({code:0,breezemoons:[]});assert.deepEqual((await api.legacyMoonPage()).list,[])
console.log('PASS identity/key boundary rejects delayed profile resolution; legitimate empty remains readable')
state.key='synthetic-legacy';state.dispatch=()=>({code:0})
for(const kind of ['create','update','delete'])await api.writeLegacyMoon({kind,id:kind==='create'?'':'100',content:'有效内容'})
const writes=state.calls.slice(-3);assert.deepEqual(writes.map(x=>x.init.method),['POST','PUT','DELETE']);assert.deepEqual(writes.map(x=>x.p),['/breezemoon','/breezemoon/100','/breezemoon/100']);assert.ok(writes.every(x=>JSON.parse(x.init.body).apiKey==='synthetic-legacy'&&!x.init.headers))
console.log('PASS explicit classic POST/PUT/DELETE carry only legacy key/body, no Bearer or fabricated idempotency')
const Auth=defineStore('legacy-moon-auth',()=>({apiKey:ref('synthetic-legacy'),account:ref({oId:'7'}),isLoggedIn:ref(true)}));globalThis.__legacyMoonAuth=Auth
const storeSource=replace(compile((await fs.readFile('src/stores/legacyBreezemoons.ts','utf8')).replaceAll('import.meta.env.SSR','false')),[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['./auth',url('export const useAuthStore=__legacyMoonAuth')],['@/api/http',http],['@/api/legacy/breezemoons',moonURL]])
const {useLegacyBreezemoonsStore}=await import(url(storeSource)),pinia=createPinia(),store=useLegacyBreezemoonsStore(pinia),owner=Auth(pinia)
store.draft='保留提交内容';state.dispatch=()=>{throw new Error('network interrupted')}
const command={kind:'create',id:'',content:store.draft}
assert.equal(await store.execute(command),false);assert.deepEqual({...store.uncertain},command);const before=state.calls.length
assert.equal(await store.execute(command),false);assert.equal(state.calls.length,before);assert.equal(store.draft,'保留提交内容')
store.release();assert.equal(state.calls.length,before);assert.equal(store.uncertain,null)
state.dispatch=()=>({code:0});assert.equal(await store.execute(command),true);assert.equal(store.draft,'');assert.equal(store.completed.kind,'create')
store.draft='不会被旧响应清除';state.dispatch=()=>new Promise(r=>release=r)
const old=store.execute({kind:'create',id:'',content:store.draft});owner.apiKey='new-key';owner.account={oId:'8'};state.version++
release({code:0});assert.equal(await old,false);assert.equal(store.completed,null);assert.equal(store.uncertain,null);assert.equal(store.busy,false)
console.log('PASS actual Pinia unknown writes lock instead of retry; explicit release sends nothing, success clears matching draft, owner boundary rejects old result')
const relation=url(replace(compile(await fs.readFile('src/api/v3-user-relations.ts','utf8')).replaceAll("from './mode'","from 'data:text/javascript,export%20function%20getApiMode()%7Breturn%20%22v3%22%7D'"),[['./http',http]])),mode=url('export const getApiMode=()=>"v1"')
const publicURL=url(replace(compile(await fs.readFile('src/api/v3-public-user.ts','utf8')),[['./mode',mode],['./http',http],['./v3-user-relations',relation]]))
const publicLegacy=await import(url(replace(compile(await fs.readFile('src/api/legacy/public-user.ts','utf8')),[['../http',http],['../v3-public-user',publicURL],['./auth',auth]])))
state.dispatch=()=>({oId:'7',userName:'known',userNickname:'名',userAvatarURL:'',userIntro:'介绍',userURL:'https://example.invalid',userPoint:100,userRole:'admin',userPassword:'secret'})
const u=await publicLegacy.legacyPublicUser('known');assert.equal(Object.keys(u).length,6);assert.equal(u.userPoint,undefined);assert.equal(u.userRole,undefined)
await assert.rejects(publicLegacy.legacyPublicUser('other'));await assert.rejects(publicLegacy.legacyPublicUser('../known'))
console.log('PASS public card legacy adapter projects exactly six fields and verifies requested username, never full profile aliases')

const {ApiError}=await import(http)
state.key='new-key';owner.apiKey='new-key';owner.account={oId:'8'}
state.dispatch=()=>{throw new ApiError('HTML response',200)}
assert.equal(await store.execute({kind:'create',id:'',content:'未确认HTML响应'}),false);assert.ok(store.uncertain);store.release()
state.dispatch=()=>({})
assert.equal(await store.execute({kind:'create',id:'',content:'损坏回执'}),false);assert.ok(store.uncertain)
console.log('PASS HTTP success with non-JSON or missing command result remains unknown/locked instead of permitting duplicate publication')
