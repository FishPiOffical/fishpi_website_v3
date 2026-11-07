import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import {parse,compileScript} from '@vue/compiler-sfc'
import {createRenderer,h,ref,nextTick} from 'vue'
import {createPinia,defineStore} from 'pinia'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const replace=(s,pairs)=>{for(const[a,b]of pairs)s=s.replaceAll(`from '${a}'`,`from '${b}'`).replaceAll(`from "${a}"`,`from '${b}'`);return s}
const state=globalThis.__chatAppearanceTest={context:1,ssr:false,calls:[],dispatch:null}
const http=url(`export class ApiError extends Error{constructor(m,status=0,code=''){super(m);this.status=status;this.code=code}}export function getAuthContextVersion(){return globalThis.__chatAppearanceTest.context}export async function request(path,init){globalThis.__chatAppearanceTest.calls.push({path,init});return globalThis.__chatAppearanceTest.dispatch(path,init)}`)
const {ApiError}=await import(http)
const apiURL=url(compile(await fs.readFile('src/api/v3-chat-appearance.ts','utf8')).replace("from './http'",`from '${http}'`))
const auth=defineStore('appearance-auth',()=>({accessToken:ref('first'),account:ref({oId:'1'})}));globalThis.__chatAppearanceAuth=auth
const authURL=url('export const useAuthStore=globalThis.__chatAppearanceAuth'),keys=url("let n=0;export function profileOperationKey(){return 'appearance-'+ ++n}")
const storeURL=url(replace(compile((await fs.readFile('src/stores/v3ChatAppearance.ts','utf8')).replaceAll('import.meta.env.SSR','globalThis.__chatAppearanceTest.ssr')),[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/http',http],['@/api/v3-profile',keys],['@/api/v3-chat-appearance',apiURL],['@/stores/auth',authURL]]))
const {useV3ChatAppearanceStore}=await import(storeURL)
const orange={bubbleId:'paipai-orange',frameId:'paipai-orange',version:1},blue={bubbleId:'fishpond-blue',frameId:'paipai-orange',version:1};let current={...orange},lose=false,readFail=false,applied=0
const clone=value=>JSON.parse(JSON.stringify(value)),receipts=new Map(),envelope=data=>({code:0,data})
async function dispatch(path,init){assert.equal(path,'/api/v3/me/chat-appearance');if(init?.method==='PUT'){const key=init.headers['Idempotency-Key'];if(!receipts.has(key)){current={...JSON.parse(init.body),version:1};receipts.set(key,clone(current));applied++}if(lose){lose=false;throw Error('outcome unknown')}return envelope(clone(receipts.get(key)))}if(readFail)throw new ApiError('read failed',503);return envelope(clone(current))}
state.dispatch=dispatch
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();await nextTick()}
function mount(){const pinia=createPinia(),store=useV3ChatAppearanceStore(pinia);return {store,user:auth(pinia)}}
let view=mount();assert.equal(state.calls.length,0);await view.store.load();assert.deepEqual(clone(view.store.current),orange);await view.store.choose('bubble','fishpond-blue');assert.deepEqual(clone(view.store.current),blue);assert.equal(applied,1);assert.equal(state.calls.at(-1).init.cache,'no-store');view.store.$dispose()
console.log('PASS appearance client 1 explicit personal read, exact PUT pair and post-write GET current state')
view=mount();await view.store.load();lose=true;await view.store.choose('frame','fishpond-blue');const pending=clone(view.store.pending),before=applied;assert.ok(pending);view.user.accessToken='rotated';await tick();assert.equal(view.store.pending.key,pending.key);await view.store.choose('bubble','classic');assert.equal(view.store.pending.key,pending.key);await view.store.retry();assert.equal(applied,before);assert.equal(view.store.pending,null);const retries=state.calls.filter(c=>c.init?.method==='PUT').slice(-2);assert.equal(retries[0].init.body,retries[1].init.body);assert.equal(retries[0].init.headers['Idempotency-Key'],retries[1].init.headers['Idempotency-Key']);view.store.$dispose()
console.log('PASS appearance client 2 ACK loss keeps frozen pair/key across token rotation and exact replay prevents duplicate apply')
view=mount();await view.store.load();readFail=true;const previous=applied;await view.store.choose('bubble','paipai-orange');assert.equal(view.store.pending,null);assert.equal(view.store.current,null);assert.match(view.store.error,/read failed/);readFail=false;await view.store.load();assert.equal(applied,previous+1);assert.equal(view.store.current.bubbleId,'paipai-orange');view.store.$dispose()
console.log('PASS appearance client 3 successful save plus failed GET retries read only, never resaves historical receipt')
view=mount();const releases=[];state.dispatch=()=>new Promise(r=>releases.push(r));const oldRead=view.store.load();await tick();view.user.account={oId:'2'};await tick();releases[1](envelope(blue));await tick();releases[0](envelope(orange));await oldRead;assert.equal(view.store.current.bubbleId,'fishpond-blue');view.store.$dispose();state.dispatch=dispatch
console.log('PASS appearance client 4 old owner read cannot restore another account selection')
state.ssr=true;view=mount();let count=state.calls.length;await view.store.load();assert.equal(state.calls.length,count);view.store.$dispose();state.ssr=false
view=mount();view.user.accessToken=null;count=state.calls.length;await view.store.load();assert.equal(state.calls.length,count);view.store.$dispose()
console.log('PASS appearance client 5 SSR and guests issue no personal requests')
const messageURL=url(compile(await fs.readFile('src/api/v3-chat-messages.ts','utf8')).replace("from './http'",`from '${http}'`)),{decodeChatMessage}=await import(messageURL)
const base={id:'10',createdAt:10,type:'text',content:'text',contentHtml:'<p>text</p>',author:{id:'1',userName:'same-owner',userNickname:'',userAvatarURL:''},client:'',card:{}}
const messages=[orange,orange,blue,blue].map((appearance,i)=>decodeChatMessage({...base,id:String(10+i),appearance:{...appearance,privateField:'SECRET'}}))
assert.ok(!JSON.stringify(messages).includes('SECRET'));assert.equal(decodeChatMessage({...base,appearance:{version:99,bubbleId:'x',frameId:'url(evil)'}}).appearance.bubbleId,'classic')
const stub=url(`import{h}from'${import.meta.resolve('vue')}';export default{setup(p,{slots}){return()=>h('span',slots.default?.())}}`),router=url(`import{h}from'${import.meta.resolve('vue')}';export const RouterLink={props:['to'],setup(p,{slots}){return()=>h('a',{href:p.to},slots.default?.())}}`)
const d=parse(await fs.readFile('src/components/ChatBubble.vue','utf8')).descriptor,Bubble=(await import(url(replace(compile(compileScript(d,{id:'appearance-bubble',inlineTemplate:true}).content),[['vue',import.meta.resolve('vue')],['vue-router',router],['@/components/ImageLightbox.vue',stub],['@/components/medal/MedalList.vue',stub],['@/components/user/VipNickname.vue',stub],['@/utils/avatar',url("export const DEFAULT_AVATAR='/avatar.png'")],['@/utils/chatMessage',url(compile(await fs.readFile('src/utils/chatMessage.ts','utf8')))]])))).default
const insert=(n,p)=>{p.children.push(n);n.parent=p},renderer=createRenderer({patchProp(n,k,o,v){n.props[k]=v},insert,remove(){},createElement(tag){return{tag,props:{},children:[]}},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(n,t){n.text=t},setElementText(n,t){n.text=t},parentNode:n=>n.parent,nextSibling:()=>null,insertStaticContent(t,p){const n={text:t,children:[]};insert(n,p);return[n,n]}})
const root={children:[]},app=renderer.createApp({render:()=>h('div',messages.map(m=>h(Bubble,{key:m.id,userName:m.author.userName,chatroom:true,html:m.contentHtml,appearance:m.appearance})))})
app.mount(root);const collect=n=>[...(n.tag==='article'?[n]:[]),...(n.children||[]).flatMap(collect)],articles=collect(root)
assert.deepEqual(articles.map(n=>n.props['data-bubble']),['paipai-orange','paipai-orange','fishpond-blue','fishpond-blue']);assert.ok(articles.every(n=>n.props['data-frame']==='paipai-orange'));assert.ok(articles.every(n=>n.props['data-appearance-snapshot']==='v1'));app.unmount()
console.log('PASS appearance client 6 actual four bubbles from same author render independent send-time snapshots; unknown versions default and private fields do not project')
