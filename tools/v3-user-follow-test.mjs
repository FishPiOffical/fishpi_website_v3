import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer, createSSRApp, h, nextTick, ref, reactive } from 'vue'
import { createPinia, defineStore } from 'pinia'
import { renderToString } from '@vue/server-renderer'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__follow={context:1,requests:[],responses:[],dispatch:null};const state=__follow
const http=url(`export class ApiError extends Error{constructor(message,status=0,code){super(message);this.status=status;this.code=code}}export function getAuthContextVersion(){return globalThis.__follow.context}export async function request(path,init){globalThis.__follow.requests.push({path,init});if(globalThis.__follow.dispatch)return globalThis.__follow.dispatch(path,init);const value=globalThis.__follow.responses.shift();if(value instanceof Error)throw value;return value}`)
const api=await import(url(compile(await fs.readFile('src/api/v3-user-follow.ts','utf8')).replace("from './http'",`from '${http}'`))),{ApiError}=await import(http),env=data=>({code:0,data})
state.responses.push(env({targetId:'2',following:false,userPassword:'private'}));assert.deepEqual(await api.readV3UserFollow('2'),{targetId:'2',following:false});assert.deepEqual(state.requests[0],{path:'/api/v3/me/follows/users/2',init:{cache:'no-store'}})
state.responses.push(env({following:true,changed:true}));await api.setV3UserFollow('2',true,'same-key');assert.deepEqual(state.requests[1],{path:'/api/v3/me/follows/users/2',init:{method:'PUT',headers:{'Idempotency-Key':'same-key'}}})
state.responses.push(env({following:false,changed:false}));await api.setV3UserFollow('2',false,'delete-key');assert.equal(state.requests[2].init.method,'DELETE')
for(const id of ['0','../2','2?x=1','99999999999999999999'])await assert.rejects(api.readV3UserFollow(id),e=>e.status===422)
for(const response of [null,{code:1},env({targetId:'3',following:false}),env({targetId:'2',following:0})]){state.responses.push(response);await assert.rejects(api.readV3UserFollow('2'))}
console.log('PASS user follow 1 exact GET/PUT/DELETE paths, explicit state/key and projected strict response, invalid targets rejected')
const auth=defineStore('follow-auth',()=>({accessToken:ref('A'),account:ref({oId:'1',userName:'owner'})}));globalThis.__followAuth=auth;globalThis.__followAPI=api
const authURL=url('export const useAuthStore=globalThis.__followAuth'),apiURL=url(`export const setV3UserFollow=(...args)=>globalThis.__followAPI.setV3UserFollow(...args);export const readV3UserFollow=(...args)=>globalThis.__followAPI.readV3UserFollow(...args)`),keys=url(`let n=0;export function profileOperationKey(){return 'follow-key-'+(++n)}`)
const replace=(source,pairs)=>{for(const [from,to]of pairs)source=source.replaceAll(`from '${from}'`,`from '${to}'`).replaceAll(`from "${from}"`,`from '${to}'`);return source}
const storeSource=compile((await fs.readFile('src/stores/v3UserFollow.ts','utf8')).replaceAll('import.meta.env.SSR','false'))
const {useV3UserFollowStore}=await import(url(replace(storeSource,[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/http',http],['@/stores/auth',authURL],['@/api/v3-profile',keys],['@/api/v3-user-follow',apiURL]])))
globalThis.__followStore=useV3UserFollowStore
let pinia=createPinia(),owner=auth(pinia),store=useV3UserFollowStore(pinia)
state.responses.push(Error('lost response'));await assert.rejects(store.set('2',true));const key=store.commands['2'].key;owner.accessToken='B';assert.equal(store.commands['2'].key,key);await assert.rejects(store.set('2',false),e=>e.status===409)
state.responses.push(env({following:true,changed:true}));await store.set('2',true);assert.equal(state.requests.at(-1).init.headers['Idempotency-Key'],key);assert.equal(store.commands['2'],undefined)
console.log('PASS user follow 2 real Pinia preserves unknown intent/key across token rotation and blocks opposite action until same-command recovery')
let release;state.dispatch=()=>new Promise(r=>release=r);const pending=store.set('2',false);state.context++;owner.accessToken=null;owner.account=null;release(env({following:false,changed:true}));await pending;assert.deepEqual(store.commands,{});assert.equal(store.lastChange.targetId,'');state.dispatch=null
console.log('PASS user follow 3 logout/new identity clear unresolved commands and delayed completions cannot revive old state')
const source=await fs.readFile('src/components/user/UserFollowButton.vue','utf8'),descriptor=parse(source).descriptor
const storeURL=url('export const useV3UserFollowStore=globalThis.__followStore'),resolveURL=url(`export async function resolveV3NicknameUser(name){return{id:name==='other'?'2':'3',userName:name}}`)
const component=(await import(url(replace(compile(compileScript(descriptor,{id:'follow-test',inlineTemplate:true}).content),[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/http',http],['@/api/v3-user-follow',apiURL],['@/api/v3-membership-styles',resolveURL],['@/stores/auth',authURL],['@/stores/v3UserFollow',storeURL]])))).default
const insert=(node,parent,anchor)=>{if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}const i=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(i<0?parent.children.length:i,0,node);node.parent=parent}
const renderer=createRenderer({patchProp(el,k,old,v){el.props[k]=v},insert,remove(node){if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}},createElement(tag){return{tag,children:[],props:{}}},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(n,t){n.text=t},setElementText(n,t){n.children=[{text:t,children:[]}]},parentNode:n=>n.parent,nextSibling(n){const s=n.parent?.children||[];return s[s.indexOf(n)+1]||null},insertStaticContent(text,parent,anchor){const n={text,children:[]};insert(n,parent,anchor);return[n,n]}})
const text=n=>[n.text||'',...(n.children||[]).map(text)].join(' ')
const find=(n,fn)=>fn(n)?n:(n.children||[]).map(c=>find(c,fn)).find(Boolean)
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}
function mount(pinia=createPinia(),userName="other"){const root={children:[]},app=renderer.createApp(component,{userName});app.use(pinia);const user=auth(pinia);app.mount(root);return{root,app,user,text:()=>text(root),click:()=>find(root,n=>n.tag==='button').props.onClick()}}

const click=(view,label)=>{const button=find(view.root,n=>n.tag==='button'&&text(n).trim()===label);assert.ok(button,'Missing '+label);button.props.onClick()}
let actual=false,writes=[],lose=true,readFail=false;state.dispatch=async(path,init)=>{if(init?.method){writes.push({method:init.method,key:init.headers['Idempotency-Key']});if(lose){lose=false;actual=true;throw Error('响应丢失')}return env({following:init.method==='PUT',changed:true})}if(readFail)throw Error('状态读取503');return env({targetId:path.endsWith('/2')?'2':'3',following:actual})}
pinia=createPinia();let view=mount(pinia);await tick();const stableButton=find(view.root,n=>n.tag==='button');click(view,'+ 关注');await tick();assert.equal(find(view.root,n=>n.tag==='button'),stableButton);assert.match(view.text(),/重试本次关注/);assert.match(view.text(),/结果待确认/);const pendingKey=writes[0].key;view.app.unmount()
view=mount(pinia);await tick();assert.match(view.text(),/重试本次关注/);actual=false;click(view,'重试本次关注');await tick();assert.deepEqual(writes,[{method:'PUT',key:pendingKey},{method:'PUT',key:pendingKey}]);assert.match(view.text(),/\+ 关注/);assert.ok(!view.text().includes('取消关注'));view.app.unmount()
console.log('PASS user follow 4 actual component remount retains unknown command, never toggles recovered intent, historical receipt cannot replace current GET state')
state.dispatch=async(path,init)=>{if(init?.method){writes.push({method:init.method});actual=true;readFail=true;return env({following:true,changed:true})}if(readFail)throw Error('状态读取503');return env({targetId:'2',following:actual})};actual=false;readFail=false;view=mount();await tick();click(view,'+ 关注');await tick();assert.match(view.text(),/状态读取503/);assert.match(view.text(),/重读关注状态/);const n=writes.length;readFail=false;click(view,'重读关注状态');await tick();assert.equal(writes.length,n);assert.match(view.text(),/取消关注/);view.app.unmount()
console.log('PASS user follow 5 confirmed write followed by failed GET only retries reading, never re-submits mutation')
let ssrReads=0;state.dispatch=()=>{ssrReads++;throw Error('SSR')};const ssr=createSSRApp(component,{userName:'other'});ssr.use(createPinia());await renderToString(ssr);assert.equal(ssrReads,0)
let selfReads=0;state.dispatch=()=>{selfReads++;throw Error('self')};view=mount(createPinia(),'owner');await tick();assert.equal(selfReads,0);view.app.unmount()
console.log('PASS user follow 6 SSR and self render no follow requests/actions')

pinia=createPinia();store=useV3UserFollowStore(pinia);let releaseRead,readCalls=0;state.dispatch=(path,init)=>{if(init?.method)return env({following:true,changed:true});readCalls++;if(readCalls===1)return new Promise(resolve=>releaseRead=resolve);return env({targetId:'2',following:false})};view=mount(pinia);await tick();assert.ok(releaseRead);await store.set('2',true);await tick();assert.equal(readCalls,2);releaseRead(env({targetId:'2',following:true}));await tick();assert.ok(!view.text().includes('取消关注'));assert.match(view.text(),/\+ 关注/);view.app.unmount();
console.log('PASS user follow 7 commit from another component invalidates earlier in-flight GET and rejects its delayed relationship snapshot')
