import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import {parse,compileScript} from '@vue/compiler-sfc'
import {createRenderer,createSSRApp,h,nextTick,ref} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,defineStore,setActivePinia} from 'pinia'
const state=globalThis.__legacyPublic={key:null,mode:'v1',calls:[],dispatch:null}
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const replace=(s,pairs)=>{for(const [a,b] of pairs)s=s.replaceAll(`from '${a}'`,`from '${b}'`).replaceAll(`from "${a}"`,`from '${b}'`);return s}
const http=url(`export class ApiError extends Error{constructor(m,status){super(m);this.status=status}}export async function request(path,init){__legacyPublic.calls.push({path,init});return __legacyPublic.dispatch(path,init)}`)
const mode=url('export const getApiMode=()=>__legacyPublic.mode'),key=url('export const getLegacyKey=()=>__legacyPublic.key')
const apiURL=url(replace(compile(await fs.readFile('src/api/v3-profession-public.ts','utf8')),[['./http',http],['./mode',mode],['./legacy/auth',key]])),api=await import(apiURL)
const definition={professionId:'10',professionCode:'writer',displayName:'创作者',shortName:'创作',description:'<b>文本</b>'}
const job={...definition,levelCode:'L1',levelName:'初学者',requiredExperience:0,rarity:{rank:40,totalUsers:151,surpassedPercent:67.54966887417218}}
const profile={primaryProfession:job,professions:[job],ranking:[{professionId:'10',...job.rarity}],activityFeed:[]}
const envelope=data=>({code:0,data})
state.dispatch=()=>envelope({...profile,secret:'PRIVATE',userProgressVersion:2,presentation:{script:'bad'}})
let result=await api.fetchV3PublicProfessions('Alice')
assert.equal(result.primaryProfession.state,'LEGACY_SNAPSHOT');assert.equal(result.primaryProfession.totalExperience,undefined)
assert.equal(result.primaryProfession.requiredExperience,0);assert.equal(result.primaryProfession.rarity.surpassedPercent,job.rarity.surpassedPercent)
assert.deepEqual(Object.keys(result),['primaryProfession','professions','activityFeed','ranking'])
assert.equal(state.calls.at(-1).path,'/api/user/Alice/profession?position=homeProfile');assert.deepEqual(state.calls.at(-1).init,{cache:'no-store'})
state.key='OLD KEY';await api.fetchV3PublicProfessions('Alice');assert.equal(state.calls.at(-1).path,'/api/user/Alice/profession?position=homeProfile&apiKey=OLD+KEY')
state.dispatch=()=>envelope({primaryProfession:{...job,totalExperience:0}});assert.equal((await api.fetchV3PublicProfessions('Alice')).primaryProfession.totalExperience,0)
for(const bad of [{primaryProfession:{...job,rarity:{rank:2,totalUsers:1,surpassedPercent:0}}},{primaryProfession:{...job,rarity:{...job.rarity,surpassedPercent:101}}},{professions:[job,job]},{primaryProfession:{...job,levelName:undefined}},{ranking:null},{}]){state.dispatch=()=>envelope(bad);await assert.rejects(api.fetchV3PublicProfessions('Alice'),/格式/)}
let release;state.dispatch=()=>new Promise(r=>release=r);const old=api.fetchV3PublicProfessions('Alice');state.key='NEW KEY';release(envelope(profile));await assert.rejects(old,/登录状态/)
console.log('PASS classic public professions 1 exact public endpoint/key, optional experience and real zero, legacy tie percentages, whitelist/invalid input and late credential rejection')
setActivePinia(createPinia());const auth=defineStore('legacy-public-auth',()=>({accessToken:ref(null),apiKey:ref(null)}))();globalThis.__legacyPublicAuth=()=>auth
const authURL=url('export const useAuthStore=globalThis.__legacyPublicAuth')
const descriptor=parse(await fs.readFile('src/components/profession/PublicProfessions.vue','utf8')).descriptor
const component=(await import(url(replace(compile(compileScript(descriptor,{id:'legacy-public',inlineTemplate:true}).content),[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/stores/auth',authURL],['@/api/http',http],['@/api/mode',mode],['@/api/v3-profession-public',apiURL]])))).default
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}
const insert=(node,parent,anchor)=>{if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}const i=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(i<0?parent.children.length:i,0,node);node.parent=parent}
const renderer=createRenderer({patchProp(el,key,old,value){el.props[key]=value},insert,remove(node){if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}},createElement(tag){return{tag,children:[],props:{}}},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(node,text){node.text=text},setElementText(node,text){node.children=[{text,children:[]}]},parentNode(node){return node.parent},nextSibling(node){const siblings=node.parent?.children||[];return siblings[siblings.indexOf(node)+1]||null},insertStaticContent(content,parent,anchor){const node={text:content.replace(/<[^>]*>/g,''),children:[]};insert(node,parent,anchor);return[node,node]}})
const content=node=>[node.text||'',...(node.children||[]).map(content)].join(' ')
function mount(name='Alice'){const target=ref(name),root={children:[]};const app=renderer.createApp({setup:()=>()=>h(component,{userName:target.value})});app.use(createPinia());app.mount(root);return{app,target,root,text:()=>content(root)}}
state.key=null;state.dispatch=()=>envelope(profile);let view=mount();await tick();assert.match(view.text(),/旧版等级快照/);assert.match(view.text(),/初学者/);assert.ok(!view.text().includes('累计经验')&&!view.text().includes('已选择，尚无经验进度'))
state.dispatch=()=>envelope({primaryProfession:{...job,totalExperience:0,requiredExperience:undefined}});auth.apiKey='refresh';await tick();assert.match(view.text(),/格式/)
state.dispatch=()=>envelope({primaryProfession:{...job,totalExperience:0}});auth.apiKey='another';await tick();assert.match(view.text(),/累计经验 0/)
let pending;state.dispatch=()=>new Promise(r=>pending=r);state.key='private';auth.apiKey='private';await tick();assert.ok(pending);state.key=null;state.dispatch=()=>envelope({ranking:[]});auth.apiKey=null;await tick();pending(envelope({primaryProfession:{...job,displayName:'SECRET'}}));await tick();assert.ok(!view.text().includes('SECRET'));assert.match(view.text(),/当前无可展示的名次/)
let pendingTarget;state.dispatch=path=>path.includes('/Alice/')?new Promise(r=>pendingTarget=r):envelope({ranking:[]});view.target.value='Alice2';await tick();view.target.value='Alice';await tick();view.target.value='Bob';await tick();pendingTarget(envelope(profile));await tick();assert.ok(!view.text().includes('初学者'));view.app.unmount()
const before=state.calls.length,ssr=createSSRApp(component,{userName:'Alice'});ssr.use(createPinia());const html=await renderToString(ssr);assert.equal(state.calls.length,before);assert.ok(!html.includes('初学者'))
console.log('PASS classic public professions 2 actual Vue snapshot/hidden experience and zero rendering, old key/logout/target rejection, SSR zero private reads')
state.mode='v3';state.dispatch=()=>envelope({primaryProfession:{...job,state:'ACTIVE'}});await assert.rejects(api.fetchV3PublicProfessions('Alice'),/格式/);assert.equal(state.calls.at(-1).path,'/api/v3/users/Alice/professions')
console.log('PASS classic public professions 3 v3 remains strict on paired experience and original rarity formula with no legacy fallback')
