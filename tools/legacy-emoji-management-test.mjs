import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer, createSSRApp, ref, nextTick } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { renderToString } from '@vue/server-renderer'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),replace=(s,pairs)=>{for(const[a,b]of pairs)s=s.replaceAll(`from '${a}'`,`from '${b}'`).replaceAll(`from "${a}"`,`from '${b}'`);return s}
globalThis.Document=class {};globalThis.ShadowRoot=class {};
const state=globalThis.__emojiManagement={key:null,context:0,ssr:false,mode:'v1',calls:[],dispatch:null}
const http=url(`export class ApiError extends Error{constructor(m,status){super(m);this.status=status}}export const getAuthContextVersion=()=>__emojiManagement.context;export async function request(path,init){__emojiManagement.calls.push({path,init});return __emojiManagement.dispatch(path,init)}`),key=url('export const getLegacyKey=()=>__emojiManagement.key'),mode=url('export const getApiMode=()=>__emojiManagement.mode'),object=url(`export function legacyObject(v){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('object');return v}`)
const editor=url(replace(compile(await fs.readFile('src/api/legacy/editor.ts','utf8')),[['../http',http],['./auth',key],['./home',object]]))
const reads=url(replace(compile(await fs.readFile('src/api/legacy/editor-emojis.ts','utf8')),[['../http',http],['./auth',key],['./home',object],['./editor',editor]]))
const apiURL=url(replace(compile(await fs.readFile('src/api/legacy/emoji-management.ts','utf8')),[['../http',http],['./auth',key],['./home',object],['./editor',editor]])),api=await import(apiURL),reader=await import(reads)
state.dispatch=()=>({code:0});await assert.rejects(api.writeLegacyEmoji({op:'create',name:'分组',sort:0}),e=>e.status===401);assert.equal(state.calls.length,0);state.key='synthetic'
const cases=[
 [{op:'create',name:'中文分组',sort:4},'group/create',{name:'中文分组',sort:4}],
 [{op:'update-group',groupId:'11',name:'改名',sort:-2},'group/update',{groupId:'11',name:'改名',sort:-2}],
 [{op:'delete-group',groupId:'11'},'group/delete',{groupId:'11'}],
 [{op:'add-url',groupId:'11',url:'https://file.fishpi.cn/a.png?sig=a%2Bb',sort:2,name:''},'group/add-url-emoji',{groupId:'11',url:'https://file.fishpi.cn/a.png?sig=a%2Bb',sort:2,name:''}],
 [{op:'update-item',groupId:'11',itemId:'22',name:'编辑',sort:6},'emoji/update',{groupId:'11',oId:'22',name:'编辑',sort:6}],
 [{op:'remove-item',groupId:'11',emojiId:'33'},'group/remove-emoji',{groupId:'11',emojiId:'33'}]
]
for(const [command,path,body]of cases){await api.writeLegacyEmoji({...command,author:'ATTACK',apiKey:'ATTACK'});const call=state.calls.at(-1);assert.equal(call.path,'/api/emoji/'+path);assert.deepEqual(JSON.parse(call.init.body),{...body,apiKey:'synthetic'});assert.equal(call.init.redirect,'error');assert.equal(call.init.__captchaRetried,true);assert.ok(!call.init.headers)}
for(const command of [{op:'create',name:'a'.repeat(21),sort:0},{op:'create',name:'<b>bad</b>',sort:0},{op:'create',name:'x',sort:2**31},{op:'add-url',groupId:'11',url:'javascript:bad',sort:0,name:''},{op:'add-url',groupId:'11',url:'/private.png',sort:0,name:''},{op:'remove-item',groupId:'../11',emojiId:'3'}]){const before=state.calls.length;await assert.rejects(api.writeLegacyEmoji(command),e=>e.status===422);assert.equal(state.calls.length,before)}
let resolve;state.dispatch=()=>new Promise(r=>resolve=r);const late=api.writeLegacyEmoji(cases[0][0]);state.key='new';resolve({code:0});await assert.rejects(late,/登录状态/)
let groups=[{oId:'11',name:'全部',type:1,sort:0},{oId:'12',name:'我的分组',type:0,sort:1}],items=[{oId:'22',emojiId:'33',name:'图片',sort:0,url:'https://file.fishpi.cn/a.png?sig=a%2Bb',secret:'PRIVATE'}]
const dispatch=(path,init)=>{if(init?.method==='POST')return{code:0};return{code:0,data:path.startsWith('/users/emotions?')?[{smile:'😄'}]:path.startsWith('/api/emoji/groups?')?groups:items}}
state.dispatch=dispatch;assert.equal((await reader.legacyAllEmojiGroups()).length,2);assert.equal((await reader.legacyAllGroupEmojis('11'))[0].url,items[0].url);assert.ok(!JSON.stringify(await reader.legacyAllGroupEmojis('11')).includes('PRIVATE'))
console.log('PASS legacy emoji exact six existing endpoints, ID domains, signed URL, body whitelist, name/URL/sort validation, no writes on bad input or missing auth, no automatic replay')

