import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import {parse,compileScript} from '@vue/compiler-sfc'
import {createRenderer,createSSRApp,nextTick,ref,reactive,h} from 'vue'
import {createPinia,defineStore} from 'pinia'
import {renderToString} from '@vue/server-renderer'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__editorEmoji={version:1,calls:[],insertions:[],dispatch:null,editors:[]};const state=__editorEmoji
const http=url(`export class ApiError extends Error{constructor(m,status=0){super(m);this.status=status}}export function getAuthContextVersion(){return globalThis.__editorEmoji.version}export function onAccessTokenChange(fn){globalThis.__editorEmoji.tokenListener=fn;fn('A');return()=>{}}export async function request(path,init){globalThis.__editorEmoji.calls.push({path,init});return globalThis.__editorEmoji.dispatch(path,init)}`)
const apiURL=url(compile(await fs.readFile('src/api/v3-emojis.ts','utf8')).replace("from './http'",`from '${http}'`))
const fishpi=await fs.readFile('src/api/fishpi.ts','utf8'),markdown=fishpi.slice(fishpi.indexOf('export function emojiToMarkdown('),fishpi.indexOf('export async function fetchFrequentEmotions'))
const fishpiURL=url(compile(markdown)+'\nexport async function searchUsers(){throw Error("legacy mention still pending")}')
const auth=defineStore('editor-emojis-auth',()=>({accessToken:ref('A'),account:ref({oId:'1'})}));globalThis.__editorEmojiAuth=auth
const authURL=url('export const useAuthStore=globalThis.__editorEmojiAuth'),loadingURL=url('export default {render(){return null}}'),appearanceURL=url('export function useAppearanceStore(){return{state:{theme:"light"}}}'),previewURL=url('export function createMarkdownPreview(){return{transform:()=>"",parse(){},reset(){},dispose(){}}}'),uploadURL=url('export function createEditorUpload(){return{handler(){},cancel(){},dispose(){}}}')
const replace=(s,pairs)=>{for(const [a,b] of pairs)s=s.replaceAll(`from '${a}'`,`from '${b}'`).replaceAll(`from "${a}"`,`from '${b}'`);return s}
async function component(file,pairs){const descriptor=parse(await fs.readFile(file,'utf8')).descriptor;return url(replace(compile(compileScript(descriptor,{id:file,inlineTemplate:true}).content),[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],...pairs]))}
const mentionURL=url('export function createMentionHints(){return{hint:async()=>[],cancel(){},dispose(){}}}');
const pickerURL=await component('src/components/EmojiPicker.vue',[['@/api/fishpi',fishpiURL],['@/api/http',http],['@/api/v3-emojis',apiURL],['@/stores/auth',authURL],['@/components/FpLoading.vue',loadingURL]])
const editorURL=await component('src/components/MarkdownEditor.vue',[['@/api/fishpi',fishpiURL],['@/api/http',http],['@/stores/appearance',appearanceURL],['@/components/FpLoading.vue',loadingURL],['@/components/EmojiPicker.vue',pickerURL],['@/utils/markdownPreview',previewURL],['@/utils/editorUpload',uploadURL],['@/utils/mentionHints',mentionURL]])
const Editor=(await import(editorURL)).default
class FakeVditor{constructor(host,options){this.value=options.value?options.value+'\n':options.value;this.vditor={lute:{GetEmojis:()=>({smile:'😄',heart:'❤️',bad:'<img onerror=x>',remote:'https://evil.invalid/x.png'})}};this.options=options;state.editors.push(this);queueMicrotask(()=>options.after())}getValue(){return this.value}setValue(v){this.value=v}insertMD(v){this.value+=v;state.insertions.push(v);this.options.input(this.value)}setTheme(){}destroy(){}focus(){}}
globalThis.window={Vditor:FakeVditor,innerWidth:1000}
const insert=(n,p,a)=>{const i=a?p.children.indexOf(a):-1;p.children.splice(i<0?p.children.length:i,0,n);n.parent=p}
const renderer=createRenderer({patchProp(n,k,o,v){n.props[k]=v},insert,remove(n){if(n.parent)n.parent.children=n.parent.children.filter(c=>c!==n)},createElement(tag){return{tag,props:{},children:[],querySelectorAll(){return[]}}},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(n,t){n.text=t},setElementText(n,t){n.children=[{text:t,children:[]}]},parentNode:n=>n.parent,nextSibling(n){const s=n.parent?.children||[];return s[s.indexOf(n)+1]||null},insertStaticContent(t,p,a){const n={text:t,children:[]};insert(n,p,a);return[n,n]}})
const text=n=>[n.text||'',...(n.children||[]).map(text)].join(' '),find=(n,fn)=>fn(n)?n:(n.children||[]).map(c=>find(c,fn)).find(Boolean),tick=async()=>{for(let i=0;i<35;i++)await Promise.resolve();await nextTick()}
const env=data=>({code:0,data}),page=list=>({list,pagination:{p:1,size:50,total:list.length,pageCount:list.length?1:0}})
function dispatch(path){if(path==='/api/v3/me/settings/emotions')return env({emotions:['smile','heart']});if(path.startsWith('/api/v3/me/settings/emoji-groups?'))return env(page([{id:'10',name:'图片',type:0,sort:0}]));if(path.startsWith('/api/v3/me/settings/emoji-groups/10/emojis'))return env(page([{id:'11',emojiId:'12',name:'a[b]<x>',url:'https://file.fishpi.cn/a(b).png?sig=x%2Fy',sort:0}]));throw Error(path)}
state.dispatch=dispatch
function mount(modelValue=''){const pinia=createPinia(),user=auth(pinia),props=reactive({modelValue,apiKey:null}),root={children:[]},app=renderer.createApp(Editor,props);app.use(pinia);app.config.errorHandler=e=>{throw e};const exposed=app.mount(root);return{app,root,props,user,exposed,text:()=>text(root)}}
let view=mount();await tick();assert.equal(state.calls.length,0);const instance=state.editors.at(-1),trigger=instance.options.toolbar.find(i=>i?.name==='v3-emoji');assert.ok(trigger);assert.equal(instance.options.hint.emoji&&Object.keys(instance.options.hint.emoji).length,0);trigger.click();await tick();assert.match(view.text(),/😄/);assert.ok(find(view.root,n=>typeof n.props?.class==='string'&&n.props.class.split(' ').includes('panel--below')));assert.ok(!find(view.root,n=>n.tag==='button'&&text(n).trim()==='表情'));const smile=find(view.root,n=>n.tag==='button'&&n.props.title==='smile');smile.props.onClick();await tick();assert.equal(state.insertions.at(-1),':smile:');assert.ok(!view.text().includes(':heart:'))
console.log('PASS editor emoji 1 actual Editor toolbar callback/exposed Vue picker loads v3 lazily and inserts canonical alias without apiKey')
trigger.click();await tick();find(view.root,n=>n.tag==='button'&&text(n).trim()==='图片').props.onClick();await tick();const image=find(view.root,n=>n.tag==='button'&&n.props.title==='a[b]<x>');image.props.onClick();await tick();assert.equal(state.insertions.at(-1),'![a\\[b\\]&lt;x&gt;](https://file.fishpi.cn/a\\(b\\).png?sig=x%2Fy)')
console.log('PASS editor emoji 2 actual image-group GET and escaped insertion preserves signed URL without Vditor angle destination')
trigger.click();await tick();view.user.accessToken='rotated';await tick();assert.match(view.text(),/😄/);find(view.root,n=>n.tag==='button'&&n.props.title==='heart').props.onClick();await tick();assert.equal(state.insertions.at(-1),':heart:')
console.log('PASS editor emoji 3 same-owner token rotation keeps open authorized picker and its current selection')
let resolveOld;state.dispatch=path=>path.includes('/emotions')?new Promise(r=>resolveOld=r):dispatch(path);trigger.click();await tick();state.version++;view.user.account={oId:'2'};view.user.accessToken='B';await tick();resolveOld(env({emotions:['PRIVATE_OLD']}));await tick();assert.ok(!view.text().includes('PRIVATE_OLD'));assert.ok(!view.text().includes('😄'));state.dispatch=dispatch;trigger.click();await tick();assert.match(view.text(),/😄/)
console.log('PASS editor emoji 4 changed identity closes and clears old panel; prior-owner late result discarded')
trigger.click();await tick();state.dispatch=()=>{throw Error('<img onerror=alert(1)>')};trigger.click();await tick();assert.match(view.text(),/<img onerror=alert\(1\)>/);assert.ok(!find(view.root,n=>n.tag==='img'&&n.props?.onerror));state.dispatch=dispatch;find(view.root,n=>n.tag==='button'&&text(n).trim()==='重试').props.onClick();await tick();assert.match(view.text(),/😄/)
console.log('PASS editor emoji 5 visible read failure stays text, explicit retry restores real aliases with no fake defaults')
const n=state.insertions.length;view.user.accessToken=null;await tick();assert.ok(!view.text().includes('😄'));smile.props.onClick();await tick();assert.equal(state.insertions.length,n);view.app.unmount();const requests=state.calls.length
const ssr=createSSRApp(Editor,{modelValue:'PRIVATE_SOURCE',apiKey:null});ssr.use(createPinia());const html=await renderToString(ssr);assert.equal(state.calls.length,requests);assert.ok(!html.includes('PRIVATE_SOURCE'))
console.log('PASS editor emoji 6 logout invalidates retained buttons and SSR makes no owner reads or exposes editor source')
const editorSource=await fs.readFile('src/components/MarkdownEditor.vue','utf8');assert.ok(editorSource.includes('insertMD(')&&!editorSource.includes('insertValue('));assert.ok(!editorSource.includes('fetchVditorEmoji')&&!fishpi.includes('function fetchVditorEmoji('));assert.ok(!editorSource.includes('/users/emotions')&&!editorSource.includes('emojiTail: \'<a'));assert.equal(state.calls.filter(c=>!c.path.startsWith('/api/v3/')).length,0)
console.log('PASS editor emoji 7 old owner emoji API/cache/tail removed; all actual picker reads are v3')

