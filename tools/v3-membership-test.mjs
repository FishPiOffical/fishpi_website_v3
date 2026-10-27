import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createRenderer, nextTick, ref } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__membershipRequests=[];globalThis.__membershipResponses=[]
const http=url(`export class ApiError extends Error{constructor(message,status=0,code){super(message);this.status=status;this.code=code}} export async function request(path,init){globalThis.__membershipRequests.push({path,init});const result=globalThis.__membershipResponses.shift();if(result instanceof Error)throw result;if(result===undefined)throw Error('Unexpected '+path);return result}`)
const {ApiError}=await import(http)
const api=await import(url(compile(await fs.readFile('src/api/v3-membership.ts','utf8')).replace("from './http'",`from '${http}'`)))
const plan={id:'10',code:'VIP4_MONTH',name:'至尊会员',price:1000,durationType:'月卡',durationValue:30,benefits:{bold:false,underline:false,color:'#AABBCC',autoCheckin:false,checkinCard:0}}
const inactive={active:false,levelCode:'',expiresAt:0,config:{}},active={active:true,levelCode:'VIP4_MONTH',expiresAt:0,config:{}}
const receipt={id:'100',levelCode:'VIP4_MONTH',paidPoints:800,expiresAt:1795500000000}
const page=(list,p=1,total=list.length)=>({list,pagination:{p,size:50,total,pageCount:Math.ceil(total/50)}}),envelope=data=>({code:0,data})
const first=Array.from({length:50},(_,i)=>({...plan,id:String(i+1)}));__membershipResponses.push(envelope(page(first,1,51)),envelope(page([{...plan,id:'51'}],2,51)));assert.equal((await api.fetchV3MembershipLevels()).length,51);assert.match(__membershipRequests.at(-1).path,/p=2&size=50/)
__membershipResponses.push(envelope(page([plan,plan])));await assert.rejects(api.fetchV3MembershipLevels(),/格式/)
__membershipResponses.push(envelope(page(first,1,51)),envelope(page([{...plan,id:'51'}],2,52)));await assert.rejects(api.fetchV3MembershipLevels(),/格式/)
__membershipResponses.push(envelope(page(first,1,1001)));await assert.rejects(api.fetchV3MembershipLevels(),error=>error.status===503)
console.log('PASS membership 1 complete paged catalog without period assumptions, duplicate/change/budget failures never return truncated success')
__membershipResponses.push(envelope({...active,config:{bold:false,checkinCard:0,internal:'secret'}}));assert.deepEqual((await api.fetchV3Membership()).config,{bold:false,checkinCard:0})
__membershipResponses.push(envelope(inactive));assert.deepEqual(await api.fetchV3Membership(),inactive)
__membershipResponses.push(envelope({...inactive,config:{bold:true}}));await assert.rejects(api.fetchV3Membership(),/格式/)
assert.deepEqual(api.membershipDisplayFields([plan],active),['bold','underline','color']);assert.deepEqual(api.membershipDisplayFields([plan],inactive),[])
assert.throws(()=>api.membershipDisplayFields([{...plan,code:'other'}],active),/未找到/)
assert.throws(()=>api.membershipDisplayFields([plan,{...plan,id:'11',benefits:{bold:false}}],active),/不一致/)
console.log('PASS membership 2 inactive/permanent/current config contracts, exact supported-field presence rather than truthiness and ambiguous catalog rejection')
__membershipResponses.push(envelope({config:{bold:false,color:'#AABBCC',autoCheckin:true}}));assert.deepEqual(await api.saveV3MembershipDisplay({bold:false},'display-key'),{bold:false,color:'#AABBCC'})
let req=__membershipRequests.at(-1);assert.equal(req.path,'/api/v3/me/membership/config');assert.equal(req.init.method,'PUT');assert.deepEqual(JSON.parse(req.init.body),{bold:false});assert.equal(req.init.headers['Idempotency-Key'],'display-key')
await assert.rejects(api.saveV3MembershipDisplay({autoCheckin:true},'bad'),error=>error.status===422)
assert.deepEqual(api.membershipOpening('10','  COUPON12  '),{levelId:'10',couponCode:'COUPON12'});assert.deepEqual(api.membershipOpening('10','  '),{levelId:'10',couponCode:''})
for(const coupon of ['short','\tCOUPON12','\ud800COUPON12','A'.repeat(33)])assert.throws(()=>api.membershipOpening('10',coupon))
__membershipResponses.push(envelope({...receipt,transferId:'must-not-project',couponCode:'private'}));assert.deepEqual(await api.openV3Membership({levelId:'10',couponCode:'COUPON12',userId:'ignored',price:1},'open-key'),receipt)
req=__membershipRequests.at(-1);assert.equal(req.init.method,'POST');assert.deepEqual(JSON.parse(req.init.body),{levelId:'10',couponCode:'COUPON12'});assert.equal(req.init.headers['Idempotency-Key'],'open-key')
console.log('PASS membership 3 exact partial display/opening bodies, ASCII coupon normalization and safe receipt projection without owner/price/benefit input')
const renderer=createRenderer({patchProp(){},insert(){},remove(){},createElement(){return{}},createText(){return{}},createComment(){return{}},setText(){},setElementText(){},parentNode(){return null},nextSibling(){return null}})
setActivePinia(createPinia());let reloads=0;const auth=defineStore('membership-test-auth',()=>({accessToken:ref('A'),account:ref({oId:'1',userName:'owner',userNickname:'Owner'}),reloadAccount:async()=>{reloads++}}))();globalThis.__membershipAuth=()=>auth;globalThis.__membershipAPI={...api};globalThis.__membershipKey=0;globalThis.__membershipConfirm=async()=>true
const authURL=url('export const useAuthStore=globalThis.__membershipAuth'),apiURL=url(Object.keys(api).map(name=>typeof api[name]==='function'?`export const ${name}=(...args)=>globalThis.__membershipAPI.${name}(...args);`:`export const ${name}=globalThis.__membershipAPI.${name};`).join('\n'))
const keyURL=url('export const profileOperationKey=()=>"member-key-"+(++globalThis.__membershipKey)'),dialogURL=url('export const fpConfirm=(...args)=>globalThis.__membershipConfirm(...args)')
const forbidden=url('export async function fetchV3MembershipStyles(){throw Error("UNEXPECTED STYLE READ")} export function membershipUserId(v){return /^[1-9][0-9]{0,18}$/.test(String(v))?String(v):""} export async function resolveV3NicknameUser(){throw Error("UNEXPECTED USER READ")}')
const nicknameHttp=url('export function getAccessToken(){return null} export function onAccessTokenChange(){return()=>{}}')
const nickname=await fs.readFile('src/composables/useVipNickname.ts','utf8'),nicknameURL=url(compile(nickname).replace("from '@/api/http'",`from '${nicknameHttp}'`).replace("from '@/api/v3-membership-styles'",`from '${forbidden}'`).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replaceAll('import.meta.env.SSR','false'))
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}
async function component(){let source=(await fs.readFile('src/components/settings/OwnerMembership.vue','utf8')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];let js=compile(source).replace("from '@/stores/auth'",`from '${authURL}'`).replace("from '@/api/http'",`from '${http}'`).replace("from '@/api/v3-membership'",`from '${apiURL}'`).replace("from '@/api/v3-profile'",`from '${keyURL}'`).replace("from '@/composables/useDialog'",`from '${dialogURL}'`).replace("from '@/composables/useVipNickname'",`from '${nicknameURL}'`).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replace("from 'pinia'",`from '${import.meta.resolve('pinia')}'`);const imports=[...js.matchAll(/^import .+;$/gm)].map(m=>m[0]).join('\n');js=js.replace(/^import .+;$/gm,'');const mod=await import(url(`${imports}\nexport default{setup(){${js}\nreturn{levels,state,support,advanced,draft,coupon,busy,pending,error,message,stateError,buy,save,retry,loadState,loadLevels}},render(){return null}}`));const app=renderer.createApp(mod.default);app.use(createPinia());return{app,vm:app.mount({})}}
let releaseOld;const old=new Promise(resolve=>releaseOld=resolve)
Object.assign(__membershipAPI,{fetchV3MembershipLevels:async()=>[plan],fetchV3Membership:async()=>auth.accessToken==='A'?old:active})
let view=await component();await tick();auth.accessToken='B';await tick();releaseOld({...active,levelCode:'PRIVATE-A'});await tick();assert.equal(view.vm.state.levelCode,'VIP4_MONTH');assert.equal(view.vm.draft.bold,'');assert.equal(view.vm.advanced,true);auth.accessToken=null;assert.equal(view.vm.state,null);assert.deepEqual(view.vm.levels,[]);assert.equal(view.vm.coupon,'');view.app.unmount()
console.log('PASS membership 4 actual Vue/Pinia isolates late reads and clears account state, coupon, catalog and drafts across credentials')
auth.accessToken='C';let confirmed,resolveConfirm,writes=0
__membershipAPI.fetchV3Membership=async()=>inactive;__membershipAPI.openV3Membership=async()=>{writes++;return receipt};__membershipConfirm=async options=>{confirmed=options;return new Promise(resolve=>resolveConfirm=resolve)}
view=await component();await tick();view.vm.coupon='COUPON12';const buying=view.vm.buy(plan);await tick();assert.match(confirmed.message,/1000/);view.vm.coupon='DIFFERENT';auth.accessToken=null;resolveConfirm(true);await buying;assert.equal(writes,0);view.app.unmount()
console.log('PASS membership 5 explicit review captures plan/coupon and an identity change while confirmation is open cannot submit a purchase')
auth.accessToken='D';__membershipConfirm=async()=>true;let fail=true;const purchases=[]
__membershipAPI.openV3Membership=async(input,key)=>{purchases.push({input:JSON.parse(JSON.stringify(input)),key});if(fail){fail=false;throw new ApiError('lost ACK',0)}return receipt}
view=await component();await tick();view.vm.coupon='COUPON12';await view.vm.buy(plan);assert.ok(view.vm.pending);view.vm.coupon='DIFFERENT';await view.vm.buy({...plan,id:'11'});assert.equal(purchases.length,1);view.vm.retry();await tick();assert.deepEqual(purchases[0],purchases[1]);assert.match(view.vm.message,/800/);assert.equal(view.vm.pending,null);view.app.unmount()
console.log('PASS membership 6 unknown opening preserves original plan/coupon/key and blocks another purchase; same-key recovery reports actual charged points')
auth.accessToken='E';const configurations=[];let current=active
__membershipAPI.fetchV3Membership=async()=>current;__membershipAPI.saveV3MembershipDisplay=async(changes,key)=>{configurations.push({changes:JSON.parse(JSON.stringify(changes)),key});current={...active,config:{color:changes.color}};return current.config}
view=await component();await tick();view.vm.draft.color='#112233';await view.vm.save();assert.deepEqual(configurations[0].changes,{color:'#112233'});assert.equal(view.vm.draft.bold,'');assert.equal(view.vm.draft.color,'#112233');assert.equal(view.vm.message,'会员展示设置已保存')
current={...active,levelCode:'VIP1_MONTH',config:{}};__membershipAPI.fetchV3MembershipLevels=async()=>[{...plan,code:'VIP1_MONTH'}];await view.vm.loadLevels();await view.vm.loadState();view.vm.draft.color='rainbow';await view.vm.save();assert.match(view.vm.error,/仅VIP4/);assert.equal(configurations.length,1);view.app.unmount()
console.log('PASS membership 7 missing legacy display fields are not defaulted into writes; only supported changed fields save and exact VIP4 effect gate holds')
auth.accessToken='F';let count=0;__membershipAPI.fetchV3MembershipLevels=async()=>[plan];__membershipAPI.fetchV3Membership=async()=>{if(++count>1)throw Error('read failed');return inactive};__membershipAPI.openV3Membership=async()=>receipt
view=await component();await tick();await view.vm.buy(plan);assert.match(view.vm.message,/800/);assert.match(view.vm.stateError,/read failed/);assert.equal(view.vm.pending,null);assert.equal(view.vm.state,null)
__membershipAPI.fetchV3Membership=async()=>inactive;await view.vm.loadState();__membershipAPI.openV3Membership=async()=>{throw new ApiError('coupon invalid',422)};await view.vm.buy(plan);assert.equal(view.vm.pending,null);assert.match(view.vm.error,/coupon invalid/);view.app.unmount()
console.log('PASS membership 8 confirmed opening survives follow-up read failure, retryable reads never rebuy and definitive coupon rejection clears intent')
const vip=await fs.readFile('src/views/VipView.vue','utf8');assert.match(vip,/<OwnerMembership/);assert.ok(!vip.includes('apiKey')&&!vip.includes('fetchMembershipDetail'))