const shared={shareCode:'ABCDEFGHIJKL',groupName:'快照名',emojiCount:3,createdTime:1700000000000,secret:'PRIVATE'}
const imported={shareCode:'ABCDEFGHIJKL',groupId:'99',groupName:'导入名',sourceGroupName:'快照名',emojiCount:3,secret:'PRIVATE'}
state.dispatch=(path)=>({code:0,data:path.endsWith('/create')?shared:imported})
let receipt=await api.writeLegacyEmoji({op:'share',groupId:'12'});assert.deepEqual(receipt,{op:'share',groupId:'12',shareCode:shared.shareCode,groupName:shared.groupName,emojiCount:3,createdTime:shared.createdTime});assert.equal(state.calls.at(-1).path,'/api/emoji/group/share/create');assert.deepEqual(JSON.parse(state.calls.at(-1).init.body),{groupId:'12',apiKey:'new'})
receipt=await api.writeLegacyEmoji({op:'import',shareCode:'  abcdefghijkl  '});assert.deepEqual(receipt,{op:'import',groupId:'99',groupName:imported.groupName,sourceGroupName:imported.sourceGroupName,emojiCount:3});assert.equal(state.calls.at(-1).path,'/api/emoji/group/share/import');assert.deepEqual(JSON.parse(state.calls.at(-1).init.body),{shareCode:'ABCDEFGHIJKL',apiKey:'new'})
state.dispatch=()=>({code:0,data:{processedCount:999,addedCount:999}});assert.deepEqual(await api.writeLegacyEmoji({op:'migrate'}),{op:'migrate'});assert.equal(state.calls.at(-1).path,'/api/emoji/emoji/migrate');assert.deepEqual(JSON.parse(state.calls.at(-1).init.body),{apiKey:'new'})
for(const data of [{...imported,groupId:'../99'},{...imported,shareCode:'WRONGCODE'},{...imported,emojiCount:-1}]){state.dispatch=()=>({code:0,data});await assert.rejects(api.writeLegacyEmoji({op:'import',shareCode:'ABCDEFGHIJKL'}))}
for(const data of [{...shared,shareCode:'wrong'},{...shared,createdTime:null},{...shared,groupName:undefined}]){state.dispatch=()=>({code:0,data});await assert.rejects(api.writeLegacyEmoji({op:'share',groupId:'12'}))}
const invalidBefore=state.calls.length;await assert.rejects(api.writeLegacyEmoji({op:'import',shareCode:'https://bad.example/'}));assert.equal(state.calls.length,invalidBefore)
console.log('PASS legacy emoji shares/import/migration real protocols, normalized code, metadata whitelist and malformed success rejection; migration invents no counts')