const buffered=mount();assert.throws(()=>buffered.exposed.flush(),/编辑器仍在加载/);await tick();const bufferInstance=state.editors.at(-1);bufferInstance.value='latest editor buffer before delayed input';assert.equal(buffered.props.modelValue,'');assert.equal(buffered.exposed.flush(),'latest editor buffer before delayed input');buffered.app.unmount()
console.log('PASS editor emoji 8 actual MarkdownEditor flush reads live Vditor buffer and rejects loading state')

const unchanged=mount('original source without terminator');await tick();assert.equal(state.editors.at(-1).getValue(),'original source without terminator\n');assert.equal(unchanged.exposed.flush(),'original source without terminator');unchanged.app.unmount()
console.log('PASS editor emoji 9 unchanged normalized editor preserves exact original source rather than adding an edit')
const composerURL=await component('src/components/ChatComposer.vue',[['@/components/MarkdownEditor.vue',editorURL],['@/components/EmojiPicker.vue',pickerURL]]),Composer=(await import(composerURL)).default
let parentValue='existing prefix';const deliveries=[],composerProps=reactive({modelValue:parentValue,compact:true,'onUpdate:modelValue':v=>{parentValue=v;composerProps.modelValue=v},onSubmit:()=>deliveries.push(parentValue)}),composerRoot={children:[]},composerApp=renderer.createApp({setup(){return()=>h(Composer,{...composerProps})}});composerApp.use(createPinia());composerApp.mount(composerRoot)
find(composerRoot,n=>n.tag==='button'&&n.props.class==='send').props.onClick();assert.equal(deliveries.length,0);await tick();assert.match(text(composerRoot),/编辑器仍在加载/)
const liveComposer=state.editors.at(-1);liveComposer.value='latest typed message before debounce';find(composerRoot,n=>n.tag==='button'&&n.props.class==='send').props.onClick();assert.deepEqual(deliveries,['latest typed message before debounce']);liveComposer.value='latest keyboard shortcut text';liveComposer.options.ctrlEnter();assert.equal(deliveries.at(-1),'latest keyboard shortcut text');composerProps.sending=true;await tick();liveComposer.value='must not send while busy';liveComposer.options.ctrlEnter();assert.equal(deliveries.length,2);composerProps.sending=false;composerProps.disabled=true;await tick();liveComposer.options.ctrlEnter();assert.equal(deliveries.length,2);composerProps.disabled=false;await tick();liveComposer.value='   ';liveComposer.options.ctrlEnter();assert.equal(deliveries.length,2);composerApp.unmount()
console.log('PASS editor emoji 10 actual ChatComposer+MarkdownEditor delivers current buffer for click/shortcut; loading/busy/disabled/empty never sends')

