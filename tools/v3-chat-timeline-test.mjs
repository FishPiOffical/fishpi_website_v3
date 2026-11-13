import assert from 'node:assert/strict';import fs from 'node:fs/promises';import ts from 'typescript';import{ref,nextTick}from'vue';import{createPinia,defineStore}from'pinia'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),replace=(s,pairs)=>{for(const[a,b]of pairs)s=s.replaceAll(`from '${a}'`,`from '${b}'`);return s}
const state=globalThis.__timeline={context:1,calls:[],dispatch:null,subscriptions:[],reactions:[]};const http=url(`export class ApiError extends Error{constructor(m,status=0,code){super(m);this.status=status;this.code=code}}export function getAccessToken(){return 'fixture-token'}export function getAuthContextVersion(){return globalThis.__timeline.context}export async function request(path,init){globalThis.__timeline.calls.push({path,init});return globalThis.__timeline.dispatch(path,init)}`),{ApiError}=await import(http)
const appearanceURL=url(compile(await fs.readFile('src/utils/chatAppearance.ts','utf8')))
const apiURL=url(replace(compile(await fs.readFile('src/api/v3-chat-messages.ts','utf8')).replaceAll("'./v3-reactions'", "'"+url(compile(await fs.readFile('src/api/v3-reactions.ts','utf8')).replace("from './http'",`from '${http}'`))+"'"),[['./http',http],['@/utils/chatAppearance',appearanceURL]])),api=await import(apiURL)
const auth=defineStore('timeline-auth',()=>({accessToken:ref('A'),account:ref({oId:'1'})}));globalThis.__timelineAuth=auth;const authURL=url('export const useAuthStore=globalThis.__timelineAuth'),rtURL=url('export function subscribeChatChanges(event,state){const sub={event,state,closed:false};globalThis.__timeline.subscriptions.push(sub);queueMicrotask(()=>{if(!sub.closed&&globalThis.__timeline.autoReady!==false)state("ready")});return()=>sub.closed=true}'),reactionURL=url('export function useV3ReactionsStore(){return{invalidate(kind,id){globalThis.__timeline.reactions.push([kind,id])}}}')
const storeURL=url(replace(compile((await fs.readFile('src/stores/v3ChatTimeline.ts','utf8')).replaceAll('import.meta.env.SSR','false')),[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/http',http],['@/api/v3-chat-messages',apiURL],['@/api/v3-realtime',rtURL],['@/stores/auth',authURL],['@/stores/v3Reactions',reactionURL]])),{useV3ChatTimelineStore}=await import(storeURL),tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()},env=data=>({code:0,data})
const msg=(id,content='body '+id)=>({id,createdAt:Number(id),type:'text',content,contentHtml:'<p>'+content+'</p>',author:{id:'2',userName:'other',userNickname:'',userAvatarURL:''},client:'Web/Website',card:{}}),page=(list=[msg('11'),msg('12')],hasMore=true)=>({list,hasMore,nextBefore:list[0]?.id||'',nextAfter:list.at(-1)?.id||''})
let latest=[msg('11'),msg('12')],older=[msg('9'),msg('10')],historyFail=false;const dispatch=async path=>{if(path==='/api/v3/chat/topic')return env({text:'current topic'});if(path.includes('/messages?')){if(historyFail)throw new ApiError('history503',503);return env(path.includes('before=')?page(older,false):page(latest,true))}throw new Error('Unexpected request '+path)};state.dispatch=dispatch
await api.chatMessagePage({before:'11'});assert.equal(state.calls.at(-1).path,'/api/v3/chat/messages?size=20&before=11');let count=state.calls.length;await assert.rejects(api.chatMessagePage({before:'11',after:'12'}),e=>e.status===422);assert.equal(state.calls.length,count);for(const data of [page([msg('12'),msg('11')]),page([msg('11'),msg('11')]),{...page(),nextBefore:'9'}]){state.dispatch=async()=>env(data);await assert.rejects(api.chatMessagePage(),e=>e.status===502)}state.dispatch=dispatch
console.log('PASS timeline 1 actual cursor API validates order, boundaries, duplicate IDs and matching next cursors')
function setup(){const pinia=createPinia(),store=useV3ChatTimelineStore(pinia);return{pinia,store,user:auth(pinia)}}
let view=setup();count=state.calls.length;await view.store.connect();assert.deepEqual(view.store.messages.map(m=>m.id),['11','12']);assert.equal(view.store.topic,'current topic');assert.equal(view.store.connected,true);assert.deepEqual(state.calls.slice(count).map(c=>c.path),['/api/v3/chat/messages?size=20','/api/v3/chat/topic']);const subscriptions=state.subscriptions.length;await view.store.connect();assert.equal(state.subscriptions.length,subscriptions);view.store.$dispose()
console.log('PASS timeline 2 current HTTP history/topic, ready is transport authentication, repeated connect shares subscription')
view=setup();await view.store.connect();await view.store.loadMore();assert.deepEqual(view.store.messages.map(m=>m.id),['9','10','11','12']);assert.equal(view.store.hasMore,false);assert.ok(state.calls.some(c=>c.path.includes('before=11')));view.store.$dispose()
console.log('PASS timeline 3 older cursor prepends ascending rows with server hasMore rather than page guesses')
view=setup();await view.store.connect();historyFail=true;await view.store.loadMore();assert.match(view.store.error,/503/);assert.equal(view.store.hasMore,true);historyFail=false;await view.store.loadMore();assert.equal(state.calls.at(-1).path,'/api/v3/chat/messages?size=20&before=11');view.store.$dispose()
console.log('PASS timeline 4 failed older read preserves original cursor and current history for exact retry')
view=setup();await view.store.connect();count=state.calls.length;const updating=state.subscriptions.at(-1);updating.event({type:'message',id:'12',message:msg('12','pushed update')});updating.event({type:'message',id:'13',message:msg('13')});assert.equal(view.store.messages.find(m=>m.id==='12').content,'pushed update');updating.event({type:'deleted',id:'12'});updating.event({type:'message',id:'12',message:msg('12','stale update')});assert.deepEqual(view.store.messages.map(m=>m.id),['11','13']);assert.equal(state.calls.length,count);view.store.$dispose()
console.log('PASS timeline 5 pushed create/update and deletion render without HTTP or resurrecting tombstones')
view=setup();await view.store.connect();count=state.calls.length;const legacy=state.subscriptions.at(-1);latest=[msg('11'),msg('12'),msg('13')];legacy.event({type:'message',id:'12'});legacy.event({type:'message',id:'13'});assert.equal(state.calls.length,count);await new Promise(resolve=>setTimeout(resolve,1050));assert.deepEqual(state.calls.slice(count).map(c=>c.path),['/api/v3/chat/messages?size=20']);assert.equal(view.store.messages.at(-1).id,'13');view.store.$dispose();latest=[msg('11'),msg('12')]
console.log('PASS timeline 6 metadata-only frames share one delayed history reconciliation')
view=setup();let latestRelease;state.dispatch=path=>path.includes('/messages?')?new Promise(r=>latestRelease=r):dispatch(path);const loading=view.store.connect();await tick();state.subscriptions.at(-1).event({type:'message',id:'20',message:msg('20','pushed during history')});latestRelease(env(page()));await loading;assert.ok(view.store.messages.some(m=>m.id==='20'));view.store.$dispose();state.dispatch=dispatch
console.log('PASS timeline 7 WebSocket snapshot during initial read survives an older history snapshot')
view=setup();await view.store.connect();let olderRelease;state.dispatch=async path=>path.includes('before=')?new Promise(r=>olderRelease=r):dispatch(path);const oldLoading=view.store.loadMore();await tick();state.subscriptions.at(-1).event({type:'deleted',id:'9'});await tick();olderRelease(env(page([msg('9'),msg('10')],false)));await oldLoading;assert.ok(!view.store.messages.some(m=>m.id==='9'));view.store.$dispose();state.dispatch=dispatch
console.log('PASS timeline 8 older page cannot resurrect a target deleted while the page was in flight')
view=setup();await view.store.connect();count=state.calls.length;state.subscriptions.at(-1).event({type:'reactions',id:'12'});await tick();assert.deepEqual(state.reactions.at(-1),['chat','12']);assert.equal(state.calls.length,count);state.subscriptions.at(-1).event({type:'topic'});await tick();assert.equal(state.calls.at(-1).path,'/api/v3/chat/topic');view.store.$dispose()
console.log('PASS timeline 9 reaction invalidates only its target, topic event reads topic rather than a message')
view=setup();await view.store.connect();const syncing=state.subscriptions.at(-1);count=state.calls.length;syncing.event({type:'message',id:'12'});latest=[msg('30','fresh window')];syncing.event({type:'sync'});await new Promise(resolve=>setTimeout(resolve,1050));assert.deepEqual(view.store.messages.map(m=>m.id),['30']);assert.deepEqual(state.calls.slice(count).map(c=>c.path),['/api/v3/chat/messages?size=20','/api/v3/chat/topic']);view.store.$dispose();latest=[msg('11'),msg('12')]
console.log('PASS timeline 10 sync replaces the window and cancels scheduled reconciliation')
view=setup();await view.store.connect();let latePage;state.dispatch=path=>path.includes('/messages?')?new Promise(r=>latePage=r):dispatch(path);const obsolete=view.store.readLatest();await tick();const priorSub=state.subscriptions.at(-1);view.user.accessToken=null;assert.equal(view.store.messages.length,0);assert.equal(priorSub.closed,true);latePage(env(page([msg('40','OLD_OWNER')])));await obsolete;assert.equal(view.store.messages.length,0);view.store.$dispose();state.dispatch=dispatch
console.log('PASS timeline 11 logout clears messages/cursors/topic and old HTTP or subscription cannot restore them')
view=setup();await view.store.connect();const prior=state.subscriptions.at(-1);view.user.accessToken='normally-rotated';await tick();assert.equal(prior.closed,true);assert.equal(view.store.messages.length,2);assert.equal(state.subscriptions.at(-1).closed,false);view.store.disconnect();assert.equal(view.store.messages.length,0);view.store.$dispose()
console.log('PASS timeline 12 normal token rotation rebinds current state and disconnect explicitly clears owned timeline')
view=setup();view.user.accessToken=null;count=state.calls.length;await view.store.connect();assert.equal(state.calls.length,count);assert.match(view.store.error,/登录/);view.store.$dispose();const chat=await fs.readFile('src/stores/chat.ts','utf8'),home=await fs.readFile('src/views/HomeView.vue','utf8'),ssr=await fs.readFile('src/entry-server.ts','utf8');assert.ok(!chat.includes('chat-room-channel')&&!chat.includes('fetchChatNodeBundle')&&!chat.includes('fetchChatHistory'));assert.ok(!home.includes('fetchChatHistory')&&!ssr.includes('fetchChatHistory'));assert.ok(home.includes('ChatPublicationRecovery'))
console.log('PASS timeline 13 guest makes no authenticated chat request; facade/Home/SSR remove legacy message/node streams')
view=setup();await view.store.connect();const clearSub=state.subscriptions.at(-1);view.store.clearVisible();assert.equal(view.store.messages.length,0);assert.equal(clearSub.closed,false);clearSub.event({type:'message',id:'13',message:msg('13')});await tick();assert.deepEqual(view.store.messages.map(m=>m.id),['13']);await view.store.readLatest();assert.deepEqual(view.store.messages.map(m=>m.id),['11','12']);view.store.$dispose()
console.log('PASS timeline 14 clear screen stays empty without disconnecting; new events appear and explicit latest refresh restores the window')
view=setup();await view.store.connect();const deniedSubscription=state.subscriptions.at(-1);state.dispatch=async()=>{throw new ApiError('forbidden',403)};await view.store.readLatest();state.dispatch=dispatch;assert.equal(view.store.messages.length,0);assert.equal(deniedSubscription.closed,true);deniedSubscription.event({type:'message',id:'12',message:msg('12')});view.store.upsertConfirmed(msg('50','LATE_PRE_DENIAL'));assert.equal(view.store.messages.length,0);assert.match(view.store.error,/授权不可用/);view.user.accessToken='reauthorized';await tick();assert.equal(view.store.messages.length,2);view.store.$dispose()
console.log('PASS timeline 15 authoritative 403 clears/cancels authorization state and blocks late publication projection until new credential binding')

view=setup();await view.store.connect();view.store.removeConfirmed('12');assert.deepEqual(view.store.messages.map(m=>m.id),['11']);view.store.upsertConfirmed(msg('12','stale publication'));await view.store.readLatest();assert.ok(!view.store.messages.some(m=>m.id==='12'));assert.ok(state.reactions.some(r=>r[1]==='12'));view.store.clearVisible();view.store.upsertConfirmed(msg('12','late after clear'));assert.equal(view.store.messages.length,0);view.store.$dispose()
console.log('PASS timeline 16 confirmed deletion tombstone survives stale history/publication and clear-screen without resurrecting removed content')

view=setup();await view.store.connect();const barrageCalls=state.calls.length,history=view.store.messages.map(m=>m.id),hint=view.store.changeHint,barrage={id:'12345678-1234-1234-1234-123456789abc',content:'hello',color:'#FFFFFF',createdAt:1,author:{id:'1',userName:'name',userNickname:'',userAvatarURL:''}};state.subscriptions.at(-1).event({type:'barrage',barrage});await tick();assert.deepEqual(view.store.barrage,barrage);assert.equal(state.calls.length,barrageCalls);assert.deepEqual(view.store.messages.map(m=>m.id),history);assert.equal(view.store.changeHint,hint);const barrageSub=state.subscriptions.at(-1);view.user.accessToken=null;assert.equal(view.store.barrage,null);barrageSub.event({type:'barrage',barrage});assert.equal(view.store.barrage,null);view.store.$dispose()
console.log('PASS timeline 17 barrage remains ephemeral without detail/history/context invalidation; logout clears and rejects old subscription')

state.autoReady=false
view=setup()
count=state.calls.length
await view.store.connect()
assert.equal(view.store.connected,false)
assert.equal(state.calls.length-count,2)
const recovering=state.subscriptions.at(-1)
recovering.state('ready')
assert.deepEqual(view.store.messages.map(m=>m.id),['11','12'])
await tick()
assert.equal(state.calls.length-count,4)
view.store.$dispose()
console.log('PASS timeline 18 slow socket falls back to HTTP once, then reconciles once without clearing visible messages')

const realtimeSource=compile((await fs.readFile('src/api/v3-realtime.ts','utf8'))
  .replace('import.meta.env.SSR','false').replace('import.meta.env?.VITE_BROWSER_API_ORIGIN',"''"))
const realtime=await import(url(replace(realtimeSource,[['./http',http],['./v3-chat-messages',apiURL]])))
let socket
globalThis.window={location:{protocol:'http:',host:'127.0.0.1:5173'}}
globalThis.WebSocket=class {
  constructor(){socket=this}
  send(){}
  close(){}
}
state.dispatch=async()=>env({ticket:'fixture-ticket',path:'/api/v3/realtime',channel:'chat'})
const delivered=[]
const unsubscribe=realtime.subscribeChatChanges(value=>delivered.push(value),()=>{})
await tick()
const frame=(type,data)=>socket.onmessage({data:JSON.stringify({type,data})})
const petStatus={name:'荷小豚',state:'idle',speciesId:'hexiaotun',level:15}
const payload={messageId:'12',revision:'1',message:{...msg('12'),petStatus,tail:{text:'今天也要开心🐟'},appearance:{bubbleId:'candy',frameId:'gold',version:1}}}
frame('chat.message.created',payload)
assert.equal(delivered.length,0)
socket.onopen()
frame('ready',{channel:'chat'})
frame('chat.message.created',payload)
frame('chat.message.updated',{...payload,revision:'2',message:msg('99')})
frame('chat.message.deleted',{...payload,revision:'3'})
assert.deepEqual(delivered,[
  {type:'message',id:'12',revision:'1',message:api.decodeChatMessage(payload.message)},
  {type:'message',id:'12',revision:'2'},
  {type:'deleted',id:'12',revision:'3'},
])
assert.deepEqual(delivered[0].message.appearance,payload.message.appearance)
assert.deepEqual(delivered[0].message.tail,payload.message.tail)
assert.deepEqual(delivered[0].message.petStatus,petStatus)
assert.deepEqual(api.decodeChatMessage({...msg('12'),petStatus:{...petStatus,speciesId:'unknown'}}).petStatus,
  {name:'荷小豚',state:'idle',level:15})
assert.equal(api.decodeChatMessage({...msg('12'),type:'unavailable',petStatus}).petStatus,undefined)
console.log('PASS timeline 19 authenticated transport decodes HTTP-equivalent snapshot, rejects mismatched IDs, ignores deletion bodies')

const summary = {targetId:'12',targetType:'chat',groupType:'emoji',currentUserReaction:'heart',
  summary:[{value:'heart',emoji:'❤️',count:2,selected:true,users:[]}]}
assert.equal(api.decodeChatMessage({...msg('12'),reactions:summary}).reactions.currentUserReaction,'heart')
assert.throws(()=>api.decodeChatMessage({...msg('12'),reactions:{...summary,targetId:'99'}}))
assert.equal(api.decodeChatMessage({...msg('12'),type:'unavailable',reactions:summary}).reactions,null)
console.log('PASS 聊天表态快照绑定消息 ID，过滤不可读消息')

frame('chat.message.reactions',{messageId:'12',revision:'4',reactions:summary})
assert.equal(delivered.at(-1).snapshot.currentUserReaction,'heart')
frame('chat.message.reactions',{messageId:'12',revision:'5'})
assert.equal(delivered.at(-1).snapshot,undefined)
frame('chat.message.created',{messageId:'12',revision:'6',message:{...msg('12'),reactionsUnavailable:true}})
assert.equal(delivered.at(-1).message.content,'body 12')
assert.equal(delivered.at(-1).message.reactionsUnavailable,true)
frame('chat.message.reactions',{messageId:'12',revision:'7',reactionsUnavailable:true})
assert.equal(delivered.at(-1).reactionsUnavailable,true)
unsubscribe()

const faultMessage={...msg('12'),reactionsUnavailable:true}
state.dispatch=async path=>env(path.includes('?')?page([faultMessage],false):faultMessage)
assert.equal((await api.chatMessagePage()).list[0].reactionsUnavailable,true)
assert.equal((await api.chatMessageDetail('12')).content,'body 12')
assert.equal((await api.chatMessageDetail('12')).reactionsUnavailable,true)

state.dispatch=dispatch
view=setup()
await view.store.connect()
const readsBeforeFault=state.calls.length
const invalidationsBeforeFault=state.reactions.length
state.subscriptions.at(-1).event(delivered.at(-1))
await tick()
assert.equal(view.store.messages.at(-1).content,'body 12')
assert.equal(view.store.messages.at(-1).reactionsUnavailable,true)
assert.equal(state.calls.length,readsBeforeFault)
assert.equal(state.reactions.length,invalidationsBeforeFault)
view.store.$dispose()
console.log('PASS 表态故障推送保留正文并跳过逐条补查')

state.dispatch=async()=>env({ticket:'fixture-ticket',path:'/api/v3/realtime',channel:'chat'})
const notices=[]
const stopNotices=realtime.subscribeChatChanges(event=>notices.push(event),()=>{})
await tick()
const actor={id:'8',userName:'fish',userNickname:'鱼'}
const sender={id:'9',userName:'sender',userNickname:'发包人'}
const claim={id:'claim-12-1',createdAt:100,actor,sender,packetId:'12',got:1,count:2}
frame('chat.red_packet.claimed',claim)
assert.equal(notices.length,0)
socket.onopen()
frame('ready',{channel:'chat'})
frame('chat.red_packet.claimed',{...claim,got:3})
frame('chat.presence.changed',{...claim,kind:'unknown',text:'错误方向'})
frame('chat.presence.changed',{...claim,kind:'join'})
frame('chat.presence.changed',{...claim,kind:'leave',text:'  '})
assert.equal(notices.length,0)
frame('chat.red_packet.claimed',claim)
frame('chat.presence.changed',{id:'join-8',createdAt:101,actor,kind:'join',text:'小鱼来啦'})
frame('chat.presence.changed',{id:'leave-8',createdAt:102,actor,kind:'leave',text:'小鱼先下线啦'})
assert.deepEqual(notices.map(event=>event.notice.kind),['claim','join','leave'])
assert.deepEqual(notices.slice(1).map(event=>event.notice.text),['小鱼来啦','小鱼先下线啦'])
stopNotices()

state.dispatch=dispatch
view=setup()
await view.store.connect()
const readsBeforeNotices=state.calls.length
const subscription=state.subscriptions.at(-1)
for(const event of [...notices,notices[0]])subscription.event(event)
assert.deepEqual(view.store.notices.map(notice=>notice.id),['claim-12-1','join-8','leave-8'])
assert.equal(state.calls.length,readsBeforeNotices)
view.store.clearVisible()
assert.deepEqual(view.store.notices,[])
view.store.$dispose()
console.log('PASS 红包和进出场事件仅在实时授权后接收，重复事件去重且无额外读取')
