import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import {parse,compileScript} from '@vue/compiler-sfc'
import {createRenderer,createSSRApp,h,nextTick,reactive,ref} from 'vue'
import {createPinia,defineStore} from 'pinia'
import {renderToString} from '@vue/server-renderer'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const replace=(s,pairs)=>{for(const [a,b]of pairs)s=s.replaceAll(`from '${a}'`,`from '${b}'`).replaceAll(`from "${a}"`,`from '${b}'`);return s}
const state=globalThis.__commentLocation={context:1,calls:[],dispatch:null,scrolls:[]},http=url(`export class ApiError extends Error{constructor(m,status=0){super(m);this.status=status}}export function getAuthContextVersion(){return globalThis.__commentLocation.context}export async function request(path,init){globalThis.__commentLocation.calls.push({path,init});return globalThis.__commentLocation.dispatch(path,init)}`)
const apiURL=url(replace(compile(await fs.readFile('src/api/v3-comment-location.ts','utf8')),[['./http',http]])),api=await import(apiURL),env=data=>({code:0,data}),ordinary={id:'201',articleId:'101',type:0,page:2,size:20,paragraph:null},anchor='a'.repeat(64)
state.dispatch=async()=>env({...ordinary,privateBody:'NO_LEAK'})
assert.equal(api.commentLink('101','201'),'/article/101?comment=201#comment201')
for(const hash of ['#201','#comment201','#comment-201','#comment%32%30%31'])assert.equal(api.commentTarget(undefined,hash),'201')
for(const hash of ['#comments','#%broken','#comment1evil',''])assert.equal(api.commentTarget(undefined,hash),'')
for(const q of [null,[],['201'],'invalid',''])assert.throws(()=>api.commentTarget(q,'#comment201'))
assert.equal(api.commentTarget('202','#comment201'),'202')
console.log('PASS comment navigation 1 explicit comment query and known legacy fragment forms are bounded, malformed input never overrides a valid binding')
assert.deepEqual(await api.fetchCommentLocation('201','101'),ordinary);assert.equal(state.calls.at(-1).path,'/api/v3/comments/201/location');assert.ok(!JSON.stringify(await api.fetchCommentLocation('201','101')).includes('NO_LEAK'))
for(const patch of [{id:'202'},{articleId:'102'},{page:0},{page:1.1},{page:42949673},{size:50},{type:2},{paragraph:undefined}]){state.dispatch=async()=>env({...ordinary,...patch});await assert.rejects(api.fetchCommentLocation('201','101'))}
for(const status of ['active','orphaned']){state.dispatch=async()=>env({...ordinary,type:1,paragraph:{id:anchor,state:status,privateSnapshot:'NO_LEAK'}});const d=await api.fetchCommentLocation('201','101');assert.deepEqual(d.paragraph,{id:anchor,state:status});assert.ok(!JSON.stringify(d).includes('NO_LEAK'))}
console.log('PASS comment navigation 2 exact target/article/page/type binding, paragraph states and strict location whitelist reject forged destinations')
const auth=defineStore('comment-location-auth',()=>({accessToken:ref('A'),account:ref({oId:'1'})}));globalThis.__commentLocationAuth=auth
const route=globalThis.__commentLocationRoute=reactive({query:{comment:'201'},hash:'#comment201'}),routeURL=url('export function useRoute(){return globalThis.__commentLocationRoute}'),authURL=url('export const useAuthStore=globalThis.__commentLocationAuth')
const descriptor=parse(await fs.readFile('src/components/articles/ArticleCommentLocation.vue','utf8')).descriptor,Component=(await import(url(replace(compile(compileScript(descriptor,{id:'location',inlineTemplate:true}).content),[['vue',import.meta.resolve('vue')],['vue-router',routeURL],['@/stores/auth',authURL],['@/api/http',http],['@/api/mode',url("export const getApiMode=()=> 'v3'")],['@/api/legacy/comment-location',url("export function locateLegacyLoadedComment(){throw Error('unexpected legacy location')}")],['@/api/v3-comment-location',apiURL]])))).default
const insert=(n,p,a)=>{const i=a?p.children.indexOf(a):-1;p.children.splice(i<0?p.children.length:i,0,n);n.parent=p},renderer=createRenderer({patchProp(n,k,o,v){n.props[k]=v},insert,remove(n){if(n.parent)n.parent.children=n.parent.children.filter(c=>c!==n)},createElement(tag){return{tag,props:{},children:[]}},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(n,t){n.text=t},setElementText(n,t){n.children=[{text:t,children:[]}]},parentNode:n=>n.parent,nextSibling(n){const a=n.parent?.children||[];return a[a.indexOf(n)+1]||null},insertStaticContent(t,p,a){const n={text:t,children:[]};insert(n,p,a);return[n,n]}})
const text=n=>[n.text||'',...(n.children||[]).map(text)].join(' '),find=(n,p)=>p(n)?n:(n.children||[]).map(c=>find(c,p)).find(Boolean),tick=async()=>{for(let n=0;n<35;n++)await Promise.resolve();await nextTick()}
globalThis.document={getElementById:id=>({scrollIntoView(options){state.scrolls.push({id,options})}})}
function mount(){const root={children:[]},config=reactive({articleId:'101',article:null,commentPage:1}),events=[],pinia=createPinia(),app=renderer.createApp({render:()=>h(Component,{...config,onLocated:v=>{events.push(v);config.commentPage=v.page}})});app.use(pinia);app.mount(root);return{root,config,events,user:auth(pinia),app,text:()=>text(root)}}
function retry(v){const b=find(v.root,n=>n.tag==='button'&&text(n).trim()==='重新定位评论');assert.ok(b);b.props.onClick()}
state.dispatch=async()=>env(ordinary);let v=mount();await tick();assert.equal(v.events[0].page,2);assert.equal(state.scrolls.length,0);v.config.article={oId:'101',articleComments:[{oId:'201'}],pagination:{paginationCurrentPageNum:2}};await tick();assert.equal(state.scrolls.at(-1).id,'comment201');v.user.accessToken='ROTATED';await tick();assert.equal(v.events.at(-1).page,2);v.app.unmount()
console.log('PASS comment navigation 3 actual locator waits for the requested page DOM, scrolls current comment only and revalidates after ordinary token rotation')
state.dispatch=async()=>{throw Error('position503')};v=mount();await tick();assert.match(v.text(),/position503/);assert.equal(v.events.length,0);state.dispatch=async()=>env({...ordinary,page:3});retry(v);await tick();assert.equal(v.events.at(-1).page,3);assert.ok(state.calls.every(c=>!c.init.method));v.app.unmount()
console.log('PASS comment navigation 4 lookup failure retains visible retry; re-location consumes current page using GET only')
const releases=[];state.dispatch=()=>new Promise(resolve=>releases.push(resolve));v=mount();await tick();v.user.account={oId:'2'};state.context++;v.user.accessToken='OTHER';await tick();assert.equal(releases.length,2);releases[0](env(ordinary));await tick();assert.equal(v.events.length,0);releases[1](env(ordinary));await tick();assert.equal(v.events.length,1);v.app.unmount()
console.log('PASS comment navigation 5 prior identity response cannot change page or scroll after account switch')
state.dispatch=async()=>env(ordinary);v=mount();await tick();v.config.article={oId:'101',articleComments:[],pagination:{paginationCurrentPageNum:2}};await tick();assert.match(v.text(),/评论位置已变化/);v.app.unmount()
console.log('PASS comment navigation 6 disappeared/moved target in the actual page requests re-location instead of pretending successful navigation')
const before=state.calls.length,ssr=createSSRApp(Component,{articleId:'101',article:null,commentPage:1});ssr.use(createPinia());await renderToString(ssr);assert.equal(state.calls.length,before)
console.log('PASS comment navigation 7 actual SSR never fetches private reader position or serializes a locator response')

