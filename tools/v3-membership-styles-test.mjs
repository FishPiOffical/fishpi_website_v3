import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer, h, nextTick, ref } from 'vue'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__styleRequests=[];globalThis.__styleResponses=[];globalThis.__styleToken=null;globalThis.__styleListeners=[];globalThis.__styleSSR=false
const http=url(`export class ApiError extends Error{constructor(message,status=0,code){super(message);this.status=status;this.code=code}} export async function request(path){globalThis.__styleRequests.push(path);const result=globalThis.__styleResponses.shift();if(result instanceof Error)throw result;if(result===undefined)throw Error('Unexpected '+path);return result} export function getAccessToken(){return globalThis.__styleToken} export function onAccessTokenChange(fn){globalThis.__styleListeners.push(fn);fn(globalThis.__styleToken);return()=>{}}`)
const api=await import(url(compile(await fs.readFile('src/api/v3-membership-styles.ts','utf8')).replace("from './http'",`from '${http}'`)))
const envelope=data=>({code:0,data})
__styleResponses.push(envelope({list:[{userId:'1',style:{bold:false,underline:true,color:'#ABCDEF',configJson:'secret',expiresAt:10}},{userId:'2',style:{}}]}))
assert.deepEqual(await api.fetchV3MembershipStyles(['1','2']),[{userId:'1',style:{bold:false,underline:true,color:'#ABCDEF'}},{userId:'2',style:{}}])
assert.equal(__styleRequests.at(-1),'/api/v3/membership/styles?userIds=1%2C2')
for(const ids of [[],['1','1'],['0'],Array.from({length:101},(_,i)=>String(i+1))])await assert.rejects(api.fetchV3MembershipStyles(ids))
for(const list of [[{userId:'2',style:{}}],[{userId:'1',style:{bold:'true'}}],[{userId:'1',style:{color:'#123'}}]]){__styleResponses.push(envelope({list}));await assert.rejects(api.fetchV3MembershipStyles(['1']),/格式/)}
__styleResponses.push(envelope({id:'1',userName:'Alice',userPhone:'secret'}));assert.deepEqual(await api.resolveV3NicknameUser('alice'),{id:'1',userName:'Alice'});assert.equal(__styleRequests.at(-1),'/api/v3/users/alice')
__styleResponses.push(envelope({id:'1',userName:'Other'}));await assert.rejects(api.resolveV3NicknameUser('Alice'),/格式/)
assert.equal(api.membershipUserId(Number.MAX_SAFE_INTEGER+1),'');assert.equal(api.membershipUserId('1234567890123456789'),'1234567890123456789')
console.log('PASS membership styles 1 exact ID batches/order, typed three-field projection, safe name-to-ID lookup and malformed response rejection')
const batches=[],lookups=[];globalThis.__styleBatch=async ids=>ids.map(userId=>({userId,style:{bold:true,color:'#112233'}}));globalThis.__styleLookup=async name=>({id:name.toLowerCase()==='alice'?'1':'77',userName:name})
const service=url(`export const membershipUserId=globalThis.__styleId;export async function fetchV3MembershipStyles(ids){globalThis.__styleBatches.push([...ids]);return globalThis.__styleBatch(ids)}export async function resolveV3NicknameUser(name){globalThis.__styleLookups.push(name);return globalThis.__styleLookup(name)}`)
globalThis.__styleId=api.membershipUserId;globalThis.__styleBatches=batches;globalThis.__styleLookups=lookups
const helper=await import(url(compile(await fs.readFile('src/composables/useVipNickname.ts','utf8')).replace("from '@/api/http'",`from '${http}'`).replace("from '@/api/v3-membership-styles'",`from '${service}'`).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replaceAll('import.meta.env.SSR','globalThis.__styleSSR')))
function token(value){globalThis.__styleToken=value;for(const fn of __styleListeners)fn(value)}
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();await nextTick()}
const until=async test=>{const end=Date.now()+3000;while(!test()){if(Date.now()>end)throw Error('Fixture did not reach expected pending request');await new Promise(resolve=>setTimeout(resolve,1))}}
assert.equal((await helper.loadVipName('1')).isVip,false);assert.equal(batches.length,0)
token('A');const results=await Promise.all([...Array.from({length:205},(_,i)=>helper.loadVipName(String(i+1))),helper.loadVipName('1')]);assert.equal(batches.length,3);assert.deepEqual(batches.map(batch=>batch.length),[100,100,5]);assert.equal(results[0].color,'#112233');assert.ok(batches.every(batch=>new Set(batch).size===batch.length))
const before=batches.length;await helper.loadVipName('1');assert.equal(batches.length,before);assert.equal(helper.cachedVipName('999','Alice'),undefined)
console.log('PASS membership styles 2 anonymous never queries, 205 visible IDs coalesce into 100/100/5 ordered batches and duplicate IDs/cache hits do not refetch')
token('B');globalThis.__styleBatch=async ids=>ids.map(userId=>({userId,style:{underline:true,color:'rainbow'}}))
const alias=await helper.loadVipName(undefined,'Alice');assert.equal(alias.effect,'rainbow');assert.equal(helper.cachedVipName(undefined,'alice').underline,true);const lookupsBefore=lookups.length;await helper.loadVipName(undefined,'ALICE');assert.equal(lookups.length,lookupsBefore)
await helper.loadVipName('42','Alice');assert.equal(helper.cachedVipName('42').effect,'rainbow');assert.equal(helper.cachedVipName(undefined,'Alice').effect,'rainbow');assert.equal(helper.cachedVipName('99','Alice'),undefined)
helper.invalidateVipName('1','Alice');assert.equal(helper.cachedVipName('1'),undefined);assert.equal(helper.cachedVipName(undefined,'Alice'),undefined)
console.log('PASS membership styles 3 only verified v3 lookup binds name aliases; explicit IDs cannot fall back to another alias and owner invalidation clears both')
token('C');let releaseOld;globalThis.__styleBatch=async ids=>new Promise(resolve=>releaseOld=()=>resolve(ids.map(userId=>({userId,style:{color:'#FF0000'}}))))
const stale=helper.loadVipName('55');await until(()=>!!releaseOld);token('D');globalThis.__styleBatch=async ids=>ids.map(userId=>({userId,style:{color:'#0000FF'}}));await helper.loadVipName('55');releaseOld();await stale;await tick();assert.equal(helper.cachedVipName('55').color,'#0000FF');token(null);assert.equal(helper.cachedVipName('55'),undefined)
console.log('PASS membership styles 4 an old batch cannot overwrite a new reader and logout synchronously removes all cached styles')
token('E');let releaseInvalidated;globalThis.__styleBatch=async ids=>new Promise(resolve=>releaseInvalidated=()=>resolve(ids.map(userId=>({userId,style:{color:'#111111'}}))))
const old=helper.loadVipName('66');await until(()=>!!releaseInvalidated);helper.invalidateVipName('66');assert.equal((await old).isVip,false);globalThis.__styleBatch=async ids=>ids.map(userId=>({userId,style:{color:'#222222'}}));const fresh=helper.loadVipName('66');releaseInvalidated();await fresh;assert.equal(helper.cachedVipName('66').color,'#222222')
console.log('PASS membership styles 5 invalidating while a batch is in flight cancels its write and a later request installs only the fresh style')
token('F');let failures=0;globalThis.__styleBatch=async()=>{failures++;throw Error('offline')};assert.equal((await helper.loadVipName('77')).isVip,false);assert.equal(helper.cachedVipName('77'),undefined);await helper.loadVipName('77');assert.equal(failures,2)
globalThis.__styleBatch=async ids=>ids.map(userId=>({userId,style:{}}));await helper.loadVipName('77');assert.equal(helper.cachedVipName('77').isVip,false);const successfulReads=batches.length;await helper.loadVipName('77');assert.equal(batches.length,successfulReads)
const realNow=Date.now;Date.now=()=>realNow()+61000;assert.equal(helper.cachedVipName('77'),undefined);await helper.loadVipName('77');Date.now=realNow;assert.equal(batches.length,successfulReads+1)
globalThis.__styleSSR=true;assert.equal(helper.cachedVipName('77'),undefined);assert.equal((await helper.loadVipName('77')).isVip,false);globalThis.__styleSSR=false
console.log('PASS membership styles 6 transport errors are not cached, valid empty styles are plain text, later reads honor TTL and SSR never uses browser styles')
const source=await fs.readFile('src/components/user/VipNickname.vue','utf8'),descriptor=parse(source).descriptor
let componentCode=compile(compileScript(descriptor,{id:'nickname-test',inlineTemplate:true}).content).replace(/from ['"]vue['"]/g,`from '${import.meta.resolve('vue')}'`)
globalThis.__styleHelper=helper
const helperURL=url(['cachedVipName','loadVipName','vipNameClass','vipNameStyle','vipNameRevision'].map(name=>`export const ${name}=globalThis.__styleHelper.${name}`).join('\n'))
componentCode=componentCode.replace("from '@/composables/useVipNickname'",`from '${helperURL}'`);const component=(await import(url(componentCode))).default
let element;const renderer=createRenderer({patchProp(el,key,old,value){el.props[key]=value},insert(){},remove(){},createElement(){element={props:{}};return element},createText(){return{}},createComment(){return{}},setText(){},setElementText(){},parentNode(){return null},nextSibling(){return null}})
token('G');globalThis.__styleBatch=async ids=>ids.map(userId=>({userId,style:{bold:true,color:'rainbow'}}));const target=ref('88'),app=renderer.createApp({setup:()=>()=>h(component,{userId:target.value,userName:'shown',text:'显示昵称',lazy:false})});app.mount({});await until(()=>helper.cachedVipName('88'));await tick();assert.match(element.props.class,/vip-nickname--rainbow/)
token(null);await tick();assert.ok(!String(element.props.class).includes('rainbow'));assert.equal(element.props.style,undefined);app.unmount()
console.log('PASS membership styles 7 actual compiled nickname template drops old CSS immediately on logout, with no local config fallback')
const helperSource=await fs.readFile('src/composables/useVipNickname.ts','utf8');assert.ok(!helperSource.includes('fetchMembershipDetail')&&!helperSource.includes('fetchUserProfile')&&!helperSource.includes("'@/api/fishpi'"))
console.log('PASS membership styles 8 shared nickname transport has no legacy membership/profile fallback or raw membership-status dependency')
