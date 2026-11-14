import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'
import { compileString } from 'sass'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const output = process.env.USER_CARD_TEST_OUTPUT || '/tmp/user-hover-card-browser'
const assets = process.env.USER_CARD_TEST_ASSETS
// 默认素材为自包含测试夹具；视觉验收可指定本地已确认的背景、头像与勋章 SVG 目录。
const fallbackBackground = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="700"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#596e91"/><stop offset=".5" stop-color="#c5d8db"/><stop offset="1" stop-color="#716486"/></linearGradient></defs><path fill="url(#g)" d="M0 0h400v700H0z"/><circle cx="80" cy="220" r="140" fill="#f2f0dd" opacity=".3"/></svg>'
const fallbackAvatar = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><path fill="#c4d7bf" d="M0 0h128v128H0z"/><circle cx="64" cy="46" r="25" fill="#50664c"/><path d="M20 128v-15a44 44 0 0 1 88 0v15" fill="#50664c"/></svg>'
const fallbackMedal = '<svg xmlns="http://www.w3.org/2000/svg" width="104" height="28" viewBox="0 0 104 28"><rect x="6" y="5" width="98" height="20" rx="10" fill="#8f6b1f"/><circle cx="14" cy="14" r="12" fill="#e4c765" stroke="#8f6b1f"/><text x="31" y="19" fill="#fff6d0" font-family="sans-serif" font-size="12">测试勋章</text></svg>'
const asset = (name, fallback) => assets ? {contentType:name.endsWith('.svg')?'image/svg+xml':'image/png',body:fs.readFileSync(path.join(assets,name))} : {contentType:'image/svg+xml',body:fallback}
fs.mkdirSync(output, { recursive: true })
const data = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const transpile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const imports = { vue: data(fs.readFileSync('node_modules/vue/dist/vue.esm-browser.prod.js', 'utf8')) }
// 只替换网络与身份边界；资料卡、勋章、昵称、关注组件及图片工具使用真实源码。
const mock = data(`import {reactive,toRefs,ref,h} from 'vue';
export const auth=reactive({accessToken:'fixture-token',account:{oId:'viewer',userName:'viewer'},get isLoggedIn(){return !!this.accessToken&&!!this.account}});
let version=1;export const useAuthStore=()=>auth;export const getAuthContextVersion=()=>version;export const storeToRefs=toRefs;
export const route=reactive({path:'/',fullPath:'/'});export const useRoute=()=>route;
export const RouterLink={inheritAttrs:false,props:['to'],setup(p,{attrs,slots}){return()=>h('a',{...attrs,href:typeof p.to==='string'?p.to:p.to.path+(p.to.hash||'')},slots.default?.())}};
export const state=reactive({background:true,medalCount:10,name:'答辩姐',intro:'厦门的咕咕嘎嘎',website:'https://rylan.ma/',role:'成员',city:'厦门',failMedal:false,delayMedals:0,follow:false,calls:[]});
export async function fetchPublicUser(name){state.calls.push('profile:'+name);return {id:name==='self'?'viewer':name,userName:name,userNickname:state.name,userIntro:state.intro,userRole:state.role,userNo:34363,userCity:state.city,userOnlineFlag:false,userPoint:17008,onlineMinute:15420,userURL:state.website,userAvatarURL:'https://file.fishpi.cn/fixture-avatar.png',...(state.background?{cardBg:'https://file.fishpi.cn/fixture-bg.png'}:{})}}
export async function fetchV3PublicMedals(name,p=1){state.calls.push('medals:'+name+':'+p);if(state.delayMedals)await new Promise(resolve=>setTimeout(resolve,state.delayMedals));if(state.failMedal)throw new Error('fixture read failure');const total=state.medalCount;return {list:Array.from({length:Math.min(20,Math.max(0,total-(p-1)*20))},(_,i)=>({id:String((p-1)*20+i),name:'功勋玩家α',description:'真实 SVG 渲染夹具',order:i})),p,total,pageCount:Math.ceil(total/20)}}
export const cachedVipName=()=>null,loadVipName=async()=>{},vipNameClass=()=>'',vipNameStyle=()=>({}),vipNameRevision=ref(0);
export const readV3UserFollow=async()=>({following:state.follow}),resolveV3NicknameUser=async name=>({id:name});
const operations=reactive({commands:{},lastChange:{},async set(id,following){state.follow=following;this.lastChange={targetId:id}}});export const useV3UserFollowStore=()=>operations;
export function identity(id){version++;auth.account=id?{oId:id,userName:id}:null;auth.accessToken=id?'fixture-token-'+id:null}
window.fixture={state,auth,identity,route};`)
for(const spec of ['@/stores/auth','@/api/http','pinia','vue-router','@/api/v3-public-user','@/api/v3-medals','@/composables/useVipNickname','@/api/v3-user-follow','@/api/v3-membership-styles','@/stores/v3UserFollow']) imports[spec]=mock
for(const name of ['avatar','time']) imports['@/utils/'+name]=data(transpile(fs.readFileSync('src/utils/'+name+'.ts','utf8')))
let css=''
const compiled=new Map()
function compile(file){
  const key='fixture:'+file
  if(compiled.has(file))return key
  compiled.set(file,key)
  const {descriptor}=parse(fs.readFileSync(file,'utf8'))
  const id='data-v-card-'+compiled.size
  let code=transpile(compileScript(descriptor,{id,inlineTemplate:true}).content).replace(/from (['"])([^'"]+)\1/g,(all,q,spec)=>{
    if(spec.endsWith('.vue'))return `from '${compile(spec.startsWith('@/')?'src/'+spec.slice(2):path.posix.join(path.posix.dirname(file),spec))}'`
    assert.ok(imports[spec], '夹具缺少依赖：'+spec)
    return all
  }).replace('export default','const component=')
  for(const style of descriptor.styles){const source=style.lang==='scss'?compileString(style.content).css:style.content;css+=compileStyle({source,filename:file,id,scoped:!!style.scoped}).code+'\n'}
  imports[key]=data(code+`;component.__scopeId='${id}';export default component;`)
  return key
}
const component=compile('src/components/user/UserHoverCard.vue')
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;font:14px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;background:#f4f6f8;--fp-card:#fff;--fp-border:#e0e4e9;--fp-text:#292e36;--fp-title:#252a31;--fp-muted:#77808d;--fp-primary:#62ae37;--fp-hover:#f3f5f7;--fp-bg:#f5f6f8;--fp-avatar-radius:8px;--fp-link:#4784e6}body.dark{background:#202326;--fp-card:#282b2e;--fp-border:#41474d;--fp-text:#e3e6e8;--fp-title:#f2f4f5;--fp-muted:#aab2ba;--fp-primary:#78b958;--fp-hover:#343b41;--fp-bg:#202529}button{font:inherit;cursor:pointer}a{text-decoration:none;color:inherit}.stage{padding:100px 100px}.trigger{display:block;width:48px;height:48px;border-radius:8px;background:#dce9d4;border:0;color:#455740}.hint{color:#89929d;margin:20px 0} ${css}</style><script type="importmap">${JSON.stringify({imports})}</script><div id="app"></div><script type="module">import{createApp,h}from'vue';import Card from '${component}';createApp({setup:()=>()=>h('main',{class:'stage'},[h('button',{class:'trigger','data-user-card':'Yinfeng','aria-label':'测试用户头像'},'用户'),h('p',{class:'hint'},'本地隔离资料卡验证'),h(Card)])}).mount('#app');</script></html>`
const browser=await chromium.launch({channel:'chrome',headless:true})
const errors=[],external=[],successes=[]
const check=async(message,fn)=>{await fn();successes.push(message)}
const page=await browser.newPage({viewport:{width:1100,height:900}})
page.on('pageerror',e=>errors.push(e.message))
await page.route('**/*',route=>{
  const url=new URL(route.request().url())
  if(url.origin==='http://card.test'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:html})
  if(url.hostname==='file.fishpi.cn'&&url.pathname==='/fixture-bg.png')return route.fulfill(asset('card-background.png',fallbackBackground))
  if(url.hostname==='file.fishpi.cn'&&url.pathname==='/fixture-avatar.png')return route.fulfill(asset('yinfeng-avatar.png',fallbackAvatar))
  if(url.hostname==='fishpi.cn'&&url.pathname==='/gen')return route.fulfill(asset('medal-alpha.svg',fallbackMedal))
  external.push(route.request().url());return route.abort()
})
const card=page.locator('.global-user-card')
async function open(){await page.locator('.trigger').evaluate(el=>el.blur());await page.keyboard.press('Shift');await page.locator('.trigger').focus();await card.waitFor();await page.waitForFunction(()=>document.querySelectorAll('.medal-list img').length===fixture.state.medalCount||fixture.state.failMedal||!fixture.auth.isLoggedIn||fixture.state.medalCount===0);await page.waitForFunction(()=>[...document.querySelectorAll('.card-avatar,.medal-list img')].every(i=>i.complete&&i.naturalWidth>0))}
async function reopen(config){await page.keyboard.press('Escape');await page.mouse.move(1000,850);await page.locator('.trigger').evaluate(el=>el.blur());await page.evaluate(config=>Object.assign(fixture.state,config),config);await open()}
async function withinViewport(){await page.waitForFunction(()=>{const e=document.querySelector('.global-user-card');if(!e)return false;const b=e.getBoundingClientRect();return b.x>=11&&b.y>=11&&b.right<=innerWidth-11&&b.bottom<=innerHeight-11});const b=await card.boundingBox();const size=page.viewportSize();assert.ok(b.x>=11&&b.y>=11&&b.x+b.width<=size.width-11&&b.y+b.height<=size.height-11,JSON.stringify(b))}
try{
await page.goto('http://card.test/')
await open()
await check('紧凑背景卡保留整卡背景和轻遮罩，头像使用二倍缩图',async()=>{
  assert.match(await page.locator('.card-profile').getAttribute('style'),/imageView2\/2\/w\/380/)
  assert.match(await page.locator('.card-avatar').getAttribute('src'),/imageView2\/2\/w\/112/)
  assert.equal(await page.locator('.card-cover .member-number').count(),0)
  const gradient=await page.locator('.card-content').evaluate(el=>getComputedStyle(el).backgroundImage);assert.match(gradient,/0.58|58%/)
  await withinViewport()
})
await check('10枚勋章默认两行，展开/收起保留真实SVG比例且不新增GET',async()=>{
  await page.getByRole('button',{name:'展开全部勋章',exact:true}).waitFor()
  assert.equal(await page.locator('.medal-count').innerText(),'10')
  const before=await page.evaluate(()=>fixture.state.calls.length)
  assert.equal(await page.locator('.medal-viewport').evaluate(el=>el.clientHeight),62)
  assert.equal(await page.locator('.medal-link[aria-hidden="true"]').count(),4)
  assert.equal(await page.locator('.medal-link[tabindex="-1"]').count(),4)
  await page.getByRole('button',{name:'展开全部勋章',exact:true}).click()
  assert.equal(await page.locator('.medal-link[aria-hidden="true"]').count(),0)
  assert.equal(await page.locator('.medal-viewport').evaluate(el=>el.clientHeight),130)
  const sizes=await page.locator('.medal-list img').evaluateAll(images=>images.map(i=>({w:i.width,h:i.height,nw:i.naturalWidth,nh:i.naturalHeight})))
  assert.ok(sizes.every(s=>s.h===28&&Math.abs(s.w/s.h-s.nw/s.nh)<.01))
  await card.screenshot({animations:'disabled',path:path.join(output,'background-expanded.png')})
  await page.getByRole('button',{name:'收起勋章',exact:true}).click()
  assert.equal(await page.evaluate(()=>fixture.state.calls.length),before)
  assert.equal(await page.locator('.medal-viewport').evaluate(el=>el.clientHeight),62)
  await card.screenshot({animations:'disabled',path:path.join(output,'background-collapsed.png')})
})
await check('卡片内焦点不会误关闭，保留主页/私信/转账/关注/网址',async()=>{
  assert.equal(await page.locator('.message').getAttribute('href'),'/chat?toUser=Yinfeng')
  assert.equal(await page.locator('.transfer').getAttribute('href'),'/settings/point?to=Yinfeng')
  assert.equal(await page.locator('.medal-link').first().getAttribute('href'),'/member/Yinfeng#member-medals')
  assert.equal(await page.locator('.website').getAttribute('href'),'https://rylan.ma/')
  await page.locator('.message').focus();await page.waitForTimeout(200);assert.equal(await card.count(),1)
  await page.getByRole('button',{name:'+ 关注',exact:true}).click();await page.getByRole('button',{name:'取消关注',exact:true}).waitFor();assert.equal(await card.count(),1)
  await page.keyboard.press('Escape');await card.waitFor({state:'detached'})
})
await reopen({background:false})
await check('无背景卡无封面留白，保留身份、勋章和双列统计',async()=>{
  assert.equal(await page.locator('.card-cover').count(),0)
  assert.equal(await page.locator('.card-profile--background').count(),0)
  assert.equal(await page.locator('.member-number').innerText(),'# 34363')
  assert.equal(await page.locator('.card-metrics .metric').count(),2)
  await card.screenshot({animations:'disabled',path:path.join(output,'plain-collapsed.png')})
})
await check('链接、编号、位置和角色同行，角色贴右；长内容不破坏对齐',async()=>{
  const assertRow=async()=>{
    const row=await page.locator('.card-details').boundingBox()
    const website=await page.locator('.card-details .website').boundingBox()
    const number=await page.locator('.card-details .member-number').boundingBox()
    const city=await page.locator('.card-details .card-city').boundingBox()
    const role=await page.locator('.card-details .card-badge').boundingBox()
    assert.ok(website.x+website.width<=number.x&&number.x+number.width<=city.x&&city.x+city.width<=role.x)
    assert.ok([website,number,city,role].every(item=>Math.abs(item.y+item.height/2-row.y-row.height/2)<1))
    assert.ok(Math.abs(role.x+role.width-row.x-row.width)<1)
  }
  await assertRow()
  await reopen({background:true,medalCount:1,website:'https://very-long-profile-website-label.example.test/',role:'比较长的公开角色名称',city:'比较长的公开城市名称'})
  await assertRow()
  await reopen({background:false,medalCount:1,website:'',role:'成员',city:'厦门'})
  assert.equal(await page.locator('.card-details .website').count(),0)
  const row=await page.locator('.card-details').boundingBox()
  const role=await page.locator('.card-details .card-badge').boundingBox()
  assert.ok(Math.abs(role.x+role.width-row.x-row.width)<1)
})
await check('一行勋章不显示总数，两行显示总数且无需展开',async()=>{
  for(const medalCount of [1,3,4]){
    await reopen({background:false,medalCount,website:'https://rylan.ma/'})
    const rows=await page.locator('.medal-link').evaluateAll(els=>new Set(els.map(el=>el.offsetTop)).size)
    assert.equal(rows,medalCount<=3?1:2)
    assert.equal(await page.locator('.medal-count').count(),rows===1?0:1)
    assert.equal(await page.locator('.medal-toggle').count(),0)
    if(medalCount===1)await card.screenshot({animations:'disabled',path:path.join(output,'plain-single-medal.png')})
  }
})
await reopen({background:false,medalCount:0})
await check('合法空勋章不留空分区',async()=>{assert.equal(await page.locator('.card-medals').count(),0);await card.screenshot({animations:'disabled',path:path.join(output,'plain-empty.png')})})
await reopen({background:true,medalCount:10,name:'这是一个非常长非常长的用户昵称测试内容',intro:'这是一个非常长的个人简介内容，用来检查两行省略以及长文字是否破坏卡片布局。'.repeat(3)})
await page.setViewportSize({width:640,height:375})
await check('窄桌面与短视口保持边界，长昵称省略，展开卡片可以滚动',async()=>{
  await withinViewport()
  const n=await page.locator('.nickname').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,ellipsis:getComputedStyle(el).textOverflow}));assert.ok(n.scroll>n.client);assert.equal(n.ellipsis,'ellipsis')
  await page.getByRole('button',{name:'展开全部勋章',exact:true}).click();await withinViewport()
  assert.ok(await card.evaluate(el=>el.scrollHeight>el.clientHeight))
  await page.locator('.message').focus();await withinViewport()
  await page.screenshot({animations:'disabled',path:path.join(output,'short-viewport.png')})
})
await page.setViewportSize({width:1100,height:900})
await reopen({background:true,medalCount:10,name:'答辩姐',intro:'厦门的咕咕嘎嘎'})
await check('深色背景卡适配主题变量',async()=>{
  await page.evaluate(()=>document.body.classList.add('dark'))
  await card.screenshot({animations:'disabled',path:path.join(output,'dark-background.png')})
  assert.notEqual(await card.evaluate(el=>getComputedStyle(el).color),'rgb(41, 46, 54)')
})
await reopen({background:false,medalCount:10,failMedal:true})
await check('勋章失败重试期间保留按钮和焦点，成功移交焦点且不关闭浮层',async()=>{
  const retry=page.getByRole('button',{name:'重试读取勋章',exact:true})
  await retry.waitFor();await page.evaluate(()=>{fixture.state.failMedal=false;fixture.state.delayMedals=250})
  await retry.click();assert.equal(await retry.getAttribute('aria-busy'),'true');assert.equal(await retry.evaluate(el=>document.activeElement===el),true)
  await retry.waitFor({state:'detached'});await page.waitForTimeout(180)
  assert.equal(await card.count(),1)
  assert.equal(await card.evaluate(el=>el===document.activeElement||el.contains(document.activeElement)),true)
  await page.evaluate(()=>fixture.state.delayMedals=0)
})
await check('游客保持既有勋章策略并隐藏交易操作',async()=>{
  await page.evaluate(()=>fixture.identity(null));await card.waitFor({state:'detached'});await open()
  assert.equal(await page.locator('.card-medals').count(),0)
  assert.equal(await page.locator('.card-footer').count(),0)
  assert.equal(await page.locator('.card-avatar').count(),1)
})
await check('触屏不触发悬浮卡，Escape和路由切换清除卡片',async()=>{
  await page.keyboard.press('Escape');await card.waitFor({state:'detached'})
  await page.locator('.trigger').dispatchEvent('pointerdown',{pointerType:'touch',bubbles:true})
  await page.locator('.trigger').dispatchEvent('pointerover',{pointerType:'touch',bubbles:true})
  await page.waitForTimeout(300);assert.equal(await card.count(),0)
  await page.keyboard.press('Tab');await open()
  await page.evaluate(()=>{fixture.route.path='/latest';fixture.route.fullPath='/latest'})
  await card.waitFor({state:'detached'})
})
assert.deepEqual(errors,[]);assert.deepEqual(external,[])
fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({successes,errors,external},null,2))
console.log(JSON.stringify({passed:successes.length,successes,output},null,2))
}finally{await browser.close()}