const auth=defineStore('emoji-test-auth',()=>({apiKey:ref('new'),account:ref({oId:'7'})}));globalThis.__emojiAuth=auth
const authURL=url('export const useAuthStore=__emojiAuth'),storeURL=url(replace(compile((await fs.readFile('src/stores/legacyEmojis.ts','utf8')).replaceAll('import.meta.env.SSR','__emojiManagement.ssr')),[['pinia',import.meta.resolve('pinia')],['vue',import.meta.resolve('vue')],['@/api/http',http],['@/api/mode',mode],['@/api/legacy/emoji-management',apiURL],['./auth',authURL]])),storeModule=await import(storeURL)
const pinia=createPinia();setActivePinia(pinia);let store=storeModule.useLegacyEmojisStore(pinia)
state.dispatch=()=>{throw Error('unknown')};await store.submit(cases[0][0]);assert.ok(store.pending);const before=state.calls.length;await store.submit(cases[0][0]);assert.equal(state.calls.length,before);state.dispatch=dispatch;await reader.legacyAllEmojiGroups();assert.ok(store.pending);store.release();assert.equal(store.pending,null);await store.submit(cases[0][0]);assert.equal(store.pending,null);assert.equal(store.revision,1)
state.dispatch=()=>new Promise(r=>resolve=r);const writing=store.submit(cases[0][0]);auth(pinia).apiKey='another';state.key='another';resolve({code:0});await writing;assert.equal(store.pending,null);assert.equal(store.busy,false);assert.equal(store.revision,2)
const frequentDescriptor=parse(await fs.readFile('src/components/LegacyFrequentEmotions.vue','utf8')).descriptor
const frequentURL=url(replace(compile(compileScript(frequentDescriptor,{id:'legacy-frequent',inlineTemplate:true}).content),[['vue',import.meta.resolve('vue')],['@/api/http',http],['@/api/legacy/editor-emojis',reads],['@/stores/auth',authURL]]))
const Frequent=(await import(frequentURL)).default
const descriptor=parse(await fs.readFile('src/components/LegacyEmojiPacks.vue','utf8')).descriptor
const Page=(await import(url(replace(compile(compileScript(descriptor,{id:'legacy-emojis',inlineTemplate:true}).content),[['./LegacyFrequentEmotions.vue',frequentURL],['vue',import.meta.resolve('vue')],['@/api/http',http],['@/api/legacy/editor-emojis',reads],['@/stores/auth',authURL],['@/stores/legacyEmojis',storeURL]])))).default
const insert=(n,p,a)=>{if(n.parent){const i=n.parent.children.indexOf(n);if(i>=0)n.parent.children.splice(i,1)}const i=a?p.children.indexOf(a):-1;p.children.splice(i<0?p.children.length:i,0,n);n.parent=p},renderer=createRenderer({patchProp(n,k,o,v){n.props[k]=v},insert,remove(n){if(n.parent)n.parent.children=n.parent.children.filter(c=>c!==n)},createElement(tag){return{tag,tagName:tag.toUpperCase(),get options(){return this.children.filter(c=>c.tag==='option')},props:{},children:[],value:'',addEventListener(){},removeEventListener(){},getRootNode(){return{activeElement:null}}}},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(n,t){n.text=t},setElementText(n,t){n.children=[{text:t,children:[]}]},parentNode:n=>n.parent,nextSibling(n){const c=n.parent?.children||[];return c[c.indexOf(n)+1]||null},insertStaticContent(t,p,a){const n={text:t,children:[]};insert(n,p,a);return[n,n]}})
const text=n=>[n.text||'',...(n.children||[]).map(text)].join(' '),find=(n,f)=>f(n)?n:(n.children||[]).map(c=>find(c,f)).find(Boolean),all=(n,f)=>[...(f(n)?[n]:[]),...(n.children||[]).flatMap(c=>all(c,f))],tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}
function mount(pinia=createPinia()){const root={children:[]},app=renderer.createApp(Page);app.use(pinia);app.mount(root);return{pinia,root,app,store:storeModule.useLegacyEmojisStore(pinia),user:auth(pinia)}}
globalThis.window={confirm:()=>true};state.key='new';state.dispatch=dispatch;let view=mount();await tick();assert.match(text(view.root),/当前快照/);assert.equal(find(view.root,n=>n.tag==='img').props.src,items[0].url);assert.ok(!find(view.root,n=>n.props?.['aria-label']==='分组名称'))
find(view.root,n=>n.tag==='select').props.onChange({target:{value:'12'}});await tick();assert.ok(find(view.root,n=>n.props?.['aria-label']==='分组名称'))
const button=t=>find(view.root,n=>n.tag==='button'&&text(n).includes(t)),form=t=>find(view.root,n=>n.tag==='form'&&text(n).includes(t)),input=(label,value)=>find(view.root,n=>n.props?.['aria-label']===label).props['onUpdate:modelValue'](value)
input('新分组名称','测试分组');state.dispatch=(path,init)=>{if(init?.method==='POST')throw Error('uncertain');return dispatch(path,init)};await form('新建分组').props.onSubmit({preventDefault(){}});await tick();assert.ok(view.store.pending);assert.match(text(view.root),/不能直接重发/);const writes=state.calls.filter(c=>c.init?.method==='POST').length;await form('新建分组').props.onSubmit({preventDefault(){}});assert.equal(state.calls.filter(c=>c.init?.method==='POST').length,writes)
const sameApp=view.pinia;view.app.unmount();state.dispatch=dispatch;view=mount(sameApp);await tick();assert.ok(view.store.pending);assert.equal(state.calls.filter(c=>c.init?.method==='POST').length,writes);await button('已核对，解除操作锁定').props.onClick();await tick();assert.equal(view.store.pending,null)
state.dispatch=()=>{throw Error('read503')};await button('刷新核对').props.onClick();await tick();assert.match(text(view.root),/read503/);assert.ok(!find(view.root,n=>n.tag==='img'));state.dispatch=dispatch;await button('刷新核对').props.onClick();await tick();assert.ok(find(view.root,n=>n.tag==='img'))

