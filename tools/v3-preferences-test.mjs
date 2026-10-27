import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createRenderer, nextTick, ref } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
const transpile = source => ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
globalThis.__prefRequests=[];globalThis.__prefResponses=[]
const shim=url('export class ApiError extends Error{constructor(message,status){super(message);this.status=status}} export async function request(path,init){globalThis.__prefRequests.push({path,init});const value=globalThis.__prefResponses.shift();if(value instanceof Error)throw value;if(value===undefined)throw Error("Unexpected "+path);return value}')
const api=await import(url(transpile(await fs.readFile('src/api/v3-preferences.ts','utf8')).replace("from './http'",`from '${shim}'`)))
const envelope=data=>({code:0,data})
const functions={listPageSize:20,listViewMode:1,indexRedirectURL:'',notifications:true,subscriptionEmail:false,keyboardShortcuts:true,autoSubscribeOnReply:true,externalLinkConfirmation:true,chatImageBlur:false}
const display={commentViewMode:0,avatarViewMode:0,skin:'classic/pc',mobileSkin:'classic/mobile'}
__prefResponses.push(envelope(functions));assert.deepEqual(await api.fetchV3Preferences('functions'),functions)
__prefResponses.push(envelope({...functions,notifications:0}));await assert.rejects(api.fetchV3Preferences('functions'))
__prefResponses.push(new Error('offline'));await assert.rejects(api.fetchV3Preferences('privacy'),/offline/)
await assert.rejects(api.fetchV3Preferences('../user'))
console.log('PASS preferences 1 strict resource whitelist and actual booleans; failures never become public/default settings')
__prefResponses.push(envelope({...functions,listPageSize:40}));await api.saveV3Preferences('functions',{listPageSize:40},'page-size-key')
assert.equal(__prefRequests.at(-1).path,'/api/v3/me/settings/functions');assert.equal(__prefRequests.at(-1).init.method,'PUT');assert.deepEqual(JSON.parse(__prefRequests.at(-1).init.body),{listPageSize:40})
assert.equal(__prefRequests.at(-1).init.headers['Idempotency-Key'],'page-size-key')
const before=__prefRequests.length
await assert.rejects(api.saveV3Preferences('functions',{listPageSize:9},'bad'));await assert.rejects(api.saveV3Preferences('functions',{notifications:'true'},'bad'));await assert.rejects(api.saveV3Preferences('functions',{userNotifyStatus:0},'bad'));await assert.rejects(api.saveV3Preferences('display',{commentViewMode:2},'bad'));await assert.rejects(api.saveV3Preferences('privacy',{},'bad'))
assert.equal(__prefRequests.length,before)
__prefResponses.push(envelope({publicLocation:false}));assert.equal((await api.saveV3Preferences('location',{publicLocation:false},'geo-key')).publicLocation,false)
console.log('PASS preferences 2 only contract fields/types/ranges and changed values are transmitted; public-location semantics stay boolean')
__prefResponses.push(envelope({languages:['zh_CN','ja_JP'],timezones:[{id:'Asia/Tokyo',name:'Tokyo'}]}));assert.deepEqual((await api.fetchV3LocaleOptions()).language,[{value:'zh_CN',label:'简体中文'},{value:'ja_JP',label:'ja_JP'}])
__prefResponses.push(envelope({list:[{id:'classic/pc',device:'pc',name:'Desktop',secret:'omit'},{id:'classic/mobile',device:'mobile',name:'Mobile'}]}));assert.deepEqual(await api.fetchV3SkinOptions(),{skin:[{value:'classic/pc',label:'Desktop'}],mobileSkin:[{value:'classic/mobile',label:'Mobile'}]})
__prefResponses.push(envelope({languages:['zh_CN'],timezones:[{id:'Asia/Tokyo'}]}));await assert.rejects(api.fetchV3LocaleOptions())
console.log('PASS preferences 3 actual locale/skin catalogs map by server ids and device, reject missing metadata')