// Exercise real composer disposal/recreation with the production layout-change handler.
const roomSource=await fs.readFile('src/views/ChatroomView.vue','utf8'),styleHandler=roomSource.match(/function toggleChatStyle\(\)\s*{[^]*?\n}/)?.[0];assert.ok(styleHandler,'layout changes must synchronize the editor before disposal')
const style=ref('modern'),styleDraft=ref(''),composerRef=ref(null),draft=styleDraft,chat={toggleChatStyle(){style.value=style.value==='modern'?'classic':'modern'}}
const syncHandler=roomSource.match(/function syncComposer\(\)\s*{[^]*?\n}/)[0],toggleChatStyle=Function('composerRef','draft','chat',syncHandler+';'+styleHandler+';return toggleChatStyle')(composerRef,draft,chat),styleRoot={children:[]},styleApp=renderer.createApp({setup(){return()=>h(Composer,{key:style.value,ref:composerRef,modelValue:draft.value,compact:true,'onUpdate:modelValue':v=>draft.value=v})}});styleApp.use(createPinia());styleApp.mount(styleRoot)
toggleChatStyle();assert.equal(style.value,'modern');await tick();assert.match(text(styleRoot),/编辑器仍在加载/)
state.editors.at(-1).value='latest unsaved body 🐟';toggleChatStyle();await tick();assert.equal(style.value,'classic');assert.equal(draft.value,'latest unsaved body 🐟');assert.equal(state.editors.at(-1).getValue(),'latest unsaved body 🐟\n')
state.editors.at(-1).value='';toggleChatStyle();await tick();assert.equal(style.value,'modern');assert.equal(draft.value,'');assert.equal(state.editors.at(-1).getValue(),'');styleApp.unmount()
assert.equal((roomSource.match(/@click="toggleChatStyle"/g)||[]).length,3);assert.ok(!roomSource.includes('@click="chat.toggleChatStyle()"'))
console.log('PASS editor emoji 11 layout remount preserves immediately typed or cleared buffer and blocks while editor loads')

