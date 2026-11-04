import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import {effectScope} from 'vue'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const load=async(file,mapping)=>{let s=(await fs.readFile(file,'utf8')).replaceAll('import.meta.env.SSR','false').replaceAll('import.meta.hot','undefined');s=compile(s);for(const[a,b]of mapping)s=s.replaceAll(`from '${a}'`,`from '${b}'`);return url(s)}
const state=globalThis.__legacyNotice={key:null,listeners:new Set(),calls:[],dispatch:()=>{throw Error('unexpected read')}}
const http=url(`export class ApiError extends Error{constructor(m,status){super(m);this.status=status}}export async function request(p,init){__legacyNotice.calls.push({p,init});return __legacyNotice.dispatch(p,init)}`)
// Use the real legacy key lifecycle, not a duplicate event implementation.
const authURL=await load('src/api/legacy/auth.ts',[['../http',http],['js-md5',import.meta.resolve('js-md5')]])
const auth=await import(authURL)
const home=url(`export function legacyObject(v){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid');return v}export function legacyDate(v){if(!Number.isSafeInteger(v)||v<0)throw Error('invalid');return v}`)
const links=url(`export function notificationLink(v){try{const u=new URL(v,'https://fishpi.cn');return u.origin==='https://fishpi.cn'?u.pathname+u.search+u.hash:''}catch{return ''}}`)
const apiURL=await load('src/api/legacy/notifications.ts',[['../http',http],['./auth',authURL],['./home',home],['../v3-notifications',links]])
const api=await import(apiURL)
await assert.rejects(api.legacyUnreadCount(),e=>e.status===401);assert.equal(state.calls.length,0)
auth.setLegacyKey('synthetic-A')
state.dispatch=()=>({code:0,data:Array.from({length:12},(_,i)=>({oId:String(i+1),description:'内容',commentAuthorName:'target',authorName:'target',userPassword:'private',commentCreateTime:1000}))})
const page=await api.legacyNotificationPage('commented',2,10)
assert.equal(page.items.length,2);assert.equal(page.total,12);assert.equal(page.pageCount,2);assert.equal(page.items[0].authorName,undefined);assert.equal(page.items[0].userPassword,undefined)
assert.ok(state.calls.at(-1).p.includes('apiKey=synthetic-A'));assert.ok(!state.calls.at(-1).p.includes('p='));assert.equal(state.calls.at(-1).init.headers,undefined)
const hidden=api.projectLegacyNotification({oId:'2',contentAvailable:false,description:'secret',content:'secret',articleTitle:'secret',actor:{id:'3',userName:'reader'}})
assert.ok(!JSON.stringify(hidden).includes('secret'));assert.equal(hidden.authorName,undefined)
const explicit=api.projectLegacyNotification({oId:'1',actor:{id:'3',userName:'reader',userAvatarURL:'https://example.invalid/a?sig=full'}})
assert.equal(explicit.authorName,'reader');assert.equal(explicit.userAvatarURL,'https://example.invalid/a?sig=full')
assert.equal(api.projectLegacyNotification({actor:{id:'3',userName:'reader',userAvatarURL:'https://user:pass@example.invalid/a'}}).userAvatarURL,undefined)
state.dispatch=()=>({code:0,data:[]});assert.deepEqual((await api.legacyNotificationPage('at',1,10)).items,[])
state.dispatch=()=>({code:0,data:[{oId:'1'},{oId:'1'}]});await assert.rejects(api.legacyNotificationPage('at',1,10))
state.dispatch=()=>({code:0});await assert.rejects(api.legacyNotificationPage('at',1,10))
console.log('PASS legacy notice snapshot pagination, unavailable/actor whitelist, signed avatars, empty versus invalid responses and legacy-only credentials')
state.dispatch=()=>({code:0,unreadNotificationCnt:3,unreadReplyNotificationCnt:2})
assert.deepEqual(await api.legacyUnreadCount(),{unreadNotificationCnt:3,unreadReplyNotificationCnt:2})
state.dispatch=()=>({code:0,unreadNotificationCnt:-1});await assert.rejects(api.legacyUnreadCount())
state.dispatch=()=>({code:0});await assert.rejects(api.legacyUnreadCount())
for(const type of ['all','reply'])await api.markLegacyNotices(type)
assert.ok(state.calls.at(-2).p.startsWith('/notifications/all-read?'));assert.ok(state.calls.at(-1).p.startsWith('/notifications/make-read/reply?'))
state.dispatch=()=>({code:0,data:[{fromUser:'A'}]});assert.equal(await api.legacyPrivateUnread(),1)
console.log('PASS explicit read semantics, required true unread total, missing category remains unknown')
const timers=new Map();let timer=0
globalThis.__legacyNoticeTimers={set(fn){timers.set(++timer,fn);return timer},clear(id){timers.delete(id)}}
class Socket{static all=[];constructor(url){this.url=url;Socket.all.push(this)}close(){this.closed=true}}
globalThis.WebSocket=Socket;globalThis.location={protocol:'http:',host:'127.0.0.1:5173'}
globalThis.window={addEventListener(){},removeEventListener(){}}
let channel=(await fs.readFile('src/api/legacy/user-channel.ts','utf8')).replaceAll('import.meta.env.SSR','false').replaceAll('import.meta.hot','undefined').replaceAll('setTimeout(','__legacyNoticeTimers.set(').replaceAll('clearTimeout(','__legacyNoticeTimers.clear(')
channel=compile(channel).replace("from './auth'",`from '${authURL}'`)
const channelURL=url(channel),rt=await import(channelURL)
let invalidations=0
const stop1=rt.subscribeLegacyUserChanges(()=>invalidations++),stop2=rt.subscribeLegacyUserChanges(()=>invalidations++)
assert.equal(Socket.all.length,1);const socket=Socket.all[0],late=()=>socket.onmessage?.({data:'{"command":"refreshNotification","content":"ignored"}'})
assert.equal(socket.url,'ws://127.0.0.1:5173/user-channel?apiKey=synthetic-A')
socket.onopen();assert.equal(invalidations,2);late();assert.equal(invalidations,4)
socket.onmessage({data:'{"content":"no-command"}'});assert.equal(invalidations,4)
stop1();assert.ok(!socket.closed)
const staleMessage=socket.onmessage;socket.onerror();assert.equal(timers.size,1);staleMessage({data:'{"command":"refreshNotification"}'});assert.equal(invalidations,4)
const [retryId,retry]=timers.entries().next().value;timers.delete(retryId);retry();assert.equal(Socket.all.length,2);assert.ok(socket.closed)
stop2();assert.equal(Socket.all.at(-1).closed,true);assert.equal(timers.size,0)
console.log('PASS one shared legacy socket, invalidation-only frames, unsubscribe reference count and cleanup')
const stateURL=await load('src/stores/legacyNoticeState.ts',[['vue',import.meta.resolve('vue')],['@/api/legacy/auth',authURL],['@/api/legacy/notifications',apiURL],['@/api/legacy/user-channel',channelURL]])
const {legacyNoticeState}=await import(stateURL)
let releaseA,releaseB,reads=0
state.dispatch=()=>{reads++;return new Promise(r=>{if(reads===1)releaseA=r;else releaseB=r})}
const scope=effectScope(),store=scope.run(legacyNoticeState)
assert.equal(store.loading.value,true);store.invalidate();store.invalidate();assert.equal(reads,1)
auth.setLegacyKey('synthetic-B');assert.equal(reads,2)
releaseB({code:0,unreadNotificationCnt:2});await new Promise(r=>setImmediate(r));releaseA({code:0,unreadNotificationCnt:99});await new Promise(r=>setImmediate(r))
assert.equal(store.total.value,2)
let releaseCount,coalesced=0
state.dispatch=()=>{coalesced++;return coalesced===1?new Promise(r=>releaseCount=r):{code:0,unreadNotificationCnt:4}}
store.invalidate();store.invalidate();store.invalidate();assert.equal(coalesced,1)
releaseCount({code:0,unreadNotificationCnt:3});await new Promise(r=>setImmediate(r));assert.equal(coalesced,2);assert.equal(store.total.value,4)
state.dispatch=()=>{throw Error('read failed')};store.invalidate();await new Promise(r=>setImmediate(r));assert.equal(store.error.value,'read failed');assert.deepEqual(store.unread.value,{})
auth.setLegacyKey(null);assert.equal(store.error.value,'');assert.equal(store.total.value,0);assert.equal(store.loading.value,false)
scope.stop();assert.ok(Socket.all.every(x=>x.closed));assert.equal(timers.size,0)
console.log('PASS actual legacy key + notice state lifecycle: coalesced reads, synchronous account isolation, stale response rejection, failures and logout cleanup')
