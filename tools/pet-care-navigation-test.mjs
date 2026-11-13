import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'

// 使用实际 Vue 组件，时钟与服务端快照由夹具控制，不连接原测试服务或修改业务状态。
const dom = new JSDOM('<div id="app"></div>', { url: 'http://127.0.0.1/pets', pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'Event', 'MouseEvent']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] })
}
Object.defineProperty(document, 'hidden', { configurable: true, value: false })
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
const scrolled = []
HTMLElement.prototype.scrollIntoView = function () { scrolled.push(this) }
const { reactive, ref, computed, createApp, h, nextTick } = await import('vue')
let time = Date.UTC(2026, 10, 13, 12), serial = 0, context = 1, reads = 0, writes = 0
const originalNow = Date.now, originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout
const timers = new Map()
Date.now = () => time
globalThis.setTimeout = (fn, delay = 0) => { const id = ++serial; timers.set(id, { fn, at: time + Number(delay) }); return id }
globalThis.clearTimeout = id => { timers.delete(id) }
const flush = async () => { for (let index = 0; index < 10; index++) await nextTick() }
const advance = async amount => {
  time += amount
  for (let guard = 0; guard < 20; guard++) {
    const ready = [...timers].filter(([, timer]) => timer.at <= time)
    if (!ready.length) break
    for (const [id, timer] of ready) { timers.delete(id); timer.fn() }
    await flush()
    assert(guard < 19, '到期核对不能形成无界轮询')
  }
  await flush()
}
const pet = (extra = {}) => ({ id: 'pet-A', speciesId: 'hexiaotun', name: '荷小豚', hunger: 100, water: 100,
  mood: 80, energy: 80, experience: 10, level: 1, friendship: 2, adoptedAt: time, activity: null,
  skills: [], jobs: [], cooldowns: { pet: 0, play: 0 }, growthToday: { used: 0, limit: 10 }, ...extra })
const snapshot = extra => ({ serverNow: time, today: '2026-11-13', pet: pet(extra), wallet: { coins: 100 },
  dailySupply: { claimed: false, coins: 20, food: 2 }, stories: [], income: { earned: 0, limit: 60, remaining: 60 } })
