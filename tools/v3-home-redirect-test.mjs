import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import {parse,compileScript} from '@vue/compiler-sfc'
import {createRenderer,createSSRApp,computed,nextTick,ref} from 'vue'
import {createPinia,defineStore} from 'pinia'
import {createRouter,createMemoryHistory} from 'vue-router'
import {renderToString} from '@vue/server-renderer'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const state=globalThis.__homeRedirect={context:1,calls:[],dispatch:null}
const http=url(`export class ApiError extends Error{};export const getAuthContextVersion=()=>globalThis.__homeRedirect.context;export async function request(path){globalThis.__homeRedirect.calls.push(path);return globalThis.__homeRedirect.dispatch()}`)
const apiURL=url(compile(await fs.readFile('src/api/v3-preferences.ts','utf8')).replace("from './http'",`from '${http}'`)),api=await import(apiURL)
const helperURL=url(compile(await fs.readFile('src/utils/homeRedirect.ts','utf8'))),{homeRedirectBases,homeRedirectDestination}=await import(helperURL)
const auth=defineStore('home-redirect-auth',()=>{const accessToken=ref(null),account=ref(null),initialized=ref(false);return{accessToken,account,initialized,isLoggedIn:computed(()=>!!accessToken.value&&!!account.value)}});globalThis.__homeRedirectAuth=auth
const authURL=url('export const useAuthStore=globalThis.__homeRedirectAuth')
// 将共享偏好接入真实 store，沿用已有接口和身份夹具。
let functionSource=compile(await fs.readFile('src/stores/functionPreferences.ts','utf8'))
for(const [name,target] of [['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['./auth',authURL],['@/api/http',http],['@/api/v3-preferences',apiURL]]) functionSource=functionSource.replaceAll(`from '${name}'`,`from '${target}'`)
const functionURL=url(functionSource)
globalThis.window={location:{origin:'http://127.0.0.1:5173'}}
const descriptor=parse(await fs.readFile('src/components/home/HomePreferenceRedirect.vue','utf8')).descriptor
let code=compile(compileScript(descriptor,{id:'home-redirect',inlineTemplate:true}).content.replaceAll('import.meta.env.VITE_API_TARGET',"'http://[::1]:8081'"))
for(const[a,b]of [['vue',import.meta.resolve('vue')],['vue-router',import.meta.resolve('vue-router')],['@/stores/functionPreferences',functionURL],['@/stores/auth',authURL],['@/api/http',http],['@/api/v3-preferences',apiURL],['@/utils/homeRedirect',helperURL],['@/seo/site',url("export const SITE_ORIGIN='https://fishpi.cn'")]])code=code.replaceAll(`from '${a}'`,`from '${b}'`).replaceAll(`from "${a}"`,`from '${b}'`)
const Component=(await import(url(code))).default
const routes=[{path:'/',name:'home',component:{}},{path:'/recent',component:{}},{path:'/cr',component:{}},{path:'/watch',component:{}},{path:'/notifications',component:{}},{path:'/settings/function',component:{}},{path:'/following',redirect:'/watch'},{path:'/old/:tag',redirect:to=>'/recent?tag='+to.params.tag},{path:'/root-alias',redirect:'/'},{path:'/cycle-a',redirect:'/cycle-b'},{path:'/cycle-b',redirect:'/cycle-a'},{path:'/:pathMatch(.*)*',name:'not-found',component:{}}]
const router=()=>createRouter({history:createMemoryHistory(),routes})
const bases=homeRedirectBases('https://fishpi.cn','http://[::1]:8081','http://127.0.0.1:5173'),r=router()
assert.deepEqual(homeRedirectDestination('http://localhost:8081/notifications',r,bases),{kind:'target',path:'/notifications'})
for(const value of ['https://fishpi.cn.evil.test/recent','https://u:p@fishpi.cn/recent','javascript:alert(1)','//fishpi.cn/recent','/recent','http://localhost:8082/recent','https://example.test/recent','https://fishpi.cn/%255cfoo','https://fishpi.cn/%252f%252fevil'])assert.equal(homeRedirectDestination(value,r,bases).kind,'unsupported')
console.log('PASS home redirect 1 exact configured origins, local IPv4/IPv6 aliases and unsafe URL rejection')
assert.deepEqual(homeRedirectDestination('https://fishpi.cn/following?x=1#part',r,bases),{kind:'target',path:'/watch?x=1#part'})
assert.deepEqual(homeRedirectDestination('https://fishpi.cn/old/hello?discard=1#h',r,bases),{kind:'target',path:'/recent?tag=hello#h'})
assert.equal(homeRedirectDestination('https://fishpi.cn/admin',r,bases).kind,'unsupported');assert.equal(homeRedirectDestination('https://fishpi.cn/cycle-a',r,bases).kind,'unsupported')
for(const value of ['','https://fishpi.cn/','https://fishpi.cn/root-alias'])assert.equal(homeRedirectDestination(value,r,bases).kind,'none')
assert.deepEqual(homeRedirectDestination('https://fishpi.cn/#part',r,bases),{kind:'target',path:'/#part'})
assert.deepEqual(homeRedirectDestination('https://site.test/app/recent',r,['https://site.test/app']),{kind:'target',path:'/recent'});assert.equal(homeRedirectDestination('https://site.test/outside',r,['https://site.test/app']).kind,'unsupported')
console.log('PASS home redirect 2 supported routes/aliases/query/hash, root and cyclic redirect avoidance, known context boundary')
function payload(target=''){return{code:0,data:Object.fromEntries(api.preferenceFields.functions.map(f=>[f.key,f.key==='indexRedirectURL'?target:f.kind==='boolean'?true:f.kind==='string'?'':f.key==='listPageSize'?20:0]))}}
const text=n=>n.text||n.children?.map(text).join('')||'',find=(n,f)=>f(n)?n:n.children?.map(c=>find(c,f)).find(Boolean)
const insert=(n,p,a)=>{if(n.parent)n.parent.children=n.parent.children.filter(x=>x!==n);const i=a?p.children.indexOf(a):-1;p.children.splice(i<0?p.children.length:i,0,n);n.parent=p}
const renderer=createRenderer({patchProp(n,k,o,v){n.props[k]=v},insert,remove(n){if(n.parent)n.parent.children=n.parent.children.filter(c=>c!==n)},createElement(tag){return{tag,props:{},children:[]}},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(n,t){n.text=t},setElementText(n,t){n.children=[{text:t,children:[]}]},parentNode:n=>n.parent,nextSibling(n){const s=n.parent?.children||[];return s[s.indexOf(n)+1]||null}})
const tick=async()=>{for(let i=0;i<5;i++){await nextTick();await new Promise(resolve=>setImmediate(resolve))}}
async function mount(path='/',logged=true){const pinia=createPinia(),user=auth(pinia);if(logged){user.accessToken='A';user.account={oId:'1'};user.initialized=true}const routerInstance=router();await routerInstance.push(path);const root={children:[]},app=renderer.createApp(Component);app.use(pinia);app.use(routerInstance);app.mount(root);await tick();return{root,app,user,router:routerInstance,text:()=>text(root)}}
async function click(v,label){const button=find(v.root,n=>n.tag==='button'&&text(n).trim()===label);assert.ok(button);await button.props.onClick();await tick()}
state.dispatch=async()=>payload();let n=state.calls.length,v=await mount('/',false);assert.equal(state.calls.length,n);v.user.accessToken='A';v.user.account={oId:'1'};await tick();assert.equal(state.calls.length,n);v.user.initialized=true;await tick();assert.equal(state.calls.length,n+1);v.app.unmount()
console.log('PASS home redirect 3 no guest/uninitialized request; reads once only after restored login')
for(const path of ['/?page=1','/#part']){n=state.calls.length;v=await mount(path);assert.equal(state.calls.length,n);v.app.unmount()}
console.log('PASS home redirect 4 query/hash home entries keep their current page and do not request preferences')
state.dispatch=async()=>payload('http://localhost:8081/notifications?x=1#part');v=await mount();assert.equal(v.router.currentRoute.value.fullPath,'/notifications?x=1#part');v.app.unmount()
console.log('PASS home redirect 5 actual component and existing preferences adapter replace current supported SPA route only')
state.dispatch=async()=>{throw Error('server503')};v=await mount();assert.ok(v.text().includes('读取失败'));assert.equal(v.router.currentRoute.value.fullPath,'/');assert.equal(find(v.root,n=>n.tag==='a').props.href,'/settings/function');state.dispatch=async()=>payload('https://fishpi.cn/recent');await click(v,'重试跳转');assert.equal(v.router.currentRoute.value.fullPath,'/recent');v.app.unmount()
console.log('PASS home redirect 6 read failure keeps home with explicit retry/settings link; retry reads current value')
state.dispatch=async()=>payload('https://fishpi.cn/admin');v=await mount();assert.ok(v.text().includes('暂不支持'));assert.equal(v.router.currentRoute.value.fullPath,'/');v.app.unmount()
console.log('PASS home redirect 7 unsupported target keeps home and does not navigate to legacy/external destination')
state.dispatch=async()=>payload();v=await mount();n=state.calls.length;v.user.accessToken='rotated';await tick();assert.equal(state.calls.length,n);assert.equal(v.text(),'');v.app.unmount()
console.log('PASS home redirect 8 empty preference stays home and ordinary token rotation does not repeat the read')
let release;state.dispatch=()=>new Promise(resolve=>release=resolve);v=await mount();await v.router.push('/recent');release(payload('https://fishpi.cn/cr'));await tick();assert.equal(v.router.currentRoute.value.fullPath,'/recent');v.app.unmount()
state.dispatch=()=>new Promise(resolve=>release=resolve);v=await mount();v.app.unmount();release(payload('https://fishpi.cn/cr'));await tick();assert.equal(v.router.currentRoute.value.fullPath,'/');assert.equal(v.root.children.length,0)
console.log('PASS home redirect 9 leaving home or unmounting rejects late settings without hijacking navigation')
state.dispatch=()=>new Promise(resolve=>release=resolve);v=await mount();const old=release;state.dispatch=async()=>payload();state.context++;v.user.accessToken=null;v.user.account=null;v.user.accessToken='B';v.user.account={oId:'2'};await tick();old(payload('https://fishpi.cn/cr'));await tick();assert.equal(v.router.currentRoute.value.fullPath,'/');v.app.unmount()
state.dispatch=()=>new Promise(resolve=>release=resolve);v=await mount();n=state.calls.length;v.user.accessToken='new-access';await tick();assert.equal(state.calls.length,n);release(payload('https://fishpi.cn/recent'));await tick();assert.equal(v.router.currentRoute.value.fullPath,'/recent');v.app.unmount()
console.log('PASS home redirect 10 logout/account switch discards old target; same-account access refresh preserves current pending read')
state.dispatch=async()=>payload('https://fishpi.cn/cr');v=await mount('/?skip=1');let deny=true;v.router.beforeEach(to=>to.path==='/cr'&&deny?false:true);await v.router.push('/');await tick();assert.ok(v.text().includes('跳转未完成'));assert.equal(v.router.currentRoute.value.fullPath,'/');deny=false;await click(v,'重试跳转');assert.equal(v.router.currentRoute.value.fullPath,'/cr');v.app.unmount()
console.log('PASS home redirect 11 aborted router navigation remains on home with current retry instead of a false success')
const pinia=createPinia(),user=auth(pinia);user.initialized=true;user.accessToken='A';user.account={oId:'1'};const sr=router();await sr.push('/');const app=createSSRApp(Component);app.use(pinia);app.use(sr);n=state.calls.length;const html=await renderToString(app);assert.equal(state.calls.length,n);assert.ok(!html.includes('跳转'));const home=await fs.readFile('src/views/HomeView.vue','utf8');assert.ok(home.includes('<HomePreferenceRedirect />'));const source=await fs.readFile('src/components/home/HomePreferenceRedirect.vue','utf8');assert.ok(!/localStorage|sessionStorage|location\.(?:href|assign|replace)/.test(source))
console.log('PASS home redirect 12 SSR never reads owner settings; Home wires actual component without persistent private data or full-page classic navigation')
