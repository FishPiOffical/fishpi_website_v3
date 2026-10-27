import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createRenderer, nextTick, ref } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
const transpile = source => ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
globalThis.__profileRequests=[];globalThis.__profileResponses=[]
const shim=moduleURL('export class ApiError extends Error{constructor(message,status,code){super(message);this.status=status;this.code=code}} export async function request(path,init){globalThis.__profileRequests.push({path,init});const value=globalThis.__profileResponses.shift();if(value instanceof Error)throw value;if(typeof value==="function")return value();if(value===undefined)throw Error("Unexpected "+path);return value}')
const api=await import(moduleURL(transpile(await fs.readFile('src/api/v3-profile.ts','utf8')).replace("from './http'",`from '${shim}'`)))
const envelope=data=>({code:0,data}), profile={userNickname:'owner',userIntro:'intro',userURL:'https://example.com/'}
__profileResponses.push(envelope(profile));assert.deepEqual(await api.fetchV3Profile(),profile)
__profileResponses.push(envelope({mbti:'ENFP-A'}));assert.equal(await api.fetchV3Personality(),'ENFP-A')
__profileResponses.push(envelope({types:['ENFP'],variants:['A','T']}));assert.deepEqual((await api.fetchV3PersonalityOptions()).types,['ENFP'])
__profileResponses.push(new Error('offline'));await assert.rejects(api.fetchV3Profile(),/offline/)
__profileResponses.push(envelope({mbti:'ENFP-extra'}));await assert.rejects(api.fetchV3Personality())
console.log('PASS profile 1 exact owner reads/catalog reject malformed data and never manufacture defaults on errors')
const signed='https://images.example/avatar.png?sig=a%2Fb&size=(40)'
__profileResponses.push(envelope(profile));await api.saveV3Profile({...profile,userQQ:'must-not-send'},'profile-key')
assert.deepEqual(JSON.parse(__profileRequests.at(-1).init.body),profile)
assert.equal(__profileRequests.at(-1).init.headers['Idempotency-Key'],'profile-key')
__profileResponses.push(envelope({mbti:''}));await api.saveV3Personality('','mbti-key');assert.deepEqual(JSON.parse(__profileRequests.at(-1).init.body),{mbti:''})
__profileResponses.push(envelope({avatarURL:signed}));assert.equal(await api.saveV3Avatar(signed,'avatar-key'),signed)
assert.equal(__profileRequests.at(-1).init.method,'PUT');assert.equal(__profileRequests.at(-1).path,'/api/v3/me/settings/avatar')
assert.equal(api.displayAvatar('javascript:evil()'),'');assert.equal(api.displayAvatar('//evil.test/a'),'');assert.equal(api.displayAvatar('https://user:pass@images.example/a'),'')
console.log('PASS profile 2 whitelist writes use independent resources and keys, preserve signed URLs and filter dangerous previews')
const originalFetch=globalThis.fetch, uploads=[]
globalThis.fetch=async(path,init)=>{uploads.push({path,init});return new Response(JSON.stringify(envelope({succMap:{'avatar.png':signed},errFiles:[]})),{status:200})}
const png=new File([new Uint8Array([137,80,78,71,13,10,26,10,1])],'untrusted.webp',{type:'image/webp'})
const ticket={ticket:'UPLOAD_ONLY',tokenType:'Bearer',fieldName:'file',uploadURL:'https://pic.fishpi.cn/api/v1/files',expiresIn:180}
__profileResponses.push(envelope(ticket));assert.equal(await api.uploadV3Avatar(png,new AbortController().signal),signed)
assert.equal(uploads[0].path,'/rhypic-upload/api/v1/files');assert.equal(uploads[0].init.headers.Authorization,'Bearer UPLOAD_ONLY');assert.equal(uploads[0].init.credentials,'omit');assert.equal(uploads[0].init.redirect,'error')
assert.equal(uploads[0].init.body.get('file').name,'avatar.png');assert.equal(uploads[0].init.body.get('file[]'),null)
assert.equal(uploads[0].init.body.get('file').type,'image/png')
assert.equal(__profileRequests.at(-1).path,'/api/v3/uploads/tickets');assert.deepEqual(JSON.parse(__profileRequests.at(-1).init.body),{})
await assert.rejects(api.uploadV3Avatar(new File(['RIFFwebp'],'fake.png'),new AbortController().signal),/WebP/)
const before=uploads.length
__profileResponses.push(envelope({...ticket,uploadURL:'http://remote.example/api/v1/files'}));await assert.rejects(api.uploadV3Avatar(png,new AbortController().signal));assert.equal(uploads.length,before)
__profileResponses.push(envelope({...ticket,fieldName:'file[]'}));await assert.rejects(api.uploadV3Avatar(png,new AbortController().signal));assert.equal(uploads.length,before)
const aborted=new AbortController();__profileResponses.push(()=>{aborted.abort();return envelope(ticket)});await assert.rejects(api.uploadV3Avatar(png,aborted.signal));assert.equal(uploads.length,before)
globalThis.fetch=originalFetch
console.log('PASS profile 3 magic-based named multipart upload uses only short ticket, no cookies/redirects; invalid targets/aborted identity cannot upload')

