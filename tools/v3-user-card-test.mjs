import assert from 'node:assert/strict';import fs from 'node:fs/promises';import ts from 'typescript';import{parse,compileScript}from'@vue/compiler-sfc';import{createRenderer,createSSRApp,h,ref,reactive,markRaw,nextTick}from'vue';import{createPinia,defineStore}from'pinia';import{renderToString}from'@vue/server-renderer'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),replace=(s,pairs)=>{for(const[a,b]of pairs)s=s.replaceAll(`from '${a}'`,`from '${b}'`).replaceAll(`from "${a}"`,`from '${b}'`);return s}
const state=globalThis.__userCard={context:1,calls:[],dispatch:null}
const http=url(`export class ApiError extends Error{constructor(m,status=0){super(m);this.status=status}}export function getAuthContextVersion(){return globalThis.__userCard.context}export async function request(path,init){globalThis.__userCard.calls.push({path,init});return globalThis.__userCard.dispatch(path,init)}`),{ApiError}=await import(http),relationURL=url(replace(compile(await fs.readFile('src/api/v3-user-relations.ts','utf8')),[['./http',http]])),apiURL=url(replace(compile(await fs.readFile('src/api/v3-public-user.ts','utf8')),[['./http',http],['./v3-user-relations',relationURL]])),api=await import(apiURL)
const medalsURL=url(replace(compile(await fs.readFile('src/api/v3-medals.ts','utf8')),[['./http',http]]))
const avatarURL=url(compile(await fs.readFile('src/utils/avatar.ts','utf8'))),timeURL=url(compile(await fs.readFile('src/utils/time.ts','utf8')))
const medalImageURL=url(`import{h}from '${import.meta.resolve('vue')}';export default{props:['id','name'],setup:p=>()=>h('span',{'data-medal-id':p.id},p.name)}`)
const auth=defineStore('user-card-auth',()=>({accessToken:ref('A'),account:ref({oId:'1',userName:'actor'}),isLoggedIn:ref(true)}));globalThis.__userCardAuth=auth
const route=globalThis.__userCardRoute=reactive({path:'/',fullPath:'/'}),vueAdapter=url(`export*from '${import.meta.resolve('vue')}';import{h}from '${import.meta.resolve('vue')}';const passthrough={setup(p,{slots}){return()=>h('div',slots.default?.())}};export const Teleport=passthrough;export const Transition=passthrough`),routerURL=url(`import{h}from '${import.meta.resolve('vue')}';export function useRoute(){return globalThis.__userCardRoute};export const RouterLink={props:['to'],setup(p,{slots}){return()=>h('a',{href:p.to},slots.default?.())}}`)
const vipURL=url(`import{h}from '${import.meta.resolve('vue')}';export default{props:['userId','userName'],setup(p,{slots}){return()=>h('span',{'data-vip-id':p.userId},slots.default?.())}}`),followURL=url(`import{h}from '${import.meta.resolve('vue')}';export default{props:['userName'],setup:p=>()=>h('button',{'data-follow':p.userName},'follow action')}`)
const templateSource=(await fs.readFile('src/components/user/UserHoverCard.vue','utf8')).replace('</script>', '\ndefineExpose({show, hide, retry})\n</script>').replaceAll('<Teleport','<div').replaceAll('</Teleport>','</div>').replaceAll('<Transition','<div').replaceAll('</Transition>','</div>');const d=parse(templateSource).descriptor;const Card=(await import(url(replace(compile(compileScript(d,{id:'user-card',inlineTemplate:true}).content),[['vue',vueAdapter],['vue-router',routerURL],['pinia',import.meta.resolve('pinia')],['@/api/http',http],['@/api/v3-public-user',apiURL],['@/api/v3-medals',medalsURL],['@/utils/avatar',avatarURL],['@/utils/time',timeURL],['@/components/medal/V3MedalImage.vue',medalImageURL],['@/stores/auth',url('export const useAuthStore=globalThis.__userCardAuth')],['@/components/user/VipNickname.vue',vipURL],['@/components/user/UserFollowButton.vue',followURL]])))).default
class FakeNode {contains(other){return this===other}}
class FakeElement extends FakeNode{constructor(name='target'){super();this.dataset={userCard:name};this.offsetHeight=220}closest(selector){return selector.includes('data-user-card')?this:null}getBoundingClientRect(){return{left:20,right:60,top:100,bottom:140}}}
globalThis.Node=FakeNode;globalThis.Element=FakeElement;globalThis.innerWidth=1280;globalThis.innerHeight=720
const events=new Map,windowEvents=new Map;globalThis.document={activeElement:null,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};globalThis.window={matchMedia:query=>({matches:query.includes('any-hover')}),addEventListener:(name,fn)=>windowEvents.set(name,fn),removeEventListener:name=>windowEvents.delete(name)}
// 仅提供受测试控制的几何数据，不能用固定溢出值冒充真实分行。
const resizeObservers=new Set
globalThis.ResizeObserver=class {
  constructor(callback){this.callback=callback;this.targets=new Set;resizeObservers.add(this)}
  observe(target){this.targets.add(target)}
  unobserve(target){this.targets.delete(target)}
  disconnect(){this.targets.clear();resizeObservers.delete(this)}
}
const childNodesOf=node=>node.childNodes||node.children||[]
const insert=(node,parent,anchor)=>{
  if(node.parent){const siblings=childNodesOf(node.parent),index=siblings.indexOf(node);if(index>=0)siblings.splice(index,1)}
  const children=childNodesOf(parent),index=anchor?children.indexOf(anchor):-1
  children.splice(index<0?children.length:index,0,node);node.parent=parent
}
const renderer=createRenderer({
  patchProp(node,key,oldValue,value){node.props[key]=value},
  insert,
  remove(node){if(node.parent){const children=childNodesOf(node.parent),index=children.indexOf(node);if(index>=0)children.splice(index,1)}},
  createElement(tag){return markRaw({
    tag,props:{},childNodes:[],offsetTop:0,offsetHeight:28,
    // HTMLElement.children 不包含 Vue 的片段文字/注释锚点。
    get children(){return this.childNodes.filter(child=>Boolean(child.tag))},
    get classList(){return{contains:name=>String(this.props.class||'').split(/\s+/).includes(name)}},
    querySelector(selector){return this.children.map(child=>find(child,node=>selector.startsWith('.')&&node.classList?.contains(selector.slice(1)))).find(Boolean)||null},
    focus(options){document.activeElement=this;this.focusOptions=options},
    contains(other){return this===other||this.childNodes.some(child=>child===other||child.contains?.(other))},
  })},
  createText(text){return{text}},createComment(){return{}},
  setText(node,text){node.text=text},setElementText(node,text){node.childNodes=[{text}]},
  parentNode:node=>node.parent,
  nextSibling(node){const children=childNodesOf(node.parent||{});return children[children.indexOf(node)+1]||null},
  insertStaticContent(text,parent,anchor){const node={text};insert(node,parent,anchor);return[node,node]},
})
const text=n=>[n.text||'',...childNodesOf(n).map(text)].join(' '),find=(n,f)=>f(n)?n:childNodesOf(n).map(c=>find(c,f)).find(Boolean),all=(n,f)=>[...(f(n)?[n]:[]),...childNodesOf(n).flatMap(c=>all(c,f))],tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();await nextTick()}
const env=data=>({code:0,data});
const profile={id:'2',userName:'target',userNickname:'literal <b>nickname</b>',userAvatarURL:'https://example.test/avatar.png?q=1',userIntro:'plain <img src=x onerror=alert(1)> intro',userURL:'https://example.test/info?q=1'},dispatch=async path=>path.includes('/medals?') ? env({list:[],pagination:{p:1,size:20,total:0,pageCount:0}}) : env(profile);state.dispatch=dispatch
function mount(pinia=createPinia()){const root={children:[]},app=renderer.createApp(Card);app.use(pinia);const vm=app.mount(root);return{app,root,vm,user:auth(pinia),text:()=>text(root)}}
const click=(v,label)=>{const button=find(v.root,n=>n.tag==='button'&&text(n).trim()===label);assert.ok(button,'Missing '+label);return button.props.onClick()}
const labelledButton=(v,label)=>find(v.root,n=>n.tag==='button'&&n.props?.['aria-label']===label)
const clickLabel=(v,label)=>{const button=labelledButton(v,label);assert.ok(button,'缺少按钮 '+label);button.props.onClick()}
const anchor=()=>markRaw(new FakeElement()),open=async v=>{events.get('focusin')({target:anchor()});await tick()}
assert.deepEqual(await api.fetchPublicUser('target'),profile);assert.deepEqual(state.calls.at(-1),{path:'/api/v3/users/target',init:{cache:'no-store'}});assert.equal(api.decodePublicUser({...profile,userPhone:'SECRET',secret2fa:'SECRET',cardBg:'SECRET'},'TARGET').id,'2');assert.ok(!JSON.stringify(api.decodePublicUser({...profile,userPhone:'SECRET'},'target')).includes('SECRET'));for(const name of ['', 'x'.repeat(65),'target\n','foo/bar','../target','中文'])await assert.rejects(api.fetchPublicUser(name),e=>e.status===422)
const enriched={...profile,cardBg:'https://images.example.test/card.gif?sig=a%2Bb&x=1',userPoint:-5,onlineMinute:0};assert.deepEqual(api.decodePublicUser({...enriched,userPhone:'SECRET',settings:{qq:'SECRET'}},'target'),enriched);for(const cardBg of ['javascript:alert(1)','data:image/svg+xml,bad','//evil.test/a','https://u:p@example.test/a','https://example.test/\\bad'])assert.equal(api.decodePublicUser({...profile,cardBg},'target').cardBg,'');assert.equal(api.decodePublicUser({...profile,cardBg:'/images/card.gif?sig=a%2Bb'},'target').cardBg,'https://fishpi.cn/images/card.gif?sig=a%2Bb');for(const change of [{cardBg:1},{cardBg:'x'.repeat(2049)},{userPoint:1.1},{onlineMinute:-1},{onlineMinute:NaN}])assert.throws(()=>api.decodePublicUser({...profile,...change},'target'));
console.log('PASS user card 1 v3 public whitelist, optional background/statistics, signed URLs, old-server compatibility and bounded target binding')
for(const value of [{...profile,userName:'other'},{...profile,id:'0'},{...profile,userIntro:null},{...profile,userURL:5}])assert.throws(()=>api.decodePublicUser(value,'target'));for(const value of ['javascript:alert(1)','//evil.test','https://u:p@example.test','https://example.test/\n','/local','https://example.test/\\evil'])assert.equal(api.decodePublicUser({...profile,userURL:value},'target').userURL,'');assert.equal(api.decodePublicUser({...profile,userAvatarURL:'javascript:alert(1)'},'target').userAvatarURL,'')
console.log('PASS user card 2 mismatched/private malformed data fails; unsafe website/avatar schemes never enter navigation')
let v=mount();await open(v);assert.match(v.text(),/literal <b>nickname<\/b>/);assert.match(v.text(),/plain <img/);assert.ok(!v.text().includes('黑客')&&!v.text().includes('离线'));assert.ok(!find(v.root,n=>n.props?.innerHTML));assert.ok(find(v.root,n=>n.tag==='a'&&n.props.href==='/chat?toUser=target'));assert.ok(find(v.root,n=>n.props?.['data-vip-id']==='2'));assert.ok(find(v.root,n=>n.props?.['data-follow']==='target'));assert.ok(find(v.root,n=>n.tag==='a'&&n.props.href===profile.userURL&&n.props.rel==='noopener noreferrer'));v.app.unmount();assert.equal(events.size,0)
console.log('PASS user card 3 actual global focus entry renders safe public fields and ID-bound nickname, follow/message links without fake status')
state.dispatch=async()=>{throw new ApiError('profile503',503)};v=mount();await open(v);assert.match(v.text(),/用户资料加载失败/);assert.ok(!v.text().includes('literal <b>nickname'));state.dispatch=dispatch;await click(v,'重试用户资料');await tick();assert.match(v.text(),/literal <b>nickname/);v.app.unmount()
console.log('PASS user card 4 failed public read has explicit same-target retry and never stale/legacy fallback')
v=mount();await open(v);const before=state.calls.length;v.vm.hide();await open(v);assert.equal(state.calls.length,before+2);v.app.unmount()
console.log('PASS user card 5 reopening reads current profile rather than indefinite old LRU data')
let release;state.dispatch=()=>new Promise(r=>release=r);v=mount();const pending=v.vm.show('target',anchor());await tick();state.context++;v.user.accessToken=null;v.user.account=null;v.user.isLoggedIn=false;release(env(profile));await pending;await tick();assert.ok(!v.text().includes('literal <b>nickname'));v.app.unmount();state.dispatch=dispatch
console.log('PASS user card 6 logout hides card and rejects late previous-reader response')
v=mount();await open(v);state.dispatch=async()=>env({...profile,userNickname:'rotated current'});v.user.accessToken='rotated';await tick();assert.match(v.text(),/rotated current/);state.dispatch=async()=>{throw new ApiError('disabled404',404)};v.user.accessToken='next';await tick();assert.match(v.text(),/用户资料加载失败/);assert.ok(!v.text().includes('rotated current'));v.app.unmount();state.dispatch=dispatch
console.log('PASS user card 7 ordinary token rotation rereads current target and clears old data if target becomes unavailable')
state.dispatch=()=>new Promise(r=>release=r);v=mount();const old=v.vm.show('target',anchor());await tick();const finish=release;state.dispatch=async()=>env({...profile,id:'3',userName:'second',userNickname:'second current'});await v.vm.show('second',anchor());finish(env(profile));await old;await tick();assert.match(v.text(),/second current/);assert.ok(!v.text().includes('literal <b>nickname'));v.app.unmount();state.dispatch=dispatch
console.log('PASS user card 8 switching target invalidates previous in-flight profile')
state.dispatch=async()=>env({...profile,id:'1'});v=mount();await open(v);assert.ok(!find(v.root,n=>n.props?.['data-follow']));assert.ok(!find(v.root,n=>n.tag==='a'&&n.props.href==='/chat?toUser=target'));v.app.unmount();state.dispatch=dispatch
console.log('PASS user card 9 self determination uses public ID even if username differs from current account snapshot')
v=mount();const count=state.calls.length;events.get('pointerover')({pointerType:'touch',target:anchor()});await tick();assert.equal(state.calls.length,count);await open(v);events.get('keydown')({key:'Escape'});await tick();assert.ok(!v.text().includes('literal <b>nickname'));v.app.unmount()
console.log('PASS user card 10 touch never opens hover overlay, keyboard focus opens and Escape dismisses')
globalThis.innerWidth=390;v=mount();await open(v);const card=find(v.root,n=>n.props?.role==='dialog');assert.equal(card.props.style.left,'12px');route.fullPath='/elsewhere';await tick();assert.ok(!v.text().includes('literal <b>nickname'));v.app.unmount();route.fullPath='/';globalThis.innerWidth=1280
console.log('PASS user card 11 narrow viewport clamps card to visible bounds and route change dismisses it')
const app=createSSRApp(Card);app.use(createPinia());const initial=state.calls.length,html=await renderToString(app);assert.equal(state.calls.length,initial);assert.ok(!html.includes('literal &lt;b&gt;nickname'));const source=await fs.readFile('src/components/user/UserHoverCard.vue','utf8');assert.ok(source.includes('lang="scss"')&&!source.includes('fetchUserProfile')&&!source.includes('apiKey')&&!source.includes('roleBadge')&&!source.includes('cache.get('));assert.ok(source.includes('document.removeEventListener'))
console.log('PASS user card 12 SSR does not read or display a target; obsolete fields/cache/API removed and listeners cleaned')

