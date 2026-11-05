import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer, createSSRApp, h, nextTick, ref, reactive } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { renderToString } from '@vue/server-renderer'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__interaction={context:1,requests:[],responses:[],dispatch:null,confirmations:[],confirmWork:async()=>true,balanceFails:false,balanceReads:0};const state=__interaction
const http=url(`export class ApiError extends Error{constructor(message,status=0,code){super(message);this.status=status;this.code=code}}export function getAuthContextVersion(){return globalThis.__interaction.context}export async function request(path,init){const s=globalThis.__interaction;s.requests.push({path,init});if(s.dispatch)return s.dispatch(path,init);const value=s.responses.shift();if(value instanceof Error)throw value;return value}`)
const mode=process.env.FP_INTERACTIONS_MODE==='v1'?'v1':'v3',credentialName=mode==='v1'?'apiKey':'accessToken',modeURL=url(`export const getApiMode=()=> '${mode}'`);globalThis.__interactionKey='a'.repeat(128)
const legacyAuthURL=url('export const getLegacyKey=()=>globalThis.__interactionAuth?globalThis.__interactionAuth().apiKey:globalThis.__interactionKey'),legacyURL=url(compile(await fs.readFile('src/api/legacy/versioned.ts','utf8')).replace("from '../http'",`from '${http}'`).replace("from './auth'",`from '${legacyAuthURL}'`))
const api=await import(url(compile(await fs.readFile('src/api/v3-article-interactions.ts','utf8')).replace("from './http'",`from '${http}'`).replace("from './mode'",`from '${modeURL}'`).replace("from './legacy/versioned'",`from '${legacyURL}'`))),{ApiError}=await import(http),env=data=>({code:0,data})
const auth=defineStore('interaction-auth',()=>({accessToken:ref(mode==='v3'?'A':null),apiKey:ref(mode==='v1'?globalThis.__interactionKey:null),account:ref({oId:'1',userName:'owner'}),async reloadAccount(){state.balanceReads++;if(state.balanceFails)throw Error('balance failed')}}));globalThis.__interactionAuth=auth;setActivePinia(createPinia());globalThis.__interactionAPI=api
const authURL=url('export const useAuthStore=globalThis.__interactionAuth'),apiURL=url(`export const readArticleInteraction=(...a)=>globalThis.__interactionAPI.readArticleInteraction(...a);export const writeArticleInteraction=(...a)=>globalThis.__interactionAPI.writeArticleInteraction(...a);export const readArticleRewardHtml=(...a)=>globalThis.__interactionAPI.readArticleRewardHtml(...a)`),keys=url(`let n=0;export function profileOperationKey(){return 'interaction-key-'+(++n)}`)
const replace=(source,pairs)=>{for(const [from,to]of pairs)source=source.replaceAll(`from '${from}'`,`from '${to}'`).replaceAll(`from "${from}"`,`from '${to}'`);return source}
const storeSource=compile((await fs.readFile('src/stores/v3ArticleInteractions.ts','utf8')).replaceAll('import.meta.env.SSR','false'))
const {useV3ArticleInteractionsStore}=await import(url(replace(storeSource,[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/mode',modeURL],['@/api/http',http],['@/stores/auth',authURL],['@/api/v3-profile',keys],['@/api/v3-article-interactions',apiURL]])))
globalThis.__interactionStore=useV3ArticleInteractionsStore
const storeURL=url('export const useV3ArticleInteractionsStore=globalThis.__interactionStore'),dialogURL=url('export async function fpConfirm(options){const s=globalThis.__interaction;s.confirmations.push(options);return s.confirmWork(options)}'),routerURL=url(`export function useRoute(){return {fullPath:'/article/2'}};export const RouterLink={props:['to'],template:'<a><slot /></a>'}`)
const source=await fs.readFile('src/components/articles/V3ArticleInteraction.vue','utf8'),descriptor=parse(source).descriptor
const component=(await import(url(replace(compile(compileScript(descriptor,{id:'interaction-test',inlineTemplate:true}).content),[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['vue-router',routerURL],['@/api/mode',modeURL],['@/api/http',http],['@/api/v3-article-interactions',apiURL],['@/composables/useDialog',dialogURL],['@/stores/auth',authURL],['@/stores/v3ArticleInteractions',storeURL]])))).default
const insert=(node,parent,anchor)=>{if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}const i=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(i<0?parent.children.length:i,0,node);node.parent=parent}
const renderer=createRenderer({patchProp(el,k,old,v){el.props[k]=v},insert,remove(node){if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}},createElement(tag){return{tag,children:[],props:{}}},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(n,t){n.text=t},setElementText(n,t){n.children=[{text:t,children:[]}]},parentNode:n=>n.parent,nextSibling(n){const s=n.parent?.children||[];return s[s.indexOf(n)+1]||null},insertStaticContent(text,parent,anchor){const n={text,children:[]};insert(n,parent,anchor);return[n,n]}})
const text=n=>[n.text||'',...(n.children||[]).map(text)].join(' ')
const find=(n,fn)=>fn(n)?n:(n.children||[]).map(c=>find(c,fn)).find(Boolean)
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}

function mount(pinia=createPinia(),kind='vote',articleId='2',initialPrice=50){const root={children:[]},app=renderer.createApp(component,{kind,articleId,initialPrice});app.use(pinia);const user=auth(pinia);app.mount(root);return{root,app,user,text:()=>text(root)}}
const click=(view,label)=>{const button=find(view.root,n=>n.tag==='button'&&text(n).trim()===label);assert.ok(button,'Missing '+label+'; actual '+view.text());assert.ok(!button.props.disabled,'Disabled '+label);button.props.onClick()}
const vote=(choice=null)=>({id:'2',vote:choice,upCount:choice==='up'?1:0,downCount:choice==='down'?1:0}),thanks=(thanked=false)=>({id:'2',thanked,thankCount:thanked?1:0,thankPoint:20}),reward=(rewarded=false)=>({id:'2',rewarded,rewardPoint:50})
state.responses.push(env({...vote(),userPassword:'secret'}));assert.deepEqual(await api.readArticleInteraction('vote','2'),{kind:'vote',...vote()});assert.equal(state.requests.at(-1).init.cache,'no-store')
for(const choice of ['up','down',null]){state.responses.push(env(vote(choice)));await api.writeArticleInteraction('vote','2',choice,'key');assert.equal(state.requests.at(-1).init.method,choice===null?'DELETE':'PUT');assert.equal(state.requests.at(-1).init.body,choice===null?undefined:JSON.stringify({vote:choice}))}
for(const kind of ['thanks','reward']){state.responses.push(env({id:'2',[kind==='thanks'?'thanked':'rewarded']:true}));await api.writeArticleInteraction(kind,'2',null,'key');assert.equal(state.requests.at(-1).init.method,'POST');assert.equal(state.requests.at(-1).init.body,undefined)}
for(const id of ['0','../2','2?x=1','99999999999999999999'])await assert.rejects(api.readArticleInteraction('vote',id),e=>e.status===422)
for(const result of [null,{code:1},env({...vote(),id:'3'}),env({...vote(),upCount:-1}),env({...vote(),vote:0})]){state.responses.push(result);await assert.rejects(api.readArticleInteraction('vote','2'))}
state.responses.push(env({id:'2',rewarded:false,rewardContentHtml:'SECRET'}));await assert.rejects(api.readArticleRewardHtml('2'))
console.log('PASS interactions 1 exact resource/method/key/body contracts, strict projected state and current authorized reward HTML')

let pinia=createPinia(),owner=auth(pinia),store=useV3ArticleInteractionsStore(pinia)
state.responses.push(Error('lost'));await assert.rejects(store.set('vote','2','up'));const key=store.commands['vote:2'].key;owner.accessToken='B';assert.equal(store.commands['vote:2'].key,key);await assert.rejects(store.set('vote','2','down'),e=>e.status===409)
state.responses.push(new ApiError('denied',403));await assert.rejects(store.set('vote','2','up'));assert.equal(store.commands['vote:2'].key,key)
state.responses.push(env(vote('up')));await store.set('vote','2','up');assert.equal(new Headers(state.requests.at(-1).init.headers).get('Idempotency-Key'),key);assert.equal(store.commands['vote:2'],undefined)
console.log('PASS interactions 2 real Pinia keeps unknown explicit vote/key across rotation and recovery 4xx, blocks opposing commands')
let release;state.dispatch=()=>new Promise(r=>release=r);let pending=store.set('reward','2',null);state.context++;owner[credentialName]=null;owner.account=null;release(env({id:'2',rewarded:true}));await pending;assert.deepEqual(store.commands,{});assert.equal(store.lastChange.targetId,'');state.dispatch=null
console.log('PASS interactions 3 logout/identity invalidation discards unresolved commands and late completions')

let actual=null,writes=[],lose=true;state.dispatch=async(path,init)=>{if(init?.method){writes.push({method:init.method,key:new Headers(init.headers).get('Idempotency-Key'),body:init.body});if(lose){lose=false;actual='up';throw Error('响应丢失')}return env(vote('up'))}return env(vote(actual))};pinia=createPinia();let view=mount(pinia);await tick();click(view,'赞同 · 0');await tick();assert.match(view.text(),/重试本次投票/);const original=writes[0].key;view.app.unmount();actual='down';view=mount(pinia);await tick();click(view,'重试本次投票');await tick();assert.equal(writes[1].key,original);assert.equal(writes[1].body,writes[0].body);assert.match(view.text(),/取消反对 · 1/);assert.ok(!view.text().includes('取消赞同'));view.app.unmount()
console.log('PASS interactions 4 real compiled SFC survives remount/lost ACK with original intent/key, then GET supersedes historical receipt')

let readFail=false;actual='up';writes=[];state.dispatch=async(path,init)=>{if(init?.method){writes.push(init);actual=null;readFail=true;return env(vote(null))}if(readFail)throw Error('读取503');return env(vote(actual))};view=mount();await tick();click(view,'取消赞同 · 1');await tick();assert.equal(writes[0].method,'DELETE');assert.match(view.text(),/操作已确认，读取当前状态失败/);readFail=false;click(view,'重读投票状态');await tick();assert.equal(writes.length,1);assert.match(view.text(),/赞同 · 0/);view.app.unmount()
console.log('PASS interactions 5 confirmed DELETE with failed GET offers reading only, never repeats mutation')

let thanked=false;writes=[];state.confirmations=[];state.confirmWork=async()=>false;state.dispatch=async(path,init)=>{if(init?.method){writes.push(init);thanked=true;return env({id:'2',thanked:true})}return env(thanks(thanked))};view=mount(createPinia(),'thanks');await tick();click(view,'感谢（20积分） · 0');await tick();assert.equal(writes.length,0);assert.match(state.confirmations[0].message,/20 积分/);state.confirmWork=async()=>true;click(view,'感谢（20积分） · 0');await tick();assert.equal(writes.length,1);assert.match(view.text(),/已感谢 · 1/);view.app.unmount()
console.log('PASS interactions 6 current thanks fee, explicit cancel sends nothing; confirmed thanks re-reads actual count and status')

let rewarded=false,detailFails=false;writes=[];state.balanceFails=true;state.dispatch=async(path,init)=>{if(init?.method){writes.push(init);rewarded=true;detailFails=true;return env({id:'2',rewarded:true})}if(path.endsWith('/reward'))return env(reward(rewarded));if(detailFails)throw Error('正文503');return env({id:'2',rewarded:true,rewardContentHtml:'<p>当前合法付费正文</p>'})};view=mount(createPinia(),'reward');await tick();click(view,'打赏 50 积分');await tick();assert.equal(writes.length,1);assert.match(view.text(),/操作已确认/);assert.match(view.text(),/余额刷新失败/);assert.ok(!find(view.root,n=>n.props?.innerHTML));detailFails=false;click(view,'重读打赏状态');await tick();assert.equal(writes.length,1);assert.match(find(view.root,n=>n.props?.innerHTML).props.innerHTML,/当前合法付费正文/);view.user[credentialName]=null;await tick();assert.ok(!find(view.root,n=>n.props?.innerHTML));view.app.unmount();state.balanceFails=false
console.log('PASS interactions 7 reward receipt grants no cached body; current detail GET failure only retries read, balance failure stays separate, logout removes HTML')

let releaseConfirm;state.confirmWork=options=>new Promise(resolve=>{releaseConfirm=resolve;options.signal.addEventListener('abort',()=>resolve(false),{once:true})});writes=[];state.dispatch=async(path,init)=>{if(init?.method){writes.push(init);return env({id:'2',thanked:true})}return env(thanks(false))};view=mount(createPinia(),'thanks');await tick();click(view,'感谢（20积分） · 0');await tick();const options=state.confirmations.at(-1);assert.equal(options.signal.aborted,false);view.app.unmount();assert.equal(options.signal.aborted,true);releaseConfirm(true);await tick();assert.equal(writes.length,0);state.confirmWork=async()=>true
console.log('PASS interactions 8 leaving while fee confirmation is pending aborts only that dialog and cannot later send')

let reads=0;state.dispatch=()=>{reads++;throw Error('private SSR')};const ssr=createSSRApp(component,{kind:'reward',articleId:'2',initialPrice:50});ssr.use(createPinia());const markup=await renderToString(ssr);assert.equal(reads,0);assert.ok(!markup.includes('SECRET'));const guest=createPinia();auth(guest)[credentialName]=null;view=mount(guest,'reward');await tick();assert.equal(reads,0);view.app.unmount()
console.log('PASS interactions 9 SSR and anonymous issue no private interaction reads/writes or body fetch')

pinia=createPinia();store=useV3ArticleInteractionsStore(pinia);let resolveRead,readCount=0;state.dispatch=(path,init)=>{if(init?.method)return env(vote('up'));readCount++;if(readCount===1)return new Promise(resolve=>resolveRead=resolve);return env(vote('down'))};view=mount(pinia);await tick();await store.set('vote','2','up');await tick();resolveRead(env(vote('up')));await tick();assert.equal(readCount,2);assert.match(view.text(),/取消反对 · 1/);view.app.unmount()
console.log('PASS interactions 10 another mounted sender invalidates earlier GET, late stale state cannot replace new state')

state.dispatch=null;pinia=createPinia();store=useV3ArticleInteractionsStore(pinia);for(const kind of ['thanks','reward']){state.responses.push(Error('lost'));await assert.rejects(store.set(kind,'2',null))}assert.equal(Object.keys(store.commands).length,2);assert.notEqual(store.commands['thanks:2'].key,store.commands['reward:2'].key)
state.responses.push(env({id:'2',thanked:true}));await store.set('thanks','2',null);assert.ok(store.commands['reward:2']);assert.equal(store.commands['thanks:2'],undefined)
console.log('PASS interactions 11 thanks and reward retain independent commands for same article; resolving one cannot discard another')

const article=await fs.readFile('src/views/ArticleView.vue','utf8'),long=await fs.readFile('src/components/articles/LongArticleReader.vue','utf8'),legacy=await fs.readFile('src/api/fishpi.ts','utf8');for(const s of [article,long])for(const kind of ['vote','thanks'])assert.ok(s.includes(`ArticleInteraction kind="${kind}"`));assert.ok(article.includes('ArticleInteraction kind="reward"'));for(const name of ['voteArticle','thankArticle','rewardArticle'])assert.ok(!legacy.includes(`function ${name}(`)&&!article.includes(`${name}(`))
console.log('PASS interactions 12 ordinary/long article integration shares actual component and all three unused legacy wrappers are removed')

rewarded=false;lose=true;writes=[];state.confirmations=[];state.dispatch=async(path,init)=>{if(init?.method){writes.push(init);rewarded=true;if(lose){lose=false;throw Error('购买响应丢失')}return env({id:'2',rewarded:true})}return path.endsWith('/reward')?env(reward(rewarded)):env({id:'2',rewarded:true,rewardContentHtml:'<p>当前正文</p>'})};pinia=createPinia();view=mount(pinia,'reward');await tick();click(view,'打赏 50 积分');await tick();assert.equal(state.confirmations.length,1);assert.match(view.text(),/重试本次打赏/);const rewardKey=new Headers(writes[0].headers).get('Idempotency-Key');view.app.unmount();view=mount(pinia,'reward');await tick();click(view,'重试本次打赏');await tick();assert.equal(new Headers(writes[1].headers).get('Idempotency-Key'),rewardKey);assert.equal(state.confirmations.length,1);assert.equal(writes.length,2);assert.match(view.text(),/已解锁/);view.app.unmount()
console.log('PASS interactions 13 unknown purchase remount recovers original key with no new fee confirmation or new purchase key')

let releaseBody;state.dispatch=path=>path.endsWith('/reward')?env(reward(true)):new Promise(resolve=>releaseBody=resolve);view=mount(createPinia(),'reward');await tick();assert.ok(releaseBody);state.context++;view.user[credentialName]=null;view.user.account=null;releaseBody(env({id:'2',rewarded:true,rewardContentHtml:'<p>旧账号秘密</p>'}));await tick();assert.ok(!find(view.root,n=>n.props?.innerHTML));assert.ok(!view.text().includes('旧账号秘密'));view.app.unmount()
console.log('PASS interactions 14 delayed authorized body cannot render after logout or identity boundary change')

state.dispatch=null;pinia=createPinia();store=useV3ArticleInteractionsStore(pinia);state.responses.push(new ApiError('积分不足',422));await assert.rejects(store.set('thanks','2',null));assert.equal(store.commands['thanks:2'],undefined);const rejectedKey=new Headers(state.requests.at(-1).init.headers).get('Idempotency-Key');state.responses.push(env({id:'2',thanked:true}));await store.set('thanks','2',null);assert.notEqual(new Headers(state.requests.at(-1).init.headers).get('Idempotency-Key'),rejectedKey)
console.log('PASS interactions 15 a definitive fresh validation failure permits a later new request; unknown recovery remains a separate case')

// Acceptance uses the same component/store but has a per-question winner and a zero-fee anonymous case.
function acceptance(id='2',accepted=false,canAccept=!accepted,offerPoint=20){return{id,accepted,canAccept,offerPoint}}
function mountAcceptance(pinia=createPinia(),id='2'){const root={children:[]},app=renderer.createApp(component,{kind:'accept',articleId:id,resource:'comments'});app.use(pinia);const user=auth(pinia);app.mount(root);return{root,app,user,text:()=>text(root)}}
let winner='',acceptanceReads=[],acceptanceWrites=[],acceptanceLose=true
state.confirmations=[];state.confirmWork=async()=>true
state.dispatch=async(path,init)=>{
 const id=path.split('/')[4];assert.match(path,new RegExp('^/api/'+mode+'/comments/[23]/accept$'))
 if(init?.method){acceptanceWrites.push({id,key:new Headers(init.headers).get('Idempotency-Key'),method:init.method,body:init.body});assert.equal(id,'2');winner='2';if(acceptanceLose){acceptanceLose=false;throw new ApiError('response lost',0,'offline')}return env({id,accepted:true})}
 acceptanceReads.push(id);return env(acceptance(id,winner===id,!winner))
}
pinia=createPinia();view=mountAcceptance(pinia);const competingView=mountAcceptance(pinia,'3');await tick()
click(view,'采纳（20积分）');await tick();assert.match(view.text(),/重试本次采纳/);const acceptanceKey=acceptanceWrites[0].key
view.app.unmount();view=mountAcceptance(pinia);await tick();assert.match(view.text(),/已采纳/);view.user.accessToken='acceptance-normal-refresh';await tick()
const competingReadCount=acceptanceReads.filter(id=>id==='3').length
click(view,'重试本次采纳');await tick();assert.equal(acceptanceWrites.length,2);assert.equal(acceptanceWrites[1].key,acceptanceKey);assert.equal(acceptanceWrites[1].method,'POST');assert.equal(acceptanceWrites[1].body,undefined)
assert.equal(state.confirmations.length,1);assert.ok(acceptanceReads.filter(id=>id==='3').length>competingReadCount);assert.ok(!competingView.text().includes('采纳（20积分）'));assert.match(view.text(),/已采纳/)
view.app.unmount();competingView.app.unmount()
console.log('PASS interactions 16 acceptance lost ACK preserves original comment/key across remount and token refresh, GET accepted state does not discard recovery, confirmation is not repeated and competing answer refreshes')

for(const point of [0,20]){
 winner='';acceptanceWrites=[];state.confirmations=[];state.confirmWork=async()=>false
 state.dispatch=async(path,init)=>{if(init?.method){acceptanceWrites.push(init);winner='2';return env({id:'2',accepted:true})}return env(acceptance('2',winner==='2',!winner,point))}
 view=mountAcceptance();await tick();click(view,`采纳（${point}积分）`);await tick();assert.equal(acceptanceWrites.length,0);assert.match(state.confirmations[0].message,new RegExp(`${point} 积分`))
 state.confirmWork=async()=>true;click(view,`采纳（${point}积分）`);await tick();assert.equal(acceptanceWrites.length,1);assert.match(view.text(),/已采纳/);assert.ok(!view.text().includes(`采纳（${point}积分）`));view.app.unmount()
}
console.log('PASS interactions 17 public and anonymous acceptance confirm current 20/0 fee, cancelling sends nothing, success uses current GET and removes the action')

acceptanceWrites=[];state.confirmations=[];let acceptConfirmation
state.confirmWork=options=>new Promise(resolve=>{acceptConfirmation=resolve;options.signal.addEventListener('abort',()=>resolve(false),{once:true})})
state.dispatch=async(path,init)=>{if(init?.method){acceptanceWrites.push(init);return env({id:'2',accepted:true})}return env(acceptance())}
view=mountAcceptance();await tick();click(view,'采纳（20积分）');await tick();const oldAcceptanceDialog=state.confirmations.at(-1)
state.context++;view.user.account={oId:'99',userName:'new-reader'};view.user.accessToken='new-accept-reader';await tick();assert.equal(oldAcceptanceDialog.signal.aborted,true);acceptConfirmation(true);await tick();assert.equal(acceptanceWrites.length,0);view.app.unmount();state.confirmWork=async()=>true
console.log('PASS interactions 18 changing reader while acceptance confirmation waits aborts that dialog and late confirmation cannot submit as the new account')

acceptanceWrites=[];state.dispatch=async(path,init)=>{if(init?.method){acceptanceWrites.push(init);throw new ApiError('仅支持至少20积分问答',422,'invalid_question')}return env(acceptance())}
view=mountAcceptance();await tick();click(view,'采纳（20积分）');await tick();assert.equal(acceptanceWrites.length,1);assert.ok(!view.text().includes('重试本次采纳'));assert.match(view.text(),/仅支持至少20积分问答/);assert.equal(useV3ArticleInteractionsStore().commands['comments:accept:2'],undefined);view.app.unmount()
console.log('PASS interactions 19 definitive fresh question-eligibility failure shows validation and leaves no unresolved paid acceptance command')

if(mode==='v1'){assert.ok(state.requests.every(r=>r.path.startsWith('/api/v1/')));assert.ok(state.requests.every(r=>r.init.credentials==='omit'&&r.init.__captchaRetried&&!new Headers(r.init.headers).has('Authorization')&&new Headers(r.init.headers).has('X-Fishpi-Key')));console.log('PASS classic interactions all target reads/writes use key-only JSON paths without Cookie/Bearer or automatic retries')}

if(mode==='v1'){
 pinia=createPinia();setActivePinia(pinia);store=useV3ArticleInteractionsStore(pinia);state.dispatch=()=>{throw Error('lost')};await assert.rejects(store.set('reward','2',null));assert.ok(store.commands['reward:2']);auth(pinia).apiKey='b'.repeat(128);assert.deepEqual(store.commands,{});store.$dispose();
 state.dispatch=()=>{throw new ApiError('missing route',404,'missing')};await assert.rejects(()=>api.readArticleInteraction('thanks','2'),e=>e.code==='v1_interactions_unavailable');
 console.log('PASS classic interactions nonempty key boundary clears pending paid command; unavailable versioned service is explicit')
}

if(mode==='v1'){
 let finish;state.dispatch=path=>path.endsWith('/reward')?env(reward(true)):new Promise(r=>finish=r);view=mount(createPinia(),'reward');await tick();const oldBody=finish;view.user.apiKey='c'.repeat(128);await tick();oldBody(env({id:'2',rewarded:true,rewardContentHtml:'<p>STALE_PAID_BODY</p>'}));await tick();assert.ok(!find(view.root,n=>n.props?.innerHTML?.includes('STALE_PAID_BODY')));view.app.unmount();
 console.log('PASS classic interactions nonempty key change rejects old authorized body before it can unlock the new reader')
}
