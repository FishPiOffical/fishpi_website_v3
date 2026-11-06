import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { JSDOM } from 'jsdom'

// Real browser DOM semantics: a detached node must never pass merely because its ID exists.
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://127.0.0.1:5173/' })
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'SVGElement', 'MutationObserver', 'localStorage', 'history']) globalThis[key] = dom.window[key]
const vue = await import('vue')
const { createPinia, setActivePinia } = await import('pinia')
const { createRouter, createMemoryHistory, RouterView } = await import('vue-router')
const { renderToString } = await import('@vue/server-renderer')
const { compile: compileTemplate } = await import('@vue/compiler-dom')
const { createSSRApp, h, ref, nextTick } = vue
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
function compile(source, imports = {}) {
  let js = ts.transpileModule(source.replaceAll('import.meta.env.SSR', 'false'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  for (const [key, value] of Object.entries({ vue: import.meta.resolve('vue'), pinia: import.meta.resolve('pinia'), ...imports })) js = js.replaceAll(`from '${key}'`, `from '${value}'`).replaceAll(`from "${key}"`, `from '${value}'`)
  return moduleUrl(js)
}
const { useRouteDomBoundary } = await import(compile(await fs.readFile('src/composables/useRouteDomBoundary.ts', 'utf8')))
const meta = compile(await fs.readFile('src/chat/sidebar/meta.ts', 'utf8'))
const modulesUrl = compile(await fs.readFile('src/home/modules.ts', 'utf8'), { '@/chat/sidebar/meta': meta })
const { defaultHomeLayout, HOME_LAYOUT_STORAGE } = await import(modulesUrl)
const { useHomeLayoutStore } = await import(compile(await fs.readFile('src/stores/homeLayout.ts', 'utf8'), { '@/home/modules': modulesUrl }))

const saved = defaultHomeLayout()
saved.hidden.recentA = true
saved.rows.reverse()
localStorage.setItem(HOME_LAYOUT_STORAGE, JSON.stringify(saved))
setActivePinia(createPinia())
let layout = useHomeLayoutStore()
assert.deepEqual(JSON.parse(JSON.stringify(layout.state)), defaultHomeLayout())
assert.deepEqual(JSON.parse(localStorage.getItem(HOME_LAYOUT_STORAGE)), saved)
layout.restore()
assert.deepEqual(JSON.parse(JSON.stringify(layout.state)), saved)
layout.toggle('recentB'); await nextTick()
assert.equal(JSON.parse(localStorage.getItem(HOME_LAYOUT_STORAGE)).hidden.recentB, true)
layout.restore()
assert.equal(layout.state.hidden.recentB, true)
console.log('PASS home DOM 1 first client layout matches SSR; mounted restore preserves saved rows/visibility and subsequent edits persist')
const storage = globalThis.localStorage
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage denied') } })
setActivePinia(createPinia()); layout = useHomeLayoutStore(); layout.restore(); layout.toggle('recentA'); await nextTick()
assert.equal(layout.state.hidden.recentA, true)
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
console.log('PASS home DOM 2 blocked storage cannot interrupt mounting or layout changes')

// Compile the actual AppShell route container, including its keyed recovery boundary.
const shell = await fs.readFile('src/layouts/AppShell.vue', 'utf8')
const template = shell.slice(shell.indexOf('<main :key="pageRevision"'), shell.indexOf('</main>', shell.indexOf('<main :key="pageRevision"')) + 7)
assert.ok(template.includes('ref="routeView"'))
const render = new Function('Vue', compileTemplate(template, { mode: 'function', prefixIdentifiers: true }).code)(vue)
let mounts = 0, unmounts = 0
const Home = { name: 'HomeView', setup() { mounts++; vue.onUnmounted(() => unmounts++); return () => h('div', { 'data-home-module': 'recentA' }, '首页') } }
const routes = [{ path: '/', component: Home }, { path: '/top', component: { render: () => h('section', '总榜') } }, { path: '/offline', component: { render: () => h('section', '离线') } }]
const router = () => createRouter({ history: createMemoryHistory(), routes })
let currentRouter
function root() {
  return { components: { RouterView, MemberTabs: { render: () => null } }, setup() {
    const pageHost = ref(null), routeView = ref(null)
    return { pageHost, routeView, pageRevision: useRouteDomBoundary(pageHost, routeView, () => currentRouter.currentRoute.value.fullPath), route: currentRouter.currentRoute,
      ssrAuthShell: false, isModernChat: false, immersive: false }
  }, render }
}
currentRouter = router(); await currentRouter.push('/')
const ssr = createSSRApp(root()); ssr.use(currentRouter)
document.querySelector('#app').innerHTML = await renderToString(ssr)
const warnings = []
const originalError = console.error
console.error = (...args) => warnings.push(args.join(' '))
currentRouter = router(); await currentRouter.push('/')
const app = createSSRApp(root()); app.use(currentRouter); app.mount('#app')
const tick = async () => { for (let i = 0; i < 6; i++) { await nextTick(); await new Promise(resolve => setImmediate(resolve)) } }
await tick()
console.error = originalError
assert.equal(warnings.length, 0)
assert.equal(document.querySelectorAll('main [data-home-module]').length, 1)
const initialMounts = mounts
await tick(); assert.equal(mounts, initialMounts)
console.log('PASS home DOM 3 real SSR hydration retains connected home DOM without an unnecessary remount')
const main = document.querySelector('main'), detached = main.querySelector('[data-home-module]')
main.replaceChildren()
assert.equal(detached.isConnected, false)
await tick()
assert.equal(main.isConnected, false)
assert.equal(document.querySelectorAll('main [data-home-module]').length, 1)
assert.equal(mounts, initialMounts + 1)
assert.equal(unmounts, 1)
console.log('PASS home DOM 4 observed failure reproduced: live route with empty main and detached home is rebuilt once into the connected document')
await currentRouter.push('/top'); await tick(); assert.equal(document.querySelector('main').textContent, '总榜')
await currentRouter.push('/offline'); await tick(); assert.equal(document.querySelector('main').textContent, '离线')
await currentRouter.push('/'); await tick(); assert.equal(document.querySelectorAll('main [data-home-module]').length, 1)
const beforeDispose = mounts
app.unmount(); await tick(); assert.equal(document.querySelector('#app').childNodes.length, 0); assert.equal(mounts, beforeDispose)
console.log('PASS home DOM 5 switching routes/offline/back preserves connected content; unmount disconnects recovery observer')
const entry = await fs.readFile('src/entry-client.ts', 'utf8')
assert.ok(entry.indexOf("app.mount('#app', true)") < entry.indexOf('useHomeLayoutStore(pinia).restore()'))
console.log('PASS home DOM 6 actual entry restores optional local layout only after hydration')
