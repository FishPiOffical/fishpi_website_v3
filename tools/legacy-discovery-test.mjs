import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const state=globalThis.__legacyDiscovery={data:null,calls:[],key:null,mode:'v1'}
const shim=url(`export class ApiError extends Error{constructor(m,s){super(m);this.status=s}}export async function request(path,init){__legacyDiscovery.calls.push({path,init});return{code:0,data:__legacyDiscovery.data}}`),mode=url('export const getApiMode=()=>__legacyDiscovery.mode')
const replace=(s,pairs)=>{for(const[a,b]of pairs)s=s.replaceAll(`from '${a}'`,`from '${b}'`);return s}
const content=url(replace(compile(await fs.readFile('src/api/v3-content.ts','utf8')),[['./mode',mode],['./http',shim]]))
const columns=url(replace(compile(await fs.readFile('src/api/v3-public-columns.ts','utf8')),[['./mode',mode],['./http',shim],['./v3-content',content]]))
const home=url(replace(compile(await fs.readFile('src/api/legacy/home.ts','utf8')),[['../http',shim],['../v3-content',content],['../v3-public-columns',columns]]))
const relations=url(replace(compile(await fs.readFile('src/api/v3-user-relations.ts','utf8')),[['./http',shim]]))
const repeater=url(replace(compile(await fs.readFile('src/api/v3-repeater.ts','utf8')),[['./mode',mode],['./http',shim]]))
const auth=url('export const getLegacyKey=()=>__legacyDiscovery.key')
const api=await import(url(replace(compile(await fs.readFile('src/api/legacy/discovery.ts','utf8')),[['../http',shim],['./auth',auth],['./home',home],['../v3-user-relations',relations],['../v3-repeater',repeater]])))
const extras=await import(url(replace(compile(await fs.readFile('src/api/v3-discovery-extras.ts','utf8')),[['./mode',mode],['./http',shim],['./v3-user-relations',relations],['./v3-content',content]])))
const entries=Array.from({length:23},(_,i)=>({oId:String(100+i),userName:'user'+i,userNickname:'昵称'+i,userAvatarURL:'',userCurrentCheckinStreak:i,onlineMinute:i*60,userPassword:'must not expose'}))
state.data={list:entries,totalData:{}}
let result=await api.legacyRanking('checkin',2,8)
assert.equal(result.total,23);assert.equal(result.pageCount,3);assert.equal(result.list[0].rank,9);assert.equal(result.list[0].score,8);assert.equal(result.list[0].user.userPassword,undefined)
result=await api.legacyRanking('online',3,8);assert.equal(result.list.length,7);assert.equal(result.list[0].metrics.minutes,960)
state.data.list[0].userCurrentCheckinStreak=undefined;await assert.rejects(api.legacyRanking('checkin',1,8))
console.log('PASS finite legacy ranking snapshot paginates actual membership, preserves scores/ranks and never invents missing metrics')
const item=i=>({oId:String(i),repeaterContentType:'joke',repeaterContent:'这是一段测试文本',repeaterContentLikeCount:0,repeaterContentLiked:false,repeaterContentCreatedTime:1000,repeaterContentAuthorId:'7',repeaterContentAuthorName:'author',secret:'do not project'})
state.data={items:[item(1),item(2),item(3)]};state.key='synthetic-key'
result=await api.legacyRepeaterList('joke',2)
assert.equal(result.length,2);assert.equal(result[0].content,'这是一段测试文本');assert.equal(result[0].likeCount,0);assert.equal(result[0].secret,undefined);assert.match(state.calls.at(-1).path,/apiKey=synthetic-key/)
state.data={item:item(9)};result=await api.legacyRepeaterNext('joke','1');assert.equal(result.id,'9');await assert.rejects(api.legacyRepeaterNext('joke','9'))
state.data={item:null};assert.equal(await api.legacyRepeaterNext('joke','1'),null)
state.data={items:[item(1),item(1)]};await assert.rejects(api.legacyRepeaterList('joke',12))
console.log('PASS legacy repeater list/next keep actual type, author, plain text and zero counts; duplicate/excluded IDs fail')
state.data=[{userName:'new_user',userNickname:'新鱼油',password:'private'}]
result=await extras.fetchRecentMembers();assert.equal(result[0].id,undefined);assert.equal(result[0].userAvatarURL,'');assert.equal(result[0].password,undefined);assert.equal(result[0].userName,'new_user')
assert.deepEqual(extras.decodeRecentMembers(result),result)
state.mode='v3';assert.throws(()=>extras.decodeRecentMembers(result))
state.data=[];state.mode='v1';assert.deepEqual(await extras.fetchRecentMembers(),[])
console.log('PASS recent names without public IDs stay identity-free, SSR reprojection works, v3 retains strict numeric IDs')
