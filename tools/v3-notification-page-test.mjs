import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import {createRenderer,nextTick,ref} from 'vue'
import {createPinia,defineStore,setActivePinia} from 'pinia'
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
setActivePinia(createPinia())
const auth=defineStore('notice-page-auth',()=>({accessToken:ref('A'),account:ref({oId:'1'})}))()
const notices=defineStore('notice-page-count',()=>({unread:ref({unreadCommentedNotificationCnt:1}),revision:ref(0),invalidate(){this.revision++}}))()
globalThis.__noticePage={auth,notices,context:0,key:0,reads:[],writes:[],fail:true}
const state=globalThis.__noticePage
state.fetch=async(category,p)=>{state.reads.push({category,p});return{items:[{oId:'10',hasRead:false,articleTitle:'private-one'}],pageCount:3}}
state.mark=async(category,key)=>{state.writes.push({category,key});if(state.fail){state.fail=false;throw Error('lost ACK')}}
const authModule=url('export const useAuthStore=()=>globalThis.__noticePage.auth'),noticeModule=url('export const useNoticeStore=()=>globalThis.__noticePage.notices')
const api=url('export const fetchNotificationPage=(...a)=>globalThis.__noticePage.fetch(...a);export const markV3NotificationsRead=(...a)=>globalThis.__noticePage.mark(...a);export const notificationReadKey=()=>"notice-page-key-"+(++globalThis.__noticePage.key)')
const http=url('export const getAuthContextVersion=()=>globalThis.__noticePage.context')
const router=url('export const RouterLink={};export const useRouter=()=>({push:async()=>{}})'),empty=url('export default {}'),avatar=url('export const DEFAULT_AVATAR="/avatar.png"')
const renderer=createRenderer({patchProp(){},insert(){},remove(){},createElement(){return{}},createText(){return{}},createComment(){return{}},setText(){},setElementText(){},parentNode(){return null},nextSibling(){return null}})
const tick=async()=>{for(let i=0;i<25;i++)await Promise.resolve();await nextTick()}
async function mount(){
 const source=(await fs.readFile('src/views/NotificationsView.vue','utf8')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
 let js=compile(source).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replace("from 'pinia'",`from '${import.meta.resolve('pinia')}'`).replace("from 'vue-router'",`from '${router}'`).replace("from '@/api/http'",`from '${http}'`).replace("from '@/stores/auth'",`from '${authModule}'`).replace("from '@/stores/notices'",`from '${noticeModule}'`).replace("from '@/api/v3-notifications'",`from '${api}'`).replace("from '@/components/FpLoading.vue'",`from '${empty}'`).replace("from '@/components/notifications/NoticeIcon.vue'",`from '${empty}'`).replace("from '@/utils/avatar'",`from '${avatar}'`)
 const imports=[...js.matchAll(/^import .+;$/gm)].map(m=>m[0]).join('\n');js=js.replace(/^import .+;$/gm,'')
 const mod=await import(url(`${imports}\nexport default{setup(){${js}\nreturn{type,page,items,error,marking,readType,readAll,pendingReadKeys}},render(){return null}}`))
 const app=renderer.createApp(mod.default);app.use(createPinia());return{app,vm:app.mount({})}
}
let view=await mount();await tick();view.vm.page=2;await tick();await view.vm.readType();assert.match(view.vm.error,/ACK/);const original=state.writes[0];auth.accessToken='A-refreshed';await tick();assert.equal(view.vm.page,2,'normal refresh reset notification pagination');await view.vm.readType();assert.deepEqual(state.writes[1],original,'normal refresh changed unknown bulk-read recovery key');view.app.unmount()
console.log('PASS notification page 1 normal token rotation preserves pagination and uncertain bulk-read key rather than acting on later arrivals as a new operation')
let finishWrite;state.mark=async(category,key)=>{state.writes.push({category,key});auth.accessToken='rotation-in-flight';return new Promise(resolve=>finishWrite=resolve)}
view=await mount();await tick();const flight=view.vm.readAll();await tick();assert.equal(view.vm.marking,true);const before=notices.revision;finishWrite();await flight;assert.equal(view.vm.marking,false);assert.equal(view.vm.pendingReadKeys.size,0);assert.equal(notices.revision,before+1);view.app.unmount()
console.log('PASS notification page 2 token rotation inside an acknowledged bulk read finishes busy state, releases only its receipt and invalidates current data')
let finishOld;state.mark=async()=>new Promise(resolve=>finishOld=resolve);view=await mount();await tick();const stale=view.vm.readType();await tick();const beforeChange=notices.revision;auth.account={oId:'2'};assert.deepEqual(view.vm.items,[]);assert.equal(view.vm.pendingReadKeys.size,0);finishOld();await stale;assert.equal(notices.revision,beforeChange);assert.equal(view.vm.error,'');await tick();view.vm.page=2;state.context++;auth.accessToken='new-session-same-actor';assert.equal(view.vm.page,1);view.app.unmount()
console.log('PASS notification page 3 same-token actor changes and same-actor new login clear private data/keys and discard old write feedback')
state.mark=async()=>new Promise(resolve=>finishOld=resolve);view=await mount();await tick();const unmounted=view.vm.readAll();await tick();const beforeUnmount=notices.revision;view.app.unmount();finishOld();await unmounted;assert.equal(notices.revision,beforeUnmount);assert.equal(view.vm.pendingReadKeys.size,0)
console.log('PASS notification page 4 unmounted bulk-read results cannot invalidate a later page or retain old recovery commands')