state.dispatch=async path=>path.includes('/medals?')
  ? env({list:[{id:'medal-1',name:'公开勋章示例',type:'1',description:'',order:0,expiresAt:0}],pagination:{p:1,size:20,total:1,pageCount:1}})
  : env({...enriched,userNo:'1234',userRole:'成员',userCity:'上海',userOnlineFlag:true,userAvatarURL:''})
v=mount();await open(v)
assert.match(v.text(),/# 1234/)
assert.match(v.text(),/城市\s+上海/)
assert.ok(find(v.root,n=>n.props?.class==='card-badge'&&text(n).trim()==='成员'))
assert.ok(find(v.root,n=>n.tag==='span'&&text(n).trim()==='在线'))
const absent = api.decodePublicUser({...profile,userRole:' ',userCity:[],userOnlineFlag:'false'},'target')
assert.equal(absent.userRole,undefined)
assert.equal(absent.userCity,undefined)
assert.equal(absent.userOnlineFlag,undefined)
assert.equal(api.decodePublicUser({...profile,userOnlineFlag:false},'target').userOnlineFlag,false)
for (const userNo of ['', '0', '1e2', '12abc', '9'.repeat(20)]) assert.equal(api.decodePublicUser({...profile,userNo},'target').userNo,undefined)
assert.match(v.text(),/积分\s+-5/)
assert.match(v.text(),/在线时长\s+0分钟/)
assert.match(v.text(),/公开勋章示例/)
assert.ok(find(v.root,n=>n.tag==='img'&&n.props.src==='/images/user-thumbnail.png'))
assert.ok(find(v.root,n=>n.tag==='a'&&n.props.href==='/settings/point?to=target'))
assert.ok(find(v.root,n=>n.tag==='a'&&n.props.href?.hash==='#member-medals'))
v.app.unmount()
console.log('PASS user card 13 optional public stats, medal preview, default avatar and prefilled transfer route')

const medalEntry=(number,prefix='target')=>({id:`${prefix}-medal-${number}`,name:`${prefix} 勋章 ${number}`,type:'1',description:'',order:number-1,expiresAt:0})
const medalPage=(total,p=1,prefix='target')=>env({
  list:Array.from({length:Math.min(20,Math.max(0,total-(p-1)*20))},(_,index)=>medalEntry((p-1)*20+index+1,prefix)),
  pagination:{p,size:20,total,pageCount:Math.ceil(total/20)},
})
const medalQuery=path=>path.includes('/medals?')?Number(new URL(path,'https://fishpi.cn').searchParams.get('p')):null
const medalCalls=after=>state.calls.slice(after).filter(call=>medalQuery(call.path)!==null)
const medalIds=v=>all(v.root,n=>Boolean(n.props?.['data-medal-id'])).map(n=>n.props['data-medal-id'])
const hasClass=(node,name)=>String(node.props?.class||'').split(/\s+/).includes(name)
const setMedalRows=async(v,columns)=>{
  const list=find(v.root,n=>hasClass(n,'medal-list'))
  assert.ok(list,'卡片应渲染勋章列表')
  let item=0
  for(const child of list.children) child.offsetTop=child.tag?Math.floor(item++/columns)*34:0
  const observers=[...resizeObservers].filter(observer=>observer.targets.has(list))
  assert.ok(observers.length,'勋章列表应监听实际尺寸变化')
  for(const observer of observers) observer.callback([{target:list}])
  await tick()
}

// 十枚全部来自第一页：两行不截断，出现第三行后才提供展开；展开不能再取第一页。
state.dispatch=async path=>medalQuery(path)!==null?medalPage(10,medalQuery(path)):env(profile)
v=mount();let start=state.calls.length;await open(v)
assert.equal(medalIds(v).length,10)
assert.equal(hasClass(find(v.root,n=>hasClass(n,'card-profile')),'card-profile--background'),false)
await setMedalRows(v,5)
assert.equal(labelledButton(v,'展开全部勋章'),undefined)
await setMedalRows(v,4)
assert.equal(all(v.root,n=>hasClass(n,'medal-link')&&n.props.tabindex===-1).length,2)
await clickLabel(v,'展开全部勋章');await tick()
assert.ok(labelledButton(v,'收起勋章'))
assert.equal(all(v.root,n=>hasClass(n,'medal-link')&&n.props.tabindex===-1).length,0)
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1])
await clickLabel(v,'收起勋章');await tick()
assert.ok(labelledButton(v,'展开全部勋章'))
assert.equal(medalIds(v).length,10)
v.app.unmount();assert.equal(resizeObservers.size,0)
console.log('PASS user card 14 two-row overflow follows measured rows; ten medals expand locally and observer is cleaned')

