import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { parse, compileScript, compileStyle, compileTemplate } from '@vue/compiler-sfc'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const output = process.env.SETTINGS_TEST_OUTPUT || '/tmp/settings-drawer-browser'
fs.mkdirSync(output, { recursive: true })
const data = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64')
const transpile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const imports = {
  vue: data(fs.readFileSync('node_modules/vue/dist/vue.esm-browser.prod.js', 'utf8')),
  pinia: data(fs.readFileSync('node_modules/pinia/dist/pinia.esm-browser.prod.js', 'utf8')),
}
// 实际编译设置、所有本机设置 store 和模块列表；仅隔离账号服务、路由和不属于本次的业务弹窗。
const services = data(`import {reactive} from 'vue';import {defineStore} from 'pinia';
export const useAuthStore=defineStore('fixtureAuth',()=>reactive({isLoggedIn:true,accessToken:'fixture',account:{oId:'fixture',userName:'fixture'}}));
export const usePrivateInboxStore=defineStore('fixtureInbox',()=>reactive({unreadTotal:0,error:'',inboxOpen:false,showInbox(){this.inboxOpen=true}}));
export const useAppearanceShopStore=defineStore('fixtureShop',()=>reactive({open:false,show(){this.open=true}}));
export const useFeedbackPanelStore=defineStore('fixtureFeedback',()=>reactive({open:false,target:'',show(target){this.target=target;this.open=true}}));
export const feedbackEnabled=true;
export const route=reactive({path:'/cr',params:{},query:{}});export const useRoute=()=>route;export const useRouter=()=>({push:async path=>{route.path=path}});`)
for (const spec of ['@/stores/auth', '@/stores/privateInbox', '@/stores/appearanceShop', '@/feedback/panel', '@/feedback/api', 'vue-router']) imports[spec] = services
const stub = data(`export default {render(){return null}}`)
const stubComponents = new Set(['FeedbackDialog.vue', 'HiddenChatConversations.vue', 'WhisperConversations.vue', 'ChatTailSettingsDialog.vue'])
let css = ''
const compiled = new Map()
function compile(file) {
  const key = 'fixture:' + file
  if (compiled.has(file)) return key
  compiled.set(file, key)
  if (stubComponents.has(path.basename(file))) { imports[key] = stub; return key }
  let code, id
  if (file.endsWith('.vue')) {
    const { descriptor } = parse(fs.readFileSync(file, 'utf8'))
    id = 'data-v-settings-' + compiled.size
    if (descriptor.script || descriptor.scriptSetup) {
      code = transpile(compileScript(descriptor, { id, inlineTemplate: true }).content).replace('export default', 'const component =')
    } else {
      const template = compileTemplate({ source: descriptor.template.content, filename: file, id })
      assert.equal(template.errors.length, 0, file + ' 模板编译失败')
      code = template.code + '\nconst component = {render};'
    }
    for (const style of descriptor.styles) {
      const result = compileStyle({ source: style.content, filename: path.resolve(file), id, scoped: !!style.scoped, preprocessLang: style.lang })
      assert.equal(result.errors.length, 0, file + ' 样式编译失败')
      css += result.code + '\n'
    }
    code += `;component.__scopeId='${id}';export default component;`
  } else code = transpile(fs.readFileSync(file, 'utf8'))
  code = code.replace(/from (['"])([^'"]+)\1/g, (original, quote, specifier) => {
    if (imports[specifier]) return original
    const base = specifier.startsWith('@/') ? 'src/' + specifier.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
    const target = fs.existsSync(base) ? base : base + '.ts'
    assert.ok(fs.existsSync(target), '夹具缺少显式依赖：' + specifier)
    return `from '${compile(target)}'`
  }).replaceAll('import.meta.env.SSR', 'false')
  imports[key] = data(code)
  return key
}
const component = compile('src/components/settings/SettingsDrawer.vue')
const drawerStore = compile('src/stores/settingsDrawer.ts'), pageStore = compile('src/stores/pageSidebar.ts'), chatStore = compile('src/stores/chatSidebar.ts')
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f4f6f8;--fp-card:#fff;--fp-border:#e0e4e9;--fp-text:#292e36;--fp-title:#252a31;--fp-muted:#77808d;--fp-primary:#62ae37;--fp-hover:#f3f5f7;--fp-bg:#f5f6f8;--fp-link:#4386ec;--fp-panel-radius:12px;--fp-income:#62ae37;--fp-accent:#e88828}body.dark{--fp-card:#282b2e;--fp-border:#41474d;--fp-text:#e3e6e8;--fp-title:#f2f4f5;--fp-muted:#aab2ba;--fp-primary:#9acb78;--fp-hover:#343b41;--fp-bg:#202529}button,input,select{font:inherit}.fp-input{width:100%;padding:10px;border:1px solid var(--fp-border);border-radius:8px;background:var(--fp-hover);color:var(--fp-text)}.fp-btn{padding:9px 14px;border:1px solid var(--fp-border);border-radius:7px;background:var(--fp-card);color:var(--fp-text)}.fp-btn--primary{background:var(--fp-primary);color:#fff}.page{max-width:1100px;margin:70px auto;color:#8b949d;padding:24px}.page h1{font-size:26px}${css}
</style><script type="importmap">${JSON.stringify({ imports })}</script><div class="page"><h1>摸鱼派 · 设置预览</h1><p>隔离本地夹具，所有设置使用真实组件。</p></div><div id="app"></div><script type="module">
import {createApp,h} from 'vue';import {createPinia} from 'pinia';import Drawer from '${component}';import {useSettingsDrawerStore} from '${drawerStore}';import {usePageSidebarStore} from '${pageStore}';import {useChatSidebarStore} from '${chatStore}';import {useAppearanceShopStore} from '@/stores/appearanceShop';
const app=createApp({render:()=>h(Drawer)});app.use(createPinia());app.mount('#app');
const drawer=useSettingsDrawerStore(),page=usePageSidebarStore(),chat=useChatSidebarStore(),shop=useAppearanceShopStore();window.fixture={drawer,page,chat,shop};drawer.show('pageSidebar');
</script></html>`
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = [], requests = [], checks = []
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', error => errors.push(error.message))
await page.route('**/*', route => {
  if (route.request().url() === 'http://settings.test/') return route.fulfill({ contentType: 'text/html', body: html })
  if (route.request().url() === 'http://settings.test/logo.png') return route.fulfill({ contentType: 'image/png', body: fs.readFileSync('public/logo.png') })
  requests.push(route.request().url());return route.abort()
})
const check = async (label, fn) => { await fn(); checks.push(label) }
const row = id => page.locator(`[data-module-id="${id}"]`)
const nav = label => page.locator('.nav').getByRole('button', { name: label, exact: true })
try {
  await page.goto('http://settings.test/')
  await page.waitForSelector('[data-module-id="profile"]')
  await check('按页面布局、聊天体验、个性化分组，资料固定置顶', async () => {
    assert.deepEqual(await page.locator('.nav-group-title').allTextContents(), ['页面布局', '聊天体验', '个性化', '帮助与反馈'])
    assert.equal(await page.locator('[data-module-id]').first().getAttribute('data-module-id'), 'profile')
    assert.equal(await row('profile').getByRole('button').count(), 0)
    assert.ok(await nav('外观商城').isVisible())
  })
  await check('模块显示方式、开关与本地持久化即时同步', async () => {
    await row('breezemoons').getByRole('button', { name: '独立卡片', exact: true }).click()
    assert.equal(await page.evaluate(() => fixture.page.presentationOf('breezemoons')), 'card')
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('fp.pageSidebar.v1')).presentation.breezemoons), 'card')
    await row('breezemoons').getByRole('checkbox').uncheck()
    assert.equal(await page.evaluate(() => fixture.page.isOn('breezemoons')), false)
    await row('breezemoons').getByRole('checkbox').check()
    assert.equal(await row('breezemoons').getByRole('button', { name: '独立卡片', exact: true }).getAttribute('aria-pressed'), 'true')
  })
  await check('旧配置中资料位于中间时，箭头排序仍按可见顺序移动', async () => {
    await page.evaluate(() => {fixture.page.pref.order=['income','profile','appearance','checkin','download','breezemoons','ad']})
    await row('income').getByRole('button', { name: '下移上下班时间' }).click()
    assert.deepEqual((await page.locator('[data-module-id]').evaluateAll(rows => rows.map(row => row.dataset.moduleId))).slice(0, 3), ['profile','appearance','income'])
    await row('income').getByRole('button', { name: '上移上下班时间' }).click()
    assert.equal(await page.locator('[data-module-id]').nth(1).getAttribute('data-module-id'), 'income')
  })
  await check('聊天与内页独立配置，鼠标拖拽仍能排序', async () => {
    await nav('聊天室侧栏').click()
    await row('income').getByRole('button', { name: '独立卡片', exact: true }).click()
    assert.equal(await page.evaluate(() => fixture.chat.presentationOf('income')), 'card')
    assert.equal(await page.evaluate(() => fixture.page.presentationOf('income')), 'tabs')
    await row('income').locator('.module-drag').dragTo(row('breezemoons'), { targetPosition: {x:80,y:3} })
    const ids = await page.locator('[data-module-id]').evaluateAll(rows => rows.map(row => row.dataset.moduleId))
    assert.ok(ids.indexOf('income') < ids.indexOf('breezemoons'))
  })
  await page.screenshot({ path: path.join(output, 'settings-desktop.png') })
  await check('聊天显示开关与文案横向排列，精简模式保留座驾开关联动', async () => {
    await nav('聊天室输入').click()
    const switches = page.locator('.setting-toggle')
    assert.equal(await switches.count(), 2)
    assert.deepEqual(await switches.evaluateAll(rows => rows.map(row => getComputedStyle(row).flexDirection)), ['row', 'row'])
    await switches.first().getByRole('checkbox').check()
    assert.equal(await switches.nth(1).getByRole('checkbox').isDisabled(), true)
    await switches.first().getByRole('checkbox').uncheck()
    assert.equal(await switches.nth(1).getByRole('checkbox').isDisabled(), false)
    await page.screenshot({path:path.join(output, 'settings-chat-input-desktop.png')})
    await nav('聊天室侧栏').click()
  })
  await check('上下班设置保持按模块启用条件显示', async () => {
    await page.evaluate(() => {if(fixture.chat.isOn('income'))fixture.chat.toggle('income');if(fixture.page.isOn('income'))fixture.page.toggle('income')})
    assert.equal(await nav('上下班时间').count(), 0)
    await row('income').getByRole('checkbox').check()
    await nav('上下班时间').click()
    assert.equal(await page.locator('input[type="time"]').count(), 3)
  })
  await check('商城入口关闭设置后复用既有商城窗口', async () => {
    await nav('外观商城').click()
    assert.equal(await page.evaluate(() => fixture.drawer.open), false)
    assert.equal(await page.evaluate(() => fixture.shop.open), true)
    await page.evaluate(() => {fixture.shop.open=false;fixture.drawer.show('branding')})
    await page.locator('.shop-entry').click()
    assert.equal(await page.evaluate(() => fixture.drawer.open), false)
    assert.equal(await page.evaluate(() => fixture.shop.open), true)
  })
  await check('390px 窄屏分类、全部设置表单无横向溢出', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const section of ['pageSidebar','chatSidebar','home','chatInput','emoji','chatBlock','branding','income','feedback']) {
      await page.evaluate(section => fixture.drawer.show(section), section)
      await page.waitForTimeout(250)
      const bounds = await page.locator('.content').evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }))
      assert.ok(bounds.scroll <= bounds.client + 1, section + ' 内容横向溢出')
      assert.ok(bounds.left >= 0 && bounds.right <= 390, section + ' 内容越出屏幕：' + JSON.stringify(bounds))
      if (section === 'chatInput') await page.screenshot({path:path.join(output, 'settings-chat-input-mobile.png')})
    }
    await page.evaluate(() => fixture.drawer.show('pageSidebar'))
    await page.screenshot({ path: path.join(output, 'settings-mobile.png') })
    await page.evaluate(() => document.body.classList.add('dark'))
    await page.waitForTimeout(200)
    await page.screenshot({ path: path.join(output, 'settings-mobile-dark.png') })
  })
  await check('刷新恢复所选位置，键盘 Escape 可关闭', async () => {
    await page.reload()
    await page.waitForSelector('[data-module-id="profile"]')
    assert.equal(await row('breezemoons').getByRole('button', {name:'独立卡片',exact:true}).getAttribute('aria-pressed'), 'true')
    await page.keyboard.press('Escape')
    assert.equal(await page.evaluate(() => fixture.drawer.open), false)
  })
  assert.deepEqual(errors, [])
  assert.deepEqual(requests, [])
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, errors, requests }, null, 2))
  console.log(`${checks.length} 组设置浏览器检查通过，截图：${output}`)
} finally { await browser.close() }
