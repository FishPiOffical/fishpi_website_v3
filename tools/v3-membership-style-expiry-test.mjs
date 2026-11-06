import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import {parse,compileScript} from '@vue/compiler-sfc'
import {createRenderer,h,nextTick} from 'vue'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
let now=100000,timerId=0;const timers=new Map(),originalNow=Date.now,originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout,originalObserver=globalThis.IntersectionObserver
Date.now=()=>now;globalThis.setTimeout=(fn,delay=0)=>{const id=++timerId;timers.set(id,{fn,at:now+Number(delay)});return id};globalThis.clearTimeout=id=>timers.delete(id)
const state=globalThis.__expiryStyle={token:'A',listeners:[],batches:[],dispatch:async ids=>ids.map(userId=>({userId,style:{bold:true,color:'rainbow'}})),lookups:0,hot:{dispose(fn){globalThis.__expiryStyle.dispose=fn}}}
const http=url('export const getAccessToken=()=>globalThis.__expiryStyle.token;export function onAccessTokenChange(fn){globalThis.__expiryStyle.listeners.push(fn);fn(globalThis.__expiryStyle.token);return()=>{globalThis.__expiryStyle.listeners=globalThis.__expiryStyle.listeners.filter(x=>x!==fn)}}')
const service=url('export const membershipUserId=value=>typeof value==="string"&&/^[1-9][0-9]{0,18}$/.test(value)?value:"";export async function fetchV3MembershipStyles(ids){globalThis.__expiryStyle.batches.push([...ids]);return globalThis.__expiryStyle.dispatch(ids)};export async function resolveV3NicknameUser(){globalThis.__expiryStyle.lookups++;return{id:"1",userName:"Alias"}}')
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}
async function advance(ms){now+=ms;for(let round=0;round<30;round++){const due=[...timers].filter(([,v])=>v.at<=now);if(!due.length){await tick();if(![...timers.values()].some(x=>x.at<=now))return;continue}for(const [id,t]of due)if(timers.delete(id))t.fn();await tick()}throw Error('Unbounded timer loop')}
function token(value){state.token=value;for(const fn of state.listeners)fn(value)}
let app
try{
 const helperURL=url(compile(await fs.readFile('src/composables/useVipNickname.ts','utf8')).replaceAll('import.meta.env.SSR','false').replaceAll('import.meta.hot','globalThis.__expiryStyle.hot').replace("from 'vue'",`from '${import.meta.resolve('vue')}'`).replace("from '@/api/http'",`from '${http}'`).replace("from '@/api/v3-membership-styles'",`from '${service}'`))
 const helper=await import(helperURL),d=parse(await fs.readFile('src/components/user/VipNickname.vue','utf8')).descriptor
 const Component=(await import(url(compile(compileScript(d,{id:'style-expiry',inlineTemplate:true}).content).replace(/from ['"]vue['"]/g,`from '${import.meta.resolve('vue')}'`).replace("from '@/composables/useVipNickname'",`from '${helperURL}'`)))).default
 const nodes=[],renderer=createRenderer({patchProp(n,k,o,v){n.props[k]=v},insert(){},remove(){},createElement(tag){const n={tag,props:{}};nodes.push(n);return n},createText(){return{}},createComment(){return{}},setText(){},setElementText(){},parentNode(){return null},nextSibling(){return null}})
 app=renderer.createApp({setup:()=>()=>h('div',[h(Component,{userId:'1',text:'first',lazy:false}),h(Component,{userId:'2',text:'second',lazy:false})])});app.mount({});await advance(0)
 const spans=nodes.filter(n=>n.tag==='span');assert.equal(spans.length,2);assert.ok(spans.every(n=>String(n.props.class).includes('rainbow')));assert.deepEqual(state.batches,[['1','2']])
 let release;state.dispatch=ids=>new Promise(resolve=>release=()=>resolve(ids.map(userId=>({userId,style:{}}))))
 await advance(59999);assert.ok(spans.every(n=>String(n.props.class).includes('rainbow')))
 await advance(2);assert.ok(spans.every(n=>!String(n.props.class).includes('rainbow')),'Mounted nicknames kept expired style without another reactive event')
 assert.ok(spans.every(n=>n.props.style===undefined));assert.deepEqual(state.batches,[['1','2'],['1','2']]);assert.ok(release)
 release();await tick();assert.ok(spans.every(n=>n.props.style===undefined))
 console.log('PASS style expiry 1 actual mounted nicknames clear expired style before fresh response, visible IDs coalesce into one batch and inactive result stays plain')
 state.dispatch=async ids=>ids.map(userId=>({userId,style:{color:'#123456'}}))
 const alias=helper.loadVipName(undefined,'Alias');await advance(0);await alias;const before=state.lookups
 await advance(60001);const freshAlias=helper.loadVipName(undefined,'Alias');await advance(0);await freshAlias;assert.ok(state.lookups>before)
 console.log('PASS style expiry 2 expired name alias cannot recover old style or avoid a current username lookup')
 app.unmount();app=null
 const observers=[]
 globalThis.IntersectionObserver=class{constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this)}observe(){}disconnect(){this.disconnected=true}}
 const seeded=helper.loadVipName('3');await advance(0);await seeded
 app=renderer.createApp({setup:()=>()=>h(Component,{userId:'3',text:'offscreen',lazy:true})});app.mount({});await tick();const lazyNode=nodes.filter(n=>n.tag==='span').at(-1)
 assert.equal(lazyNode.props.style['--vip-color'],'#123456')
 const countThree=()=>state.batches.filter(batch=>batch.includes('3')).length,beforeThree=countThree()
 await advance(60001);assert.equal(lazyNode.props.style,undefined);assert.equal(countThree(),beforeThree)
 state.dispatch=async ids=>ids.map(userId=>({userId,style:{color:'#ABCDEF'}}))
 observers.at(-1).callback([{isIntersecting:true}]);await advance(0);assert.equal(lazyNode.props.style['--vip-color'],'#ABCDEF');assert.equal(countThree(),beforeThree+1)
 console.log('PASS style expiry 3 offscreen nickname clears expired CSS without fetching; entering visibility performs exactly one fresh batched read')

 token(null);await tick();assert.equal(timers.size,0);const reads=state.batches.length;await advance(120000);assert.equal(state.batches.length,reads);assert.equal(lazyNode.props.style,undefined)
 console.log('PASS style expiry 4 logout cancels the shared expiry/batch timers and cannot trigger background reads or retain old CSS')
 app.unmount();app=null;token('HMR')
 state.dispatch=async ids=>ids.map(userId=>({userId,style:{color:'#455667'}}))
 app=renderer.createApp({setup:()=>()=>h(Component,{userId:'3',text:'hmr',lazy:false})});app.mount({});await advance(0)
 const hmrNode=nodes.filter(n=>n.tag==='span').at(-1);assert.equal(hmrNode.props.style['--vip-color'],'#455667')
 let oldReply;state.dispatch=ids=>new Promise(resolve=>oldReply=()=>resolve(ids.map(userId=>({userId,style:{color:'#FF0000'}}))))
 helper.invalidateVipName('3');await advance(0);assert.ok(oldReply);state.dispose();await tick();assert.equal(timers.size,0,'Disposed module scheduled new style work')
 oldReply();await tick();assert.equal(helper.cachedVipName('3'),undefined);assert.equal(hmrNode.props.style,undefined);assert.equal(timers.size,0)
 console.log('PASS style expiry 5 HMR disposal cancels cache timers and queued style work; late old batch cannot restore CSS or start a new timer')

 app.unmount();app=null
}finally{if(app)app.unmount();token(null);Date.now=originalNow;globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;globalThis.IntersectionObserver=originalObserver;delete globalThis.__expiryStyle}