state.dispatch=async()=>env(ordinary);v=mount();await tick();const beforePendingPageScrolls=state.scrolls.length;v.config.article={oId:'101',articleComments:[],pagination:{paginationCurrentPageNum:1}};await tick();assert.equal(state.scrolls.length,beforePendingPageScrolls);assert.ok(!v.text().includes('评论位置已变化'));globalThis.document.getElementById=()=>null;v.config.article={oId:'101',articleComments:[{oId:'201'}],pagination:{paginationCurrentPageNum:2}};await tick();assert.match(v.text(),/评论当前无法在页面中定位/);v.app.unmount();
console.log('PASS comment navigation 8 stale previous-page data does not fabricate a moved target; absent current DOM produces explicit re-location instead of false success')

// Back/forward can restore the same binding while an older request for it is still pending.
route.query={comment:'201'};route.hash='#comment201';const historyRequests=[];
state.dispatch=(path,init)=>new Promise(resolve=>historyRequests.push({path,signal:init.signal,resolve}));
v=mount();await tick();route.query={comment:'202'};route.hash='#comment202';await tick();route.query={comment:'201'};route.hash='#comment201';await tick();assert.equal(historyRequests.length,3);assert.ok(historyRequests[0].signal.aborted);assert.ok(historyRequests[1].signal.aborted);
historyRequests[1].resolve(env({...ordinary,id:'202',page:4}));historyRequests[0].resolve(env({...ordinary,page:3}));await tick();assert.equal(v.events.length,0);
historyRequests[2].resolve(env(ordinary));await tick();assert.equal(v.events.length,1);assert.equal(v.events[0].page,2);v.app.unmount();
console.log('PASS comment navigation 9 back/forward ABA target sequence rejects both superseded requests even when the original route binding returns')