const renderer=createRenderer({patchProp(){},insert(){},remove(){},createElement(){return{}},createText(){return{}},createComment(){return{}},setText(){},setElementText(){},parentNode(){return null},nextSibling(){return null}})
setActivePinia(createPinia());const auth=defineStore('pref-auth-test',()=>({accessToken:ref('A'),reloadAccount:async()=>{}}))()
globalThis.__prefAuth=()=>auth
const authURL=url('export const useAuthStore=globalThis.__prefAuth')
let keyId=0;globalThis.__prefKey=()=>`pref:${++keyId}`
const keyURL=url('export const profileOperationKey=globalThis.__prefKey')
globalThis.__prefAPI={...api}
const apiURL=url('export const preferenceFields=globalThis.__prefAPI.preferenceFields;'+['fetchV3Preferences','saveV3Preferences','fetchV3LocaleOptions','fetchV3SkinOptions'].map(name=>`export const ${name}=(...args)=>globalThis.__prefAPI.${name}(...args);`).join('\n'))
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();await nextTick()}
async function component(resource,fields){
 globalThis.__prefProps={resource,title:resource,fields}
 let source=(await fs.readFile('src/components/settings/OwnerPreferences.vue','utf8')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
 let js=transpile(source).replace("from '@/api/v3-preferences'",`from '${apiURL}'`).replace("from '@/api/v3-profile'",`from '${keyURL}'`).replace("from '@/stores/auth'",`from '${authURL}'`).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replace("from 'pinia'",`from '${import.meta.resolve('pinia')}'`).replace('const props = defineProps();','const props = globalThis.__prefProps;')
 const imports=[...js.matchAll(/^import .+;$/gm)].map(m=>m[0]).join('\n');js=js.replace(/^import .+;$/gm,'')
 const module=await import(url(`${imports}\nexport default{setup(){${js}\nreturn{values,original,options,ready,error,message,busy,save,load}},render(){return null}}`))
 const app=renderer.createApp(module.default);app.use(createPinia());return{app,vm:app.mount({})}
}
let resolveA;const late=new Promise(resolve=>resolveA=resolve),saved=[],keys=[];let failOnce=true
Object.assign(globalThis.__prefAPI,{
 fetchV3Preferences:async()=>auth.accessToken==='A'?late:{...functions,indexRedirectURL:'/CURRENT-B'},
 saveV3Preferences:async(resource,changes,key)=>{saved.push(changes);keys.push(key);if(failOnce){failOnce=false;throw Error('lost acknowledgement')}return{...functions,indexRedirectURL:'/CURRENT-B',...changes}},
})
const owner=await component('functions');await tick();auth.accessToken='B';await tick();resolveA({...functions,indexRedirectURL:'/PRIVATE-A'});await tick();assert.equal(owner.vm.values.indexRedirectURL,'/CURRENT-B')
await owner.vm.save();assert.equal(saved.length,0);assert.match(owner.vm.message,/没有/)
owner.vm.values.listPageSize=40;await owner.vm.save();assert.match(owner.vm.error,/lost acknowledgement/);await owner.vm.save();assert.equal(keys[0],keys[1]);assert.deepEqual(saved[1],{listPageSize:40});assert.equal(owner.vm.message,'已保存')
auth.accessToken=null;assert.deepEqual(owner.vm.values,{});assert.equal(owner.vm.ready,false);assert.equal(owner.vm.message,'');owner.app.unmount()
console.log('PASS preferences 4 actual Vue/Pinia ignores old-owner reads, skips unchanged writes and preserves same-key uncertain retry')
auth.accessToken='C';let failRevert=true;const revertWrites=[]
Object.assign(globalThis.__prefAPI,{
 fetchV3Preferences:async()=>({...functions}),
 saveV3Preferences:async(resource,changes,key)=>{revertWrites.push({changes,key});if(failRevert){failRevert=false;throw Error('uncertain')}return{...functions,...changes}},
})
const reverted=await component('functions');await tick();reverted.vm.values.notifications=false;await reverted.vm.save();reverted.vm.values.notifications=true;await reverted.vm.save();assert.deepEqual(revertWrites[1].changes,{notifications:true});assert.notEqual(revertWrites[0].key,revertWrites[1].key);reverted.app.unmount()
console.log('PASS preferences 5 reverting an uncertain field still sends the desired original value instead of pretending nothing changed')
const displayWrites=[];let skinReads=0
Object.assign(globalThis.__prefAPI,{
 fetchV3Preferences:async()=>({...display}),
 fetchV3SkinOptions:async()=>{skinReads++;return{skin:[{value:'classic/pc',label:'Desktop'}],mobileSkin:[{value:'classic/mobile',label:'Mobile'}]}},
 saveV3Preferences:async(resource,changes)=>{displayWrites.push(changes);return{...display,...changes}},
})
const modes=await component('display',['commentViewMode','avatarViewMode']);await tick();modes.vm.values.commentViewMode=1;modes.vm.values.skin='must-not-clobber';await modes.vm.save();assert.deepEqual(displayWrites[0],{commentViewMode:1});assert.equal(skinReads,0);modes.app.unmount()
const skins=await component('display',['skin','mobileSkin']);await tick();assert.equal(skinReads,1);assert.equal(skins.vm.options.mobileSkin[0].value,'classic/mobile');skins.app.unmount()
globalThis.__prefAPI.fetchV3Preferences=async()=>{throw Error('unavailable')};const failed=await component('privacy');await tick();assert.equal(failed.vm.ready,false);assert.deepEqual(failed.vm.values,{});assert.match(failed.vm.error,/unavailable/);failed.app.unmount()
console.log('PASS preferences 6 display subsets cannot overwrite sibling fields; catalogs load only where needed; read errors disable saving')
auth.accessToken='D';let releaseWrite
Object.assign(globalThis.__prefAPI,{
 fetchV3Preferences:async()=>({...functions,indexRedirectURL:auth.accessToken==='D'?'/D':'/CURRENT-E'}),
 saveV3Preferences:async()=>new Promise(resolve=>releaseWrite=resolve),
})
const delayed=await component('functions');await tick();delayed.vm.values.listPageSize=60;const pending=delayed.vm.save();await tick()
auth.accessToken='E';await tick();releaseWrite({...functions,indexRedirectURL:'/PRIVATE-D',listPageSize:60});await pending
assert.equal(delayed.vm.values.indexRedirectURL,'/CURRENT-E');assert.equal(delayed.vm.values.listPageSize,20);assert.equal(delayed.vm.message,'');assert.equal(delayed.vm.busy,false)
delayed.app.unmount()
console.log('PASS preferences 7 late prior-owner save response cannot overwrite the new account or report a new-account success')