const renderer=createRenderer({patchProp(){},insert(){},remove(){},createElement(){return{}},createText(){return{}},createComment(){return{}},setText(){},setElementText(){},parentNode(){return null},nextSibling(){return null}})
setActivePinia(createPinia());const auth=defineStore('profile-auth-test',()=>({accessToken:ref('A'),reloadAccount:async()=>{}}))()
globalThis.__profileAuth=()=>auth
const authURL=moduleURL('export const useAuthStore=globalThis.__profileAuth')
const names=['fetchV3Profile','saveV3Profile','fetchV3Personality','fetchV3PersonalityOptions','saveV3Personality','fetchV3Avatar','saveV3Avatar','displayAvatar','uploadV3Avatar','profileOperationKey','fetchV3Qq','saveV3Qq','fetchV3ProfileTags','saveV3ProfileTags']
const apiURL=moduleURL(names.map(name=>`export const ${name}=(...args)=>globalThis.__profileAPI.${name}(...args);`).join('\n'))
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();await nextTick()}
async function component(mode,exposed){
  globalThis.__profileProps={mode}
  let source=(await fs.readFile('src/components/settings/OwnerProfileSettings.vue','utf8')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  let js=transpile(source).replace("from '@/api/v3-profile'",`from '${apiURL}'`).replace("from '@/stores/auth'",`from '${authURL}'`).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replace("from 'pinia'",`from '${import.meta.resolve('pinia')}'`).replace('const props = defineProps();','const props = globalThis.__profileProps;')
  const imports=[...js.matchAll(/^import .+;$/gm)].map(m=>m[0]).join('\n');js=js.replace(/^import .+;$/gm,'')
  const loaded=await import(moduleURL(`${imports}\nexport default{setup(){${js}\nreturn{${exposed.join(',')}}},render(){return null}}`))
  const app=renderer.createApp(loaded.default);app.use(createPinia());return{app,vm:app.mount({})}
}
let resolveOld;const late=new Promise(resolve=>resolveOld=resolve),keys=[];let failSave=true
globalThis.__profileAPI={...api,
  fetchV3Profile:async()=>auth.accessToken==='A'?late:{...profile,userNickname:'CURRENT-B'},
  fetchV3Personality:async()=>'',fetchV3PersonalityOptions:async()=>({types:['ENFP'],variants:['A','T']}),
  saveV3Profile:async(body,key)=>{keys.push(key);if(failSave){failSave=false;throw Error('lost acknowledgement')}return body},
  saveV3Personality:async value=>value,
  fetchV3Qq:async()=>'',saveV3Qq:async value=>value,
  fetchV3ProfileTags:async()=>'',saveV3ProfileTags:async value=>value,
}
const owner=await component('profile',['nickname','intro','website','mbti','errors','messages','loaded','busy','saveProfile','savePersonality'])
await tick();auth.accessToken='B';await tick();resolveOld({...profile,userNickname:'PRIVATE-A'});await tick();assert.equal(owner.vm.nickname,'CURRENT-B')
owner.vm.nickname='new-name';await owner.vm.saveProfile();assert.match(owner.vm.errors.profile,/lost acknowledgement/);await owner.vm.saveProfile();assert.equal(keys[0],keys[1]);assert.equal(owner.vm.messages.profile,'已保存')
owner.vm.mbti='bad';await owner.vm.savePersonality();assert.match(owner.vm.errors.personality,/请选择/)
owner.vm.mbti=' enfp-a ';await owner.vm.savePersonality();assert.equal(owner.vm.mbti,'ENFP-A')
auth.accessToken=null;assert.equal(owner.vm.nickname,'');assert.equal(owner.vm.mbti,'');assert.equal(owner.vm.messages.profile,'');owner.app.unmount()
console.log('PASS profile 4 actual Vue/Pinia ignores late owner reads, retries unknown saves with same key and isolates MBTI status/identity')

auth.accessToken='C';let uploadCount=0,avatarSaveCount=0;const avatarKeys=[]
Object.assign(globalThis.__profileAPI,{
  fetchV3Avatar:async()=>signed,
  uploadV3Avatar:async()=>{uploadCount++;return signed},
  saveV3Avatar:async(value,key)=>{avatarSaveCount++;avatarKeys.push(key);if(avatarSaveCount===1)throw Error('save unavailable');return value},
})
const avatar=await component('avatar',['avatar','avatarDraft','busy','errors','messages','onUpload','saveAvatar']);await tick()
const input={files:[png],value:'chosen'};await avatar.vm.onUpload({target:input});assert.equal(input.value,'');assert.equal(avatar.vm.avatarDraft,signed);assert.match(avatar.vm.errors.avatar,/save unavailable/)
await avatar.vm.saveAvatar();assert.equal(uploadCount,1);assert.equal(avatarKeys[0],avatarKeys[1]);assert.equal(avatar.vm.messages.avatar,'已保存')
let releaseUpload,seenSignal;globalThis.__profileAPI.uploadV3Avatar=async(file,signal)=>{seenSignal=signal;return new Promise(resolve=>releaseUpload=resolve)}
const pending=avatar.vm.onUpload({target:{files:[png],value:''}});await tick();auth.accessToken=null;assert.equal(seenSignal.aborted,true);releaseUpload('https://images.example/private-c.png');await pending
assert.equal(avatarSaveCount,2);assert.equal(avatar.vm.avatarDraft,'');assert.equal(avatar.vm.avatar,'');avatar.app.unmount()
console.log('PASS profile 5 uploaded URL survives setting failure without re-upload; identity loss aborts upload and prevents save/late private results')
__profileResponses.push(envelope({qq:'00123'}));assert.equal(await api.fetchV3Qq(),'00123')
__profileResponses.push(envelope({qq:''}));assert.equal(await api.saveV3Qq('','qq-key'),'');assert.equal(__profileRequests.at(-1).path,'/api/v3/me/settings/qq')
assert.deepEqual(JSON.parse(__profileRequests.at(-1).init.body),{qq:''});assert.equal(__profileRequests.at(-1).init.headers['Idempotency-Key'],'qq-key')
auth.accessToken='Q';const qqOwner=await component('profile',['qq','errors','messages','saveQq']);await tick()
qqOwner.vm.qq='1e3';await qqOwner.vm.saveQq();assert.match(qqOwner.vm.errors.qq,/1至12/)
qqOwner.vm.qq='00123';await qqOwner.vm.saveQq();assert.equal(qqOwner.vm.qq,'00123');assert.equal(qqOwner.vm.messages.qq,'已保存');auth.accessToken=null;assert.equal(qqOwner.vm.qq,'');qqOwner.app.unmount()
console.log('PASS profile 6 private QQ resource/key, clear/leading zeros and actual component invalid-input/identity isolation')
__profileResponses.push(envelope({tags:'JavaScript,Elasticsearch'}));assert.equal(await api.fetchV3ProfileTags(),'JavaScript,Elasticsearch')
__profileResponses.push(envelope({tags:'JavaScript'}));assert.equal(await api.saveV3ProfileTags('JS','tags-key'),'JavaScript');assert.equal(__profileRequests.at(-1).path,'/api/v3/me/settings/tags');assert.deepEqual(JSON.parse(__profileRequests.at(-1).init.body),{tags:'JS'})
auth.accessToken='T';const tagKeys=[];let failTags=true
globalThis.__profileAPI.saveV3ProfileTags=async(value,key)=>{tagKeys.push(key);if(failTags){failTags=false;throw Error('uncertain tags')}return 'JavaScript'}
const tagOwner=await component('profile',['tags','errors','messages','saveTags']);await tick();tagOwner.vm.tags='JS';await tagOwner.vm.saveTags();assert.match(tagOwner.vm.errors.tags,/uncertain/);assert.equal(tagOwner.vm.tags,'JS');await tagOwner.vm.saveTags();assert.equal(tagKeys[0],tagKeys[1]);assert.equal(tagOwner.vm.tags,'JavaScript');auth.accessToken=null;assert.equal(tagOwner.vm.tags,'');tagOwner.app.unmount()
console.log('PASS profile 7 dedicated tags contract, canonical result, uncertain same-key retry and private state clearing')