const auth = reactive({ accessToken: 'token-a', account: { oId: 'A' }, isLoggedIn: true })
const route = reactive({ path: '/pets', hash: '', fullPath: '/pets' })
let refreshHandler = () => { pets.state = snapshot({ hunger: 99, water: 98 }); pets.receivedAt = time }
const pets = reactive({ state: snapshot(), catalog: { species: [], rules: {}, places: [], courses: [], jobs: [], skills: [] },
  receivedAt: time, loading: false, busy: false, pending: null, refreshNeeded: false, offline: false, catalogError: '', catalogLoading: false,
  get pet() { return this.state?.pet }, get coins() { return this.state?.wallet.coins }, foodQuantity: 6,
  refresh() { reads++; return Promise.resolve(refreshHandler()) }, ensureLoaded() {}, act() { writes++ }, claimActivity() { writes++ },
})
const history = reactive({ opened: false, close() { this.opened = false }, open() { this.opened = true } })
const display = reactive({ visible: true, restore() {} })
const RouterLink = { props: ['to'], setup(props, { slots, attrs }) { return () => h('a', { ...attrs, href: typeof props.to === 'string' ? props.to : props.to.path }, slots.default?.()) } }
const Stub = { render: () => h('div') }
globalThis.__petCareTest = {
  usePetsStore: () => pets, useAuthStore: () => auth, usePetDisplayStore: () => display, usePetActivityHistoryStore: () => history,
  getAuthContextVersion: () => context, useRoute: () => route, RouterLink, usePageSeo() {}, normalizePetName: value => value,
  petNameLength: value => value.length, formatDate: () => '2026-11-13', Stub,
  usePetAnimationState: () => ({ action: ref('idle'), loop: ref(true), playbackKey: ref('idle'), end() {} }),
}
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'fishpi-pet-care-navigation-'))
const stub = pathToFileURL(path.join(temporary, 'stubs.mjs')).href
await fs.writeFile(path.join(temporary, 'stubs.mjs'), 'export const { usePetsStore,useAuthStore,usePetDisplayStore,usePetActivityHistoryStore,getAuthContextVersion,useRoute,RouterLink,usePageSeo,normalizePetName,petNameLength,formatDate,usePetAnimationState }=globalThis.__petCareTest; export default globalThis.__petCareTest.Stub')
const components = new Set(['PetActions.vue', 'PetActivities.vue', 'PetHomeNavigation.vue', 'PetIcon.vue'])
const stubs = new Set(['@/api/http', '@/api/v3-pets', '@/stores/pets', '@/stores/auth', '@/stores/petDisplay', '@/stores/petActivityHistory', '@/composables/usePageSeo', '@/utils/time', 'vue-router'])
const compiled = new Map()
async function compileFile(file) {
  file = path.resolve(file)
  if (compiled.has(file)) return compiled.get(file)
  const target = path.join(temporary, `${compiled.size}.mjs`), url = pathToFileURL(target).href
  compiled.set(file, url)
  let source = await fs.readFile(file, 'utf8')
  if (file.endsWith('.vue')) source = compileScript(parse(source, { filename: file }).descriptor, { id: `care-test-${compiled.size}`, inlineTemplate: true }).content
  for (const match of [...source.matchAll(/from\s*(['"])([^'"]+)\1/g)]) {
    const specifier = match[2]
    let replacement
    if (stubs.has(specifier) || specifier.endsWith('usePetAnimationState') || specifier.endsWith('.vue') && !components.has(path.basename(specifier))) replacement = stub
    else if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      let dependency = specifier.startsWith('@/') ? path.resolve('src', specifier.slice(2)) : path.resolve(path.dirname(file), specifier)
      if (!path.extname(dependency)) dependency += '.ts'
      replacement = await compileFile(dependency)
    } else replacement = import.meta.resolve(specifier)
    source = source.replaceAll(match[0], `from '${replacement}'`)
  }
  await fs.writeFile(target, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
  return url
}
const { default: Actions } = await import(await compileFile('src/components/pets/PetActions.vue'))
const { default: Home } = await import(await compileFile('src/views/PetsView.vue'))
const { requestPetActivitiesNavigation } = await import(await compileFile('src/components/pets/petNavigation.ts'))
let app
function mount(component) { app = createApp(component); app.mount('#app') }
function unmount() { app?.unmount(); app = undefined; document.body.innerHTML = '<div id="app"></div>' }
const button = label => [...document.querySelectorAll('.pet-actions button')].find(node => node.querySelector('span')?.textContent === label)
const selectedSection = () => document.querySelector('[data-pet-section][aria-selected="true"]')?.dataset.petSection
function tab(name) { document.querySelector(`[data-pet-section="${name}"]`).click() }
try {
  const active = ref(true)
  pets.state = snapshot({ careAvailableAt: { feed: time + 2000, water: time + 1000 } })
  mount({ setup: () => () => h('div', [h(Actions, { active: active.value }), h(Actions, { compact: true, active: active.value })]) })
  await flush(); assert(button('喂食').disabled && button('饮水').disabled)
  await advance(999); assert.equal(reads, 0); assert.equal(pets.pet.hunger, 100, '不能客户端模拟衰减')
  await advance(1); assert.equal(reads, 1, '家园与桌宠只共用一次核验'); assert(!button('喂食').disabled && !button('饮水').disabled)
  button('喂食').click(); await flush(); assert.equal(writes, 1)
  await advance(60_000); assert.equal(reads, 1, '成功后不轮询')
  console.log('PASS 到期更新喂食饮水按钮，两个面板去重，只读服务端状态')
  pets.state = snapshot({ careAvailableAt: { feed: time, water: time } }); pets.receivedAt = time; await flush()
  assert(!button('喂食').disabled && !button('饮水').disabled, '向上取整100但服务端允许时仍可操作')
  active.value = false; pets.state = snapshot({ careAvailableAt: { feed: time + 1000, water: time + 1000 } }); pets.receivedAt = time
  await flush(); await advance(1000); assert.equal(reads, 1, '两个面板隐藏不读')
  active.value = true; await flush(); auth.accessToken = 'token-a-rotated'; await flush(); await advance(0); assert.equal(reads, 2)
  console.log('PASS 满值取整、面板可见性和普通令牌轮换')
  pets.state = snapshot({ careAvailableAt: { feed: time + 1000, water: time + 1000 } }); pets.receivedAt = time
  pets.pending = { key: 'uncertain' }; await flush(); await advance(1000); assert.equal(reads, 2, '未知写操作期间不抢读')
  pets.pending = null; pets.busy = true; await flush(); await advance(1000); assert.equal(reads, 2)
  pets.busy = false; Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  document.dispatchEvent(new Event('visibilitychange')); await flush(); await advance(1000); assert.equal(reads, 2)
  Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange'))
  await flush(); await advance(0); assert.equal(reads, 3, '恢复前台并解除写保护后只核验一次')
  pets.state = snapshot(); pets.receivedAt = time; await flush(); await advance(60000); assert.equal(reads, 3, '旧后端无时间字段时不猜阈值或循环请求')
  assert(button('喂食').disabled && button('饮水').disabled)
  console.log('PASS 未确认操作、忙碌、后台标签与旧后端可选字段')
  refreshHandler = () => { pets.refreshNeeded = true; pets.state = null }
  pets.state = snapshot({ careAvailableAt: { feed: time + 1000, water: time + 1000 } }); pets.receivedAt = time
  await flush(); await advance(1000); assert.equal(reads, 4); await advance(60000); assert.equal(reads, 4, '失败不循环重试')
  pets.refreshNeeded = false; pets.state = snapshot({ careAvailableAt: { feed: time + 1000, water: time + 1000 } }); pets.receivedAt = time
  await flush(); context++; auth.account = { oId: 'B' }; auth.accessToken = ''; auth.isLoggedIn = false; pets.state = null
  await flush(); await advance(1000); assert.equal(reads, 4, '旧身份计时器不继续读取')
  unmount(); assert.equal(timers.size, 0)
  console.log('PASS 弱网失败、换号和卸载清理')

  const rewards = { coins: 10, proficiency: 2, experience: 5, food: 0, mood: 0, skills: [], items: [] }
  const activity = kind => ({ id: 'activity', kind, name: '测试活动', status: 'claimable', startedAt: time - 5000, endsAt: time - 1000, rewards })
  for (const width of [1280, 375]) {
    window.innerWidth = width; route.hash = '#pet-activities'; route.fullPath = '/pets#pet-activities'; route.path = '/pets'
    auth.accessToken = ''; auth.isLoggedIn = false; pets.state = null; pets.refreshNeeded = false
    mount(Home); await flush(); assert.equal(document.querySelector('#pet-activities'), null)
    context++; auth.account = { oId: `owner-${width}` }; auth.accessToken = 'token'; auth.isLoggedIn = true; pets.loading = true
    await flush(); assert.equal(document.querySelector('#pet-activities'), null)
    pets.state = snapshot({ activity: activity('work') }); pets.loading = false; pets.receivedAt = time
    await flush(); assert.equal(selectedSection(), 'activities')
    assert.equal(document.querySelector('[data-pet-panel="activities"]').style.display, '')
    assert.equal(document.querySelector('#pet-work-tab').getAttribute('aria-selected'), 'true')
    assert.equal(document.activeElement.id, 'pet-activities-title'); assert(scrolled.at(-1)?.isConnected)
    assert.equal(writes, 1, '定位不自动领取或写入')
    tab('care'); await flush(); assert.equal(selectedSection(), 'care')
    requestPetActivitiesNavigation(new MouseEvent('click', { button: 0 })); await flush(); assert.equal(selectedSection(), 'activities')
    tab('shop'); await flush(); requestPetActivitiesNavigation(new MouseEvent('click', { button: 0, ctrlKey: true })); await flush(); assert.equal(selectedSection(), 'shop', '新标签页点击不劫持本页')
    route.hash = ''; route.fullPath = '/pets'; await flush(); route.hash = '#pet-activities'; route.fullPath = '/pets#pet-activities'; pets.pet.activity = activity('course')
    await flush(); assert.equal(selectedSection(), 'activities'); assert.equal(document.querySelector('#pet-course-tab').getAttribute('aria-selected'), 'true')
    tab('care'); route.hash = ''; await flush(); pets.loading = true; route.hash = '#pet-activities'; await flush()
    tab('stories'); await flush(); pets.loading = false; await flush(); assert.equal(selectedSection(), 'stories', '初次迟到读取不能覆盖手动选择')
    route.hash = ''; await flush(); route.hash = '#pet-activities'; route.path = '/games'; await flush(); assert.equal(selectedSection(), 'stories', '离页取消迟到导航')
    unmount()
    console.log(`PASS ${width}px 真实活动面板：异步身份、桌宠同hash、分类选择、手动切换和离页保护`)
  }
} finally {
  unmount(); Date.now = originalNow; globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout
  dom.window.close(); await fs.rm(temporary, { recursive: true, force: true }); delete globalThis.__petCareTest
}