// 真实总数二十一枚必须补第二页；收起、重开只切换布局，不重复请求已读页。
state.dispatch=async path=>medalQuery(path)!==null?medalPage(21,medalQuery(path)):env(enriched)
v=mount();start=state.calls.length;await open(v)
assert.equal(medalIds(v).length,20)
await setMedalRows(v,5)
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1])
const background=find(v.root,n=>hasClass(n,'card-profile'))
assert.equal(background.props.style.backgroundImage,`url("${enriched.cardBg}")`)
await clickLabel(v,'展开全部勋章');await tick()
assert.deepEqual(medalIds(v),Array.from({length:21},(_,index)=>`target-medal-${index+1}`))
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1,2])
await clickLabel(v,'收起勋章');await tick();await clickLabel(v,'展开全部勋章');await tick()
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1,2])
v.app.unmount()
console.log('PASS user card 15 twenty-one medals load the second page once; signed cover bytes survive rendering')

// 四十五枚分三页：加载中的重复点击不发并行请求，第三页由明确操作继续读取。
let releaseSecondPage,releaseThirdPage
state.dispatch=async path=>{
  const p=medalQuery(path)
  if(p===2)return new Promise(resolve=>{releaseSecondPage=resolve})
  if(p===3)return new Promise(resolve=>{releaseThirdPage=resolve})
  return p!==null?medalPage(45,p):env(profile)
}
v=mount();start=state.calls.length;await open(v)
await clickLabel(v,'展开全部勋章');await tick()
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1,2])
const loadingMore=labelledButton(v,'加载更多勋章')
assert.ok(loadingMore)
assert.equal(loadingMore.props['aria-busy'],true)
loadingMore.props.onClick();await tick()
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1,2])
releaseSecondPage(medalPage(45,2));await tick()
assert.equal(medalIds(v).length,40)
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1,2])
assert.equal(labelledButton(v,'加载更多勋章'),loadingMore)
loadingMore.focus()
await clickLabel(v,'加载更多勋章');await tick()
assert.equal(labelledButton(v,'加载更多勋章'),loadingMore)
assert.equal(loadingMore.props['aria-disabled'],true)
await clickLabel(v,'加载更多勋章');await tick()
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1,2,3])
releaseThirdPage(medalPage(45,3));await tick()
assert.deepEqual(medalIds(v),Array.from({length:45},(_,index)=>`target-medal-${index+1}`))
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1,2,3])
assert.equal(labelledButton(v,'加载更多勋章'),undefined)
assert.equal(document.activeElement,labelledButton(v,'收起勋章'))
v.app.unmount();document.activeElement=null
console.log('PASS user card 16 forty-five medals use sequential pages, preserve the busy button and restore focus after completion')

