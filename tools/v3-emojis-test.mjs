import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createRenderer, nextTick, ref } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
const transpile = source => ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const shim=url('export class ApiError extends Error{constructor(message,status,code){super(message);this.status=status;this.code=code}} export function getAuthContextVersion(){return globalThis.__emojiContext||0} export async function request(path,init){globalThis.__emojiRequests.push({path,init});const value=globalThis.__emojiResponses.shift();if(value instanceof Error)throw value;if(value===undefined)throw Error("Unexpected "+path);return value}')
globalThis.__emojiRequests=[];globalThis.__emojiResponses=[]
const api=await import(url(transpile(await fs.readFile('src/api/v3-emojis.ts','utf8')).replace("from './http'",`from '${shim}'`)))
const envelope=data=>({code:0,data})
const page=(list,p=1,total=list.length)=>({list,pagination:{p,size:50,total,pageCount:Math.ceil(total/50)}})
__emojiResponses.push(envelope({emotions:['smile','heart']}));assert.deepEqual(await api.fetchV3FrequentEmotions(),[{name:'smile',text:':smile:'},{name:'heart',text:':heart:'}])
__emojiResponses.push(envelope({groups:[['smile','heart']],defaults:['smile']}));assert.deepEqual((await api.fetchV3EmotionOptions()).defaults,['smile'])
__emojiResponses.push(new Error('unavailable'));await assert.rejects(api.fetchV3FrequentEmotions(),/unavailable/)
console.log('PASS emojis 1 real alias/catalog reads with canonical insertion text and no manufactured fallback on errors')
const group={id:'10',name:'全部',type:1,sort:-1}
__emojiResponses.push(envelope(page([group],1,51)));assert.equal((await api.fetchV3EmojiGroups()).pageCount,2)
__emojiResponses.push(envelope(page([{...group,id:'11',name:'next',type:0}],2,51)));assert.equal((await api.fetchV3EmojiGroups(2)).list[0].oId,'11')
const signed='https://images.example/a(b).png?sig=a%2Fb&x=(y)'
__emojiResponses.push(envelope(page([{id:'20',emojiId:'99',name:'a[b]',sort:0,url:signed}])));const item=(await api.fetchV3GroupEmojis('10')).list[0]
assert.equal(item.oId,'20');assert.equal(item.emojiId,'99');assert.equal(item.url,signed)
__emojiResponses.push(envelope(page([{id:'21',emojiId:'98',name:'bad',sort:0,url:'javascript:bad()'}])));assert.equal((await api.fetchV3GroupEmojis('10')).list[0].url,'')
__emojiResponses.push(envelope({list:[],pagination:{p:1,size:50,total:0,pageCount:0}}));assert.deepEqual((await api.fetchV3GroupEmojis('10')).list,[])
await assert.rejects(api.fetchV3GroupEmojis('../user'))
console.log('PASS emojis 2 actual pages, signed URL identity, member-id/global-id distinction and unsafe URL handling')
__emojiResponses.push(envelope({...group,id:'12',name:'new',type:0,sort:2}));await api.createV3EmojiGroup('new',2,'same-key')
assert.equal(__emojiRequests.at(-1).init.method,'POST');assert.deepEqual(JSON.parse(__emojiRequests.at(-1).init.body),{name:'new',sort:2})
__emojiResponses.push(envelope({id:'20',groupId:'10',deleted:true}));await api.removeV3GroupEmoji('10','20','remove-key')
assert.equal(__emojiRequests.at(-1).path,'/api/v3/me/settings/emoji-groups/10/emojis/20');assert.equal(__emojiRequests.at(-1).init.method,'DELETE')
__emojiResponses.push(envelope({id:'22',emojiId:'99',groupId:'10',name:'one',sort:2,url:signed}));await api.addV3EmojiURL('',signed,0,'one','add-key')
assert.equal(__emojiRequests.at(-1).path,'/api/v3/me/settings/emojis');assert.equal(JSON.parse(__emojiRequests.at(-1).init.body).url,signed)
__emojiResponses.push(envelope({emotions:['smile']}));await api.saveV3FrequentEmotions([],'reset-key')
assert.deepEqual(JSON.parse(__emojiRequests.at(-1).init.body),{emotions:[]});assert.equal(__emojiRequests.at(-1).init.headers['Idempotency-Key'],'reset-key')
console.log('PASS emojis 3 exact v3 mutation methods/bodies/keys, private member removal, first-image upload and empty-array reset')
const fishpi=await fs.readFile('src/api/fishpi.ts','utf8')
const markdown=fishpi.slice(fishpi.indexOf('export function emojiToMarkdown('),fishpi.indexOf('export async function fetchFrequentEmotions'))
const markdownModule=await import(url(transpile(markdown)))
assert.equal(markdownModule.emojiToMarkdown({name:'a[b]\\c',url:signed}),`![a\\[b\\]\\\\c](${signed.replace(/[()]/g, '\\$&')})`)
assert.ok(!fishpi.includes('vditor@3.8.7'));assert.ok(!fishpi.includes('function mockEmotions'))
console.log('PASS emojis 4 actual Markdown helper escapes alternate-text brackets and preserves parenthesized signed URLs; versioned fake fallback removed')
const renderer=createRenderer({patchProp(){},insert(){},remove(){},createElement(){return{}},createText(){return{}},createComment(){return{}},setText(){},setElementText(){},parentNode(){return null},nextSibling(){return null}})
setActivePinia(createPinia());const useAuth=defineStore('emoji-auth-test',()=>({accessToken:ref('A'),account:ref({oId:'1'})}));const auth=useAuth();globalThis.__emojiAuth=useAuth
const authURL=url('export const useAuthStore=globalThis.__emojiAuth')
const apiNames=['addV3EmojiURL','createV3EmojiGroup','deleteV3EmojiGroup','fetchV3EmojiGroups','fetchV3GroupEmojis','fetchV3FrequentAliases','fetchV3EmotionOptions','saveV3FrequentEmotions','removeV3GroupEmoji','emojiOperationKey','fetchV3FrequentEmotions','updateV3EmojiGroup','updateV3EmojiItem','shareV3EmojiGroup','importV3EmojiGroup','migrateV3LegacyEmojis']
const apiURL=url(apiNames.map(name=>`export const ${name}=(...args)=>globalThis.__emojiAPI.${name}(...args);`).join('\n'))
const fishpiURL=url(transpile(markdown));const loadingURL=url('export default {}')
async function component(file,exposed){
 let source=(await fs.readFile(file,'utf8')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
 let js=transpile(source).replace("from '@/api/v3-emojis'",`from '${apiURL}'`).replace("from '@/api/fishpi'",`from '${fishpiURL}'`).replace("from '@/api/http'",`from '${shim}'`).replace("from '@/stores/auth'",`from '${authURL}'`).replace("from '@/components/FpLoading.vue'",`from '${loadingURL}'`).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replace("from 'pinia'",`from '${import.meta.resolve('pinia')}'`).replace(/const props = withDefaults\([^]*?\);/, 'const props={showTrigger:true,placement:"above",labels:{}};').replace('defineExpose({ toggle });','').replace('const emit = defineEmits();','const emit=(...args)=>globalThis.__emojiEmitted.push(args);')
 const imports=[...js.matchAll(/^import .+;$/gm)].map(m=>m[0]).join('\n');js=js.replace(/^import .+;$/gm,'')
 const loaded=await import(url(`${imports}\nexport default {setup(){${js}\nreturn {${exposed.join(',')}}},render(){return null}}`))
 const app=renderer.createApp(loaded.default);app.use(createPinia());const vm=app.mount({});return {app,vm}
}
// Install one auth instance across component-local Pinia roots.
const originalAuth=useAuth();globalThis.__emojiAuth=()=>originalAuth
let resolveA;const oldGroups=new Promise(resolve=>resolveA=resolve),calls=[],keys=[];let createFails=true
const groupB={oId:'2',name:'B-group',type:0,sort:0}
const valuePage=list=>({list,p:1,size:50,total:list.length,pageCount:1})
globalThis.__emojiAPI={
 fetchV3EmojiGroups:async()=>{const owner=auth.accessToken;calls.push(['groups',owner]);return owner==='A'?oldGroups:valuePage([groupB])},
 fetchV3GroupEmojis:async id=>{calls.push(['items',auth.accessToken,id]);return valuePage([])},
 fetchV3FrequentAliases:async()=>['smile'],fetchV3EmotionOptions:async()=>({groups:[['smile','heart']],defaults:['smile']}),
 emojiOperationKey:api.emojiOperationKey,
 createV3EmojiGroup:async(name,sort,key)=>{keys.push(key);if(createFails){createFails=false;throw Error('lost acknowledgement')}return{oId:'3',name,sort,type:0}},
 addV3EmojiURL:async()=>{},deleteV3EmojiGroup:async()=>{},removeV3GroupEmoji:async()=>{},saveV3FrequentEmotions:async()=>['smile'],fetchV3FrequentEmotions:async()=>[{name:'smile',text:':smile:'}],
}
const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve();await nextTick()}
const {app,vm}=await component('src/components/EmojiPacks.vue',['groups','items','groupId','error','busy','newGroup','onCreate'])
await tick();auth.accessToken='B';await tick();resolveA(valuePage([{oId:'1',name:'PRIVATE-A',type:0,sort:0}]));await tick()
assert.equal(vm.groups[0].name,'B-group');assert.equal(calls.filter(x=>x[0]==='items'&&x[1]==='B').length,1)
vm.newGroup='new';await vm.onCreate();assert.match(vm.error,/lost acknowledgement/);assert.equal(vm.newGroup,'new');await vm.onCreate();assert.equal(keys[0],keys[1]);assert.equal(vm.newGroup,'')
auth.accessToken=null;assert.equal(vm.groups.length,0);assert.equal(vm.items.length,0);assert.equal(vm.busy,false);app.unmount()
console.log('PASS emojis 5 actual Vue/Pinia group workflow isolates late prior-owner reads and preserves an uncertain create key through retry')
globalThis.__emojiEmitted=[];auth.accessToken='B'
const picker=await component('src/components/EmojiPicker.vue',['open','items','toggle','pick'])
picker.vm.toggle();await tick();assert.equal(picker.vm.items[0].text,':smile:');picker.vm.pick(picker.vm.items[0]);assert.deepEqual(__emojiEmitted[0],['insert',':smile:']);assert.equal(picker.vm.open,false)
picker.vm.toggle();await tick();auth.accessToken=null;assert.equal(picker.vm.open,false);assert.equal(picker.vm.items.length,0);picker.app.unmount()
console.log('PASS emojis 6 actual picker inserts canonical alias and closes/clears on identity loss')

