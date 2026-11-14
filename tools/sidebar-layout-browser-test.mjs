import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const output = process.env.SIDEBAR_LAYOUT_TEST_OUTPUT || '/tmp/sidebar-layout-browser'
fs.mkdirSync(output, { recursive: true })
const data = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const transpile = code => ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const vue = data(fs.readFileSync('node_modules/vue/dist/vue.esm-browser.prod.js', 'utf8'))
// 布局、标签、摘要头、齿轮与分组均使用真实源码，仅隔离网络和账号服务。
const mocks = data(`import {reactive,toRefs} from 'vue';
export const auth=reactive({accessToken:'token-a',account:{oId:'a',userName:'alpha',userNickname:'测试用户',userPoint:123648,userAppRole:1},get isLoggedIn(){return !!this.accessToken&&!!this.account}});
let version=1;const listeners=new Set();
export const useAuthStore=()=>auth;
export const getAuthContextVersion=()=>version;
export function onAccessTokenChange(fn){listeners.add(fn);fn(auth.accessToken);return()=>listeners.delete(fn)}
export function rotate(token){auth.accessToken=token;for(const fn of listeners)fn(token)}
export function identity(id){version++;auth.account=id?{oId:id,userName:id,userNickname:'测试用户',userPoint:123648,userAppRole:1}:null;rotate(id?'token-'+id:null)}
export const drawer=reactive({opened:[],show(section){this.opened.push(section)}});
export const useSettingsDrawerStore=()=>drawer;
export const storeToRefs=toRefs;
export const useChatStore=()=>reactive({topicError:'',discuss:'今天聊点什么'});
export const useAppearanceStore=()=>reactive({state:{theme:'light'}});
export const useCountStore=()=>reactive({loaded:true,view:{kind:'work',time:'03:42:38',earned:'214.507'}});
export const useChatSidebarStore=()=>({isOn:()=>true});
export const usePersonSummaryStore=()=>reactive({following:8,collections:21,attach:()=>()=>{}});
export const useV3ChatOnlineStore=()=>reactive({users:[],total:29,loading:false});
export const useV3ChatMutesStore=()=>reactive({total:0,loading:false});
export const findPack=()=>({name:'经典浅色',preview:'#e9f4e7'});
export const avatarThumbnail=()=> 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" rx="4" fill="#b5dca5"/></svg>');
export const avatarUrl=()=>'';export const fallbackAvatar=()=>{};`)
const imports = { vue, pinia: mocks }
for (const key of ['stores/auth','api/http','stores/settingsDrawer','stores/chat','stores/chatSidebar','stores/personSummary','stores/appearance','stores/count','stores/v3ChatOnline','stores/v3ChatMutes','packs','utils/avatar']) imports['@/'+key]=mocks
// 资料卡仍使用真实布局，仅把路由导航与会员样式读取替换为无网络展示。
const displayMocks=data(`import {h} from 'vue';export const RouterLink={props:['to'],setup:(props,{slots})=>()=>h('a',{href:props.to},slots.default?.())};export default {props:['text'],render(){return h('span',{},this.text)}};`)
imports['vue-router']=displayMocks
imports['@/components/user/VipNickname.vue']=displayMocks
let css = ''
const compiled = new Map()
function compile(file) {
  const key = 'fixture:' + file
  if (compiled.has(file)) return key
  compiled.set(file, key)
  let script, id
  if (file.endsWith('.vue')) {
    const { descriptor } = parse(fs.readFileSync(file, 'utf8'))
    id = 'data-v-layout-' + compiled.size
    script = transpile(compileScript(descriptor, { id, inlineTemplate: true }).content)
    css += descriptor.styles.map(style => {
      const source=style.src?fs.readFileSync(path.resolve(path.dirname(file),style.src),'utf8'):style.content
      return compileStyle({ source, filename: file, id, scoped: !!style.scoped }).code
    }).join('\n')
  } else script = transpile(fs.readFileSync(file,'utf8'))
  script = script.replace(/from (['"])([^'"]+)\1/g, (original, quote, specifier) => {
    if (imports[specifier]) return original
    const target = specifier.startsWith('@/') ? 'src/' + specifier.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
    return `from '${compile(target.endsWith('.vue')||target.endsWith('.ts')?target:target+'.ts')}'`
  }).replaceAll('import.meta.env.SSR', 'false')
  if(id) script=script.replace('export default','const component =')+`;component.__scopeId='${id}';export default component;`
  imports[key] = data(script)
  return key
}
const component = compile('src/components/sidebar/SidebarLayout.vue')
const draftModule = compile('src/composables/sidebarDrafts.ts')
const profileModule = compile('src/chat/sidebar/modules/ProfileModule.vue')
const incomeModule = compile('src/chat/sidebar/modules/IncomeModule.vue')
const modules = [
  {id:'profile',title:'我的资料'}, {id:'breezemoons',title:'清风明月'},
  {id:'income',title:'上下班时间'}, {id:'checkin',title:'今日活跃与签到'},
  {id:'topic',title:'当前话题'}, {id:'online',title:'在线成员'}, {id:'appearance',title:'外观'},
]
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f4f6f8;--fp-card:#fff;--fp-border:#e0e4e9;--fp-text:#292e36;--fp-head:#555e6b;--fp-title:#252a31;--fp-muted:#77808d;--fp-primary:#62ae37;--fp-hover:#f3f5f7;--fp-bg:#f5f6f8;--fp-elevated:#f9fafb}
body.dark{background:#202326;--fp-card:#282b2e;--fp-border:#41474d;--fp-text:#e3e6e8;--fp-title:#f2f4f5;--fp-head:#d0d5dc;--fp-muted:#aab2ba;--fp-primary:#9acb78;--fp-hover:#343b41;--fp-bg:#202529;--fp-elevated:#30363b}
.test-layout{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,3fr);gap:20px;max-width:1280px;margin:24px auto;padding:0 20px;align-items:start}.main-content{padding:28px;border:1px solid var(--fp-border);border-radius:12px;background:var(--fp-card);color:var(--fp-text);min-height:440px}.main-content h1{margin:0 0 12px;font-size:22px}.main-content p{color:var(--fp-muted);line-height:1.8}.test-layout>aside{min-width:0}.fixture-panel{color:var(--fp-text)}.fixture-panel label{display:block;margin:12px 0;color:var(--fp-muted)}.fixture-panel input{display:block;width:100%;border:1px solid var(--fp-border);border-radius:7px;padding:9px;background:var(--fp-bg);color:var(--fp-text)}.fixture-row{padding:10px 0;border-bottom:1px solid var(--fp-border);font-size:13px}.fixture-link{font-size:12px;color:var(--fp-muted);text-decoration:none}.fixture-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0}.fixture-summary strong{font-size:24px;font-variant-numeric:tabular-nums}.fixture-summary span{color:var(--fp-primary);font-size:12px}
@media(max-width:700px){.test-layout{grid-template-columns:minmax(0,1fr);margin:12px auto;padding:0 12px}.main-content{display:none}}
${css}</style><script type="importmap">${JSON.stringify({imports})}</script><div id="app"></div><script type="module">
import {createApp,h,reactive,ref,onMounted,onUnmounted} from 'vue';
import SidebarLayout from '${component}';import {auth,drawer,rotate,identity} from '@/stores/auth';
import {useSidebarDraftState} from '${draftModule}';
import ProfileModule from '${profileModule}';import IncomeModule from '${incomeModule}';
const all=${JSON.stringify(modules)},state=reactive({modules:[...all],section:'pageSidebar',presentation:{income:'card'},collapsed:[],mounts:{},unmounts:{},visualMode:false});
const FixturePanel={props:['id'],emits:['summary'],setup(props,{emit}){const createDraft=()=>{const draft=ref('');return {state:{draft},clear:()=>{draft.value=''}}};const {draft}=useSidebarDraftState(props.id,createDraft)||createDraft().state;const owner=auth.account?.oId||'guest';onMounted(()=>{state.mounts[props.id]=(state.mounts[props.id]||0)+1;emit('summary',props.id==='breezemoons'?'12 条动态':'31.42% · 已签到')});onUnmounted(()=>{state.unmounts[props.id]=(state.unmounts[props.id]||0)+1});return()=>h('div',{class:'fixture-panel','data-fixture':props.id,'data-owner':owner},state.visualMode&&props.id==='profile'?[h(ProfileModule)]:state.visualMode&&props.id==='income'?[h(IncomeModule)]:[
h('div',{class:'fixture-summary'},[h('strong',{},props.id==='income'?'03:42:38':props.id==='profile'?'测试用户':'31.42%'),h('span',{},props.id==='income'?'今日已赚 ¥214.507':'今日签到已完成')]),
h('label',{},['输入草稿',h('input',{'aria-label':props.id+'草稿',value:draft.value,onInput:e=>draft.value=e.target.value})]),
...Array.from({length:props.id==='breezemoons'?3:1},(_,i)=>h('div',{class:'fixture-row'},'模块内容 '+(i+1)+' · 保留当前状态'))])}};
window.fixture={state,all,drawer,rotate,identity};
createApp({setup:()=>()=>h('div',{class:'test-layout'},[h('main',{class:'main-content'},[h('h1',{},'社区内页'),h('p',{},'已开启模块可以单独展示，也可以集中在标签页中。')]),h(SidebarLayout,{modules:state.modules,section:state.section,ariaLabel:'社区侧栏模块',presentationOf:id=>state.presentation[id]||'tabs',isCollapsed:id=>state.collapsed.includes(id),onToggle:id=>{state.collapsed=state.collapsed.includes(id)?state.collapsed.filter(x=>x!==id):[...state.collapsed,id]}},{default:({module,onSummary})=>h(FixturePanel,{id:module.id,onSummary}),'header-actions':({module})=>module.id==='breezemoons'?h('a',{class:'fixture-link',href:'/breezemoons'},'更多'):null})])}).mount('#app');
</script></html>`
const browser = await chromium.launch({channel:'chrome',headless:true})
const errors=[], externalRequests=[], successes=[]
const check=async(message,fn)=>{await fn();successes.push(message)}
const page=await browser.newPage({viewport:{width:1280,height:1050},reducedMotion:'reduce'})
page.on('pageerror',error=>errors.push(error.message))
await page.route('**/*',route=>{
  if(route.request().url()==='http://sidebar-layout.test/')return route.fulfill({contentType:'text/html',body:html})
  externalRequests.push(route.request().url());return route.abort()
})
const input=id=>page.getByRole('textbox',{name:id+'草稿',exact:true})
const tab=id=>page.locator(`.sidebar-tab[id$="-tab-${id}"]`)
const card=id=>page.locator(`[data-sidebar-module="${id}"]`)
const groups=()=>page.locator('.sidebar-layout').evaluate(node=>[...node.children].map(child=>child.dataset.sidebarModule||child.classList.contains('sidebar-tabs')&&'tabs').filter(Boolean))
try{
  await page.goto('http://sidebar-layout.test/')
  await page.waitForSelector('[data-fixture="profile"]')
  await check('默认混排：资料置顶、标签组与独立卡依次显示，未访问标签零挂载',async()=>{
    assert.deepEqual(await groups(),['profile','tabs','income'])
    assert.equal(await page.locator('[data-fixture]').count(),3)
    assert.equal(await tab('profile').count(),0)
    assert.equal(await page.locator('[data-fixture="checkin"]').count(),0)
    assert.equal(await page.getByRole('button',{name:'配置模块',exact:true}).count(),1)
    await page.getByRole('button',{name:'配置模块',exact:true}).click()
    assert.deepEqual(await page.evaluate(()=>fixture.drawer.opened),['pageSidebar'])
  })
  await check('独立卡折叠保留输入和实例，收起仍可配置',async()=>{
    await input('profile').fill('资料草稿')
    await card('profile').locator('.card-toggle').click()
    assert.equal(await input('profile').isVisible(),false)
    assert.equal(await card('profile').getByRole('button',{name:'配置模块',exact:true}).isVisible(),true)
    await card('profile').locator('.card-toggle').click()
    assert.equal(await input('profile').inputValue(),'资料草稿')
    assert.equal(await page.evaluate(()=>fixture.state.mounts.profile),1)
  })
  await check('标签切换保留草稿及实例，辅助链接跟随当前标签',async()=>{
    await input('breezemoons').fill('清风明月尚未发布')
    await tab('checkin').click()
    assert.equal(await page.locator('.fixture-link:visible').count(),0)
    await tab('breezemoons').click()
    assert.equal(await input('breezemoons').inputValue(),'清风明月尚未发布')
    assert.equal(await page.evaluate(()=>fixture.state.mounts.breezemoons),1)
    assert.equal(await page.locator('.fixture-link:visible').count(),1)
  })
  await check('改为独立卡保留草稿且无重复内容，独立卡相对排序保留',async()=>{
    await page.evaluate(()=>{fixture.state.presentation.breezemoons='card';fixture.state.modules=[fixture.all[2],fixture.all[1],fixture.all[0],...fixture.all.slice(3)]})
    await page.waitForSelector('[data-sidebar-module="breezemoons"]')
    assert.deepEqual(await groups(),['profile','income','breezemoons','tabs'])
    assert.equal(await tab('breezemoons').count(),0)
    assert.equal(await page.locator('[data-fixture="breezemoons"]').count(),1)
    assert.equal(await input('breezemoons').inputValue(),'清风明月尚未发布')
    await card('breezemoons').locator('.card-toggle').click()
    assert.match(await card('breezemoons').locator('.card-toggle').innerText(),/12 条动态/)
    await card('breezemoons').locator('.card-toggle').click()
  })
  await check('返回标签模式时卡片折叠偏好不影响标签内容，关闭当前标签自动选择可用模块',async()=>{
    await page.evaluate(()=>{fixture.state.collapsed.push('breezemoons');fixture.state.presentation.breezemoons='tabs'})
    await tab('breezemoons').click()
    assert.equal(await input('breezemoons').isVisible(),true)
    assert.equal(await input('breezemoons').inputValue(),'清风明月尚未发布')
    await page.evaluate(()=>{fixture.state.modules=fixture.state.modules.filter(m=>m.id!=='breezemoons')})
    await page.waitForFunction(()=>document.querySelector('.sidebar-tab[aria-selected="true"]')?.id.endsWith('-checkin'))
    assert.equal(await page.locator('[data-fixture="breezemoons"]').count(),0)
    await page.evaluate(()=>{fixture.state.modules.splice(1,0,fixture.all[1])})
    await tab('breezemoons').click()
    assert.equal(await input('breezemoons').inputValue(),'')
    await tab('checkin').click()
  })
  await check('普通令牌轮换保留草稿，换号销毁卡片与标签旧内容',async()=>{
    await input('profile').fill('甲账号资料')
    await input('checkin').fill('甲账号签到')
    await page.evaluate(()=>fixture.rotate('token-a-rotated'))
    assert.equal(await input('profile').inputValue(),'甲账号资料')
    assert.equal(await input('checkin').inputValue(),'甲账号签到')
    await page.evaluate(()=>fixture.identity('b'))
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-fixture]')].every(node=>node.dataset.owner==='b'))
    assert.equal(await input('profile').inputValue(),'')
    assert.equal(await input('checkin').inputValue(),'')
  })
  await check('全部独立卡没有空标签框，隐藏资料后配置齿轮移到第一张卡',async()=>{
    await page.evaluate(()=>{for(const mod of fixture.all)fixture.state.presentation[mod.id]='card';fixture.state.modules=fixture.all.filter(m=>m.id!=='profile')})
    await page.waitForFunction(()=>!document.querySelector('.sidebar-tabs'))
    assert.deepEqual(await groups(),['breezemoons','income','checkin','topic','online','appearance'])
    assert.equal(await page.getByRole('button',{name:'配置模块',exact:true}).count(),1)
    assert.equal(await card('breezemoons').getByRole('button',{name:'配置模块',exact:true}).count(),1)
  })
  await check('全关闭仍有配置入口，只保留资料不出现空标签框',async()=>{
    await page.evaluate(()=>{fixture.state.modules=[]})
    await page.waitForSelector('.sidebar-tabs-empty')
    assert.equal(await page.getByRole('button',{name:'配置模块',exact:true}).isVisible(),true)
    await page.evaluate(()=>{fixture.state.modules=[fixture.all[0]]})
    await page.waitForSelector('[data-sidebar-module="profile"]')
    assert.equal(await page.locator('.sidebar-tabs').count(),0)
  })
  await check('聊天室与内页使用独立的最后标签选择',async()=>{
    await page.evaluate(()=>{fixture.state.presentation={income:'card'};fixture.state.modules=[...fixture.all];fixture.state.section='chatSidebar';fixture.state.collapsed=[]})
    await tab('online').click()
    assert.equal(await page.evaluate(()=>localStorage.getItem('fp.sidebarTab.chatSidebar.v1')),'online')
    await page.evaluate(()=>{fixture.state.section='pageSidebar'})
    await page.waitForFunction(()=>document.querySelector('.sidebar-tab[aria-selected="true"]')?.id.endsWith('-checkin'))
    assert.equal(await page.evaluate(()=>localStorage.getItem('fp.sidebarTab.pageSidebar.v1')),'checkin')
  })
  await check('桌面与390px窄屏无横向溢出，键盘和暗色可用',async()=>{
    await tab('checkin').focus()
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await page.waitForFunction(()=>document.querySelector('.sidebar-tab[aria-selected="true"]')?.id.endsWith('-breezemoons'))
    await page.evaluate(()=>{fixture.state.visualMode=true})
    await page.mouse.click(2,2)
    await page.screenshot({path:path.join(output,'desktop-light.png'),fullPage:true,animations:'disabled'})
    await page.setViewportSize({width:390,height:844})
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    await page.screenshot({path:path.join(output,'mobile-light.png'),fullPage:true,animations:'disabled'})
    await page.evaluate(()=>document.body.classList.add('dark'))
    await page.screenshot({path:path.join(output,'mobile-dark.png'),fullPage:true,animations:'disabled'})
    await page.setViewportSize({width:1280,height:1050})
    await page.screenshot({path:path.join(output,'desktop-dark.png'),fullPage:true,animations:'disabled'})
    await page.evaluate(()=>{fixture.state.collapsed=['profile','income'];document.body.classList.remove('dark')})
    await page.screenshot({path:path.join(output,'desktop-collapsed.png'),fullPage:true,animations:'disabled'})
    await page.setViewportSize({width:390,height:844})
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    assert.equal(await card('profile').count(),1)
    assert.equal(await page.locator('.sidebar-layout').count(),1)
    await page.screenshot({path:path.join(output,'mobile-collapsed.png'),fullPage:true,animations:'disabled'})
  })
  assert.deepEqual(errors,[])
  assert.deepEqual(externalRequests,[])
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:successes,errors,externalRequests},null,2))
  console.log(`PASS ${successes.length} 组混合侧栏浏览器验证；截图 ${output}`)
  successes.forEach(item=>console.log('  '+item))
}finally{await browser.close()}
