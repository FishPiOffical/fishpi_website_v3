import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, setActivePinia, defineStore } from 'pinia'
import { ref, nextTick } from 'vue'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__finance={requests:[],responses:[],context:1,SSR:false,confirm:async()=>true,keys:0}
const state=__finance
const http=url(`export class ApiError extends Error {constructor(message,status=0,code){super(message);this.status=status;this.code=code}} export function getAuthContextVersion(){return globalThis.__finance.context} export async function request(path,init){globalThis.__finance.requests.push({path,...init});const r=globalThis.__finance.responses.shift();if(r instanceof Error)throw r;if(r===undefined)throw Error('Missing response');return typeof r==='function'?await r():r}`)
const {ApiError}=await import(http)
const api=await import(url(compile(await fs.readFile('src/api/v3-finance.ts','utf8')).replace("from './http'",`from '${http}'`)))
const env=data=>({code:0,data}), receipt={transferId:'123',recipient:{userId:'2',userName:'Alice',secret:'private'},amount:100,receivedPoints:99,feePoints:1,memo:'clean',internal:'secret'}, invite={code:'AbCd1234EfGh5678',expiresAt:1795500000000,paidPoints:100}
state.responses.push(env(receipt));assert.deepEqual(await api.transferV3Points({userName:' Alice ',amount:100,memo:'  <b>hello</b>  '},'key-1'),{transferId:'123',recipient:{userId:'2',userName:'Alice'},amount:100,receivedPoints:99,feePoints:1,memo:'clean'})
assert.deepEqual(JSON.parse(state.requests.at(-1).body),{userName:'Alice',amount:100,memo:'<b>hello</b>'});assert.equal(state.requests.at(-1).headers['Idempotency-Key'],'key-1')
for(const bad of [{amount:1},{amount:2.5},{amount:2147483648},{userName:'<Alice>'},{memo:'x'.repeat(129)},{memo:'x\u0001x'},{memo:'x\ud800'}])assert.throws(()=>api.pointTransferInput({userName:'Alice',amount:100,memo:'',...bad}))
assert.equal(api.pointTransferInput({userName:'Alice',amount:2147483647,memo:'a\nb'}).amount,2147483647)
for(const bad of [{feePoints:2},{amount:101},{recipient:{userId:2,userName:'Alice'}},{memo:'x'.repeat(256)}]){state.responses.push(env({...receipt,...bad}));await assert.rejects(api.transferV3Points({userName:'Alice',amount:100,memo:''},'key'),e=>e.status===502)}
console.log('PASS finance 1 strict transfer input, closed request, conservation and private-field projection')
state.responses.push(env(invite));assert.deepEqual(await api.purchaseV3Invitation('purchase'),invite);assert.equal(state.requests.at(-1).body,'{}')
for(const status of ['unused','used','stopped']){state.responses.push(env({status,reservation:'private'}));assert.equal(await api.fetchV3InvitationStatus(' '+invite.code+' '),status);assert.equal(state.requests.at(-1).path,'/api/v3/invitation-codes/status');assert.deepEqual(JSON.parse(state.requests.at(-1).body),{code:invite.code})}
state.responses.push(env({status:'reserved'}));await assert.rejects(api.fetchV3InvitationStatus(invite.code),e=>e.status===502)
await assert.rejects(api.fetchV3InvitationStatus('bad'),e=>e.status===422)
console.log('PASS finance 2 private POST status enum and invitation receipt, invalid codes never requested')
setActivePinia(createPinia())
const authDefinition=defineStore('fixture-auth',()=>({accessToken:ref('A'),account:ref({oId:'1',userName:'Owner',userPoint:10000}),reloadAccount:async()=>{if(state.reloadFail)throw Error('read unavailable')}}))
globalThis.__financeAuth=authDefinition
const authPort=url('export const useAuthStore=globalThis.__financeAuth')
const dialogPort=url('export function fpConfirm(input){return globalThis.__finance.confirm(input)}')
const keyPort=url('export function profileOperationKey(){return `finance-${++globalThis.__finance.keys}`}')
const apiPort=url(['pointTransferInput','transferV3Points','purchaseV3Invitation'].map(k=>`export const ${k}=globalThis.__financeAPI.${k}`).join('\n'));globalThis.__financeAPI=api
let storeSource=compile(await fs.readFile('src/stores/v3Finance.ts','utf8')).replaceAll('import.meta.env.SSR','globalThis.__finance.SSR')
for(const [from,to] of [['pinia',import.meta.resolve('pinia')],['vue',import.meta.resolve('vue')],['@/api/http',http],['@/stores/auth',authPort],['@/composables/useDialog',dialogPort],['@/api/v3-profile',keyPort],['@/api/v3-finance',apiPort]])storeSource=storeSource.replace(`from '${from}'`,`from '${to}'`)
const {useV3FinanceStore}=await import(url(storeSource)),auth=authDefinition(),store=useV3FinanceStore()
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}
const until=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,1))}throw Error('Pending timeout')}
state.requests=[];state.responses.push(new ApiError('unknown',503));await store.transfer({userName:'Alice',amount:100,memo:'hello'})
const frozen=JSON.parse(JSON.stringify(store.transferPending)),request=state.requests.at(-1);assert.ok(frozen);assert.equal(store.transferReceipt,null)
auth.accessToken='B';assert.deepEqual(JSON.parse(JSON.stringify(store.transferPending)),frozen)
assert.equal(useV3FinanceStore(),store);await store.transfer({userName:'Bob',amount:200,memo:'other'});assert.equal(state.requests.length,1)
state.responses.push(new ApiError('rate',429));store.retryTransfer();await until(()=>!store.transferBusy);assert.deepEqual(JSON.parse(JSON.stringify(store.transferPending)),frozen)
state.responses.push(env(receipt));store.retryTransfer();await until(()=>!store.transferBusy);assert.equal(store.transferPending,null);assert.equal(store.transferReceipt.amount,100)
assert.ok(state.requests.every(r=>r.body===request.body&&r.headers['Idempotency-Key']===request.headers['Idempotency-Key']))
console.log('PASS finance 3 unknown result survives token refresh/route reuse; failed recovery retains frozen command and same key until confirmed')
state.reloadFail=true;state.responses.push(env(receipt));await store.transfer({userName:'Alice',amount:100,memo:''});assert.equal(store.transferReceipt.amount,100);assert.match(store.refreshError,/操作已确认/);assert.equal(store.transferPending,null);state.reloadFail=false
state.responses.push(new ApiError('invalid',422));await store.transfer({userName:'Alice',amount:100,memo:''});assert.equal(store.transferPending,null)
state.confirm=async()=>false;const before=state.requests.length;await store.transfer({userName:'Alice',amount:100,memo:''});assert.equal(state.requests.length,before)
console.log('PASS finance 4 confirmed mutation survives account-read error, initial validation releases form and confirmation cancellation sends nothing')
state.confirm=async()=>true;let release;state.responses.push(()=>new Promise(r=>release=r));const pending=store.transfer({userName:'Alice',amount:100,memo:''});await until(()=>!!release)
state.context++;auth.accessToken='C';assert.equal(store.transferPending,null);release(env(receipt));await pending;assert.equal(store.transferReceipt,null);assert.equal(store.transferBusy,false)
state.responses.push(new ApiError('unknown',503));await store.purchaseInvitation();const invitationKey=store.invitationPending.key;auth.accessToken='D';assert.equal(store.invitationPending.key,invitationKey)
state.responses.push(env(invite));store.retryInvitation();await until(()=>!store.invitationBusy);assert.equal(store.invitations.length,1);assert.equal(state.requests.at(-1).headers['Idempotency-Key'],invitationKey)
state.responses.push(env(invite));await store.purchaseInvitation();assert.equal(store.invitations.length,1)
auth.accessToken=null;assert.equal(store.invitations.length,0);assert.equal(store.invitationPending,null);assert.equal(store.transferReceipt,null)
console.log('PASS finance 5 old identity result discarded; invitation retry preserves key, deduplicates receipt and logout clears private memory')
auth.accessToken='E';state.SSR=true;const count=state.requests.length;await store.purchaseInvitation();await store.transfer({userName:'Alice',amount:100,memo:''});assert.equal(state.requests.length,count);state.SSR=false
let confirmRelease;state.confirm=()=>new Promise(r=>confirmRelease=r);const confirming=store.purchaseInvitation();await until(()=>!!confirmRelease);state.context++;auth.accessToken='F';confirmRelease(true);await confirming;assert.equal(state.requests.length,count)
console.log('PASS finance 6 SSR never sends, identity change while confirming never submits the old intent')
// Exercise the real transport refresh/retry path, rather than substituting its identity revision.
let transportSource=compile(await fs.readFile('src/api/http.ts','utf8')).replace("from '@/utils/riskCaptcha'",`from '${url('export async function ensureRiskCaptcha(){throw Error("Unexpected captcha")}')}'`).replaceAll('import.meta.env.SSR','false').replaceAll('import.meta.env.VITE_API_TARGET',"''")
const transport=await import(url(transportSource));let tokenNotifications=[];transport.onAccessTokenChange(t=>tokenNotifications.push(t));transport.setAccessToken('old');const context=transport.getAuthContextVersion(),network=[];const originalFetch=globalThis.fetch
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
globalThis.fetch=async(path,init)=>{network.push({path,body:init.body,key:init.headers.get('Idempotency-Key'),auth:init.headers.get('Authorization')});if(path==='/api/v3/auth/refresh')return json({code:0,data:{accessToken:'rotated'}});return init.headers.get('Authorization')==='Bearer old'?json({msg:'expired'},401):json({code:0,data:receipt})}
try {await transport.request('/api/v3/me/point-transfers',{method:'POST',headers:{'Idempotency-Key':'frozen-key'},body:'{"amount":100}'});assert.equal(transport.getAuthContextVersion(),context);assert.equal(transport.getAccessToken(),'rotated');assert.deepEqual(tokenNotifications,[null,'old','rotated']);const writes=network.filter(r=>r.path.endsWith('point-transfers'));assert.equal(writes.length,2);assert.ok(writes.every(r=>r.body==='{"amount":100}'&&r.key==='frozen-key'));transport.setAccessToken(null);assert.equal(transport.getAuthContextVersion(),context+1)}finally{globalThis.fetch=originalFetch}
console.log('PASS finance 7 real HTTP 401 rotation preserves identity boundary, original write body/key; logout advances boundary')
