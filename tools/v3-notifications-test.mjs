import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, setActivePinia } from 'pinia'
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`
const realm = `export class ApiError extends Error {constructor(message,status,code){super(message);this.status=status;this.code=code}} export const getAccessToken=()=>globalThis.__noticeToken; export function onAccessTokenChange(fn){globalThis.__noticeListeners.add(fn);fn(globalThis.__noticeToken);return()=>globalThis.__noticeListeners.delete(fn)} export async function request(path,init){globalThis.__noticeRequests.push({path,init});const next=globalThis.__noticeResponses.shift();if(next instanceof Error)throw next;if(next===undefined)throw Error('Unexpected '+path);return next}`
const shim = moduleUrl(realm)
globalThis.window = { location: { protocol: 'http:', host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173' }, addEventListener(){},removeEventListener(){} }
globalThis.__noticeResponses=[];globalThis.__noticeRequests=[];globalThis.__noticeToken='A';globalThis.__noticeListeners=new Set()
function env(source,ssr=false){return source.replaceAll('import.meta.env.SSR',String(ssr)).replaceAll('import.meta.env.VITE_API_TARGET',JSON.stringify('http://localhost:8080'))}
const source=env(await fs.readFile('src/api/v3-notifications.ts','utf8')).replace("from './http'",`from '${shim}'`)
const api=await import(moduleUrl(source))
const actor={id:'2',userName:'reader',userAvatarURL:'https://example.com/a.png'}
const item={id:'123',type:2,category:'commented',title:'收到评论',createdAt:1,hasRead:false,contentAvailable:true,descriptionHtml:'<p>公开评论</p>',url:'https://fishpi.cn/article/7?p=2#9',actor,article:{title:'真实标题',anonymous:false,author:actor}}
const adapted=api.adaptNotification(item)
assert.equal(adapted.url,'/article/7?p=2#9');assert.equal(adapted.authorName,'reader');assert.equal(adapted.description,'<p>公开评论</p>')
const hidden=api.adaptNotification({...item,contentAvailable:false,descriptionHtml:'PRIVATE',actor,comment:{author:actor},article:{title:'PRIVATE'}})
assert.ok(!JSON.stringify(hidden).includes('PRIVATE'));assert.equal(hidden.url,'');assert.equal(hidden.authorName,undefined)
assert.equal(api.adaptNotification({...item,type:-1,category:'other',contentAvailable:false}).dataType,-1)
const anonymous=api.adaptNotification({...item,actor:undefined,comment:{anonymous:true,author:actor}})
assert.equal(anonymous.authorName,undefined)
assert.equal(api.notificationLink('https://fishpi.cn.evil/article/7'),'');assert.equal(api.notificationLink('javascript:alert(1)'),'');assert.equal(api.notificationLink('http://localhost:8080/article/7#9'),'/article/7#9')
console.log('PASS notices 1 exact DTO whitelist, inaccessible/anonymous projection and precise local URL mapping')
const groups={commented:2,reply:1,at:0,following:0,point:0,broadcast:0,'sys-announce':0,other:1}
__noticeResponses.push({code:0,data:{total:4,categories:groups}});assert.equal((await api.fetchV3UnreadCount()).unreadOtherNotificationCnt,1)
__noticeResponses.push({code:0,data:{total:5,categories:groups}});await assert.rejects(api.fetchV3UnreadCount(),e=>e.code==='invalid_response')
__noticeResponses.push({code:0,data:{list:[item],pagination:{p:1,size:10,total:11,pageCount:2}}});assert.equal((await api.fetchNotificationPage('commented')).pageCount,2)
__noticeResponses.push({code:0,data:{list:[],pagination:{p:2,size:10,total:11,pageCount:2}}});assert.deepEqual((await api.fetchNotificationPage('commented',2)).items,[])
__noticeResponses.push({code:0,data:{list:[item],pagination:{p:3,size:10,total:1,pageCount:1}}});await assert.rejects(api.fetchNotificationPage('reply'))
__noticeResponses.push(new Error('server failed'));await assert.rejects(api.fetchNotificationPage('reply'),/server failed/)
console.log('PASS notices 2 real pagination/count validation, legitimate empty pages and server failure never becomes an invented empty success')
__noticeResponses.push({code:0,data:{changed:2}});await api.markV3NotificationsRead('commented','same-key')
const call=__noticeRequests.at(-1);assert.equal(call.path,'/api/v3/me/notifications/read');assert.equal(call.init.method,'POST');assert.equal(call.init.headers['Idempotency-Key'],'same-key');assert.deepEqual(JSON.parse(call.init.body),{type:'commented'})
console.log('PASS notices 3 explicit POST/read category and caller-retained idempotency key, numeric changed receipt')
const timeout=new Map(),interval=new Map();let timer=0
const timers={timeout(fn){timeout.set(++timer,fn);return timer},interval(fn){interval.set(++timer,fn);return timer},clearTimeout(id){timeout.delete(id)},clearInterval(id){interval.delete(id)}}
globalThis.__noticeTimers=timers
class Socket {static OPEN=1;static all=[];readyState=1;sent=[];closed=false;constructor(url){this.url=url;Socket.all.push(this)}send(value){this.sent.push(JSON.parse(value))}close(){this.closed=true}}
globalThis.WebSocket=Socket
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
let realtime=env(await fs.readFile('src/api/v3-realtime.ts','utf8')).replace("from './http'",`from '${shim}'`)
realtime='const __timers=globalThis.__noticeTimers;\n'+realtime.replaceAll('setTimeout(', '__timers.timeout(').replaceAll('setInterval(', '__timers.interval(').replaceAll('clearTimeout(', '__timers.clearTimeout(').replaceAll('clearInterval(', '__timers.clearInterval(')
const rt=await import(moduleUrl(realtime));let invalidations=0
__noticeResponses.push({code:0,data:{ticket:'T'.repeat(43),path:'/api/v3/realtime',channel:'notifications'}})
const stop=rt.subscribeNotificationChanges(()=>invalidations++);await tick()
const socket=Socket.all.at(-1);assert.equal(socket.url,'ws://127.0.0.1:5173/api/v3/realtime');assert.ok(!socket.url.includes('T'.repeat(43)))
socket.onopen();socket.onmessage({data:JSON.stringify({type:'authentication.required'})});assert.equal(socket.sent.length,1);assert.deepEqual(socket.sent[0],{type:'authenticate',ticket:'T'.repeat(43)})
socket.onmessage({data:JSON.stringify({type:'notifications.changed'})});assert.equal(invalidations,0)
socket.onmessage({data:JSON.stringify({type:'ready',data:{channel:'notifications'}})});assert.equal(invalidations,1)
socket.onmessage({data:JSON.stringify({type:'notifications.changed',data:{}})});assert.equal(invalidations,2)
for(const ping of interval.values())ping();assert.equal(socket.sent.at(-1).type,'ping')
stop();assert.equal(socket.closed,true);assert.equal(interval.size,0);assert.equal(timeout.size,0)
console.log('PASS notices 4 exact query-free socket URL, ticket once in auth frame, ready/invalidation refresh, heartbeat and cleanup')
let resolveTicket;__noticeResponses.push(new Promise(resolve=>resolveTicket=resolve));const before=Socket.all.length
const late=rt.subscribeNotificationChanges(()=>{});await tick();__noticeToken='B';late();resolveTicket({code:0,data:{ticket:'T'.repeat(43),path:'/api/v3/realtime',channel:'notifications'}});await tick();assert.equal(Socket.all.length,before)
__noticeResponses.push({code:0,data:{ticket:'T'.repeat(43),path:'https://evil/realtime',channel:'notifications'}});const bad=rt.subscribeNotificationChanges(()=>{});await tick();assert.equal(Socket.all.length,before);bad();assert.equal(timeout.size,0)
console.log('PASS notices 5 stale ticket cannot create a socket for a new identity; foreign path rejected and retry cancelled')
const subRealm=moduleUrl('export function subscribeNotificationChanges(fn){globalThis.__noticeSubscriptions.push(fn);return()=>globalThis.__noticeClosed++}')
const countRealm=moduleUrl('export async function fetchV3UnreadCount(){return globalThis.__noticeCountResponses.shift()}')
globalThis.__noticeSubscriptions=[];globalThis.__noticeClosed=0;globalThis.__noticeCountResponses=[];__noticeToken=null
let storeSource=env(await fs.readFile('src/stores/notices.ts','utf8')).replace("from '@/api/http'",`from '${shim}'`).replace("from '@/api/v3-notifications'",`from '${countRealm}'`).replace("from '@/api/v3-realtime'",`from '${subRealm}'`).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replace("from 'pinia'",`from '${import.meta.resolve('pinia')}'`)
const {useNoticeStore}=await import(moduleUrl(storeSource));setActivePinia(createPinia());const store=useNoticeStore()
const publish=token=>{__noticeToken=token;for(const fn of __noticeListeners)fn(token)}
let resolveA,resolveB;__noticeCountResponses.push(new Promise(r=>resolveA=r),new Promise(r=>resolveB=r))
publish('A');publish('B');resolveB({unreadNotificationCnt:2});await tick();resolveA({unreadNotificationCnt:99});await tick();assert.equal(store.total,2)
publish(null);assert.equal(store.total,0);assert.equal(store.loading,false);assert.equal(store.error,'');assert.ok(__noticeClosed>=2)
store.$dispose();assert.equal(__noticeListeners.size,0)
console.log('PASS notices 6 actual Pinia store clears synchronously and refuses late prior-owner unread responses after identity changes/logout/disposal')
