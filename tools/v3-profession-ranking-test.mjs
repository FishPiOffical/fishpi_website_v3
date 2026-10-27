import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createRenderer, nextTick, reactive, ref } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__rankRequests=[];globalThis.__rankResponses=[]
const http=url(`export class ApiError extends Error{constructor(message,status=0){super(message);this.status=status}} export async function request(path,init){globalThis.__rankRequests.push({path,init});const result=globalThis.__rankResponses.shift();if(result instanceof Error)throw result;if(result===undefined)throw Error('Unexpected '+path);return result}`)
const api=await import(url(compile(await fs.readFile('src/api/v3-professions.ts','utf8')).replace("from './http'",`from '${http}'`)))
const profession={professionId:'10',professionCode:'writer',displayName:'创作者',shortName:'创作',description:'职业介绍'}
const entry={rank:1,userName:'owner',userNickname:'Owner',userAvatarURL:'https://images.example/a.png',professionId:'10',professionCode:'writer',professionName:'创作者',levelCode:'L1',levelName:'初学者'}
const guide={professionId:'10',triggers:[{triggerType:'article.published'},{triggerType:'article.published'}],rewards:[{rewardType:'POINT',amount:12},{rewardType:'MEDAL'},{rewardType:'POINT',amount:12}]}
const page=(list=[],p=1,total=list.length)=>({list,pagination:{p,size:20,total,pageCount:Math.ceil(total/20)}})
const envelope=data=>({code:0,data})
__rankResponses.push(envelope(page([entry])));const hidden=(await api.fetchV3ProfessionRanking('10')).list[0];assert.equal(Object.hasOwn(hidden,'totalExperience'),false);assert.equal(hidden.rank,1);assert.equal(hidden.levelName,'初学者')
__rankResponses.push(envelope(page([{...entry,totalExperience:0}])));assert.equal((await api.fetchV3ProfessionRanking('10')).list[0].totalExperience,0)
__rankResponses.push(envelope(page([{...entry,rank:21}],2,21)));assert.equal((await api.fetchV3ProfessionRanking('10',2)).list[0].rank,21)
for(const bad of [{...entry,rank:2},{...entry,professionId:'11'},{...entry,totalExperience:null}]){__rankResponses.push(envelope(page([bad])));await assert.rejects(api.fetchV3ProfessionRanking('10'),/格式/)}
console.log('PASS profession ranking 1 authoritative ranks/pages, hidden experience stays absent while real zero remains zero; bad binding/ranks/types rejected')
__rankResponses.push(envelope(guide));assert.deepEqual(await api.fetchV3ProfessionGuide('10'),guide)
__rankResponses.push(envelope({...guide,professionId:'11'}));await assert.rejects(api.fetchV3ProfessionGuide('10'),/格式/)
__rankResponses.push(envelope({...guide,triggers:[{triggerType:'unknown'}]}));await assert.rejects(api.fetchV3ProfessionGuide('10'),/格式/)
__rankResponses.push(envelope({...guide,rewards:[{rewardType:'POINT',amount:0}]}));await assert.rejects(api.fetchV3ProfessionGuide('10'),/格式/)
__rankResponses.push(new Error('guide offline'));await assert.rejects(api.fetchV3ProfessionGuide('10'),/offline/)
assert.ok(__rankRequests.every(r=>r.path.startsWith('/api/v3/professions/')&&!r.path.includes('apiKey')&&!r.init?.body))
console.log('PASS profession ranking 2 guide preserves duplicate source/reward order, projects only supported summaries and never fabricates missing guides')
const renderer=createRenderer({patchProp(){},insert(){},remove(){},createElement(){return{}},createText(){return{}},createComment(){return{}},setText(){},setElementText(){},parentNode(){return null},nextSibling(){return null}})
setActivePinia(createPinia());const auth=defineStore('ranking-test-auth',()=>({accessToken:ref(null)}))();globalThis.__rankingAuth=()=>auth;globalThis.__rankingAPI={...api};globalThis.__rankingProps={}
const authURL=url('export const useAuthStore=globalThis.__rankingAuth'),apiURL=url(Object.keys(api).map(name=>typeof api[name]==='function'?`export const ${name}=(...args)=>globalThis.__rankingAPI.${name}(...args);`:`export const ${name}=globalThis.__rankingAPI.${name};`).join('\n'))
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}
async function component(file,exposed){let source=(await fs.readFile(`src/components/profession/${file}.vue`,'utf8')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];let js=compile(source).replace("from '@/stores/auth'",`from '${authURL}'`).replace("from '@/api/v3-professions'",`from '${apiURL}'`).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replace("from 'pinia'",`from '${import.meta.resolve('pinia')}'`).replace('const props = defineProps();','const props = globalThis.__rankingProps;');const imports=[...js.matchAll(/^import .+;$/gm)].map(m=>m[0]).join('\n');js=js.replace(/^import .+;$/gm,'');const loaded=await import(url(`${imports}\nexport default{setup(){${js}\nreturn{${exposed.join(',')}}},render(){return null}}`));const app=renderer.createApp(loaded.default);app.use(createPinia());return{app,vm:app.mount({})}}
const rankExposed=['catalog','ranking','selected','showGuide','active','rankingError','catalogError','choose','loadCatalog','loadRanking']
let reads=0;Object.assign(__rankingAPI,{fetchV3Professions:async()=>{reads++;return page([profession])},fetchV3ProfessionRanking:async()=>page([entry])})
let view=await component('ProfessionRanking',rankExposed);await tick();assert.equal(reads,0);assert.equal(view.vm.active,false);auth.accessToken='A';await tick();assert.equal(reads,1);assert.equal(view.vm.ranking.list[0].totalExperience,undefined)
view.vm.showGuide=true;auth.accessToken=null;assert.equal(view.vm.ranking,null);assert.equal(view.vm.catalog,null);assert.equal(view.vm.selected,null);assert.equal(view.vm.showGuide,false);view.app.unmount()
console.log('PASS profession ranking 3 actual Vue/Pinia fetches only after login and clears reader-bound ranking/selection/guides on logout')
auth.accessToken='B';let releaseOld;const old=new Promise(resolve=>releaseOld=resolve)
__rankingAPI.fetchV3ProfessionRanking=async id=>id==='10'?old:page([{...entry,professionId:id,userName:'second'}]);view=await component('ProfessionRanking',rankExposed);await tick();view.vm.choose({...profession,professionId:'11',displayName:'第二职业'});await tick();releaseOld(page([entry]));await tick();assert.equal(view.vm.ranking.list[0].userName,'second');assert.equal(view.vm.selected.professionId,'11')
let releasePrivate;__rankingAPI.fetchV3ProfessionRanking=async()=>new Promise(resolve=>releasePrivate=resolve);const reading=view.vm.loadRanking();await tick();auth.accessToken=null;releasePrivate(page([entry]));await reading;assert.equal(view.vm.ranking,null);view.app.unmount()
console.log('PASS profession ranking 4 late ranking/reader results cannot overwrite another profession or restore data after credentials change')
auth.accessToken='C';const calls=[]
__rankingAPI.fetchV3ProfessionRanking=async(id,p=1)=>{calls.push(p);return page(p===1?[entry]:[],p,1)};view=await component('ProfessionRanking',rankExposed);await tick();await view.vm.loadRanking(2);assert.deepEqual(calls,[1,2,1]);assert.equal(view.vm.ranking.pagination.p,1)
__rankingAPI.fetchV3ProfessionRanking=async()=>{throw Error('ranking offline')};await view.vm.loadRanking();assert.equal(view.vm.ranking,null);assert.match(view.vm.rankingError,/offline/);view.app.unmount()
console.log('PASS profession ranking 5 collapsed last page re-read and failed ranking clears stale entries without faking visible population')
auth.accessToken='D';let releaseGuide;__rankingAPI.fetchV3ProfessionGuide=async id=>id==='10'?new Promise(resolve=>releaseGuide=resolve):{...guide,professionId:id}
globalThis.__rankingProps=reactive({professionId:'10',name:'创作'});view=await component('ProfessionGuide',['guide','error','load']);await tick();__rankingProps.professionId='11';await tick();releaseGuide(guide);await tick();assert.equal(view.vm.guide.professionId,'11');auth.accessToken=null;assert.equal(view.vm.guide,null);view.app.unmount()
console.log('PASS profession ranking 6 guide target/credential changes reject old summaries and clear private rendering')
const top=await fs.readFile('src/views/TopView.vue','utf8'),owner=await fs.readFile('src/components/settings/OwnerProfessions.vue','utf8'),template=await fs.readFile('src/components/profession/ProfessionRanking.vue','utf8')
assert.ok(!top.includes('fetchProfessionRanking')&&!top.includes('top:jobs:'));assert.match(top,/<ProfessionRanking v-else-if="currentTab === 'profession'"/);assert.match(owner,/<ProfessionGuide v-if="guideId"/);assert.match(template,/user.totalExperience !== undefined/);assert.match(template,/经验未公开/);assert.match(template,/user.rank/)
console.log('PASS profession ranking 7 actual settings/top wiring removes legacy job cache/API and renders omitted experience explicitly, without index rank fallback')
