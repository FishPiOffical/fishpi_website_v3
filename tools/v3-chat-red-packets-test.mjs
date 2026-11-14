import assert from 'node:assert/strict';import fs from 'node:fs/promises';import ts from 'typescript';import{parse,compileScript}from'@vue/compiler-sfc';import{createRenderer,h,ref,reactive,nextTick,createCommentVNode}from'vue';import{createPinia,defineStore}from'pinia'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),replace=(s,pairs)=>{for(const[a,b]of pairs)s=s.replaceAll(`from '${a}'`,`from '${b}'`).replaceAll(`from "${a}"`,`from '${b}'`);return s}
globalThis.Document=class{};globalThis.ShadowRoot=class{};const state=globalThis.__revoke={context:1,calls:[],dispatch:null,confirm:async()=>true,ssr:false};const http=url(`export class ApiError extends Error{constructor(m,status=0){super(m);this.status=status}}export function getAuthContextVersion(){return globalThis.__revoke.context}export async function request(path,init){globalThis.__revoke.calls.push({path,init});return globalThis.__revoke.dispatch(path,init)}`),{ApiError}=await import(http),apiURL=url(compile(await fs.readFile('src/api/v3-chat-red-packets.ts','utf8')).replace("from './http'",`from '${http}'`)),api=await import(apiURL)
const auth=defineStore('revoke-auth',()=>({accessToken:ref(state.guest?null:'A'),account:ref({oId:'1',userName:'renamed'})}));globalThis.__revokeAuth=auth;const authURL=url('export const useAuthStore=globalThis.__revokeAuth'),keyURL=url("let n=0;export function profileOperationKey(){return 'revoke-'+(++n)}"),msgURL=url(compile(await fs.readFile('src/api/v3-chat-messages.ts','utf8')).replaceAll("'./v3-reactions'", "'"+url(compile(await fs.readFile('src/api/v3-reactions.ts','utf8')).replace("from './http'",`from '${http}'`))+"'").replace("from './http'",`from '${http}'`).replace("from '@/utils/chatAppearance'",`from '${url(compile(await fs.readFile('src/utils/chatAppearance.ts','utf8')))}'`)),reactionURL=url('export function useV3ReactionsStore(){return{invalidate(){}}}'),rtURL=url('export function subscribeChatChanges(){return()=>{}}')
const timelineURL=url(replace(compile((await fs.readFile('src/stores/v3ChatTimeline.ts','utf8')).replaceAll('import.meta.env.SSR','globalThis.__revoke.ssr')),[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/http',http],['@/api/v3-chat-messages',msgURL],['@/utils/chatAppearance',url(compile(await fs.readFile('src/utils/chatAppearance.ts','utf8')))],['@/api/v3-realtime',rtURL],['@/stores/auth',authURL],['@/stores/v3Reactions',reactionURL]])),{useV3ChatTimelineStore}=await import(timelineURL)
const storeURL=url(replace(compile((await fs.readFile('src/stores/v3ChatRedPackets.ts','utf8')).replaceAll('import.meta.env.SSR','globalThis.__revoke.ssr')),[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/http',http],['@/api/v3-profile',keyURL],['@/api/v3-chat-red-packets',apiURL],['@/api/v3-chat-messages',msgURL],['@/stores/auth',authURL],['@/stores/v3ChatTimeline',timelineURL]])),{useV3ChatRedPacketsStore}=await import(storeURL),dialogURL=url('export async function fpConfirm(o){return globalThis.__revoke.confirm(o)}')
const suggestionsURL=url(compile(await fs.readFile('src/api/v3-user-suggestions.ts','utf8')).replace("from './http'",`from '${http}'`))
const musicURL=url(compile(await fs.readFile('src/api/v3-chat-music.ts','utf8')).replace("from './http'",`from '${http}'`))
const dialogShim=url(`import{h}from '${import.meta.resolve('vue')}';export default{props:['open'],setup(p,{slots}){return()=>p.open?h('section',slots.default?.()):null}}`)
const packetRouter=url(`import{h}from '${import.meta.resolve('vue')}';export const RouterLink={props:['to'],setup(p,{slots}){return()=>h('a',{href:p.to},slots.default?.())}}`),packetAvatar=url(compile(await fs.readFile('src/utils/avatar.ts','utf8')))
let hongbaoURL=url('export default {}')
let recoveryComponentURL=url('export default {render(){return null}}')
async function component(path){const d=parse(await fs.readFile(path,'utf8')).descriptor;return(await import(url(replace(compile(compileScript(d,{id:path,inlineTemplate:true}).content),[['./ChatRedPacketRecovery.vue',recoveryComponentURL],['vue-router',packetRouter],['@/utils/avatar',packetAvatar],['@/utils/time',url(compile(await fs.readFile('src/utils/time.ts','utf8')))],['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/http',http],['@/components/FpDialog.vue',dialogShim],['./HongbaoCard.vue',hongbaoURL],['@/api/v3-chat-red-packets',apiURL],['@/api/v3-user-suggestions',suggestionsURL],['@/api/v3-chat-music',musicURL],['@/seo/site',url("export const SITE_ORIGIN='https://local.example'")],['@/stores/auth',authURL],['@/stores/v3ChatRedPackets',storeURL],['@/composables/useDialog',dialogURL]])))).default}
const Dialog=await component('src/components/chat/ChatRedPacketDialog.vue')
const Editor=await component('src/components/chat/ChatRedPacketEditor.vue'),Recovery=await component('src/components/chat/ChatRedPacketRecovery.vue')
const insert=(n,p,a)=>{if(n.parent){const i=n.parent.children.indexOf(n);if(i>=0)n.parent.children.splice(i,1)}const i=a?p.children.indexOf(a):-1;p.children.splice(i<0?p.children.length:i,0,n);n.parent=p},renderer=createRenderer({patchProp(n,k,o,v){n.props[k]=v;if(k==='value'){n.value=v;n._value=v}},insert,remove(n){if(n.parent)n.parent.children=n.parent.children.filter(c=>c!==n)},createElement(tag){const node={tag,tagName:tag.toUpperCase(),value:'',focus(){},addEventListener(){},removeEventListener(){},getRootNode(){return{activeElement:null}},props:{},children:[]};Object.defineProperty(node,'options',{get(){const found=[];const walk=n=>{if(n.tag==='option')found.push(n);for(const c of n.children||[])walk(c)};walk(node);return found}});return node},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(n,t){n.text=t},setElementText(n,t){n.children=[{text:t,children:[]}]},parentNode:n=>n.parent,nextSibling(n){const c=n.parent?.children||[];return c[c.indexOf(n)+1]||null},insertStaticContent(t,p,a){const n={text:t,children:[]};insert(n,p,a);return[n,n]}}),text=n=>[n.text||'',...(n.children||[]).map(text)].join(' '),find=(n,f)=>f(n)?n:(n.children||[]).map(c=>find(c,f)).find(Boolean),tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()},env=data=>({code:0,data})

function mount(pinia=createPinia()){const root={children:[]},events=[],app=renderer.createApp({setup(){return()=>h('div',[h(Editor,{onClose:()=>events.push('close')}),h(Recovery),h(Dialog)])}});app.use(pinia);app.mount(root);return{app,pinia,root,events,user:auth(pinia),store:useV3ChatRedPacketsStore(pinia),timeline:useV3ChatTimelineStore(pinia),text:()=>text(root)}}
function click(v,name){const b=find(v.root,n=>n.tag==='button'&&text(n).trim()===name);assert.ok(b,'Missing '+name);assert.ok(!b.props.disabled);return b.props.onClick()}




const user=id=>({id,userName:'user'+id,userNickname:'',userAvatarURL:''}),input={type:'average',money:100,count:2,message:'一起摸鱼'},copy=v=>JSON.parse(JSON.stringify(v)),pricing=i=>{const multiplier=i.type==='average'?i.count:i.type==='specify'?i.recipientIds.length:1,net=Math.floor(i.money*(i.type==='specify'?99:i.type==='rockPaperScissors'?85:97)/100);return{principalPoints:i.money*multiplier,poolPoints:net*multiplier,taxPoints:(i.money-net)*multiplier}}
let detailData,lose=false,readFails=false,writes=[],receipts=new Map(),applied=0,claimAmount=0
function resetDetail(i=input,sender='2'){detailData={id:'3',createdAt:3,...pricing(i),type:i.type,message:i.message,money:i.money,count:i.type==='rockPaperScissors'?1:i.type==='specify'?i.recipientIds.length:i.count,got:0,sender:user(sender),claims:[],currentUserClaim:null};if(i.type==='specify'&&sender==='1')detailData.recipientIds=i.recipientIds;if(i.type==='rockPaperScissors'&&sender==='1')detailData.senderGesture=i.gesture}
resetDetail()
const message=()=>({id:'3',createdAt:3,type:'redPacket',content:'',contentHtml:'',author:user(detailData.sender.id),client:'Web/PC网页端',card:{type:detailData.type,message:detailData.message,money:detailData.money,count:detailData.count,got:detailData.got}})
const dispatch=async(path,init)=>{if(init?.method==='POST'){writes.push({path,init});const key=init.headers['Idempotency-Key'];if(receipts.has(key))return env(copy(receipts.get(key)));let result;if(path.endsWith('/claims')){const body=JSON.parse(init.body),claim={amount:claimAmount,claimedAt:5};if(detailData.type==='rockPaperScissors'){claim.gesture=body.gesture;claim.outcome=claimAmount>0?'win':claimAmount<0?'lose':'tie';claim.senderRefundPoints=detailData.poolPoints-claimAmount;detailData.senderGesture=0}detailData.claims=[{...claim,user:user('1')}];detailData.currentUserClaim=claim;detailData.got=1;result={id:'3',...claim}}else{const body=JSON.parse(init.body);resetDetail(body,'1');result={id:'3',createdAt:3,...pricing(body)}}receipts.set(key,copy(result));applied++;if(lose){lose=false;throw Error('ACK lost')}return env({...result,internal:'SECRET'})}if(readFails)throw new ApiError('current503',503);return env(path.includes('/messages/')?message():copy(detailData))};state.dispatch=dispatch
for(const i of [input,{type:'random',money:32,count:1,message:''},{type:'specify',money:32,message:'专属',recipientIds:['2','3']},{type:'heartbeat',money:32,count:5,message:'心跳',riskAccepted:true},{type:'rockPaperScissors',money:256,message:'猜拳',riskAccepted:true,gesture:0}]){const expected=pricing(i);assert.deepEqual(await api.createPacket(i,'api-'+i.type,'1'),{id:'3',createdAt:3,...expected});assert.deepEqual(JSON.parse(writes.at(-1).init.body),i);assert.equal(writes.at(-1).path,'/api/v3/chat/red-packets')}
console.log('PASS packets 1 all five exact create bodies/key, total versus per-share principal and conserved white-list receipts')
for(const i of [{...input,money:'100'},{...input,money:31},{...input,count:101},{...input,message:'x'.repeat(21)},{...input,message:'\n'},{...input,recipientIds:['2']},{...input,riskAccepted:true},{type:'specify',money:32,message:'',recipientIds:['1']},{type:'specify',money:32,message:'',recipientIds:['2','2']},{type:'specify',money:32,message:'',recipientIds:['02']},{type:'heartbeat',money:32,count:5,message:''},{type:'heartbeat',money:32,count:4,message:'',riskAccepted:true},{type:'rockPaperScissors',money:255,message:'',riskAccepted:true,gesture:0},{type:'rockPaperScissors',money:256,message:'',riskAccepted:true,gesture:3}])assert.throws(()=>api.packetInput(i,'1'),e=>e.status===422)
assert.equal(api.packetInput({...input,message:'😀 <3'},'1').message,'😀 <3');for(const [t,i]of [['heartbeat',{}],['rockPaperScissors',{riskAccepted:true}],['average',{gesture:0}]])assert.throws(()=>api.packetClaimInput(t,i),e=>e.status===422)
console.log('PASS packets 2 typed money/count/message/IDs/self/duplicates and explicit risk/gesture reject invalid operations before sending')
state.dispatch=async()=>env({id:'3',createdAt:3,principalPoints:200,poolPoints:195,taxPoints:6});await assert.rejects(api.createPacket(input,'bad','1'),e=>e.status===502);state.dispatch=dispatch;resetDetail();detailData.claims=[{amount:0,claimedAt:5,user:user('1'),internal:'SECRET'}];detailData.got=1;detailData.currentUserClaim={amount:0,claimedAt:5};const detail=await api.packetDetail('3','1');assert.equal(detail.currentUserClaim.amount,0);assert.equal(detail.claims[0].internal,undefined);assert.equal(state.calls.at(-1).init.cache,'no-store');detailData.recipientIds=['2'];await assert.rejects(api.packetDetail('3','1'),e=>e.status===502);delete detailData.recipientIds;detailData.senderGesture=0;await assert.rejects(api.packetDetail('3','1'),e=>e.status===502);resetDetail()
console.log('PASS packets 3 receipt conservation, real zero claim, public white-list and hidden recipient/gesture field boundaries')
let v=mount();const fields=(tag='input')=>{const a=[];const walk=n=>{if(n.tag===tag)a.push(n);for(const c of n.children||[])walk(c)};walk(v.root);return a};state.confirm=async()=>{throw Error('Unexpected extra confirmation')};let before=writes.length;assert.match(v.text(),/本次支付\s+32/);await find(v.root,n=>n.tag==='form').props.onSubmit({preventDefault(){}});await tick();assert.deepEqual(v.events,['close']);assert.equal(v.store.receipt.kind,'create');assert.equal(v.timeline.messages[0].type,'redPacket');v.app.unmount();v.store.$dispose();v.timeline.$dispose();state.confirm=async()=>true
console.log('PASS packets 4 complete editor displays principal inline, direct creation closes matching input and reads current message')
const selectType = (view, type) => {
  const option = find(view.root, node => node.tag === 'input' && node.props.name === 'packet-type' && node.props.value === type)
  option.props['onUpdate:modelValue'](type)
}
v=mount();selectType(v,'heartbeat');await tick();assert.equal(fields().filter(node=>node.props.type==='number')[1].value,5);assert.match(v.text(),/负积分/);before=writes.length;await find(v.root,n=>n.tag==='form').props.onSubmit({preventDefault(){}});await tick();assert.equal(JSON.parse(writes.at(-1).init.body).riskAccepted,true);v.app.unmount();v.store.$dispose();v.timeline.$dispose()
console.log('PASS packets 5 heartbeat editor uses at least five shares and displays risk inline before direct submission')
v = mount()
state.dispatch = (path, init) => path.startsWith('/api/v3/suggestions/users?')
  ? Promise.resolve(env({ list: [user('2'), user('3')] }))
  : dispatch(path, init)
selectType(v, 'specify')
await tick()
before = writes.length
await find(v.root, node => node.tag === 'form').props.onSubmit({ preventDefault() {} })
assert.equal(writes.length, before)
assert.match(v.text(), /请先从搜索结果中选择接收人/)
fields().find(node => node.props.placeholder === '输入用户名搜索').props['onUpdate:modelValue']('user')
await new Promise(resolve => setTimeout(resolve, 250))
await tick()
await click(v, '@user2')
await tick()
assert.match(v.text(), /本次支付\s+32\s+积分/)
await find(v.root, node => node.tag === 'form').props.onSubmit({ preventDefault() {} })
await tick()
assert.deepEqual(JSON.parse(writes.at(-1).init.body), { type: 'specify', money: 32, message: '一起摸鱼', recipientIds: ['2'] })
assert.deepEqual(v.events, ['close'])
v.app.unmount()
v.store.$dispose()
v.timeline.$dispose()
state.dispatch = dispatch
console.log('PASS designated packet resolves a selected username to an ID and submits no count')

v=mount();lose=true;const priorApplied=applied;await v.store.create(input);const frozen=writes.at(-1),pinia=v.pinia;assert.ok(v.store.pending);v.app.unmount();v=mount(pinia);await click(v,'恢复本次红包操作');await tick();assert.equal(writes.at(-1).init.body,frozen.init.body);assert.equal(writes.at(-1).init.headers['Idempotency-Key'],frozen.init.headers['Idempotency-Key']);assert.equal(applied,priorApplied+1);assert.equal(v.store.pending,null);v.app.unmount();v.store.$dispose();v.timeline.$dispose()
console.log('PASS packets 6 committed/ACK loss recovers exact create/body/key across SPA without another accepted creation')
v=mount();readFails=true;await v.store.create(input);await tick();assert.match(v.store.readError,/current503/);before=writes.length;readFails=false;await click(v,'重读当前红包消息');await tick();assert.equal(writes.length,before);v.app.unmount();v.store.$dispose();v.timeline.$dispose()
console.log('PASS packets 7 post-confirmation current-message failure retries GET only, never repays principal')
v=mount();resetDetail();before=writes.length;await v.store.open('3');await tick();assert.equal(writes.length,before);assert.equal(v.store.detail.id,'3');claimAmount=0;state.confirm=async()=>{throw Error('Unexpected extra confirmation')};await click(v,'领取一份');await tick();assert.deepEqual(JSON.parse(writes.at(-1).init.body),{});assert.equal(v.store.receipt.data.amount,0);assert.equal(v.store.detail.currentUserClaim.amount,0);assert.ok(!find(v.root,n=>n.props?.class==='packet-recovery'),'A successful receipt must not create a top recovery banner');assert.ok(!find(v.root,n=>n.tag==='button'&&text(n).trim()==='领取一份'));v.app.unmount();v.store.$dispose();v.timeline.$dispose()
console.log('PASS packets 8 detail GET never claims, explicit safe claim preserves real zero and current refresh disables repeat claim')
v=mount();resetDetail({type:'heartbeat',money:100,count:5,message:'heart',riskAccepted:true});await v.store.open('3');await tick();claimAmount=-20;assert.match(v.text(),/负积分/);assert.match(v.text(),/97 积分/);before=writes.length;await click(v,'接受扣分风险并领取');await tick();assert.deepEqual(JSON.parse(writes.at(-1).init.body),{riskAccepted:true});assert.match(v.text(),/-20.*扣款/);v.app.unmount();v.store.$dispose();v.timeline.$dispose()
console.log('PASS packets 9 heartbeat claim risk/required balance is explicit, direct submission and negative receipt is shown as debit')
v=mount();resetDetail({type:'rockPaperScissors',money:256,message:'rps',riskAccepted:true,gesture:0});await v.store.open('3');await tick();assert.equal(v.store.detail.senderGesture,undefined);before=writes.length;assert.ok(!find(v.root,n=>n.tag==='button'&&text(n).trim()==='领取一份'));claimAmount=-217;await click(v,'剪刀 · 领取');await tick();assert.deepEqual(JSON.parse(writes.at(-1).init.body),{riskAccepted:true,gesture:1});assert.equal(v.store.receipt.data.outcome,'lose');assert.equal(v.store.detail.senderGesture,0);assert.equal(v.store.receipt.data.senderRefundPoints,434);v.app.unmount();v.store.$dispose();v.timeline.$dispose()
console.log('PASS packets 10 RPS requires chosen hand and risk decision, hides sender hand before settlement, reports debit/outcome/refund afterward')
v=mount();resetDetail();claimAmount=0;lose=true;const previous=applied;await v.store.claim('3','average',{});const first=writes.at(-1);assert.ok(v.store.pending);v.user.accessToken='rotated';assert.equal(v.store.pending.key,first.init.headers['Idempotency-Key']);await click(v,'恢复本次红包操作');await tick();assert.equal(applied,previous+1);assert.equal(writes.at(-1).init.body,first.init.body);assert.equal(writes.at(-1).init.headers['Idempotency-Key'],first.init.headers['Idempotency-Key']);v.app.unmount();v.store.$dispose();v.timeline.$dispose()
console.log('PASS packets 11 unknown claim keeps exact target/type/risk/hand/key across token rotation, one accepted settlement on recovery')
v=mount();state.dispatch=async()=>{const e=new ApiError('confirm',409);e.code='confirmation_required';throw e};await v.store.create(input);const pending=v.store.pending;before=state.calls.length;await v.store.retry();assert.equal(state.calls.length,before);state.confirm=async()=>false;await click(v,'再次确认原红包操作');assert.equal(v.store.pending,pending);state.confirm=async()=>true;state.dispatch=dispatch;await click(v,'再次确认原红包操作');await tick();assert.equal(v.store.pending,null);v.app.unmount();v.store.$dispose();v.timeline.$dispose()
console.log('PASS packets 12 platform confirmation replays only explicitly approved original command')
v=mount();state.dispatch=async()=>{throw new ApiError('bad',422)};await v.store.create(input);assert.equal(v.store.pending,null);state.dispatch=async()=>{throw Error('unknown')};await v.store.create(input);const unknown=v.store.pending;state.dispatch=async()=>{throw new ApiError('recovery403',403)};await v.store.retry();assert.equal(v.store.pending,unknown);assert.equal(await v.store.claim('3','average',{}),null);assert.equal(v.store.pending,unknown);v.user.account={oId:'2'};assert.equal(v.store.pending,null);v.app.unmount();v.store.$dispose();v.timeline.$dispose();state.dispatch=dispatch
console.log('PASS packets 13 initial definitive error permits correction, unknown recovery 4xx freezes original and prevents competing create/claim; owner change clears')
let release;v=mount();state.dispatch=()=>new Promise(r=>release=r);const late=v.store.create(input);await tick();v.user.accessToken=null;release(env({id:'3',createdAt:3,...pricing(input)}));await late;assert.equal(v.store.receipt,null);assert.equal(v.timeline.messages.length,0);v.app.unmount();v.store.$dispose();v.timeline.$dispose();state.dispatch=dispatch
console.log('PASS packets 14 logout discards late paid receipt and prevents timeline projection')
v=mount();resetDetail();await v.store.open('3');await v.store.open('bad');assert.equal(v.store.detail,null);assert.ok(v.store.detailError);assert.equal(v.store.selectedId,'bad');v.app.unmount();v.store.$dispose();v.timeline.$dispose()
console.log('PASS packets 15 invalid next detail clears previous target, cannot leave a stale claimable packet under an error')
state.ssr=true;v=mount();before=state.calls.length;await v.store.create(input);await v.store.open('3');assert.equal(state.calls.length,before);v.app.unmount();v.store.$dispose();v.timeline.$dispose();state.ssr=false;state.guest=true;v=mount();before=state.calls.length;await v.store.claim('3','average',{});await v.store.open('3');assert.equal(state.calls.length,before);v.app.unmount();v.store.$dispose();v.timeline.$dispose();state.guest=false
const main=await fs.readFile('src/views/ChatroomView.vue','utf8'),floating=await fs.readFile('src/components/chat/WhisperConversations.vue','utf8'),hidden=await fs.readFile('src/components/chat/HiddenChatConversations.vue','utf8'),facade=await fs.readFile('src/stores/chat.ts','utf8'),shell=await fs.readFile('src/layouts/AppShell.vue','utf8');assert.ok(main.includes('<ChatToolDialog '));assert.equal(main.split('<ChatRedPacketEditor ').length-1,0);assert.equal(main.split('<ChatRedPacketCard ').length-1,2);assert.ok(floating.includes('<ChatRedPacketCard ')&&hidden.includes('<ChatRedPacketCard '));assert.equal(shell.split('<ChatRedPacketDialog />').length-1,1);assert.ok(!shell.includes('<ChatRedPacketRecovery'));assert.ok((await fs.readFile('src/components/chat/ChatRedPacketDialog.vue','utf8')).includes('<ChatRedPacketRecovery '));assert.ok(!facade.includes('sendLegacySpecial')&&!facade.includes('openRedPacket'))
console.log('PASS packets 16 guest/SSR performs no packet work; both layouts/floating/hidden use details-first cards with one global dialog with local recovery and no legacy writes')

const Hongbao=await component('src/components/chat/HongbaoCard.vue')
globalThis.__hongbao=Hongbao
hongbaoURL=url('export default globalThis.__hongbao')
const Card=await component('src/components/chat/ChatRedPacketCard.vue')
const duel={type:'rockPaperScissors',money:256,message:'rps',riskAccepted:true,gesture:0}
function mountCard(senderId='2'){
  const pinia=createPinia(),root={children:[]}
  const app=renderer.createApp({setup(){return()=>h(Card,{packetId:'3',packet:{type:duel.type,count:1,got:0,money:256,msg:'rps',senderId}})}})
  app.use(pinia)
  app.mount(root)
  const store=useV3ChatRedPacketsStore(pinia)
  return {root,store,close(){app.unmount();store.$dispose();useV3ChatTimelineStore(pinia).$dispose()}}
}
const cardButton=(card,label)=>find(card.root,n=>n.tag==='button'&&n.props['aria-label']===label)
resetDetail(duel)
before=state.calls.length
let card=mountCard()
assert.ok(cardButton(card,'石头')&&cardButton(card,'剪刀')&&cardButton(card,'布'))
assert.equal(state.calls.length,before)
const openDetails=cardButton(card,'石头剪刀布红包：打开红包')
openDetails.props.onClick()
await tick()
assert.equal(card.store.detail.type,duel.type)
assert.deepEqual(state.calls.slice(before).map(c=>c.path),['/api/v3/chat/red-packets/3'])
card.store.close()
before=writes.length
claimAmount=-217
cardButton(card,'剪刀').props.onClick()
await tick()
assert.equal(writes.length,before+1)
assert.deepEqual(JSON.parse(writes.at(-1).init.body),{gesture:1,riskAccepted:true})
assert.equal(card.store.selectedId,'')
assert.match(text(card.root),/惜败.*-217 积分/)
assert.ok(!cardButton(card,'剪刀'))
card.close()

card=mountCard('1')
assert.ok(!cardButton(card,'剪刀'))
card.close()

state.dispatch=async()=>env({legacy:true,id:'3',type:duel.type,message:'旧猜拳',money:256,count:1,got:0,sender:user('2'),claims:[],currentUserClaim:null})
card=mountCard()
before=writes.length
cardButton(card,'石头').props.onClick()
await tick()
assert.equal(writes.length,before)
assert.match(text(card.root),/此红包当前无法出拳/)
card.close()
state.dispatch=dispatch
console.log('PASS packets 17 inline gestures require no mount reads, submit once without a dialog, keep details read-only, and block legacy or self claims')
v=mount();resetDetail({type:'rockPaperScissors',money:256,message:'own',riskAccepted:true,gesture:2},'1');await v.store.open('3');await tick();assert.equal(v.store.detail.senderGesture,2);assert.ok(!find(v.root,n=>n.tag==='button'&&text(n).trim()==='确认风险后领取'));resetDetail({type:'specify',money:32,message:'private recipients',recipientIds:['2','3']},'1');await v.store.open('3');await tick();assert.deepEqual(v.store.detail.recipientIds,['2','3']);v.app.unmount();v.store.$dispose();v.timeline.$dispose()
console.log('PASS packets 18 sender ID prevents self RPS claim and only owner detail exposes designated recipient list')
v=mount();resetDetail();let resolveClosed;const closedDetail=copy(detailData);state.dispatch=path=>path.endsWith('/3')?new Promise(r=>resolveClosed=r):dispatch(path);before=writes.length;const closedRun=v.store.open('3',true);await tick();v.store.close();resolveClosed(env(closedDetail));await closedRun;assert.equal(writes.length,before);assert.equal(v.store.detail,null);v.app.unmount();v.store.$dispose();v.timeline.$dispose();state.dispatch=dispatch;state.confirm=async()=>true
console.log('PASS packets 19 closing while click-to-claim detail loads cancels automatic claim')
v=mount();resetDetail();before=writes.length;await v.store.open('3',true);await tick();assert.equal(writes.length,before+1);await v.store.open('3',true);await tick();assert.equal(writes.length,before+1);v.app.unmount();v.store.$dispose();v.timeline.$dispose()
console.log('PASS packets 20 ordinary card click claims once and current claimed detail prevents resubmission')
v=mount();resetDetail();const earlier=copy(detailData);let resolveOld;state.dispatch=path=>path.endsWith('/3')?new Promise(r=>resolveOld=r):Promise.resolve(env({...copy(earlier),id:'4'}));const oldOpen=v.store.open('3');await tick();await v.store.open('4');assert.equal(v.store.detail.id,'4');resolveOld(env(earlier));await oldOpen;assert.equal(v.store.detail.id,'4');v.app.unmount();v.store.$dispose();v.timeline.$dispose();state.dispatch=dispatch
console.log('PASS packets 21 delayed prior detail cannot overwrite a later selected packet')
v=mount();resetDetail();await v.store.open('3');claimAmount=0;readFails=true;await v.store.claim('3','average',{});await tick();assert.equal(v.store.receipt.data.amount,0);assert.equal(v.store.detail,null);assert.match(v.store.detailError,/current503/);before=writes.length;readFails=false;await v.store.open();await v.store.readCurrent();await tick();assert.equal(writes.length,before);assert.equal(v.store.detail.currentUserClaim.amount,0);lose=true;await v.store.create(input);assert.ok(v.store.pending);assert.equal(v.store.receipt,null);v.app.unmount();v.store.$dispose();v.timeline.$dispose()
console.log('PASS packets 22 claim receipt is independent of failed detail/message refresh; only GET retries, new unknown operation clears previous receipt')

const bubbleSource=compileScript(parse(await fs.readFile('src/components/ChatBubble.vue','utf8')).descriptor,{id:'bubble',inlineTemplate:true}).content
const childStub=url('export default {render(){return null}}'),routerStub=url(`import{h}from '${import.meta.resolve('vue')}';export const RouterLink={setup(p,{slots}){return()=>h('a',slots.default?.())}}`)
const Bubble=(await import(url(replace(compile(bubbleSource),[['vue',import.meta.resolve('vue')],['@/api/v3-chat-messages',msgURL],['@/stores/auth',authURL],['@/stores/chatPreferences',url('export const useChatPreferencesStore=()=>({simpleMode:false})')],['@/stores/functionPreferences',url('export const useFunctionPreferencesStore=()=>({})')],['@/chat/mention',url(compile(await fs.readFile('src/chat/mention.ts','utf8')))],['vue-router',routerStub],['@/utils/time',url(compile(await fs.readFile('src/utils/time.ts','utf8')))],['@/components/chat/CollectChatEmoji.vue',childStub],['@/components/chat/ChatQuoteCard.vue',childStub],['@/utils/chatQuote',url(compile(await fs.readFile('src/utils/chatQuote.ts','utf8')))],['@/components/ImageLightbox.vue',childStub],['@/components/medal/MedalList.vue',childStub],['@/components/user/VipNickname.vue',childStub],['@/utils/avatar',url(compile(await fs.readFile('src/utils/avatar.ts','utf8')))],['@/utils/chatAppearance',url(compile(await fs.readFile('src/utils/chatAppearance.ts','utf8')))],['@/utils/chatMessage',url('export function isSingleImageMessage(){return false}')]])))).default
const bodyRoot={children:[]},hasCard=ref(false),bodyApp=renderer.createApp({setup(){return()=>h(Bubble,{userName:'plain',html:'<p>ordinary body</p>',chatroom:true},{default:()=>hasCard.value?h('strong','packet body'):createCommentVNode('v-if')})}});bodyApp.use(createPinia());bodyApp.mount(bodyRoot);assert.equal(find(bodyRoot,n=>n.props?.innerHTML)?.props.innerHTML,'<p>ordinary body</p>');hasCard.value=true;await tick();assert.match(text(bodyRoot),/packet body/);assert.ok(!find(bodyRoot,n=>n.props?.innerHTML));bodyApp.unmount()
console.log('PASS packets 23 actual ChatBubble falls back to ordinary HTML when conditional card slot is empty and replaces it for a card')

v=mount()
const classic={legacy:true,id:'3',type:'average',message:'经典红包示例',count:2,got:1,sender:user('2'),
  claims:[{user:user('9'),amount:32,claimedAt:5}],currentUserClaim:null}
state.dispatch=async()=>env(classic)
before=state.calls.length
await v.store.open('3',true)
await tick()
assert.deepEqual(state.calls.slice(before).map(call=>call.path),['/api/v3/chat/red-packets/3'])
assert.match(v.text(),/经典红包示例/)
assert.match(v.text(),/领取记录/)
assert.doesNotMatch(v.text(),/仅查看领取记录|查看详情不会领取/)
assert.ok(!find(v.root,n=>n.tag==='button'&&text(n).trim()==='领取一份'))
await v.store.claim('3','average',{})
assert.equal(state.calls.length,before+1)
v.app.unmount();v.store.$dispose();v.timeline.$dispose();state.dispatch=dispatch
console.log('PASS classic packet opens read-only through the card auto-claim path')