// 后续页失败不能吞掉已读的二十枚；重试必须仍然请求第二页。
let failNextMedalPage=true,releaseRetryPage
state.dispatch=async path=>{
  const p=medalQuery(path)
  if(p===2&&failNextMedalPage){failNextMedalPage=false;throw new ApiError('medals503',503)}
  if(p===2)return new Promise(resolve=>{releaseRetryPage=resolve})
  return p!==null?medalPage(21,p):env(profile)
}
v=mount();start=state.calls.length;await open(v)
await clickLabel(v,'展开全部勋章');await tick()
assert.equal(medalIds(v).length,20)
assert.match(v.text(),/literal <b>nickname/)
const retryMedalButton=labelledButton(v,'重试读取勋章')
assert.ok(retryMedalButton);retryMedalButton.focus()
await clickLabel(v,'重试读取勋章');await tick()
assert.equal(labelledButton(v,'重试读取勋章'),retryMedalButton)
assert.equal(retryMedalButton.props['aria-busy'],true)
assert.equal(retryMedalButton.props['aria-disabled'],true)
await clickLabel(v,'重试读取勋章');await tick()
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1,2,2])
releaseRetryPage(medalPage(21,2));await tick()
assert.equal(medalIds(v).length,21)
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1,2,2])
assert.equal(labelledButton(v,'重试读取勋章'),undefined)
assert.equal(document.activeElement,labelledButton(v,'收起勋章'))
v.app.unmount();document.activeElement=null
console.log('PASS user card 17 failed next page preserves data and the busy retry button; recovery retries once and restores focus')