find(view.root,n=>n.tag==='select').props.onChange({target:{value:'12'}});await tick()
state.dispatch=(path,init)=>path.endsWith('/share/create')?{code:0,data:shared}:dispatch(path,init)
await button('生成分组分享码').props.onClick();await tick();assert.match(text(view.root),/ABCDEFGHIJKL/);assert.match(text(view.root),/快照 3/);assert.ok(!text(view.root).includes('PRIVATE'))
let failedRead=false
state.dispatch=(path,init)=>{if(path.endsWith('/share/import')){groups=[...groups,...Array.from({length:60},(_,i)=>({oId:String(100+i),name:'分组'+i,type:0,sort:i+3})),{oId:'99',name:'当前实际名称',type:0,sort:200}];failedRead=true;return{code:0,data:imported}}if(failedRead)throw Error('post-import-get503');return dispatch(path,init)}
input('表情分享码','abcdefghijkl');await form('导入分享码').props.onSubmit({preventDefault(){}});await tick();assert.match(text(view.root),/post-import-get503/);assert.equal(view.store.pending,null);assert.equal(view.store.receipt.op,'import');assert.ok(!find(view.root,n=>n.tag==='img'));const postCount=state.calls.filter(c=>c.init?.method==='POST').length
failedRead=false;await button('刷新核对').props.onClick();await tick();assert.equal(state.calls.filter(c=>c.init?.method==='POST').length,postCount)
// Successful imports read the exact returned ID, even beyond the editor's first 50 groups.
state.dispatch=(path,init)=>path.endsWith('/share/import')?{code:0,data:imported}:dispatch(path,init)
input('表情分享码','ABCDEFGHIJKL');await form('导入分享码').props.onSubmit({preventDefault(){}});await tick();assert.equal(find(view.root,n=>n.tag==='select').props.value,'99');assert.match(text(view.root),/表情 · 1 个/);assert.equal(view.store.receipt.emojiCount,3)
state.dispatch=(path,init)=>path.endsWith('/emoji/migrate')?{code:0}:dispatch(path,init);await button('迁移旧云表情').props.onClick();await tick();assert.match(text(view.root),/不提供迁移数量/);assert.equal(find(view.root,n=>n.tag==='select').props.value,'11')
state.dispatch=()=>{throw Error('partial migration')};await button('迁移旧云表情').props.onClick();await tick();assert.equal(view.store.pending.op,'migrate');const unknownWrites=state.calls.length;await button('迁移旧云表情').props.onClick();assert.equal(state.calls.length,unknownWrites)
state.dispatch=dispatch;await button('刷新核对').props.onClick();await tick();assert.ok(view.store.pending);await button('已核对，解除操作锁定').props.onClick();await tick();assert.equal(view.store.pending,null)

