import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createRenderer, nextTick, ref } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
globalThis.__medalRequests = []; globalThis.__medalResponses = []
const http = url(`export class ApiError extends Error {constructor(message,status=0,code){super(message);this.status=status;this.code=code}} export async function request(path,init){globalThis.__medalRequests.push({path,init}); const result=globalThis.__medalResponses.shift();if(result instanceof Error)throw result;if(result===undefined)throw Error('Unexpected '+path);return result}`)
const { ApiError } = await import(http)
const api = await import(url(compile(await fs.readFile('src/api/v3-medals.ts','utf8')).replace("from './http'", `from '${http}'`)))
const medal = { id: 'A /中文', name: '纪念章', type: '稀有', description: '参与活动', order: 0, expiresAt: -1, displayed: false }
const envelope = data => ({ code: 0, data })
const page = (list=[medal], p=1, total=list.length) => ({ list, pagination: { p, size: 20, total, pageCount: Math.ceil(total/20) } })
__medalResponses.push(envelope(page())); assert.deepEqual(await api.fetchV3OwnerMedals(),page())
assert.equal(__medalRequests.at(-1).path, '/api/v3/me/medals?p=1&size=20')
__medalResponses.push(envelope(page([medal,{...medal}]))); await assert.rejects(api.fetchV3OwnerMedals(),/格式/)
__medalResponses.push(envelope({...page(),pagination:{p:1,size:20,total:1,pageCount:5}})); await assert.rejects(api.fetchV3OwnerMedals(),/格式/)
__medalResponses.push(envelope(page([{...medal,displayed:1}]))); await assert.rejects(api.fetchV3OwnerMedals(),/格式/)
__medalResponses.push(new Error('offline')); await assert.rejects(api.fetchV3OwnerMedals(),/offline/)
console.log('PASS medals 1 owner pagination/hidden/permanent DTO, malformed and duplicate responses rejected without false empty defaults')
__medalResponses.push(envelope({id:medal.id,displayed:true})); await api.setV3MedalDisplayed(medal.id,true,'display-key')
let req=__medalRequests.at(-1); assert.equal(req.path,'/api/v3/me/medals/A%20%2F%E4%B8%AD%E6%96%87/display');assert.equal(req.init.method,'PUT');assert.deepEqual(JSON.parse(req.init.body),{displayed:true});assert.equal(req.init.headers['Idempotency-Key'],'display-key')
__medalResponses.push(envelope({id:medal.id,direction:'up',order:0})); await api.moveV3Medal(medal.id,'up','move-key')
req=__medalRequests.at(-1);assert.equal(req.init.method,'POST');assert.deepEqual(JSON.parse(req.init.body),{direction:'up'})
__medalResponses.push(envelope({id:'other',displayed:true}));await assert.rejects(api.setV3MedalDisplayed(medal.id,true,'bad-result'),/格式/)
await assert.rejects(api.moveV3Medal(medal.id,'side','bad-direction'),/方向/)
assert.ok(__medalRequests.every(r=>!r.path.includes('apiKey') && !r.init?.body?.includes('userId')))
console.log('PASS medals 2 exact explicit display/move contracts, encoded original ID and stable header keys; no legacy identity inputs')
const renderer=createRenderer({patchProp(){},insert(){},remove(){},createElement(){return{}},createText(){return{}},createComment(){return{}},setText(){},setElementText(){},parentNode(){return null},nextSibling(){return null}})
setActivePinia(createPinia());const auth=defineStore('medal-test-auth',()=>({accessToken:ref('A')}))()
globalThis.__medalAuth=()=>auth;globalThis.__medalKey=0
const authURL=url('export const useAuthStore=globalThis.__medalAuth')
const keyURL=url('export const profileOperationKey=()=>"medal-key-"+(++globalThis.__medalKey)')
const apiURL=url(['fetchV3OwnerMedals','setV3MedalDisplayed','moveV3Medal'].map(n=>`export const ${n}=(...args)=>globalThis.__medalAPI.${n}(...args)`).join('\n'))
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();await nextTick()}
async function component(){
 let source=(await fs.readFile('src/components/settings/OwnerMedals.vue','utf8')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
 let js=compile(source).replace("from '@/stores/auth'",`from '${authURL}'`).replace("from '@/api/http'",`from '${http}'`).replace("from '@/api/v3-profile'",`from '${keyURL}'`).replace("from '@/api/v3-medals'",`from '${apiURL}'`).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replace("from 'pinia'",`from '${import.meta.resolve('pinia')}'`)
 const imports=[...js.matchAll(/^import .+;$/gm)].map(m=>m[0]).join('\n');js=js.replace(/^import .+;$/gm,'')
 const mod=await import(url(`${imports}\nexport default{setup(){${js}\nreturn{medals,page,total,pageCount,ready,loading,busy,readError,error,message,pending,load,display,move,retry}},render(){return null}}`))
 const app=renderer.createApp(mod.default);app.use(createPinia());return {app,vm:app.mount({})}
}
let releaseOld
const old=new Promise(resolve=>releaseOld=resolve)
globalThis.__medalAPI={fetchV3OwnerMedals:async()=>auth.accessToken==='A'?old:page([{...medal,name:'B-only'}]),setV3MedalDisplayed:async()=>{},moveV3Medal:async()=>{}}
let view=await component();await tick();auth.accessToken='B';await tick();releaseOld(page([{...medal,name:'A-private'}]));await tick();assert.equal(view.vm.medals[0].name,'B-only')
let releaseWrite;__medalAPI.setV3MedalDisplayed=async()=>new Promise(resolve=>releaseWrite=resolve)
view.vm.display(view.vm.medals[0]);await tick();auth.accessToken='C';await tick();releaseWrite({id:medal.id,displayed:true});await tick();assert.equal(view.vm.message,'');assert.equal(view.vm.pending,null);auth.accessToken=null;assert.deepEqual(view.vm.medals,[]);assert.equal(view.vm.total,0);view.app.unmount()
console.log('PASS medals 3 actual Vue/Pinia isolates late owner reads and committed write responses across credentials/logout')
auth.accessToken='D';let fail=true;const commands=[]
__medalAPI.fetchV3OwnerMedals=async()=>page()
__medalAPI.moveV3Medal=async(...args)=>{commands.push(args);if(fail){fail=false;throw new ApiError('lost ACK',0)}return{id:medal.id,direction:'up',order:0}}
view=await component();await tick();view.vm.move(view.vm.medals[0],'up');await tick();assert.match(view.vm.error,/ACK/);assert.ok(view.vm.pending)
view.vm.move(view.vm.medals[0],'down');view.vm.display(view.vm.medals[0]);await tick();assert.equal(commands.length,1)
view.vm.retry();await tick();assert.equal(commands.length,2);assert.deepEqual(commands[0],commands[1]);assert.equal(view.vm.pending,null);assert.equal(view.vm.message,'移动已完成')
__medalAPI.setV3MedalDisplayed=async()=>{throw new ApiError('no grant',404)};view.vm.display(view.vm.medals[0]);await tick();assert.equal(view.vm.pending,null);assert.match(view.vm.error,/no grant/);view.app.unmount()
console.log('PASS medals 4 unknown outcome retains exact command/key, blocks conflicting operations, retry moves once; definitive rejection releases command')
auth.accessToken='E';let reads=0,writes=0
__medalAPI.fetchV3OwnerMedals=async()=>{if(++reads>1)throw Error('read offline');return page()}
__medalAPI.setV3MedalDisplayed=async()=>{writes++;return{id:medal.id,displayed:true}}
view=await component();await tick();view.vm.display(view.vm.medals[0]);await tick();assert.equal(view.vm.pending,null);assert.equal(view.vm.message,'展示状态已保存');assert.match(view.vm.readError,/read offline/);assert.equal(view.vm.ready,false);assert.deepEqual(view.vm.medals,[])
await view.vm.load();assert.equal(writes,1);view.app.unmount()
console.log('PASS medals 5 successful mutation with failed refresh stays successful; retry reads only, no duplicate move or stale list actions')
auth.accessToken='F';const pages=[]
__medalAPI.fetchV3OwnerMedals=async p=>{p??=1;pages.push(p);return page(p===1?[medal]:[],p,1)}
view=await component();await tick();await view.vm.load(2);assert.deepEqual(pages,[1,2,1]);assert.equal(view.vm.page,1);assert.equal(view.vm.total,1)
let releaseUnmount;__medalAPI.fetchV3OwnerMedals=async()=>new Promise(resolve=>releaseUnmount=resolve);const reading=view.vm.load();await tick();view.app.unmount();releaseUnmount(page());await reading;assert.deepEqual(view.vm.medals,[])
console.log('PASS medals 6 collapsed final page reloaded from authoritative pagination and unmounted reads cannot restore private state')
