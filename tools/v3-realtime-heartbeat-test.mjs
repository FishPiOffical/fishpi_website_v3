import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
const url=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')
let now=100000, id=0, tickets=0, token='A'
const originalNow=Date.now;Date.now=()=>now
const timers=new Map()
globalThis.__heartbeat={get token(){return token},request:async path=>({code:0,data:{ticket:`ticket_${++tickets}`,path:'/api/v3/realtime',channel:path.includes('articles/')?'article':path.includes('/chat/')?'chat':path.includes('/messages/')?'messages':'notifications',articleId:'2'}}),set(fn,delay,repeat=false){timers.set(++id,{fn,delay,repeat});return id},clear(id){timers.delete(id)}}
const shim=url(`export class ApiError extends Error{};export const getAccessToken=()=>globalThis.__heartbeat.token;export const request=globalThis.__heartbeat.request`)
const source=(await fs.readFile('src/api/v3-realtime.ts','utf8')).replaceAll('import.meta.env.SSR','false').replace("from './http'",`from '${shim}'`).replace("from './v3-chat-messages'",`from '${url('export const decodeChatMessage=()=>{}')}'`).replaceAll('setTimeout(', '__heartbeat.set(').replaceAll('setInterval(', '( (fn,ms)=>__heartbeat.set(fn,ms,true))(').replaceAll('clearTimeout(', '__heartbeat.clear(').replaceAll('clearInterval(', '__heartbeat.clear(')
class Socket{static OPEN=1;static CONNECTING=0;static all=[];readyState=1;sent=[];constructor(url){this.url=url;Socket.all.push(this)}send(data){this.sent.push(JSON.parse(data))}close(){this.readyState=3}addEventListener(){}}
globalThis.WebSocket=Socket
globalThis.window=Object.assign(new EventTarget(),{location:{protocol:'http:',host:'fixture'}})
globalThis.document=Object.assign(new EventTarget(),{visibilityState:'visible'})
const rt=await import(url(source)),tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve()},message=(s,type,data={})=>s.onmessage?.({data:JSON.stringify({type,data})}),intervals=()=>[...timers.values()].filter(t=>t.repeat)
async function retry(){const entry=[...timers].find(([,t])=>!t.repeat);assert.ok(entry);timers.delete(entry[0]);entry[1].fn();await tick();return Socket.all.at(-1)}
for(const channel of ['notifications','messages','chat','article']){
 let updates=0
 const start=()=>channel==='notifications'?rt.subscribeNotificationChanges(()=>updates++):channel==='messages'?rt.subscribeMessageChanges(()=>updates++):channel==='article'?rt.subscribeArticleChanges('2',()=>updates++):rt.subscribeChatChanges(()=>{},state=>{if(state==='ready')updates++})
 const ready=s=>{message(s,'authentication.required');message(s,'ready',{channel,articleId:'2'})}
 let stop=start();await tick();let s=Socket.all.at(-1)
 assert.equal(intervals().length,0);ready(s);assert.equal(intervals().length,1)
 for(let n=0;n<5;n++){now+=25000;message(s,channel+'.changed',{articleId:'2'});intervals()[0].fn();assert.equal(s.sent.at(-1).type,'ping');message(s,'pong')}
 assert.equal(s.sent.filter(x=>x.type==='ping').length,5)
 const oldMessage=s.onmessage,oldClose=s.onclose,oldError=s.onerror,oldInterval=intervals()[0].fn,oldTicket=s.sent[0].ticket
 now+=61000;window.dispatchEvent(new Event('focus'));assert.equal(s.readyState,3);assert.equal(intervals().length,0)
 s=await retry();const before=updates;ready(s);assert.ok(updates>before);assert.notEqual(s.sent[0].ticket,oldTicket);assert.equal(new URL(s.url).search,'')
 oldClose();oldError();oldMessage({data:'bad json'});oldInterval();assert.equal(intervals().length,1);assert.equal(s.readyState,1)
 // Business traffic does not satisfy pong liveness.
 now+=25000;intervals()[0].fn();now+=25000;message(s,channel+'.changed');intervals()[0].fn();now+=25000;intervals()[0].fn();assert.equal(s.readyState,3)
 s=await retry();ready(s);window.dispatchEvent(new Event('online'));assert.equal(s.readyState,3)
 s=await retry();ready(s);s.onclose({code:1008});s=await retry();ready(s) // server authorization expiry
 stop();assert.equal(timers.size,0)
 stop=start();await tick();s=Socket.all.at(-1);ready(s);token=null;stop();assert.equal(timers.size,0);token='A'
 window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));assert.equal(timers.size,0)
 console.log(`PASS ${channel}: 125s ping/pong, suspension, fresh ticket, state reconciliation, stale callbacks, missing pong, online, expiry close, logout, cleanup`)
}
let dispose
// A consumer can synchronously unmount during ready; do not leak an interval.
dispose=rt.subscribeChatChanges(()=>{},state=>{if(state==='ready')dispose()})
await tick();let socket=Socket.all.at(-1);message(socket,'authentication.required');message(socket,'ready',{channel:'chat'});assert.equal(timers.size,0)
dispose=rt.subscribeNotificationChanges(()=>{});await tick();socket=Socket.all.at(-1);message(socket,'authentication.required');message(socket,'ready',{channel:'notifications'});message(socket,'ready',{channel:'notifications'});assert.equal(intervals().length,0);assert.equal(socket.readyState,3);dispose();assert.equal(timers.size,0)
console.log('PASS synchronous ready disposal and duplicate ready never leak/duplicate heartbeat')
Date.now=originalNow
