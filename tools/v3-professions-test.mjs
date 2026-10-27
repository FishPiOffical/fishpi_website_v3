import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createRenderer, nextTick, ref } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__professionRequests=[];globalThis.__professionResponses=[]
const http=url(`export class ApiError extends Error{constructor(message,status=0){super(message);this.status=status}} export async function request(path,init){globalThis.__professionRequests.push({path,init});const result=globalThis.__professionResponses.shift();if(result instanceof Error)throw result;if(result===undefined)throw Error('Unexpected '+path);return result}`)
const {ApiError}=await import(http)
const api=await import(url(compile(await fs.readFile('src/api/v3-professions.ts','utf8')).replace("from './http'",`from '${http}'`)))
const visibility=Object.fromEntries(api.professionModules.map(([name])=>[name,'SELF']))
const definition={professionId:'10',professionCode:'writer',displayName:'创作者',shortName:'创作',description:'职业说明'}
const progress={...definition,state:'RETIRED',totalExperience:50,levelCode:'L1',levelName:'初级',requiredExperience:0}
const page=(list=[],p=1,total=list.length)=>({list,pagination:{p,size:20,total,pageCount:Math.ceil(total/20)}})
const state={onboardingState:'SELECTED',primaryProfessionId:'11',primaryProfessionState:'ACTIVE',privacyPreset:'CUSTOM',moduleVisibility:visibility}
const mine=(list=[progress],p=1,total=list.length)=>({...page(list,p,total),state:{...state,moduleVisibility:{...visibility}}})
const detail={profession:progress,levels:[{levelCode:'L1',sortOrder:0,requiredExperience:0,displayName:'初级',shortName:'初',description:'介绍',achievementDescription:'开始',topLevel:true}],contributions:[{actionCode:'article.publish',experienceSum:-2,eventCount:1,lastOccurredAt:1792800000000}]}
const record={actionCode:'article.publish',experienceDelta:-2,beforeExperience:52,afterExperience:50,beforeLevelCode:'L1',afterLevelCode:'L1',occurredAt:1792800000000}
const envelope=data=>({code:0,data})
__professionResponses.push(envelope(page([definition])));assert.equal((await api.fetchV3Professions()).list[0].professionId,'10')
__professionResponses.push(envelope(mine()));const owner=await api.fetchV3OwnerProfessions();assert.equal(owner.state.primaryProfessionId,'11');assert.equal(owner.state.privacyPreset,'CUSTOM');assert.equal(owner.list[0].state,'RETIRED')
__professionResponses.push(envelope({...mine(),state:{...state,moduleVisibility:{experience:'PUBLIC'}}}));await assert.rejects(api.fetchV3OwnerProfessions(),/格式/)
__professionResponses.push(envelope(page([definition,definition])));await assert.rejects(api.fetchV3Professions(),/格式/)
__professionResponses.push(new Error('offline'));await assert.rejects(api.fetchV3OwnerProfessions(),/offline/)
console.log('PASS professions 1 published catalog/current owner pages, real selection without synthetic progress, full CUSTOM map and malformed/duplicate rejection')
__professionResponses.push(envelope({onboardingState:'SELECTED',primaryProfessionId:'10'}));await api.writeV3Profession({kind:'primary',professionId:'10',userId:'ignored'},'primary-key');let req=__professionRequests.at(-1);assert.deepEqual(JSON.parse(req.init.body),{professionId:'10'});assert.equal(req.init.headers['Idempotency-Key'],'primary-key')
__professionResponses.push(envelope({onboardingState:'SKIPPED',primaryProfessionId:''}));await api.writeV3Profession({kind:'skip'},'skip-key');assert.deepEqual(JSON.parse(__professionRequests.at(-1).init.body),{onboardingState:'SKIPPED'})
__professionResponses.push(envelope({privacyPreset:'SELF_ONLY',moduleVisibility:visibility}));await api.writeV3Profession({kind:'privacy',preset:'SELF_ONLY',moduleVisibility:visibility},'privacy-key');assert.deepEqual(JSON.parse(__professionRequests.at(-1).init.body),{preset:'SELF_ONLY'})
__professionResponses.push(envelope({privacyPreset:'CUSTOM',moduleVisibility:visibility}));await api.writeV3Profession({kind:'privacy',preset:'CUSTOM',moduleVisibility:visibility},'custom-key');assert.deepEqual(JSON.parse(__professionRequests.at(-1).init.body),{preset:'CUSTOM',moduleVisibility:visibility})
await assert.rejects(api.writeV3Profession({kind:'privacy',preset:'CUSTOM',moduleVisibility:{experience:'PUBLIC'}},'bad'),/格式/)
assert.ok(__professionRequests.every(r=>!r.path.includes('apiKey')&&!r.init?.body?.includes('userId')))
console.log('PASS professions 2 separate closed primary/skip/privacy commands, full CUSTOM only, original keys and no owner/apiKey input')
__professionResponses.push(envelope(detail));assert.equal((await api.fetchV3ProfessionDetail('10')).contributions[0].experienceSum,-2)
__professionResponses.push(envelope(page([record])));assert.equal((await api.fetchV3ProfessionRecords('10')).list[0].experienceDelta,-2)
__professionResponses.push(envelope({...detail,profession:{...progress,professionId:'11'}}));await assert.rejects(api.fetchV3ProfessionDetail('10'),/格式/)
__professionResponses.push(new ApiError('no progress',404));await assert.rejects(api.fetchV3ProfessionDetail('11'),/no progress/)
await assert.rejects(api.fetchV3ProfessionRecords('../other'),/格式/)
console.log('PASS professions 3 actual owner detail/route and signed experience records, bound IDs and missing progress errors without fake zero levels')
const renderer=createRenderer({patchProp(){},insert(){},remove(){},createElement(){return{}},createText(){return{}},createComment(){return{}},setText(){},setElementText(){},parentNode(){return null},nextSibling(){return null}})
setActivePinia(createPinia());const auth=defineStore('profession-test-auth',()=>({accessToken:ref('A')}))();globalThis.__professionAuth=()=>auth;globalThis.__professionKey=0
const authURL=url('export const useAuthStore=globalThis.__professionAuth'),keyURL=url('export const profileOperationKey=()=>"profession-key-"+(++globalThis.__professionKey)')
globalThis.__professionAPI={...api};const apiURL=url(Object.keys(api).map(name=>typeof api[name]==='function'?`export const ${name}=(...args)=>globalThis.__professionAPI.${name}(...args);`:`export const ${name}=globalThis.__professionAPI.${name};`).join('\n'))
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}
async function component(){let source=(await fs.readFile('src/components/settings/OwnerProfessions.vue','utf8')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];let js=compile(source).replace("from '@/stores/auth'",`from '${authURL}'`).replace("from '@/api/http'",`from '${http}'`).replace("from '@/api/v3-profile'",`from '${keyURL}'`).replace("from '@/api/v3-professions'",`from '${apiURL}'`).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replace("from 'pinia'",`from '${import.meta.resolve('pinia')}'`);const imports=[...js.matchAll(/^import .+;$/gm)].map(m=>m[0]).join('\n');js=js.replace(/^import .+;$/gm,'');const loaded=await import(url(`${imports}\nexport default{setup(){${js}\nreturn{mine,catalog,preset,modules,pending,disabled,error,message,mineError,selected,detail,records,loadMine,loadCatalog,start,savePrivacy,retry,openDetail,loadRecords}},render(){return null}}`));const app=renderer.createApp(loaded.default);app.use(createPinia());return{app,vm:app.mount({})}}
let releaseOld;const old=new Promise(resolve=>releaseOld=resolve)
Object.assign(__professionAPI,{fetchV3OwnerProfessions:async()=>auth.accessToken==='A'?old:mine(),fetchV3Professions:async()=>page([definition]),fetchV3ProfessionDetail:async()=>detail,fetchV3ProfessionRecords:async()=>page([record])})
let view=await component();await tick();auth.accessToken='B';await tick();releaseOld({...mine(),state:{...state,primaryProfessionId:'99'}});await tick();assert.equal(view.vm.mine.state.primaryProfessionId,'11');assert.equal(view.vm.preset,'CUSTOM');auth.accessToken=null;assert.equal(view.vm.mine,null);assert.equal(view.vm.modules,null);view.app.unmount()
console.log('PASS professions 4 actual Vue/Pinia credential boundaries clear private selection/privacy and reject late owner state')
auth.accessToken='C';const commands=[];let fail=true
__professionAPI.fetchV3OwnerProfessions=async()=>mine();__professionAPI.writeV3Profession=async(command,key)=>{commands.push({command:JSON.parse(JSON.stringify(command)),key});if(fail){fail=false;throw new ApiError('lost ACK',0)}return{privacyPreset:'CUSTOM',moduleVisibility:{...visibility}}}
view=await component();await tick();view.vm.modules.experience='HIDDEN';view.vm.savePrivacy();await tick();assert.match(view.vm.error,/ACK/);assert.ok(view.vm.pending);view.vm.modules.experience='PUBLIC';view.vm.start({kind:'skip'});await tick();assert.equal(commands.length,1);view.vm.retry();await tick();assert.deepEqual(commands[0],commands[1]);assert.equal(commands[1].command.moduleVisibility.experience,'HIDDEN');assert.equal(view.vm.message,'职业隐私已保存');assert.equal(view.vm.pending,null);view.app.unmount()
console.log('PASS professions 5 unknown CUSTOM outcome freezes complete command/key, blocks conflicting writes and replays exact original values')
auth.accessToken='D';let reads=0,writes=0
__professionAPI.fetchV3OwnerProfessions=async()=>{if(++reads>1)throw Error('refresh offline');return mine()};__professionAPI.writeV3Profession=async()=>{writes++;return{onboardingState:'SELECTED',primaryProfessionId:'10'}}
view=await component();await tick();view.vm.start({kind:'primary',professionId:'10'});await tick();assert.equal(view.vm.pending,null);assert.equal(view.vm.message,'主职业已保存');assert.match(view.vm.mineError,/refresh offline/);assert.equal(view.vm.mine,null);await view.vm.loadMine();assert.equal(writes,1);view.app.unmount()
console.log('PASS professions 6 successful write plus failed read stays successful and retries only GET, with no operable false-default state')
auth.accessToken='E';__professionAPI.fetchV3OwnerProfessions=async(p=1)=>mine([progress],p,21);__professionAPI.writeV3Profession=async()=>{throw new ApiError('retired',404)}
view=await component();await tick();view.vm.preset='SELF_ONLY';await view.vm.loadMine(2,false);assert.equal(view.vm.preset,'SELF_ONLY');view.vm.start({kind:'primary',professionId:'10'});await tick();assert.equal(view.vm.pending,null);assert.match(view.vm.error,/retired/)
let releaseDetail,releaseRecords;__professionAPI.fetchV3ProfessionDetail=async id=>id==='10'?new Promise(resolve=>releaseDetail=resolve):{...detail,profession:{...progress,professionId:id}};__professionAPI.fetchV3ProfessionRecords=async id=>id==='10'?new Promise(resolve=>releaseRecords=resolve):page([])
const pendingDetail=view.vm.openDetail('10');await tick();await view.vm.openDetail('11');releaseDetail(detail);releaseRecords(page([record]));await pendingDetail;await tick();assert.equal(view.vm.detail.profession.professionId,'11');assert.deepEqual(view.vm.records.list,[])
let releaseWrite;__professionAPI.writeV3Profession=async()=>new Promise(resolve=>releaseWrite=resolve);view.vm.start({kind:'skip'});await tick();auth.accessToken=null;releaseWrite({onboardingState:'SKIPPED',primaryProfessionId:''});await tick();assert.equal(view.vm.message,'');assert.equal(view.vm.detail,null);assert.equal(view.vm.records,null);view.app.unmount()
console.log('PASS professions 7 pagination preserves unsaved privacy, explicit rejection frees intent, detail/record switches and late writes never cross identity')
