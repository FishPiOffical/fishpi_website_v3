import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const output = process.env.SIDEBAR_TEST_OUTPUT || '/tmp/sidebar-tabs-browser'
fs.mkdirSync(output, { recursive: true })
const data = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const transpile = code => ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const vue = data(fs.readFileSync('node_modules/vue/dist/vue.esm-browser.prod.js', 'utf8'))
// 只替换身份和设置服务；标签、图标、配置按钮均编译实际组件。
const mocks = data(`import {reactive} from 'vue';
export const auth=reactive({accessToken:'token-a',account:{oId:'a',userName:'alpha'},get isLoggedIn(){return !!this.accessToken&&!!this.account}});
let version=1;const listeners=new Set();
export const useAuthStore=()=>auth;
export const getAuthContextVersion=()=>version;
export function onAccessTokenChange(fn){listeners.add(fn);fn(auth.accessToken);return()=>listeners.delete(fn)}
export function rotate(token){auth.accessToken=token;for(const fn of listeners)fn(token)}
export function identity(id){version++;auth.account=id?{oId:id,userName:id}:null;rotate(id?'token-'+id:null)}
export const drawer=reactive({opened:[],show(section){this.opened.push(section)}});
export const useSettingsDrawerStore=()=>drawer;`)
const imports = { vue, '@/stores/auth': mocks, '@/api/http': mocks, '@/stores/settingsDrawer': mocks }
let css = ''
const compiled = new Map()
function compile(file) {
  const key = 'fixture:' + file
  if (compiled.has(file)) return key
  compiled.set(file, key)
  const { descriptor } = parse(fs.readFileSync(file, 'utf8'))
  const id = 'data-v-tabs-' + compiled.size
  let script = transpile(compileScript(descriptor, { id, inlineTemplate: true }).content)
  script = script.replace(/from (['"])([^'"]+)\1/g, (original, quote, specifier) => {
    if (specifier.endsWith('.vue')) {
      const target = specifier.startsWith('@/') ? 'src/' + specifier.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
      return `from '${compile(target)}'`
    }
    assert.ok(imports[specifier], `夹具缺少显式依赖：${specifier}`)
    return original
  }).replaceAll('import.meta.env.SSR', 'false').replace('export default', 'const component =')
  css += descriptor.styles.map(style => compileStyle({ source: style.content, filename: file, id, scoped: !!style.scoped }).code).join('\n')
  imports[key] = data(script + `;component.__scopeId='${id}';export default component;`)
  return key
}
const component = compile('src/components/sidebar/SidebarTabs.vue')
const modules = [
  { id: 'checkin', title: '活跃签到' }, { id: 'breezemoons', title: '清风明月' },
  { id: 'income', title: '上下班时间' }, { id: 'topic', title: '当前话题' },
  { id: 'online', title: '在线成员' }, { id: 'activity', title: '当前活跃情况' },
  { id: 'appearance', title: '外观' }, { id: 'mutes', title: '思过崖' },
]
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f4f6f8;--fp-card:#fff;--fp-border:#e0e4e9;--fp-text:#292e36;--fp-title:#252a31;--fp-muted:#77808d;--fp-primary:#62ae37;--fp-hover:#f3f5f7;--fp-bg:#f5f6f8}
body.dark{background:#202326;--fp-card:#282b2e;--fp-border:#41474d;--fp-text:#e3e6e8;--fp-title:#f2f4f5;--fp-muted:#aab2ba;--fp-primary:#9acb78;--fp-hover:#343b41;--fp-bg:#202529}
.test-layout{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,3fr);gap:20px;max-width:1180px;margin:24px auto;padding:0 20px;align-items:start}.main-content{padding:28px;border:1px solid var(--fp-border);border-radius:12px;background:var(--fp-card);color:var(--fp-text);min-height:440px}.main-content h1{margin:0 0 12px;font-size:22px}.main-content p{color:var(--fp-muted);line-height:1.8}.test-layout>aside{min-width:0}.fixture-panel{padding:18px;color:var(--fp-text)}.fixture-panel h4{margin:0 0 12px;font-size:16px}.fixture-panel label{display:block;margin:12px 0;color:var(--fp-muted)}.fixture-panel input{display:block;width:100%;border:1px solid var(--fp-border);border-radius:7px;padding:9px;background:var(--fp-bg);color:var(--fp-text)}.fixture-row{padding:12px 0;border-bottom:1px solid var(--fp-border);font-size:13px}.fixture-link{font-size:12px;color:var(--fp-muted);text-decoration:none}.fixture-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.fixture-summary strong{font-size:27px;font-variant-numeric:tabular-nums}.fixture-summary span{color:var(--fp-primary);font-size:12px}
@media(max-width:700px){.test-layout{grid-template-columns:minmax(0,1fr);margin:12px auto;padding:0 12px}.main-content{display:none}}
${css}</style><script type="importmap">${JSON.stringify({ imports })}</script><div id="app"></div><script type="module">
import {createApp,h,reactive,ref,onMounted,onUnmounted} from 'vue';
import SidebarTabs from '${component}';import {auth,drawer,rotate,identity} from '@/stores/auth';
const all=${JSON.stringify(modules)},state=reactive({modules:[...all],section:'chatSidebar',showConfigure:undefined,mounts:{},unmounts:{}});
const FixturePanel={props:['id','active'],setup(props){const draft=ref('');const owner=auth.account?.oId||'guest';onMounted(()=>{state.mounts[props.id]=(state.mounts[props.id]||0)+1});onUnmounted(()=>{state.unmounts[props.id]=(state.unmounts[props.id]||0)+1});return()=>h('div',{class:'fixture-panel','data-fixture':props.id,'data-owner':owner},[
h('h4',{},all.find(m=>m.id===props.id)?.title),h('div',{class:'fixture-summary'},[h('strong',{},props.id==='income'?'03:42:38':'31.42%'),h('span',{},props.id==='income'?'今日已赚 ¥214.507':'今日签到已完成')]),
h('label',{},['输入草稿',h('input',{'aria-label':props.id+'草稿',value:draft.value,onInput:e=>draft.value=e.target.value})]),
...Array.from({length:props.id==='breezemoons'?5:2},(_,i)=>h('div',{class:'fixture-row'},'模块内容 '+(i+1)+' · 保留已输入的内容和当前状态'))])}};
window.fixture={state,all,drawer,rotate,identity};
createApp({setup:()=>()=>h('div',{class:'test-layout'},[h('main',{class:'main-content'},[h('h1',{},'社区内页'),h('p',{},'右侧按已启用模块显示标签，切换后保留输入。')]),h('aside',{},[h(SidebarTabs,{modules:state.modules,section:state.section,showConfigure:state.showConfigure,ariaLabel:'社区侧栏模块'},{default:({module,active})=>h(FixturePanel,{id:module.id,active}),'header-actions':({module})=>module.id==='breezemoons'?h('a',{class:'fixture-link',href:'/breezemoons'},'更多'):null})])])}).mount('#app');
</script></html>`
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = [], externalRequests = [], successes = []
const check = (message, fn) => async () => { await fn(); successes.push(message) }
async function newPage(init) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === 'http://sidebar.test' && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
    externalRequests.push(route.request().url())
    return route.abort()
  })
  if (init) await page.addInitScript(init)
  await page.goto('http://sidebar.test/')
  await page.waitForSelector('.sidebar-tab')
  return page
}
const tab = (page, id) => page.locator(`.sidebar-tab[id$="-tab-${id}"]`)
const input = (page, id) => page.getByRole('textbox', { name: id + '草稿', exact: true })
const selected = page => page.locator('.sidebar-tab[aria-selected="true"]').getAttribute('id')
const count = (page, id, kind = 'mounts') => page.evaluate(({ id, kind }) => fixture.state[kind][id] || 0, { id, kind })
const waitTabVisible = (page, id) => page.waitForFunction(id => {
  const list = document.querySelector('[role="tablist"]')
  const button = document.querySelector(`.sidebar-tab[id$="-tab-${id}"]`)
  if (!list || !button) return false
  const area = list.getBoundingClientRect(), item = button.getBoundingClientRect()
  return item.left >= area.left - 1 && item.right <= area.right + 1
}, id)
try {
  const page = await newPage()
  await check('首次仅挂载当前模块，真实图标及配置按钮可用', async () => {
    assert.equal(await page.locator('[data-fixture]').count(), 1)
    assert.equal(await count(page, 'checkin'), 1)
    assert.equal(await count(page, 'breezemoons'), 0)
    assert.ok(await tab(page, 'checkin').getAttribute('aria-controls'))
    assert.equal(await tab(page, 'profile').count(), 0)
    assert.equal(await page.locator('.sidebar-tabs > header').getByRole('heading').count(), 0, '标签条不再重复显示当前模块标题')
    assert.equal(await page.locator('.sidebar-configure svg path').count(), 1)
  })()
  await check('切换保留草稿，已访问面板不重复挂载，辅助操作跟随当前模块', async () => {
    await tab(page, 'breezemoons').click()
    await input(page, 'breezemoons').fill('尚未发送的清风草稿')
    assert.equal(await page.locator('.fixture-link').getAttribute('href'), '/breezemoons')
    const positions = await page.evaluate(() => ({
      tabs: document.querySelector('[role="tablist"]').getBoundingClientRect().bottom,
      action: document.querySelector('.fixture-link').getBoundingClientRect(),
      panel: document.querySelector('.sidebar-panel.is-active').getBoundingClientRect().top,
    }))
    assert.ok(positions.action.top >= positions.tabs && positions.action.bottom <= positions.panel, '辅助操作应位于标签条下方、内容面板上方')
    await tab(page, 'income').click()
    assert.equal(await page.locator('.fixture-link').count(), 0)
    await tab(page, 'breezemoons').click()
    assert.equal(await input(page, 'breezemoons').inputValue(), '尚未发送的清风草稿')
    assert.equal(await count(page, 'breezemoons'), 1)
    assert.equal(await page.locator('.sidebar-panel:visible').count(), 1)
  })()
  await check('独立资料卡拥有配置入口时，标签面板可隐藏齿轮且不重建内容', async () => {
    const before = await count(page, 'breezemoons')
    await page.evaluate(() => { fixture.state.showConfigure = false })
    assert.equal(await page.getByRole('button', { name: '配置模块', exact: true }).count(), 0)
    assert.equal(await input(page, 'breezemoons').inputValue(), '尚未发送的清风草稿')
    assert.equal(await count(page, 'breezemoons'), before)
    await page.evaluate(() => { fixture.state.showConfigure = undefined })
    assert.equal(await page.getByRole('button', { name: '配置模块', exact: true }).count(), 1)
  })()
  await check('方向键及 Home/End 只移动焦点，回车和空格才挂载模块', async () => {
    await tab(page, 'breezemoons').focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await tab(page, 'income').evaluate(el => el === document.activeElement), true)
    await waitTabVisible(page, 'income')
    assert.match(await selected(page), /-breezemoons$/)
    await page.keyboard.press('End')
    assert.equal(await tab(page, 'mutes').evaluate(el => el === document.activeElement), true)
    await waitTabVisible(page, 'mutes')
    assert.equal(await count(page, 'mutes'), 0)
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-fixture="mutes"]')
    assert.equal(await count(page, 'mutes'), 1)
    await page.keyboard.press('Home')
    assert.equal(await tab(page, 'checkin').evaluate(el => el === document.activeElement), true)
    await waitTabVisible(page, 'checkin')
    assert.match(await selected(page), /-mutes$/)
    await page.keyboard.press('Space')
    assert.match(await selected(page), /-checkin$/)
    await page.keyboard.press('ArrowLeft')
    assert.equal(await tab(page, 'mutes').evaluate(el => el === document.activeElement), true)
    await waitTabVisible(page, 'mutes')
  })()
  await check('排序保持当前模块，禁用后卸载并回退，重新启用按需挂载', async () => {
    await tab(page, 'breezemoons').click()
    await page.evaluate(() => { fixture.state.modules = [...fixture.all].reverse() })
    assert.match(await selected(page), /-breezemoons$/)
    assert.equal(await page.locator('.sidebar-tab').first().getAttribute('title'), '思过崖')
    await page.evaluate(() => { fixture.state.modules = fixture.state.modules.filter(m => m.id !== 'breezemoons') })
    await page.waitForFunction(() => fixture.state.unmounts.breezemoons === 1)
    assert.match(await selected(page), /-mutes$/)
    await page.evaluate(() => { fixture.state.modules = [...fixture.state.modules, fixture.all.find(m => m.id === 'breezemoons')] })
    assert.equal(await count(page, 'breezemoons'), 1)
    await tab(page, 'breezemoons').click()
    assert.equal(await input(page, 'breezemoons').inputValue(), '')
    assert.equal(await count(page, 'breezemoons'), 2)
  })()
  await check('普通令牌轮换保留草稿，换号及退出清理旧面板实例', async () => {
    await input(page, 'breezemoons').fill('仅当前账号可见')
    const before = await count(page, 'breezemoons')
    await page.evaluate(() => fixture.rotate('token-a-refreshed'))
    assert.equal(await input(page, 'breezemoons').inputValue(), '仅当前账号可见')
    assert.equal(await count(page, 'breezemoons'), before)
    await page.evaluate(() => fixture.identity('b'))
    await page.waitForFunction(() => document.querySelector('[data-fixture="breezemoons"]')?.getAttribute('data-owner') === 'b')
    assert.equal(await input(page, 'breezemoons').inputValue(), '')
    assert.equal(await page.locator('[data-owner="a"]').count(), 0)
    await input(page, 'breezemoons').fill('账号 B 草稿')
    await page.evaluate(() => fixture.identity(null))
    await page.waitForFunction(() => document.querySelector('[data-fixture="breezemoons"]')?.getAttribute('data-owner') === 'guest')
    assert.equal(await input(page, 'breezemoons').inputValue(), '')
  })()
  await check('全关模块仍保留配置入口，重新开启后正常显示', async () => {
    await page.evaluate(() => { fixture.state.modules = [] })
    await page.waitForSelector('.sidebar-tabs-empty')
    assert.equal(await page.locator('.sidebar-tab,.sidebar-panel').count(), 0)
    await page.evaluate(() => { fixture.state.showConfigure = false })
    assert.equal(await page.getByRole('button', { name: '配置模块', exact: true }).count(), 0)
    await page.evaluate(() => { fixture.state.showConfigure = true })
    await page.getByRole('button', { name: '配置模块', exact: true }).click()
    assert.equal(await page.evaluate(() => fixture.drawer.opened.at(-1)), 'chatSidebar')
    await page.evaluate(() => { fixture.state.modules = [...fixture.all] })
    await page.waitForSelector('.sidebar-tab')
    assert.match(await selected(page), /-checkin$/)
  })()
  await check('只持久化标签 ID，刷新恢复选择，不恢复私人草稿', async () => {
    await tab(page, 'breezemoons').click()
    await input(page, 'breezemoons').fill('不应进入浏览器存储的草稿')
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), { 'fp.sidebarTab.chatSidebar.v1': 'breezemoons' })
    await page.reload()
    await page.waitForSelector('[data-fixture="breezemoons"]')
    assert.match(await selected(page), /-breezemoons$/)
    assert.equal(await input(page, 'breezemoons').inputValue(), '')
    assert.equal(await count(page, 'checkin'), 0)
    await page.evaluate(() => { localStorage.setItem('fp.sidebarTab.pageSidebar.v1', 'income'); fixture.state.section = 'pageSidebar' })
    await page.waitForFunction(() => document.querySelector('.sidebar-tab[aria-selected="true"]')?.id.endsWith('-income'))
    await page.getByRole('button', { name: '配置模块', exact: true }).click()
    assert.equal(await page.evaluate(() => fixture.drawer.opened.at(-1)), 'pageSidebar')
  })()
  await check('无效偏好安全回退，存储被禁用仍可切换', async () => {
    const invalid = await newPage(() => localStorage.setItem('fp.sidebarTab.chatSidebar.v1', 'unknown-module'))
    assert.match(await selected(invalid), /-checkin$/)
    await invalid.close()
    const denied = await newPage(() => {
      Storage.prototype.getItem = function () { throw new DOMException('访问已禁用', 'SecurityError') }
      Storage.prototype.setItem = function () { throw new DOMException('访问已禁用', 'SecurityError') }
    })
    await tab(denied, 'income').click()
    assert.match(await selected(denied), /-income$/)
    await denied.close()
  })()
  await check('单行标签横向溢出可通过左右按钮抵达两端，滚动不触发面板读取', async () => {
    await page.setViewportSize({ width: 390, height: 850 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await tab(page, 'checkin').focus()
    await page.keyboard.press('Home')
    await waitTabVisible(page, 'checkin')
    const geometry = await page.getByRole('tablist').evaluate(list => ({
      overflow: list.scrollWidth > list.clientWidth,
      rows: new Set([...list.querySelectorAll('[role="tab"]')].map(el => Math.round(el.getBoundingClientRect().top))).size,
    }))
    assert.deepEqual(geometry, { overflow: true, rows: 1 })
    const activeBefore = await selected(page)
    const mountsBefore = await page.evaluate(() => ({ ...fixture.state.mounts }))
    const back = page.getByRole('button', { name: '向前滚动标签', exact: true })
    const forward = page.getByRole('button', { name: '向后滚动标签', exact: true })
    await page.waitForFunction(() => document.querySelector('[aria-label="向前滚动标签"]')?.disabled === true)
    for (let attempt = 0; attempt < 20 && await page.getByRole('tablist').evaluate(list => list.scrollLeft + list.clientWidth < list.scrollWidth - 1); attempt++) {
      const before = await page.getByRole('tablist').evaluate(list => list.scrollLeft)
      await forward.click()
      await page.waitForFunction(before => document.querySelector('[role="tablist"]').scrollLeft > before, before)
    }
    await page.waitForFunction(() => document.querySelector('[aria-label="向后滚动标签"]')?.disabled === true)
    assert.equal(await forward.isDisabled(), true, '向后按钮应能抵达最后一个标签')
    await waitTabVisible(page, 'mutes')
    for (let attempt = 0; attempt < 20 && await page.getByRole('tablist').evaluate(list => list.scrollLeft > 1); attempt++) {
      const before = await page.getByRole('tablist').evaluate(list => list.scrollLeft)
      await back.click()
      await page.waitForFunction(before => document.querySelector('[role="tablist"]').scrollLeft < before, before)
    }
    await page.waitForFunction(() => document.querySelector('[aria-label="向前滚动标签"]')?.disabled === true)
    assert.equal(await back.isDisabled(), true, '向前按钮应能返回第一个标签')
    await waitTabVisible(page, 'checkin')
    assert.equal(await selected(page), activeBefore)
    assert.deepEqual(await page.evaluate(() => ({ ...fixture.state.mounts })), mountsBefore)
    await page.evaluate(() => { fixture.state.modules = [fixture.all[0]] })
    await page.waitForFunction(() => document.querySelectorAll('.tab-scroll').length === 0)
    await page.evaluate(() => { fixture.state.modules = [...fixture.all] })
    await page.waitForFunction(() => document.querySelectorAll('.tab-scroll').length === 2)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
  })()
  await check('恢复条尾偏好时所选标签自动滚入可见区域', async () => {
    const restored = await newPage(() => localStorage.setItem('fp.sidebarTab.chatSidebar.v1', 'mutes'))
    assert.match(await selected(restored), /-mutes$/)
    await waitTabVisible(restored, 'mutes')
    await restored.setViewportSize({ width: 760, height: 850 })
    await waitTabVisible(restored, 'mutes')
    await restored.setViewportSize({ width: 390, height: 850 })
    await waitTabVisible(restored, 'mutes')
    assert.equal(await count(restored, 'mutes'), 1)
    assert.equal(await count(restored, 'checkin'), 0)
    await restored.close()
  })()
  await check('桌面和 390px 无横向溢出，长面板内部滚动，浅暗主题截图', async () => {
    await page.evaluate(() => { fixture.state.section = 'chatSidebar' })
    await tab(page, 'breezemoons').click()
    await page.setViewportSize({ width: 390, height: 500 })
    const scrolling = await page.locator('.sidebar-panel:visible').evaluate(el => {
      el.scrollTop = 60
      return { taller: el.scrollHeight > el.clientHeight, scrolled: el.scrollTop > 0 }
    })
    assert.deepEqual(scrolling, { taller: true, scrolled: true }, '矮视口的长模块应在面板内滚动')
    await page.locator('.sidebar-panel:visible').evaluate(el => { el.scrollTop = 0 })
    for (const width of [1180, 390]) {
      await page.setViewportSize({ width, height: 850 })
      await page.waitForTimeout(180)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `页面横向溢出：${width}`)
      const bounds = await page.locator('.sidebar-tabs').boundingBox()
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, `侧栏溢出视口：${width}`)
      assert.equal(await page.locator('.sidebar-panel:visible').evaluate(el => getComputedStyle(el).overflowY), 'auto')
      await page.screenshot({ path: `${output}/${width}-light.png`, fullPage: true })
    }
    await page.evaluate(() => document.body.classList.add('dark'))
    await page.waitForTimeout(180)
    await page.screenshot({ path: `${output}/390-dark.png`, fullPage: true })
    assert.equal(await page.locator('.sidebar-tabs').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(40, 43, 46)')
  })()
  assert.deepEqual(errors, [], '浏览器不能出现未捕获错误')
  assert.deepEqual(externalRequests, [], '模块切换不能触发夹具之外的网络请求')
  const result = { status: 'PASS', checks: successes, screenshots: ['1180-light.png', '390-light.png', '390-dark.png'], requestsOutsideFixture: externalRequests, errors }
  fs.writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally {
  await browser.close()
}
