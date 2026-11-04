import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import {createPinia,defineStore} from 'pinia'
import {computed,ref,nextTick} from 'vue'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
async function source(path,mapping=[]){let s=(await fs.readFile(path,'utf8')).replaceAll('import.meta.env.SSR','false');s=compile(s);for(const[a,b]of mapping)s=s.replaceAll(`from '${a}'`,`from '${b}'`);return s}
const state=globalThis.__legacyPM={key:'synthetic-v1',calls:[],dispatch:null,subscriptions:[],timers:new Map(),intervals:new Map(),next:0,ssr:false}
state.timeout=fn=>{state.timers.set(++state.next,fn);return state.next};state.clear=id=>state.timers.delete(id);state.interval=fn=>{state.intervals.set(++state.next,fn);return state.next};state.clearInterval=id=>state.intervals.delete(id)
const http=url(`export class ApiError extends Error{constructor(m,status){super(m);this.status=status}}export function getAuthContextVersion(){return 1}export async function request(p,init){__legacyPM.calls.push({p,init});return __legacyPM.dispatch(p,init)}`),authKey=url('export const getLegacyKey=()=>__legacyPM.key'),home=url(`export function legacyObject(v){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('bad object');return v}`),publicUser=url(`export async function legacyPublicUser(name){return {id:name==='other'?'2':'3',userName:name,userNickname:'昵称 '+name,userAvatarURL:'https://example.invalid/avatar'}}`)
const apiURL=url(await source('src/api/legacy/messages.ts',[['../http',http],['./auth',authKey],['./home',home],['./public-user',publicUser]])),api=await import(apiURL)
const peer={id:'2',userName:'other',userNickname:'',userAvatarURL:'',available:true,builtin:false}
const row=(id='10',from='2',to='1',content='raw **private**')=>({oId:id,fromId:from,toId:to,time:'2026-11-04 12:00:00',markdown:content,content:'<p>server cleaned</p>',preview:'preview',senderUserName:'wrong-for-list',receiverUserName:from==='1'?'other':'owner',user_session:'never-project',secret:'private'})
state.dispatch=()=>({result:0,data:[row('10','2','1'),row('9','1','2')]})
const history=await api.legacyMessageHistory('1',peer);assert.deepEqual(history.map(m=>m.id),['9','10']);assert.equal(history[0].fromMe,true);assert.equal(history[0].secret,undefined);assert.equal(history[0].user_session,undefined)
assert.ok(state.calls.at(-1).p.includes('toUser=other&page=1&pageSize=20&apiKey=synthetic-v1'));assert.equal(state.calls.at(-1).init.headers,undefined)
state.dispatch=()=>({result:-1,msg:'没有更多消息了'});assert.deepEqual(await api.legacyMessageHistory('1',peer,2),[])
state.dispatch=()=>({result:-1,msg:'数据库错误'});await assert.rejects(api.legacyMessageHistory('1',peer,2))
state.dispatch=()=>({result:0,data:[row('10','3','1')]});await assert.rejects(api.legacyMessageHistory('1',peer))
state.dispatch=()=>({result:0,data:[row('9'),row('10')]});await assert.rejects(api.legacyMessageHistory('1',peer))
state.dispatch=()=>({result:0,data:[{...row('10','2','1'),receiverUserName:'other',receiverAvatar:'https://example.invalid/a?sig=full'}]})
const conversations=await api.legacyMessageConversations('1');assert.equal(conversations[0].peer.id,'2');assert.equal(conversations[0].peer.userName,'other');assert.equal(conversations[0].peer.userAvatarURL,'https://example.invalid/a?sig=full');assert.equal(conversations[0].unreadCount,undefined)
state.dispatch=()=>({result:2,data:[{fromId:'2',toId:'1'},{fromId:'3',toId:'1'}]});assert.deepEqual({...await api.legacyMessageUnread('1'),byPeer:{...(await api.legacyMessageUnread('1')).byPeer}},{total:2,byPeer:{2:1,3:1}})
state.dispatch=()=>({result:2,data:[]});await assert.rejects(api.legacyMessageUnread('1'))
state.dispatch=()=>({result:1,data:[{fromId:'2',toId:'3'}]});await assert.rejects(api.legacyMessageUnread('1'))
state.dispatch=()=>({result:0});for(const kind of ['read','read-all','withdraw'])await api.writeLegacyMessage({kind,peer,messageId:'10',content:''})
assert.ok(state.calls.at(-3).p.startsWith('/chat/mark-as-read?'));assert.ok(state.calls.at(-2).p.startsWith('/chat/mark-all-as-read?'));assert.ok(state.calls.at(-1).p.startsWith('/chat/revoke?'))
assert.throws(()=>api.legacyMessageContent('\ud800'));assert.throws(()=>api.legacyMessageContent('x'.repeat(10241)));assert.throws(()=>api.legacyMessageContent('   '))
console.log('PASS legacy private DTO whitelist, precise result envelope, strict participants/order, real empty sentinel, direction-specific list names, unread ownership and read/revoke paths')
class Socket{static OPEN=1;static all=[];readyState=0;sent=[];constructor(url){this.url=url;Socket.all.push(this)}send(s){this.sent.push(s)}close(){this.closed=true;this.readyState=3}}
globalThis.WebSocket=Socket;globalThis.location={protocol:'http:',host:'127.0.0.1:5173'};globalThis.window={addEventListener(){},removeEventListener(){}}
const channelSource=(await source('src/api/legacy/message-channel.ts',[['./auth',authKey],['./messages',apiURL]])).replaceAll('setTimeout(','__legacyPM.timeout(').replaceAll('clearTimeout(','__legacyPM.clear(').replaceAll('setInterval(','__legacyPM.interval(').replaceAll('clearInterval(','__legacyPM.clearInterval(')
const channelURL=url(channelSource)
const Auth=defineStore('legacy-pm-auth',()=>{const apiKey=ref('synthetic-v1'),account=ref({oId:'1',userName:'owner'});return{apiKey,account,isLoggedIn:computed(()=>!!apiKey.value&&!!account.value)}});globalThis.__legacyPMAuth=Auth
const authURL=url('export const useAuthStore=__legacyPMAuth'),rtURL=url('export function subscribeLegacyUserChanges(fn){const entry={fn,closed:false};__legacyPM.subscriptions.push(entry);return()=>entry.closed=true}')
const inboxHelper=url(await source('src/stores/legacyPrivateInboxState.ts',[['vue',import.meta.resolve('vue')],['@/api/legacy/auth',authKey],['@/api/legacy/messages',apiURL],['@/api/legacy/user-channel',rtURL],['./auth',authURL]]))
const stub=url(`export const privateUnread=()=>{throw Error('v3 private unread reached')};export function subscribeMessageChanges(){throw Error('v3 realtime reached')};export function useV3MessagesStore(){throw Error('v3 writes reached')}`)
const inboxURL=url(await source('src/stores/privateInbox.ts',[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/mode',url("export const getApiMode=()=> 'v1'")],['./legacyPrivateInboxState',inboxHelper],['@/api/http',http],['@/api/v3-messages',stub],['@/api/v3-realtime',stub],['@/stores/auth',authURL],['@/stores/v3Messages',stub]])),{usePrivateInboxStore}=await import(inboxURL)
let rows=[row()],unread=[{fromId:'2',toId:'1'}],failHistory=false,holdHistory=null
state.dispatch=async p=>{if(p.startsWith('/chat/has-unread'))return{result:unread.length,data:unread};if(p.startsWith('/chat/get-list'))return{result:0,data:[{...row(),receiverUserName:'other'}]};if(p.startsWith('/chat/get-message')){if(holdHistory)return holdHistory;if(failHistory)throw Error('history failed');return{result:0,data:[...rows].sort((a,b)=>BigInt(a.oId)>BigInt(b.oId)?-1:1)}}return{result:0}}
let storeCode=await source('src/stores/legacyMessages.ts',[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['./auth',authURL],['./privateInbox',inboxURL],['@/api/legacy/message-channel',channelURL],['@/api/legacy/messages',apiURL]])
storeCode=storeCode.replaceAll('setTimeout(','__legacyPM.timeout(').replaceAll('clearTimeout(','__legacyPM.clear(')
const storeURL=url(storeCode),{useLegacyMessagesStore}=await import(storeURL),pinia=createPinia(),chat=useLegacyMessagesStore(pinia),inbox=usePrivateInboxStore(pinia),owner=Auth(pinia)
const tick=async()=>{for(let i=0;i<60;i++)await Promise.resolve();await nextTick()}
assert.equal(chat.canSend,false);const releasePage=chat.acquire(),releaseDrawer=chat.acquire();chat.select(peer);await tick()
assert.equal(Socket.all.length,1);const socket=Socket.all[0];socket.readyState=1;socket.onopen();await tick();assert.equal(chat.connection,'connected');assert.equal(inbox.unreadTotal,1);assert.equal(inbox.byPeer['2'],1)
chat.draft='new text';assert.equal(chat.canSend,true);await chat.execute({kind:'send',peer,messageId:'',content:chat.draft});assert.equal(socket.sent.at(-1),'new text');assert.ok(chat.pending);assert.equal(chat.busy,true)
assert.ok(!state.calls.some(c=>c.p.includes('/chat/send')))
rows=[row('11','1','2','new text'),...rows];socket.onmessage({data:JSON.stringify(rows[0])});await tick();assert.equal(chat.pending,null);assert.equal(chat.draft,'');assert.ok(chat.messages.some(m=>m.id==='11'))
releasePage();assert.equal(socket.closed,undefined);socket.onmessage({data:JSON.stringify(row('12'))});await tick();assert.equal(chat.connection,'connected')
console.log('PASS actual shared Pinia state: page and drawer use one socket, send raw once, confirm only after HTTP current history, page disposal keeps floating connection alive')
chat.draft='uncertain send';await chat.execute({kind:'send',peer,messageId:'',content:chat.draft});const sent=socket.sent.length
const [id,deadline]=[...state.timers].at(-1);state.timers.delete(id);deadline();assert.equal(chat.busy,false);assert.ok(chat.pending)
await chat.execute({kind:'send',peer,messageId:'',content:'must not send'});assert.equal(socket.sent.length,sent)
socket.onerror();assert.equal(chat.connection,'disconnected');const [retryId,retry]=[...state.timers].at(-1);state.timers.delete(retryId);retry();const reconnected=Socket.all.at(-1);reconnected.readyState=1;reconnected.onopen();await tick();assert.equal(reconnected.sent.length,0);assert.ok(chat.pending);assert.equal(chat.draft,'uncertain send')
chat.release();assert.equal(reconnected.sent.length,0);assert.equal(chat.pending,null)
failHistory=true;await chat.loadHistory();assert.equal(chat.historyError,'history failed');assert.equal(chat.messages.length,0);failHistory=false
console.log('PASS lost acknowledgement retains original send/body; timeout, reconnect, recovery inspection and release never resend, history failures remain errors')
const ordinary=state.dispatch
state.dispatch=async p=>p.startsWith('/chat/revoke')?{result:-1,msg:'撤回失败'}:ordinary(p)
await chat.execute({kind:'withdraw',peer,messageId:'11',content:''});assert.equal(chat.pending.kind,'withdraw');assert.equal(chat.busy,false)
const revokeCalls=state.calls.filter(c=>c.p.startsWith('/chat/revoke')).length
await chat.execute({kind:'withdraw',peer,messageId:'11',content:''});assert.equal(state.calls.filter(c=>c.p.startsWith('/chat/revoke')).length,revokeCalls)
chat.release();state.dispatch=ordinary;failHistory=true;await chat.execute({kind:'read-all',peer:null,messageId:'',content:''});assert.equal(chat.pending,null);assert.equal(chat.historyError,'history failed');failHistory=false
console.log('PASS ambiguous classic mutation failure locks the exact command without replay; confirmed read with failed subsequent GET never repeats mutation')
let releaseOld;holdHistory=new Promise(r=>releaseOld=r);void chat.loadHistory();await tick();owner.apiKey=null;state.key=null;owner.account=null;assert.equal(chat.messages.length,0);assert.equal(chat.draft,'');assert.equal(chat.peer,null);assert.equal(chat.pending,null)
releaseOld({result:0,data:[row('90')]});holdHistory=null;await tick();assert.equal(chat.messages.length,0);assert.equal(inbox.unreadTotal,null);assert.ok(state.subscriptions.every(s=>s.closed));releaseDrawer();chat.$dispose();inbox.$dispose();owner.$dispose();assert.equal(state.timers.size,0);assert.equal(state.intervals.size,0)
console.log('PASS identity/logout clears bodies, draft, pending and drawer state synchronously; delayed history cannot restore private data; socket/timer cleanup complete')

const beforeSSR=state.calls.length,beforeSockets=Socket.all.length
state.key='synthetic-ssr'
// Compile the actual SSR guards rather than unconditionally mocking DOM success.
let ssrStore=await fs.readFile('src/stores/legacyMessages.ts','utf8');ssrStore=compile(ssrStore.replaceAll('import.meta.env.SSR','true'));for(const[a,b]of [['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['./auth',authURL],['./privateInbox',inboxURL],['@/api/legacy/message-channel',channelURL],['@/api/legacy/messages',apiURL]])ssrStore=ssrStore.replaceAll(`from '${a}'`,`from '${b}'`)
const serverPinia=createPinia(),serverAuth=Auth(serverPinia);serverAuth.apiKey='synthetic-ssr';serverAuth.account={oId:'1',userName:'owner'}
// The inbox helper has its own SSR test; keep this store test focused on its transport consumers.
const ssrInboxStub=url('export function usePrivateInboxStore(){return {revision:0,refreshUnread(){},invalidate(){}}}')
ssrStore=ssrStore.replaceAll(`from '${inboxURL}'`,`from '${ssrInboxStub}'`)
const serverChat=(await import(url(ssrStore))).useLegacyMessagesStore(serverPinia),releaseSSR=serverChat.acquire();serverChat.select(peer);await tick();assert.equal(state.calls.length,beforeSSR);assert.equal(Socket.all.length,beforeSockets);releaseSSR();serverChat.$dispose();serverAuth.$dispose()
console.log('PASS actual server-side message store with authenticated fixture performs no private HTTP read or WebSocket subscription')
