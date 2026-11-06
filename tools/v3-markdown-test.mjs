import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__preview={token:'A',version:1,calls:[],dispatch:async()=>({code:0,data:{html:'<p>safe</p>'}})};const state=__preview
const http=url(`export class ApiError extends Error{constructor(m,status=0){super(m);this.status=status}}export function getAccessToken(){return globalThis.__preview.token}export function getAuthContextVersion(){return globalThis.__preview.version}export async function request(path,init){globalThis.__preview.calls.push({path,init});return globalThis.__preview.dispatch(path,init)}`)
const apiURL=url(compile(await fs.readFile('src/api/v3-markdown.ts','utf8')).replace("from './http'",`from '${http}'`)),api=await import(apiURL)
const {createMarkdownPreview}=await import(url(compile(await fs.readFile('src/utils/markdownPreview.ts','utf8')).replace("from '@/api/http'",`from '${http}'`).replace("from '@/api/v3-markdown'",`from '${apiURL}'`)))
function element(){return{_text:'',_html:'',children:[],listeners:{},set textContent(v){this._text=v;this._html='';this.children=[]},get textContent(){return this._text},set innerHTML(v){this._html=v;this._text='';this.children=[]},get innerHTML(){return this._html},replaceChildren(...children){this.children=children;this._html='';this._text=''},addEventListener(k,v){this.listeners[k]=v}}}
globalThis.document={createElement:element,createTextNode:text=>({text})}
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve()}
let text='body';const pane=element(),root={querySelector:s=>{assert.equal(s,'.vditor-reset');return pane}},preview=createMarkdownPreview(()=>text)
assert.equal(await api.markdownPreview(' # 中文😀\n\t '),'<p>safe</p>');let call=state.calls.at(-1);assert.equal(call.path,'/api/v3/markdown/preview');assert.equal(call.init.method,'POST');assert.equal(call.init.cache,'no-store');assert.deepEqual(JSON.parse(call.init.body),{content:' # 中文😀\n\t '})
for(const s of ['x'.repeat(1024001),'\u0000','\u007f','\ud800','\udc00'])await assert.rejects(()=>api.markdownPreview(s),e=>e.status===422)
for(const raw of [null,[],{code:0,data:null},{code:0,data:{html:2}},{code:1,data:{html:'bad'}}]){state.dispatch=async()=>raw;await assert.rejects(()=>api.markdownPreview('x'),e=>e.status===502)}
console.log('PASS preview 1 actual API path/raw Markdown/typed response and length/control/Unicode boundaries')
state.dispatch=async()=>({code:0,data:{html:'<p>authorized</p>'}});assert.equal(preview.transform('<script>raw fallback</script>'),'');preview.parse(root);await tick();assert.equal(pane.innerHTML,'<p>authorized</p>')
console.log('PASS preview 2 synchronous local fallback suppressed, only authorized v3 HTML inserted')
let finish;state.dispatch=()=>new Promise(r=>finish=r);text='old';preview.parse(root);await tick();const old=state.calls.at(-1);text='new';preview.reset();assert.equal(old.init.signal.aborted,true);assert.equal(pane.innerHTML,'');finish({code:0,data:{html:'OLD_PRIVATE'}});await tick();assert.equal(pane.innerHTML,'')
state.dispatch=async()=>({code:0,data:{html:'NEW'}});preview.parse(root);await tick();assert.equal(pane.innerHTML,'NEW')
console.log('PASS preview 3 editing clears old body immediately, aborts pending render and discards late result')
state.dispatch=()=>new Promise(r=>finish=r);preview.parse(root);await tick();state.version++;preview.reset();finish({code:0,data:{html:'OTHER_OWNER_PRIVATE'}});await tick();assert.equal(pane.innerHTML,'');state.token=null;const before=state.calls.length;preview.parse(root);await tick();assert.equal(state.calls.length,before);assert.match(pane.textContent,/登录/)
console.log('PASS preview 4 identity/logout clears body and rejects in-flight private result, guest makes no request')
state.token='B';state.dispatch=async()=>{throw Error('<img onerror=alert(1)>')};preview.parse(root);await tick();assert.equal(pane.innerHTML,'');assert.equal(pane.children[0].textContent,'<img onerror=alert(1)>');const retry=pane.children[2];assert.equal(retry.type,'button');state.dispatch=async()=>({code:0,data:{html:'RETRIED'}});retry.listeners.click();await tick();assert.equal(pane.innerHTML,'RETRIED')
console.log('PASS preview 5 failure shown as text, explicit retry only repeats read-only preview')
state.dispatch=()=>new Promise(r=>finish=r);preview.parse(root);await tick();state.token='rotated';finish({code:0,data:{html:'SAME_OWNER'}});await tick();assert.equal(pane.innerHTML,'SAME_OWNER');preview.parse(root);await tick();const pending=state.calls.at(-1);preview.dispose();finish({code:0,data:{html:'UNMOUNT_PRIVATE'}});await tick();assert.equal(pane.innerHTML,'');assert.equal(pending.init.signal.aborted,true)
console.log('PASS preview 6 ordinary token rotation retains result; unmount clears and aborts pending output')
const editor=await fs.readFile('src/components/MarkdownEditor.vue','utf8');assert.ok(!editor.includes("url: '/markdown'"));for(const s of ['transform: preview.transform','parse: preview.parse','preview.reset()','stopPreviewAuth?.()','preview.dispose()'])assert.ok(editor.includes(s));assert.ok(editor.includes('onAccessTokenChange(token =>'))
console.log('PASS preview 7 shared desktop/mobile editor callback/auth/disposal wiring, legacy preview URL removed')