__emojiResponses.push(envelope({id:'20',groupId:'10',emojiId:'99',name:'renamed',sort:8,url:signed}));
assert.equal((await api.updateV3EmojiItem('10','20','renamed',8,'meta-key')).oId,'20');
assert.deepEqual(JSON.parse(__emojiRequests.at(-1).init.body),{name:'renamed',sort:8});assert.equal(__emojiRequests.at(-1).init.method,'PUT');
__emojiResponses.push(envelope({shareCode:'ABCDEFGHIJ12',groupName:'share',emojiCount:1,createdTime:100}));
assert.equal((await api.shareV3EmojiGroup('10','share-key')).shareCode,'ABCDEFGHIJ12');assert.equal(__emojiRequests.at(-1).path,'/api/v3/me/settings/emoji-groups/10/shares');
__emojiResponses.push(envelope({groupId:'88',groupName:'copy',emojiCount:1,sourceGroupName:'share'}));
assert.equal((await api.importV3EmojiGroup(' abcdefghij12 ','import-key')).groupId,'88');assert.deepEqual(JSON.parse(__emojiRequests.at(-1).init.body),{shareCode:'ABCDEFGHIJ12'});
const requestCount=__emojiRequests.length;await assert.rejects(api.importV3EmojiGroup('bad/code','k'));assert.equal(__emojiRequests.length,requestCount);
__emojiResponses.push(envelope({groupId:'10',processedCount:2,addedCount:1}));assert.equal((await api.migrateV3LegacyEmojis('migration-key')).addedCount,1);assert.deepEqual(JSON.parse(__emojiRequests.at(-1).init.body),{});
__emojiResponses.push(envelope({groupId:'10',processedCount:1,addedCount:2}));await assert.rejects(api.migrateV3LegacyEmojis('migration-key2'));
console.log('PASS emojis 7 metadata/share/import/migration use exact resources and normalized code, reject inconsistent results')
auth.accessToken='C';const transferKeys=[];let importFailed=true;const transferGroups=[groupB];
Object.assign(globalThis.__emojiAPI,{
 fetchV3EmojiGroups:async()=>valuePage(transferGroups),
 fetchV3GroupEmojis:async()=>valuePage([{oId:'20',emojiId:'99',name:'before',sort:1,url:signed}]),
 updateV3EmojiGroup:async(id,name,sort)=>{Object.assign(groupB,{name,sort});return{...groupB}},
 updateV3EmojiItem:async(g,id,name,sort)=>({oId:id,name,sort,emojiId:'99',url:signed}),
 shareV3EmojiGroup:async()=>({shareCode:'ABCDEFGHIJ12',groupName:'B-group',emojiCount:1,createdTime:100}),
 importV3EmojiGroup:async(code,key)=>{transferKeys.push(key);if(importFailed){importFailed=false;throw Error('lost import acknowledgement')}transferGroups.push({oId:'88',name:'copy',type:0,sort:88});return{groupId:'88',groupName:'copy',emojiCount:1,sourceGroupName:'B-group'}},
 migrateV3LegacyEmojis:async()=>{transferGroups.push({oId:'1',name:'全部',type:1,sort:0});return{groupId:'1',processedCount:2,addedCount:1}},
});
const transfers=await component('src/components/EmojiPacks.vue',['groups','groupId','items','error','importCode','sharedCode','transferNotice','editGroupName','editGroupSort','editItemId','editItemName','editItemSort','editItem','onUpdateGroup','onUpdateItem','onShare','onImport','onMigrate']);await tick();
transfers.vm.editGroupName='renamed';transfers.vm.editGroupSort=4;await transfers.vm.onUpdateGroup();assert.equal(transfers.vm.groups.find(g=>g.oId==='2').name,'renamed');
transfers.vm.editItem(transfers.vm.items[0]);assert.equal(transfers.vm.editItemId,'20');transfers.vm.editItemName='new-name';await transfers.vm.onUpdateItem();assert.equal(transfers.vm.editItemId,'');
await transfers.vm.onShare();assert.equal(transfers.vm.sharedCode,'ABCDEFGHIJ12');
transfers.vm.importCode=' abcdefghij12 ';await transfers.vm.onImport();assert.match(transfers.vm.error,/lost import/);assert.equal(transfers.vm.importCode,' abcdefghij12 ');await transfers.vm.onImport();assert.equal(transferKeys[0],transferKeys[1]);assert.equal(transfers.vm.groupId,'88');assert.equal(transfers.vm.importCode,'');
await transfers.vm.onMigrate();assert.equal(transfers.vm.groupId,'1');assert.match(transfers.vm.transferNotice,/新增 1/);
auth.accessToken=null;assert.equal(transfers.vm.sharedCode,'');assert.equal(transfers.vm.transferNotice,'');assert.equal(transfers.vm.editItemName,'');transfers.app.unmount();
console.log('PASS emojis 8 actual Vue metadata/edit/share/import/migration workflow keeps unknown-result keys and clears private transfer state')

auth.accessToken='D';let requestedPages=[];
Object.assign(globalThis.__emojiAPI,{
 fetchV3EmojiGroups:async(p=1)=>{requestedPages.push(p);return p===2?{list:[{oId:'88',name:'last-page-copy',type:0,sort:51}],p:2,size:50,total:51,pageCount:2}:{list:[groupB],p:1,size:50,total:51,pageCount:2}},
 importV3EmojiGroup:async()=>({groupId:'88',groupName:'last-page-copy',emojiCount:1,sourceGroupName:'source'}),
});
const pagedTransfer=await component('src/components/EmojiPacks.vue',['groupId','importCode','editGroupSort','onImport']);await tick();requestedPages=[];
pagedTransfer.vm.importCode='ABCDEFGHIJ12';await pagedTransfer.vm.onImport();assert.deepEqual(requestedPages,[1,2]);assert.equal(pagedTransfer.vm.groupId,'88');assert.equal(pagedTransfer.vm.editGroupSort,51);
auth.accessToken=null;pagedTransfer.app.unmount();
console.log('PASS emojis 9 imported last-page group reloads authoritative metadata rather than inventing a zero sort')