// 第一页失败仍保留资料，并由专属重试恢复；未登录读者不请求勋章资源。
failNextMedalPage=true
state.dispatch=async path=>{
  const p=medalQuery(path)
  if(p!==null&&failNextMedalPage){failNextMedalPage=false;throw new ApiError('medals503',503)}
  return p!==null?medalPage(1,p):env(profile)
}
v=mount();start=state.calls.length;await open(v)
assert.equal(medalIds(v).length,0)
assert.match(v.text(),/literal <b>nickname/)
labelledButton(v,'重试读取勋章').focus()
await clickLabel(v,'重试读取勋章');await tick()
assert.deepEqual(medalIds(v),['target-medal-1'])
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1,1])
assert.equal(document.activeElement,find(v.root,n=>n.props?.role==='dialog'))
v.app.unmount();document.activeElement=null
v=mount();v.user.accessToken=null;v.user.account=null;v.user.isLoggedIn=false
start=state.calls.length;await open(v)
assert.match(v.text(),/literal <b>nickname/)
assert.equal(medalCalls(start).length,0)
assert.equal(medalIds(v).length,0)
v.app.unmount()
console.log('PASS user card 18 first-page retry is independent of profile; guests never request or display medals')

// 目标变化之后到达的第二页不得混入新目标，也不能继承旧卡片的展开状态。
state.dispatch=async path=>{
  const p=medalQuery(path)
  if(path.includes('/target/medals?')&&p===2)return new Promise(resolve=>{releaseSecondPage=resolve})
  if(p!==null)return medalPage(path.includes('/second/')?1:21,p,path.includes('/second/')?'second':'target')
  return env(path.endsWith('/second')?{...profile,id:'3',userName:'second',userNickname:'第二个用户'}:profile)
}
v=mount();await open(v);await clickLabel(v,'展开全部勋章');await tick()
await v.vm.show('second',markRaw(new FakeElement('second')));await tick()
releaseSecondPage(medalPage(21,2));await tick()
assert.deepEqual(medalIds(v),['second-medal-1'])
assert.match(v.text(),/第二个用户/)
assert.equal(labelledButton(v,'收起勋章'),undefined)
v.app.unmount()
console.log('PASS user card 19 late medal pages cannot overwrite another target or preserve its expanded state')