const topicHandler=roomSource.match(/function useTopic\(\)\s*{[^]*?\n}/)[0],paintHandler=roomSource.match(/function insertPaint\(md: string\)\s*{[^]*?\n}/)[0],appendRef=ref(null),appendDraft=ref(''),appendRoot={children:[]},appendApp=renderer.createApp({setup(){return()=>h(Composer,{ref:appendRef,modelValue:appendDraft.value,compact:true,'onUpdate:modelValue':v=>appendDraft.value=v})}});appendApp.use(createPinia());appendApp.mount(appendRoot)
const discuss=ref('本次话题'),showPaint=ref(true),appendHandlers=Function('composerRef','draft','discuss','showPaint',compile(syncHandler+';'+topicHandler+';'+paintHandler)+';return{useTopic,insertPaint}')(appendRef,appendDraft,discuss,showPaint)
appendHandlers.useTopic();appendHandlers.insertPaint('![画](https://example.invalid/a.png)');assert.equal(appendDraft.value,'');assert.equal(showPaint.value,true);await tick()
state.editors.at(-1).value='刚输入的正文 🐟';appendHandlers.useTopic();assert.equal(appendDraft.value,'刚输入的正文 🐟 # 本次话题 # ');await tick()
state.editors.at(-1).value='涂鸦前的末尾输入';appendHandlers.insertPaint('![画](https://example.invalid/a.png)');assert.equal(appendDraft.value,'涂鸦前的末尾输入\n![画](https://example.invalid/a.png)');assert.equal(showPaint.value,false);appendApp.unmount()
console.log('PASS editor emoji 12 topic and paint append to latest editor buffer without discarding unsent input; loading preserves draft/panel')

// The composer has a second picker outside Vditor: its labels must come from the same loaded editor.
state.dispatch=dispatch
const regularRoot={children:[]},regularApp=renderer.createApp({setup:()=>()=>h(Composer,{modelValue:'',compact:false})});regularApp.use(createPinia());regularApp.mount(regularRoot);await tick()
const regularTrigger=find(regularRoot,n=>n.tag==='button'&&n.props['aria-label']==='表情');assert.ok(regularTrigger);regularTrigger.props.onClick();await tick()
assert.match(text(regularRoot),/😄/);assert.ok(!text(regularRoot).includes(':smile:'));assert.ok(!text(regularRoot).includes(':heart:'))
find(regularRoot,n=>n.tag==='button'&&n.props.title==='smile').props.onClick();await tick();assert.equal(state.insertions.at(-1),':smile:');regularApp.unmount()
console.log('PASS editor emoji 13 actual noncompact composer passes loaded Unicode labels to its external picker; selection still inserts the server alias')
