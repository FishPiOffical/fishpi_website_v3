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
const directoryURL=url(`export async function resolveV3TagId(value){return value==='中文标签'?'3':value}`)
const api=await import(url(compile(await fs.readFile('src/api/v3-content-relations.ts','utf8')).replace("from './http'",`from '${http}'`).replace("from './v3-content'",`from '${directoryURL}'`))),{ApiError}=await import(http),env=data=>({code:0,data})
state.responses.push(env({targetId:'2',following:false,userPassword:'private'}));assert.deepEqual(await api.readContentRelation('collection','2'),{targetId:'2',following:false});assert.deepEqual(state.requests[0],{path:'/api/v3/me/collections/2',init:{cache:'no-store'}})
state.responses.push(env({following:true,changed:true}));await api.setContentRelation('collection','2',true,'same-key');assert.deepEqual(state.requests[1],{path:'/api/v3/me/collections/2',init:{method:'PUT',headers:{'Idempotency-Key':'same-key'}}})
state.responses.push(env({following:false,changed:false}));await api.setContentRelation('collection','2',false,'delete-key');assert.equal(state.requests[2].init.method,'DELETE')
for(const id of ['0','../2','2?x=1','99999999999999999999'])await assert.rejects(api.readContentRelation('collection',id),e=>e.status===422)
for(const response of [null,{code:1},env({targetId:'3',following:false}),env({targetId:'2',following:0})]){state.responses.push(response);await assert.rejects(api.readContentRelation('collection','2'))}
console.log('PASS content relations 1 exact GET/PUT/DELETE paths, explicit state/key and projected strict response, invalid targets rejected')
const auth=defineStore('follow-auth',()=>({accessToken:ref('A'),account:ref({oId:'1',userName:'owner'})}));globalThis.__followAuth=auth;globalThis.__followAPI=api
const authURL=url('export const useAuthStore=globalThis.__followAuth'),apiURL=url(`export const setContentRelation=(...args)=>globalThis.__followAPI.setContentRelation(...args);export const readContentRelation=(...args)=>globalThis.__followAPI.readContentRelation(...args);export const resolveContentRelationTarget=(...args)=>globalThis.__followAPI.resolveContentRelationTarget(...args)`),keys=url(`let n=0;export function profileOperationKey(){return 'relation-key-'+(++n)}`)
const replace=(source,pairs)=>{for(const [from,to]of pairs)source=source.replaceAll(`from '${from}'`,`from '${to}'`).replaceAll(`from "${from}"`,`from '${to}'`);return source}
const storeSource=compile((await fs.readFile('src/stores/v3ContentRelations.ts','utf8')).replaceAll('import.meta.env.SSR','false'))
const {useV3ContentRelationsStore}=await import(url(replace(storeSource,[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/http',http],['@/stores/auth',authURL],['@/api/v3-profile',keys],['@/api/v3-content-relations',apiURL]])))
globalThis.__followStore=useV3ContentRelationsStore
let pinia=createPinia(),owner=auth(pinia),store=useV3ContentRelationsStore(pinia)
state.responses.push(Error('lost response'));await assert.rejects(store.set('collection','2',true));const key=store.commands['collection:2'].key;owner.accessToken='B';assert.equal(store.commands['collection:2'].key,key);await assert.rejects(store.set('collection','2',false),e=>e.status===409)
state.responses.push(env({following:true,changed:true}));await store.set('collection','2',true);assert.equal(state.requests.at(-1).init.headers['Idempotency-Key'],key);assert.equal(store.commands['collection:2'],undefined)
console.log('PASS content relations 2 real Pinia preserves unknown intent/key across token rotation and blocks opposite action until same-command recovery')
let release;state.dispatch=()=>new Promise(r=>release=r);const pending=store.set('collection','2',false);state.context++;owner.accessToken=null;owner.account=null;release(env({following:false,changed:true}));await pending;assert.deepEqual(store.commands,{});assert.equal(store.lastChange.targetId,'');state.dispatch=null
console.log('PASS content relations 3 logout/new identity clear unresolved commands and delayed completions cannot revive old state')
const source=await fs.readFile('src/components/articles/ContentRelationButton.vue','utf8'),descriptor=parse(source).descriptor
const storeURL=url('export const useV3ContentRelationsStore=globalThis.__followStore'),resolveURL=url(`export async function resolveV3NicknameUser(name){return{id:name==='other'?'2':'3',userName:name}}`)
const component=(await import(url(replace(compile(compileScript(descriptor,{id:'follow-test',inlineTemplate:true}).content),[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/http',http],['@/api/v3-content-relations',apiURL],['@/api/v3-membership-styles',resolveURL],['@/stores/auth',authURL],['@/stores/v3ContentRelations',storeURL]])))).default
const insert=(node,parent,anchor)=>{if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}const i=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(i<0?parent.children.length:i,0,node);node.parent=parent}
const renderer=createRenderer({patchProp(el,k,old,v){el.props[k]=v},insert,remove(node){if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}},createElement(tag){return{tag,children:[],props:{}}},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(n,t){n.text=t},setElementText(n,t){n.children=[{text:t,children:[]}]},parentNode:n=>n.parent,nextSibling(n){const s=n.parent?.children||[];return s[s.indexOf(n)+1]||null},insertStaticContent(text,parent,anchor){const n={text,children:[]};insert(n,parent,anchor);return[n,n]}})
const text=n=>[n.text||'',...(n.children||[]).map(text)].join(' ')
const find=(n,fn)=>fn(n)?n:(n.children||[]).map(c=>find(c,fn)).find(Boolean)
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}
function mount(pinia=createPinia(),target='2',kind='collection'){const root={children:[]},app=renderer.createApp(component,{target,kind});app.use(pinia);const user=auth(pinia);app.mount(root);return{root,app,user,text:()=>text(root),click:()=>find(root,n=>n.tag==='button').props.onClick()}}

const click=(view,label)=>{const button=find(view.root,n=>n.tag==='button'&&text(n).trim()===label);assert.ok(button,'Missing '+label);button.props.onClick()}
let actual=false,writes=[],lose=true,readFail=false;state.dispatch=async(path,init)=>{if(init?.method){writes.push({method:init.method,key:init.headers['Idempotency-Key']});if(lose){lose=false;actual=true;throw Error('响应丢失')}return env({following:init.method==='PUT',changed:true})}if(readFail)throw Error('状态读取503');return env({targetId:path.endsWith('/2')?'2':'3',following:actual})}
pinia=createPinia();let view=mount(pinia);await tick();const stableButton=find(view.root,n=>n.tag==='button');click(view,'收藏');await tick();assert.equal(find(view.root,n=>n.tag==='button'),stableButton);assert.match(view.text(),/重试本次收藏/);assert.match(view.text(),/结果待确认/);const pendingKey=writes[0].key;view.app.unmount()
view=mount(pinia);await tick();assert.match(view.text(),/重试本次收藏/);actual=false;click(view,'重试本次收藏');await tick();assert.deepEqual(writes,[{method:'PUT',key:pendingKey},{method:'PUT',key:pendingKey}]);assert.match(view.text(),/收藏/);assert.ok(!view.text().includes('取消收藏'));view.app.unmount()
console.log('PASS content relations 4 actual component remount retains unknown command, never toggles recovered intent, historical receipt cannot replace current GET state')
state.dispatch=async(path,init)=>{if(init?.method){writes.push({method:init.method});actual=true;readFail=true;return env({following:true,changed:true})}if(readFail)throw Error('状态读取503');return env({targetId:'2',following:actual})};actual=false;readFail=false;view=mount();await tick();click(view,'收藏');await tick();assert.match(view.text(),/状态读取503/);assert.match(view.text(),/重读状态/);const n=writes.length;readFail=false;click(view,'重读状态');await tick();assert.equal(writes.length,n);assert.match(view.text(),/取消收藏/);view.app.unmount()
console.log('PASS content relations 5 confirmed write followed by failed GET only retries reading, never re-submits mutation')
let ssrReads=0;state.dispatch=()=>{ssrReads++;throw Error('SSR')};const ssr=createSSRApp(component,{kind:'collection',target:'2'});ssr.use(createPinia());await renderToString(ssr);assert.equal(ssrReads,0)
const loggedOut=createPinia();auth(loggedOut).accessToken=null;let anonymousReads=0;state.dispatch=()=>{anonymousReads++;throw Error('guest')};view=mount(loggedOut);await tick();assert.equal(anonymousReads,0);view.app.unmount()
console.log('PASS content relations 6 SSR and anonymous render no private state requests or mutations')
state.dispatch=null;pinia=createPinia();store=useV3ContentRelationsStore(pinia);
for(const kind of ['tag','collection','subscription']){state.responses.push(new ApiError('lost',503));await assert.rejects(store.set(kind,'3',true));}
assert.equal(Object.keys(store.commands).length,3);assert.equal(new Set(Object.values(store.commands).map(c=>c.key)).size,3);
const kept=store.commands['tag:3'].key;state.responses.push(new ApiError('recovery denied',403));await assert.rejects(store.set('tag','3',true));assert.equal(store.commands['tag:3'].key,kept);
state.responses.push(env({following:true,changed:false}));await store.set('tag','3',true);assert.equal(state.requests.at(-1).path,'/api/v3/me/follows/tags/3');assert.equal(store.commands['tag:3'],undefined);assert.ok(store.commands['collection:3']);
console.log('PASS content relations 7 same target has isolated commands by relation kind; recovery 4xx keeps original key and cannot erase another kind')
assert.equal(await api.resolveContentRelationTarget('tag','中文标签'),'3');
for(const [kind,resource] of [['tag','follows/tags'],['collection','collections'],['subscription','subscriptions']]){state.responses.push(env({targetId:'3',following:true}));await api.readContentRelation(kind,'3');assert.equal(state.requests.at(-1).path,'/api/v3/me/'+resource+'/3')}
const article=await fs.readFile('src/views/ArticleView.vue','utf8'),long=await fs.readFile('src/components/articles/LongArticleReader.vue','utf8'),tags=await fs.readFile('src/views/ArticleListView.vue','utf8');assert.ok(article.includes('ContentRelationButton kind="collection"')&&article.includes('ContentRelationButton kind="subscription"')&&!article.includes('toggleCollect'));assert.ok(long.includes('ContentRelationButton kind="collection"')&&long.includes('ContentRelationButton kind="subscription"')&&!long.includes("emit('collect')"));assert.ok(tags.includes('kind="tag" :target="extra"'));
console.log('PASS content relations 8 tag directory resolution and all resource paths, regular/long article and tag route integration share the actual component')

pinia=createPinia();store=useV3ContentRelationsStore(pinia);let releaseRead,readCalls=0;state.dispatch=(path,init)=>{if(init?.method)return env({following:true,changed:true});readCalls++;if(readCalls===1)return new Promise(resolve=>releaseRead=resolve);return env({targetId:'2',following:false})};view=mount(pinia);await tick();assert.ok(releaseRead);await store.set('collection','2',true);await tick();assert.equal(readCalls,2);releaseRead(env({targetId:'2',following:true}));await tick();assert.ok(!view.text().includes('取消收藏'));assert.match(view.text(),/收藏/);view.app.unmount();
console.log('PASS content relations 9 another component commit invalidates an in-flight state read, re-reads and rejects the delayed earlier snapshot')
