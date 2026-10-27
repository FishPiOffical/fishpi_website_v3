import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer, createSSRApp, h, nextTick, ref } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createPinia, defineStore, setActivePinia } from 'pinia'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__publicRequests=[];globalThis.__publicResponses=[]
const http=url(`export class ApiError extends Error{constructor(message,status=0,code){super(message);this.status=status;this.code=code}} export async function request(path,init){globalThis.__publicRequests.push({path,init});const result=globalThis.__publicResponses.shift();if(result instanceof Error)throw result;if(result===undefined)throw Error('Unexpected '+path);return result}`)
const {ApiError}=await import(http)
const api=await import(url(compile(await fs.readFile('src/api/v3-profession-public.ts','utf8')).replace("from './http'",`from '${http}'`)))
const definition={professionId:'10',professionCode:'writer',displayName:'创作者',shortName:'创作',description:'<b>仅作文本</b>'}
const progress={...definition,state:'ACTIVE',levelCode:'L1',levelName:'初学者'}
const contribution={professionId:'10',actionCode:'article.publish',eventCount:2,lastOccurredAt:1792800000000}
const activity={professionId:'10',actionCode:'article.publish',occurredAt:1792800000000}
const rarity={rank:2,totalUsers:10,surpassedPercent:80}
const profile={primaryProfession:progress,majorContributions:[contribution],activityFeed:[activity]}
const envelope=data=>({code:0,data})
__publicResponses.push(envelope({...profile,userPhone:'must-not-project',configJson:'private'}));let result=await api.fetchV3PublicProfessions('Alice')
assert.deepEqual(result,profile);assert.equal(Object.hasOwn(result,'ranking'),false);assert.equal(Object.hasOwn(result.primaryProfession,'totalExperience'),false);assert.equal(Object.hasOwn(result.majorContributions[0],'experienceSum'),false);assert.equal(Object.hasOwn(result.activityFeed[0],'experienceDelta'),false)
assert.equal(__publicRequests.at(-1).path,'/api/v3/users/Alice/professions');assert.equal(__publicRequests.at(-1).init,undefined)
console.log('PASS public professions 1 optional modules/experience remain absent across progress/contributions/activity; extra sensitive or raw fields never project')
const selected={primaryProfession:{...definition,state:'SELECTED'}}
__publicResponses.push(envelope(selected));assert.deepEqual(await api.fetchV3PublicProfessions('Alice'),selected)
__publicResponses.push(envelope({primaryProfession:{...selected.primaryProfession,levelName:'fake zero'}}));await assert.rejects(api.fetchV3PublicProfessions('Alice'),/格式/)
const full={primaryProfession:{...progress,totalExperience:0,requiredExperience:0,rarity},professions:[{...progress,totalExperience:0,requiredExperience:0}],majorContributions:[{...contribution,experienceSum:-2}],contributionStats:[{professionId:'10',eventCount:2,lastOccurredAt:1792800000000,experienceSum:0}],activityFeed:[{...activity,experienceDelta:-2}],levelHistory:[{professionId:'10',beforeLevelCode:'L1',afterLevelCode:'L2',occurredAt:1792800000000}],rewards:[{professionId:'10',levelCode:'L1',rewardCode:'first',rewardType:'MEDAL',status:'PENDING',grantedAt:0}],ranking:[{professionId:'10',...rarity}]}
__publicResponses.push(envelope(full));assert.deepEqual(await api.fetchV3PublicProfessions('Alice'),full)
console.log('PASS public professions 2 selected-only has no invented level, real zero/signed changes and full independent modules project accurately')
for(const bad of [{primaryProfession:{...progress,rarity:{...rarity,surpassedPercent:100}}},{primaryProfession:{...progress,totalExperience:0}},{professions:[progress,progress]},{ranking:null},{activityFeed:Array.from({length:31},()=>activity)},{}]){__publicResponses.push(envelope(bad));await assert.rejects(api.fetchV3PublicProfessions('Alice'),/格式/)}
await assert.rejects(api.fetchV3PublicProfessions('../Alice'),/用户名/);__publicResponses.push(new ApiError('not available',404));await assert.rejects(api.fetchV3PublicProfessions('Alice'),error=>error.status===404)
console.log('PASS public professions 3 invalid rarity math, partial experience, duplicate IDs, null/oversized modules and invalid target fail explicitly')
setActivePinia(createPinia());const auth=defineStore('public-profession-auth',()=>({accessToken:ref(null)}))();globalThis.__publicAuth=()=>auth;globalThis.__publicAPI={...api}
const authURL=url('export const useAuthStore=globalThis.__publicAuth'),apiURL=url('export const fetchV3PublicProfessions=(...args)=>globalThis.__publicAPI.fetchV3PublicProfessions(...args)')
const source=await fs.readFile('src/components/profession/PublicProfessions.vue','utf8'),descriptor=parse(source).descriptor
let componentCode=compile(compileScript(descriptor,{id:'public-profession-test',inlineTemplate:true}).content).replace(/from ['"]vue['"]/g,`from '${import.meta.resolve('vue')}'`).replace(/from ['"]pinia['"]/g,`from '${import.meta.resolve('pinia')}'`).replace("from '@/stores/auth'",`from '${authURL}'`).replace("from '@/api/http'",`from '${http}'`).replace("from '@/api/v3-profession-public'",`from '${apiURL}'`)
const component=(await import(url(componentCode))).default
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}
const insert=(node,parent,anchor)=>{if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}const i=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(i<0?parent.children.length:i,0,node);node.parent=parent}
const renderer=createRenderer({patchProp(el,key,old,value){el.props[key]=value},insert,remove(node){if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}},createElement(tag){return{tag,children:[],props:{}}},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(node,text){node.text=text},setElementText(node,text){node.children=[{text,children:[]}]},parentNode(node){return node.parent},nextSibling(node){const siblings=node.parent?.children||[];return siblings[siblings.indexOf(node)+1]||null},insertStaticContent(content,parent,anchor){const node={text:content.replace(/<[^>]*>/g,''),children:[]};insert(node,parent,anchor);return[node,node]}})
const content=node=>[node.text||'',...(node.children||[]).map(content)].join(' ')
function mount(name='Alice'){const target=ref(name),root={children:[]};const app=renderer.createApp({setup:()=>()=>h(component,{userName:target.value})});app.use(createPinia());app.mount(root);return{app,target,root,text:()=>content(root)}}
__publicAPI.fetchV3PublicProfessions=async()=>profile;let view=mount();await tick();let visible=view.text();assert.match(visible,/初学者/);assert.match(visible,/<b>仅作文本<\/b>/);assert.ok(!visible.includes('累计经验')&&!visible.includes('可见榜名次')&&!visible.includes('贡献统计')&&!visible.includes('暂无可展示的奖励'))
__publicAPI.fetchV3PublicProfessions=async()=>full;auth.accessToken='A';await tick();visible=view.text();assert.match(visible,/累计经验 0/);assert.match(visible,/-2 经验/);assert.match(visible,/80.00%/);assert.match(visible,/待发放/)
view.app.unmount();console.log('PASS public professions 4 actual compiled Vue template omits hidden sections/numbers while rendering zero, signed changes, rarity and reward state as text')
auth.accessToken=null;__publicAPI.fetchV3PublicProfessions=async()=>selected;view=mount();await tick();assert.match(view.text(),/已选择，尚无经验进度/);assert.ok(!view.text().includes('累计经验')&&!view.text().includes('初学者'));view.app.unmount()
let reads=0;__publicAPI.fetchV3PublicProfessions=async()=>{reads++;return full};const app=createSSRApp(component,{userName:'Alice'});app.use(createPinia());const html=await renderToString(app);assert.equal(reads,0);assert.ok(!html.includes('初学者')&&!html.includes('80.00%'))
console.log('PASS public professions 5 selected-only template never invents zero level and SSR neither fetches nor emits browser reader-bound data')
let releaseOld;__publicAPI.fetchV3PublicProfessions=async name=>name==='Alice'?new Promise(resolve=>releaseOld=resolve):{primaryProfession:{...definition,displayName:'Bob-public',state:'SELECTED'}};view=mount();await tick();view.target.value='Bob';await tick();releaseOld(full);await tick();assert.match(view.text(),/Bob-public/);assert.ok(!view.text().includes('初学者'))
let releaseReader;__publicAPI.fetchV3PublicProfessions=async()=>auth.accessToken==='private'?new Promise(resolve=>releaseReader=resolve):{ranking:[]};auth.accessToken='private';await tick();auth.accessToken=null;await tick();releaseReader(full);await tick();assert.ok(!view.text().includes('初学者')&&!view.text().includes('80.00%'));assert.match(view.text(),/当前无可展示的名次/);view.app.unmount()
console.log('PASS public professions 6 actual target/credential changes replace reader-bound output and reject delayed old target/private summaries')
__publicAPI.fetchV3PublicProfessions=async()=>{throw new ApiError('concealed',404)};view=mount();await tick();assert.match(view.text(),/当前没有可展示的职业资料/);assert.ok(!view.text().includes('concealed'));view.app.unmount()
__publicAPI.fetchV3PublicProfessions=async()=>{throw new ApiError('temporary unavailable',503)};view=mount();await tick();assert.match(view.text(),/temporary unavailable/);assert.ok(!view.text().includes('当前没有可展示的职业资料'));view.app.unmount()
const member=await fs.readFile('src/views/MemberView.vue','utf8');assert.ok(!member.includes('fetchPublicProfession')&&!member.includes('profession?.primaryProfession'));assert.match(member,/<PublicProfessions v-else-if="activeTab === 'profession'"/)
console.log('PASS public professions 7 concealed 404 and real failures remain distinct; member tab is no longer gated by visible primary profession or old profession API')