state.dispatch=()=>new Promise(r=>resolve=r);const reading=button('刷新核对').props.onClick();view.user.apiKey=null;view.user.account=null;state.key=null;resolve({code:0,data:groups});await reading;await tick();assert.ok(!find(view.root,n=>n.tag==='img'));view.app.unmount()
state.ssr=true;const ssr=createSSRApp(Page);ssr.use(createPinia());const ssrCalls=state.calls.length;const html=await renderToString(ssr);assert.equal(state.calls.length,ssrCalls);assert.ok(!html.includes(items[0].url));const settings=await fs.readFile('src/views/SettingsView.vue','utf8');assert.match(settings,/<LegacyEmojiPacks v-if="getApiMode\(\) === 'v1'"/);assert.match(settings,/<EmojiPacks v-else/)
console.log('PASS legacy emoji store unknown outcome lock/current GET no replay, identity isolation; compiled settings UI group selection, image URL, failures/retry, disabled repeats, private cleanup and SSR zero reads; v3 panel preserved')

// Every private emoji list must reject old auth generations even when the apiKey is reused.
state.key='same-key';state.ssr=false
for(const [read,data] of [[()=>reader.legacyAllEmojiGroups(),groups],[()=>reader.legacyAllGroupEmojis('11'),items],[()=>reader.legacyFrequentEmotions(),[{smile:'😄'}]]]){
 state.dispatch=()=>new Promise(r=>resolve=r);const old=read();state.context++;resolve({code:0,data});await assert.rejects(old,/登录状态/)
 assert.equal(state.calls.at(-1).init.redirect,'error');assert.equal(state.calls.at(-1).init.cache,'no-store')
}
let activePinia=createPinia(),frequentRoot={children:[]},frequentApp=renderer.createApp(Frequent);frequentApp.use(activePinia)
state.dispatch=()=>({code:0,data:[{smile:'😄'},{huaji:'https://file.fishpi.cn/emoji/graphics/huaji.gif?signature=a%2Bb'}]});frequentApp.mount(frequentRoot);await tick()
const frequentText=()=>text(frequentRoot),refresh=()=>find(frequentRoot,n=>n.tag==='button').props.onClick()
assert.match(frequentText(),/旧版保存依赖经典页面会话/);assert.match(frequentText(),/:smile:/);assert.equal(find(frequentRoot,n=>n.tag==='img').props.src,'https://file.fishpi.cn/emoji/graphics/huaji.gif?signature=a%2Bb')
let first;state.dispatch=()=>new Promise(r=>first=r);const oldRead=refresh();await tick();const oldSignal=state.calls.at(-1).init.signal
state.dispatch=()=>({code:0,data:[{heart:'❤️'}]});await refresh();await tick();assert.equal(oldSignal.aborted,true)
first({code:0,data:[{smile:'😄'}]});await oldRead;await tick();assert.match(frequentText(),/:heart:/);assert.ok(!frequentText().includes(':smile:'))
state.dispatch=()=>{throw Error('frequent-503')};await refresh();await tick();assert.match(frequentText(),/frequent-503/);assert.ok(!frequentText().includes(':heart:'));assert.ok(!frequentText().includes('暂无常用表情'))
state.dispatch=()=>({code:0,data:[]});await refresh();await tick();assert.match(frequentText(),/暂无常用表情/)
state.dispatch=()=>new Promise(r=>first=r);const loggedOutRead=refresh();const identitySignal=state.calls.at(-1).init.signal;auth(activePinia).apiKey=null;auth(activePinia).account=null;await tick();assert.equal(identitySignal.aborted,true);first({code:0,data:[{smile:'😄'}]});await loggedOutRead;await tick();assert.ok(!frequentText().includes(':smile:'));auth(activePinia).apiKey='same-key';auth(activePinia).account={oId:'7'};state.dispatch=()=>({code:0,data:[]});await refresh();await tick();
state.dispatch=()=>new Promise(r=>first=r);const lateRead=refresh();const leavingSignal=state.calls.at(-1).init.signal;frequentApp.unmount();assert.equal(leavingSignal.aborted,true);first({code:0,data:[{smile:'😄'}]});await lateRead
const beforeFrequentSSR=state.calls.length,ssrFrequent=createSSRApp(Frequent);ssrFrequent.use(createPinia());await renderToString(ssrFrequent);assert.equal(state.calls.length,beforeFrequentSSR)
assert.ok(!state.calls.some(c=>c.path==='/settings/emotionList'))
console.log('PASS actual frequent settings current Unicode/image aliases, GET-only limitation, failure/empty distinction, newer-read wins/abort, unmount/SSR; every private emoji list rejects same-key old auth generation')