// 换号必须清理旧勋章页，随后打开同一目标时也不能借用旧账号的在途结果。
state.dispatch=async path=>{
  const p=medalQuery(path)
  if(p===2)return new Promise(resolve=>{releaseSecondPage=resolve})
  return p!==null?medalPage(21,p):env(profile)
}
v=mount();await open(v);await clickLabel(v,'展开全部勋章');await tick()
state.context++;v.user.account={oId:'4',userName:'another-reader'};v.user.accessToken='another-reader-token'
await tick();assert.equal(medalIds(v).length,0)
state.dispatch=async path=>medalQuery(path)!==null?medalPage(1,medalQuery(path),'fresh-reader'):env(profile)
await open(v);releaseSecondPage(medalPage(21,2));await tick()
assert.deepEqual(medalIds(v),['fresh-reader-medal-1'])
assert.equal(labelledButton(v,'收起勋章'),undefined)
v.app.unmount();state.dispatch=dispatch
assert.equal(events.size,0);assert.equal(windowEvents.size,0);assert.equal(resizeObservers.size,0)
console.log('PASS user card 20 reader change clears prior pages and rejects their late response after reopening')

// “加载更多”失败后会切换为重试入口，移除旧入口之前也必须留住卡片内焦点。
state.dispatch=async path=>{
  const p=medalQuery(path)
  if(p===3)throw new ApiError('medals503',503)
  return p!==null?medalPage(45,p):env(profile)
}
v=mount();start=state.calls.length;await open(v)
await clickLabel(v,'展开全部勋章');await tick()
const failedMoreButton=labelledButton(v,'加载更多勋章')
assert.ok(failedMoreButton);failedMoreButton.focus()
await clickLabel(v,'加载更多勋章');await tick()
assert.equal(medalIds(v).length,40)
assert.deepEqual(medalCalls(start).map(call=>medalQuery(call.path)),[1,2,3])
assert.ok(labelledButton(v,'重试读取勋章'))
assert.equal(document.activeElement,labelledButton(v,'收起勋章'))
v.app.unmount();document.activeElement=null;state.dispatch=dispatch
console.log('PASS user card 21 failed load-more retains medals and transfers focus before replacing its control')
