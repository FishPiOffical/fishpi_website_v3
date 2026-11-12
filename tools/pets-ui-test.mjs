import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'

// 使用真实 Vue 模板与 store，仅替换传输和浏览器几何；测试不会触碰真实账号或站点接口。
const dom = new JSDOM('<!doctype html><html><body><header data-site-navigation></header><div id="app"></div></body></html>', { url: 'http://127.0.0.1:5173/pets', pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'localStorage', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : dom.window[key] })
}
Object.defineProperty(document, 'hidden', { configurable: true, value: false })
window.matchMedia = query => ({ matches: /max-width: 640px/.test(query) && window.innerWidth <= 640, addEventListener() {}, removeEventListener() {} })
globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} }
globalThis.BroadcastChannel = class { postMessage() {} close() {} }
document.querySelector('header').getBoundingClientRect = () => ({ top: 0, bottom: 80, left: 0, right: window.innerWidth, width: window.innerWidth, height: 80 })
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return this.classList.contains('pet-desktop') ? this.classList.contains('collapsed') ? 56 : 144 : this.classList.contains('pet-desktop-panel') ? 296 : 0 } })
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return this.classList.contains('pet-desktop') ? this.classList.contains('collapsed') ? 84 : 184 : this.classList.contains('pet-desktop-panel') ? 240 : 0 } })
HTMLElement.prototype.setPointerCapture = function () {}
HTMLElement.prototype.releasePointerCapture = function () {}
HTMLElement.prototype.hasPointerCapture = function () { return false }
const vue = await import('vue')
const { createApp, h, nextTick, ref, reactive } = vue
const { createPinia, defineStore, setActivePinia } = await import('pinia')
const useAuthStore = defineStore('pet-ui-auth', () => ({ accessToken: ref('token-a'), account: ref({ oId: 'A' }), isLoggedIn: vue.computed(() => !!useAuthStore().accessToken) }))
const useLayoutStore = defineStore('pet-ui-layout', () => ({ immersive: ref(false) }))
class ApiError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code } }
let context = 1, serial = 0, handler
const calls = [], route = reactive({ path: '/pets' })
const RouterLink = { props: ['to'], setup(props, { slots }) { return () => h('a', { href: typeof props.to === 'string' ? props.to : props.to.path }, slots.default?.()) } }
globalThis.__petUITest = { ApiError, getAuthContextVersion: () => context, useAuthStore, useLayoutStore, RouterLink, useRoute: () => route,
  profileOperationKey: () => `pet-ui:${++serial}`, usePageSeo: () => {},
  request: (url, options) => { calls.push({ url, options }); return handler(url, options) } }
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'fishpi-pets-ui-'))
const compiled = new Map()
const stub = pathToFileURL(path.join(temporary, 'stubs.mjs')).href
await fs.writeFile(path.join(temporary, 'stubs.mjs'), 'export const { ApiError,getAuthContextVersion,useAuthStore,useLayoutStore,RouterLink,useRoute,profileOperationKey,usePageSeo,request }=globalThis.__petUITest')
const stubs = new Set(['@/api/http', '@/stores/auth', '@/stores/layout', '@/api/v3-profile', '@/composables/usePageSeo', 'vue-router'])
async function compileFile(file) {
  file = path.resolve(file)
  if (compiled.has(file)) return compiled.get(file)
  const target = path.join(temporary, `${compiled.size}.mjs`), url = pathToFileURL(target).href
  compiled.set(file, url)
  let source = await fs.readFile(file, 'utf8')
  if (file.endsWith('.vue')) source = compileScript(parse(source, { filename: file }).descriptor, { id: `pet-ui-${compiled.size}`, inlineTemplate: true }).content
  source = source.replaceAll('import.meta.env.SSR', 'false')
  for (const match of [...source.matchAll(/from\s*(['"])([^'"]+)\1/g)]) {
    const specifier = match[2]
    let replacement
    if (stubs.has(specifier) || (path.basename(file) === 'v3-pets.ts' && specifier === './http')) replacement = stub
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
const skillNames = { vitality: '体能', exploration: '探索', knowledge: '知识', expression: '表达', crafting: '手作', kindness: '亲和' }
const jobNames = { 'delivery-assistant': '配送见习', 'trail-assistant': '巡游向导', 'library-assistant': '图书助理', 'broadcast-assistant': '播报学徒', 'craft-assistant': '手作学徒', 'care-assistant': '照护见习' }
const entry = (id, name, durationMs, coins, skill) => ({ id, name, description: '本地测试活动', durationMs,
  cost: { coins, energy: 8, hunger: 4, water: 4 }, rewards: { coins: 0, proficiency: 0, experience: 5, food: 1, mood: 3, skills: [{ id: skill, experience: 7 }] } })
const catalog = { version: 1, activityVersion: 1, species: [
  { id: 'momota', name: '摸摸獭', description: '水边的小伙伴' }, { id: 'hexiaotun', name: '荷小豚', description: '戴荷叶帽的小伙伴' },
  { id: 'yubingmiao', name: '鱼饼喵', description: '好奇的小伙伴' }, { id: 'paixiaoyu', name: '派小鱼', description: '熟悉的小伙伴' },
], items: [{ id: 'food', name: '基础口粮', price: 5, hunger: 35 }],
  skills: Object.entries(skillNames).map(([id, name]) => ({ id, name, description: '本地测试技能' })),
  places: [entry('plaza', '广场散步', 300000, 0, 'vitality'), entry('river', '河岸探索', 900000, 3, 'exploration'), entry('forest', '林间远足', 1800000, 5, 'exploration')],
  courses: Object.entries(skillNames).map(([id, name]) => entry(`basic-${id}`, `${name}入门`, 600000, 5, id)),
  jobs: Object.entries(jobNames).map(([id, name], index) => ({ ...entry(id, name, 1200000, 0, Object.keys(skillNames)[index]),
    cost: { coins: 0, energy: 12, hunger: 4, water: 6 }, rewards: { coins: 12, proficiency: 10, experience: 15, food: 0, mood: 3, skills: [] },
    requirement: { skillId: Object.keys(skillNames)[index], experience: 10 } })),
  incomeRules: { dailyLimit: 60 },
  rules: { maxNameLength: 12, initialCoins: 100, initialFood: 6,
  dailyCoins: 20, dailyFood: 2, restDurationMs: 14400000, restEnergyPerHour: 20, growthDailyLimit: 10 } }
const now = Date.UTC(2026, 10, 12, 10)
const empty = () => ({ serverNow: now, today: '2026-11-12', catalogVersion: 1, wallet: { coins: 0 }, inventory: [],
  income: { date: '2026-11-12', earned: 0, limit: 60, remaining: 60 },
  dailySupply: { claimed: false, coins: 20, food: 2 }, pet: null })
const adopted = (id = 'pet-a', name = '我的小鱼', speciesId = 'momota') => ({ ...empty(), wallet: { coins: 100 }, inventory: [{ itemId: 'food', quantity: 6 }], pet: {
  id, name, speciesId, hunger: 90, water: 90, mood: 90, energy: 80, experience: 0, level: 1, friendship: 0, adoptedAt: now,
  activity: null, skills: Object.keys(skillNames).map(id => ({ id, level: 1, experience: 0 })),
  jobs: Object.keys(jobNames).map(id => ({ id, level: 1, experience: 0, completed: 0 })), cooldowns: { pet: 0, play: 0 }, growthToday: { used: 0, limit: 10 },
} })
let serverState = empty()
let historyRows = []
const response = data => ({ code: 0, data: structuredClone(data) })
const success = async (url, options) => {
  if (options?.method) {
    const body = JSON.parse(options.body), kind = url.split('/').at(-1)
    if (kind === 'adoption') serverState = adopted('pet-a', body.name, body.speciesId)
    if (kind === 'activities') {
      const choice = catalog[body.kind === 'outing' ? 'places' : body.kind === 'work' ? 'jobs' : 'courses'].find(item => item.id === body.entryId)
      serverState.pet.activity = { id: `activity-${serial}`, kind: body.kind, entryId: choice.id, name: choice.name, startedAt: now, endsAt: now + choice.durationMs, status: 'running', cost: choice.cost, rewards: choice.rewards }
      serverState.wallet.coins -= choice.cost.coins
      for (const key of ['energy', 'hunger', 'water']) serverState.pet[key] -= choice.cost[key]
      historyRows.unshift({ ...structuredClone(serverState.pet.activity), petId: serverState.pet.id, claimedAt: null, actualRewards: null })
      return response({ operation: 'activity-start', petId: serverState.pet.id, activityId: serverState.pet.activity.id, committedAt: now })
    }
    if (kind === 'claim') {
      const activity = serverState.pet.activity
      serverState.pet.experience += activity.rewards.experience
      serverState.inventory[0].quantity += activity.rewards.food
      for (const skill of activity.rewards.skills) serverState.pet.skills.find(value => value.id === skill.id).experience += skill.experience
      const actual = structuredClone(activity.rewards)
      actual.coins = Math.min(actual.coins, serverState.income.remaining)
      serverState.wallet.coins += actual.coins
      serverState.income.earned += actual.coins; serverState.income.remaining -= actual.coins
      if (activity.kind === 'work') {
        const job = serverState.pet.jobs.find(value => value.id === activity.entryId)
        job.experience += actual.proficiency; job.completed++
      }
      const record = historyRows.find(value => value.id === activity.id)
      if (record) { record.status = 'claimed'; record.claimedAt = now + activity.endsAt - activity.startedAt; record.actualRewards = actual }
      serverState.pet.activity = null
      return response({ operation: 'activity-claim', petId: serverState.pet.id, activityId: activity.id, committedAt: now })
    }
    if (kind === 'actions' && body.action === 'wake') serverState.pet.activity = null
    return response({ operation: kind === 'actions' ? body.action : kind === 'purchases' ? 'purchase' : kind, petId: serverState.pet?.id, committedAt: now })
  }
  if (url.startsWith('/api/v3/me/pet/activities?')) {
    const params = new URL(url, 'http://localhost').searchParams, kind = params.get('kind'), page = Number(params.get('p') || 1), size = Number(params.get('size') || 10)
    const historyNow = Math.max(now, ...historyRows.map(item => item.claimedAt ?? item.startedAt))
    const list = historyRows.filter(item => kind === 'all' || item.kind === kind).map(item => ({ ...item,
      status: item.status === 'claimed' ? 'claimed' : item.endsAt <= historyNow ? 'claimable' : 'running' }))
    return response({ serverNow: historyNow, list: list.slice((page - 1) * size, page * size), pagination: { page, pageSize: size, total: list.length, pageCount: Math.max(1, Math.ceil(list.length / size)) } })
  }
  return response(url.endsWith('/catalog') ? catalog : serverState)
}
handler = success
const writes = () => calls.filter(call => call.options?.method)
const settle = async () => { await nextTick(); await new Promise(resolve => setTimeout(resolve, 0)); await nextTick() }
const click = async element => { assert(element, '交互目标必须真实存在'); element.click(); await settle() }
const input = async (element, value) => { assert(element); element.value = value; element.dispatchEvent(new Event('input', { bubbles: true })); await settle() }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { resolve, reject, promise } }
let app
try {
  const viewModule = await import(await compileFile('src/views/PetsView.vue'))
  const desktopModule = await import(await compileFile('src/components/pets/PetDesktop.vue'))
  const petModule = await import(await compileFile('src/stores/pets.ts'))
  const displayModule = await import(await compileFile('src/stores/petDisplay.ts'))
  const pinia = createPinia(); setActivePinia(pinia)
  const auth = useAuthStore(), pets = petModule.usePetsStore(), display = displayModule.usePetDisplayStore()
  const showHome = ref(true)
  app = createApp({ render: () => h('div', [showHome.value ? h(viewModule.default) : null, h(desktopModule.default)]) })
  app.use(pinia).mount('#app'); await settle()
  assert.equal(document.querySelectorAll('.species-options input').length, 4)
  assert.equal(calls.length, 2, '家园和桌宠应合并初始化请求')
  const radios = document.querySelectorAll('.species-options input')
  await click(radios[0])
  assert.equal(document.querySelectorAll('.species-option.selected').length, 1)
  assert.equal(document.querySelector('.species-option.selected input').value, 'momota')
  await input(document.querySelector('#pet-adoption-name'), '我的小鱼')
  auth.accessToken = 'token-a-rotated'; await settle()
  assert.equal(document.querySelector('#pet-adoption-name').value, '我的小鱼')
  console.log('PASS 四选一真实表单，页面与桌宠合并初始化，普通令牌轮换保留草稿')

  const pendingWrite = deferred()
  handler = (url, options) => options?.method ? pendingWrite.promise : success(url, options)
  const form = document.querySelector('.adoption-form')
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await settle()
  assert.equal(pets.busy, true)
  assert.equal(document.querySelector('.pet-feedback.pending'), null, '进行中的正常请求不得显示未确认提示')
  assert.equal(document.querySelector('#pet-adoption-name').disabled, true)
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await settle()
  assert.equal(writes().length, 1)
  pendingWrite.reject(new Error('模拟断流')); await settle()
  assert.equal(document.querySelector('#pet-adoption-name').value, '我的小鱼')
  assert(document.querySelector('[aria-label="核对上次宠物操作"]'))
  const originalKey = pets.pending.key
  handler = success
  await click(document.querySelector('[aria-label="核对上次宠物操作"]'))
  assert.equal(writes().at(-1).options.headers['Idempotency-Key'], originalKey)
  assert.equal(pets.pet.name, '我的小鱼')
  assert.equal(document.querySelector('.species-options'), null)
  assert(document.querySelector('.pet-desktop'))
  console.log('PASS 领养双击仅一写，未知结果保留输入与原键，成功后家园和桌宠同步')

  await click(document.querySelector('[aria-label="修改宠物名字"]'))
  await input(document.querySelector('#pet-name'), '旧账号未存草稿')
  auth.accessToken = 'token-a-new'; await settle()
  assert.equal(document.querySelector('#pet-name').value, '旧账号未存草稿')
  serverState = empty(); context++; auth.account = { oId: 'B' }; auth.accessToken = 'token-b'; await settle()
  assert.equal(pets.pet, null)
  assert.equal(document.querySelector('#pet-name'), null)
  assert.equal(document.querySelector('#pet-adoption-name').value, '')
  assert.equal(document.querySelector('.pet-desktop'), null)
  assert.equal(document.body.textContent.includes('旧账号未存草稿'), false)
  console.log('PASS 改名草稿在轮换时保留，换号后清空旧名字、旧宠物和未确认操作')

  serverState = adopted('pet-b', '小伙伴'); await pets.refresh(); await settle()
  display.hide(); await settle(); assert.equal(document.querySelector('.pet-desktop'), null)
  display.show(); await settle(); assert(document.querySelector('.pet-desktop'))
  display.move(-9999, -9999); window.dispatchEvent(new Event('resize')); await settle()
  assert(display.position.x >= 8); assert(display.position.y >= 88)
  display.move(9999, 9999); window.dispatchEvent(new Event('resize')); await settle()
  assert(display.position.x <= window.innerWidth - 144 - 8)
  assert(display.position.y <= window.innerHeight - 184 - 12)
  await click(document.querySelector('[aria-label="收起桌宠"]'))
  assert(document.querySelector('.pet-desktop.collapsed'))
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 })
  window.dispatchEvent(new Event('resize')); await settle()
  assert(display.position.x >= 8 && display.position.x <= 296)
  assert(display.position.y >= 88 && display.position.y <= 544)
  const handle = document.querySelector('.pet-drag-handle'), before = display.position.x
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })); await settle()
  assert.equal(display.position.x, Math.max(8, before - 12))
  handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await settle()
  assert(display.position && display.position.x >= 8 && display.position.y >= 88)
  assert.equal(JSON.parse(localStorage.getItem('fishpi.pet.display.v1')).visible, true)
  console.log('PASS 桌宠隐藏恢复、收起展开、视口和导航边界、窄屏缩放、键盘移动及双击归位')

  const ownedState = adopted('pet-b', '小伙伴')
  ownedState.serverNow = now - 120000
  ownedState.pet.cooldowns.pet = now + 40000
  serverState = ownedState; await pets.refresh(); pets.receivedAt = Date.now() - 120000; await settle()
  const care = document.querySelector('.pet-actions button[title]')
  assert(care)
  const petAction = [...document.querySelectorAll('.pet-actions button')].find(button => button.textContent.includes('抚摸'))
  assert(/\d+ 秒后/.test(petAction.textContent), '倒计时必须基于共享状态接收时间，不从组件新挂载重新计时')
  console.log('PASS 缓存状态的冷却倒计时使用共享接收时间')

  serverState = adopted('pet-b', '小伙伴'); await pets.refresh(); await settle()
  const beforeTabs = calls.length
  assert.equal(document.querySelectorAll('.activity-option').length, 3)
  assert.equal(document.querySelectorAll('.pet-skill').length, 6)
  await click(document.querySelector('#pet-course-tab'))
  assert.equal(document.querySelectorAll('.activity-option').length, 6)
  document.querySelector('#pet-course-tab').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })); await settle()
  assert.equal(document.activeElement.id, 'pet-outing-tab')
  assert.equal(calls.length, beforeTabs, '活动目录切换应使用已读目录，不额外请求')
  console.log('PASS 三个地点、六门课程与六项真实技能，标签支持键盘切换且不新增读取')

  const startWait = deferred(), beforeStart = writes().length
  let startedRequest
  handler = (url, options) => { if (options?.method) { startedRequest = { url, options }; return startWait.promise } return success(url, options) }
  const startButton = document.querySelector('[aria-label="开始河岸探索"]')
  await click(startButton); await click(startButton)
  assert.equal(writes().length, beforeStart + 1)
  assert.equal(document.querySelector('.pet-feedback.pending'), null)
  startWait.resolve(await success(startedRequest.url, startedRequest.options)); await settle()
  handler = success
  assert.equal(pets.pet.activity.kind, 'outing')
  assert.equal(pets.coins, 97)
  assert.equal(pets.pet.energy, 72)
  assert.equal(document.querySelector('.desktop-sleep'), null, '外出不能被渲染为睡觉')
  assert(document.querySelector('.desktop-activity'))
  assert([...document.querySelectorAll('.care-panel .pet-actions button')].every(button => button.disabled))
  assert([...document.querySelectorAll('.activity-option button')].every(button => button.disabled))
  assert(!document.querySelector('.care-panel .pet-actions').textContent.includes('唤醒'))
  assert.equal(document.querySelector('.current-activity.claimable'), null)
  console.log('PASS 外出双击仅一写，消费由当前读取更新，活动占用时照顾与再次出发禁用')

  const beforeExpiry = calls.length, coinsBeforeExpiry = pets.coins, experienceBeforeExpiry = pets.pet.experience
  pets.receivedAt = Date.now() - 901000; await settle()
  assert(document.querySelector('.current-activity.claimable'))
  assert.equal(calls.length, beforeExpiry, '活动到期只更新倒计时，不触发逐秒读取或自动领奖')
  assert.equal(pets.coins, coinsBeforeExpiry)
  assert.equal(pets.pet.experience, experienceBeforeExpiry)
  assert([...document.querySelectorAll('.care-panel .pet-actions button')].every(button => button.disabled), '待领取也必须占用活动位置')
  const claimWait = deferred(), beforeClaim = writes().length
  let claimRequest
  handler = (url, options) => { if (options?.method) { claimRequest = { url, options }; return claimWait.promise } return success(url, options) }
  const claimButton = document.querySelector('.activity-primary')
  await click(claimButton); await click(claimButton)
  assert.equal(writes().length, beforeClaim + 1)
  claimWait.resolve(await success(claimRequest.url, claimRequest.options)); await settle(); handler = success
  assert.equal(pets.pet.activity, null)
  assert.equal(pets.pet.experience, 5)
  assert.equal(pets.pet.skills.find(skill => skill.id === 'exploration').experience, 7)
  assert.equal(document.querySelector('.current-activity'), null)
  assert(!document.querySelector('[aria-label="开始广场散步"]').disabled)
  console.log('PASS 到期不自动发奖或读取，显式领取去重并通过当前状态更新技能和成长')

  serverState.wallet.coins = 0; serverState.pet.energy = 0; await pets.refresh(); await settle()
  assert(document.querySelector('[aria-label="开始广场散步"]').disabled)
  assert(document.querySelector('[aria-label="开始广场散步"]').title.includes('精力不足'))
  await click(document.querySelector('#pet-course-tab'))
  assert([...document.querySelectorAll('.activity-option button')].every(button => button.disabled))
  assert(document.querySelector('.shortage').textContent.includes('宠物币不足'))
  serverState = adopted('pet-b', '小伙伴'); await pets.refresh(); await settle()
  handler = (url, options) => options?.method ? Promise.reject(new Error('模拟课程响应断流')) : success(url, options)
  await click(document.querySelector('[aria-label="开始知识入门"]'))
  assert.equal(pets.pending.kind, 'activities')
  const courseKey = pets.pending.key, originalCourse = JSON.parse(writes().at(-1).options.body)
  await click(document.querySelector('#pet-outing-tab'))
  auth.accessToken = 'token-b-next'; await settle()
  assert.equal(pets.pending.key, courseKey)
  handler = success
  await click(document.querySelector('[aria-label="核对上次宠物操作"]'))
  assert.equal(writes().at(-1).options.headers['Idempotency-Key'], courseKey)
  assert.deepEqual(JSON.parse(writes().at(-1).options.body), originalCourse)
  assert.equal(pets.pet.activity.kind, 'course')
  assert.equal(document.querySelector('.desktop-sleep'), null)
  assert(document.querySelector('.current-copy').textContent.includes('本次课程'))
  console.log('PASS 资源不足禁用开始，课程未知结果在切换标签和令牌轮换后仍恢复原命令')

  serverState.pet.activity.status = 'claimable'
  serverState.pet.activity.startedAt = now - 601000; serverState.pet.activity.endsAt = now - 1000
  await pets.refresh(); await settle()
  handler = (url, options) => url.endsWith('/catalog') ? Promise.reject(new ApiError('宠物目录暂不可用', 503)) : success(url, options)
  await pets.reloadCatalog(); await settle()
  assert.equal(pets.catalog, null)
  assert(document.querySelector('.current-activity.claimable'))
  assert(document.querySelector('.current-rewards').textContent.includes('知识 +7'))
  assert.equal(document.querySelectorAll('.pet-skill').length, 6)
  assert(!document.querySelector('.activity-primary').disabled)
  await click(document.querySelector('.activity-primary'))
  assert.equal(pets.pet.activity, null)
  assert.equal(pets.pet.skills.find(skill => skill.id === 'knowledge').experience, 7)
  console.log('PASS 目录读取失败保留当前活动快照、技能与领取入口，不依赖目录重读才领奖')

  handler = success; await pets.reloadCatalog()
  serverState = adopted('pet-b', '小伙伴'); serverState.serverNow = Date.UTC(2026, 10, 12, 15, 59, 59)
  serverState.income = { date: '2026-11-12', earned: 60, limit: 60, remaining: 0 }
  await pets.refresh(); await settle()
  const midnight = deferred(), beforeMidnight = calls.length
  handler = () => midnight.promise
  pets.receivedAt = Date.now() - 2000; await settle()
  assert.equal(calls.length, beforeMidnight + 1)
  assert.equal(pets.state.income.remaining, 0, '跨日不能本地清额度，必须等服务器状态')
  pets.receivedAt -= 2000; await settle()
  assert.equal(calls.length, beforeMidnight + 1, '跨日检查同一天只读一次')
  serverState = adopted('pet-b', '小伙伴'); serverState.serverNow = Date.UTC(2026, 10, 12, 16, 0, 5)
  serverState.today = serverState.income.date = '2026-11-13'
  midnight.resolve(response(serverState)); await settle()
  assert.equal(pets.state.income.remaining, 60)
  assert.equal(pets.state.today, '2026-11-13')
  handler = success
  console.log('PASS 跨日只核对一次服务端额度，不本地重置收入或连续补查')

  assert(!calls.some(call => call.url.startsWith('/api/v3/me/pet/activities?')), '日志默认收起，不随初始化或照顾动作请求')
  handler = success; await pets.reloadCatalog()
  serverState = adopted('pet-b', '小伙伴'); serverState.pet.skills.find(skill => skill.id === 'knowledge').experience = 10
  await pets.refresh(); await settle()
  await click(document.querySelector('#pet-work-tab'))
  assert.equal(document.querySelectorAll('.activity-option').length, 6)
  assert.equal(document.querySelectorAll('.pet-job').length, 6)
  assert.equal(document.querySelectorAll('.pet-skill').length, 6, '职业熟练度与技能必须各自展示')
  assert(document.querySelector('[aria-label="开始配送见习"]').disabled)
  assert(document.querySelector('[aria-label="开始配送见习"]').title.includes('体能经验 10'))
  assert(!document.querySelector('[aria-label="开始图书助理"]').disabled)
  serverState.income = { date: '2026-11-12', earned: 60, limit: 60, remaining: 0 }
  await pets.refresh(); await settle()
  assert(document.querySelector('[aria-label="开始图书助理"]').disabled)
  assert(document.querySelector('[aria-label="开始图书助理"]').title.includes('今日工作收入已达上限'))
  serverState.income = { date: '2026-11-12', earned: 55, limit: 60, remaining: 5 }
  await pets.refresh(); await settle()
  await click(document.querySelector('[aria-label="开始图书助理"]'))
  assert.equal(pets.pet.activity.kind, 'work')
  assert(document.querySelector('.current-copy').textContent.includes('本次工作'))
  assert(document.querySelector('.current-cap').textContent.includes('领取当天'))
  assert(document.querySelector('.desktop-activity[aria-label="工作中"]'))
  assert(!document.querySelector('.desktop-sleep'))
  assert.equal(pets.pet.jobs.find(job => job.id === 'library-assistant').experience, 0)
  console.log('PASS 六类兼职读取门槛和共享收入上限，职业熟练度独立，工作中不误显示睡眠')

  const historyCount = () => calls.filter(call => call.url.startsWith('/api/v3/me/pet/activities?')).length
  const beforeHistoryOpen = historyCount()
  await click(document.querySelector('.history-toggle'))
  assert.equal(historyCount(), beforeHistoryOpen + 1)
  assert(document.querySelector('.history-status.running'))
  assert(document.querySelector('.history-rewards').textContent.includes('预计收获'))
  assert(!document.querySelector('.history-rewards').classList.contains('actual'))
  assert(document.querySelector('.history-times').textContent.includes('2026-11-12'))
  serverState.serverNow = serverState.pet.activity.endsAt; serverState.pet.activity.status = 'claimable'
  await pets.refresh(); await settle()
  const beforeWorkClaim = writes().length
  await click(document.querySelector('.activity-primary'))
  assert.equal(writes().length, beforeWorkClaim + 1)
  assert.equal(pets.coins, 105, '共享收入余量只有5币时，不得用计划12币冒充实际到账')
  assert.equal(pets.pet.jobs.find(job => job.id === 'library-assistant').experience, 10)
  assert.equal(pets.pet.jobs.find(job => job.id === 'library-assistant').completed, 1)
  assert.equal(pets.pet.skills.find(skill => skill.id === 'knowledge').experience, 10)
  assert(document.querySelector('.history-rewards.actual').textContent.includes('宠物币 +5'))
  assert(!document.querySelector('.history-rewards.actual').textContent.includes('宠物币 +12'))
  console.log('PASS 日志展开才读，工作领取后同步实际成果和履历，不以计划薪酬覆盖共享上限结算')

  const historyFilter = label => [...document.querySelectorAll('.history-filters button')].find(button => button.textContent === label)
  await click(historyFilter('工作履历'))
  assert.equal(document.querySelectorAll('.history-item').length, 1)
  assert(document.querySelector('.history-record h3').textContent.includes('图书助理'))
  assert(calls.at(-1).url.includes('kind=work'))
  const historical = structuredClone(historyRows[0])
  historyRows = Array.from({ length: 11 }, (_, index) => ({ ...structuredClone(historical), id: `history-${index}`, name: `工作记录${index}`, actualRewards: index === 0 ? null : { ...historical.actualRewards, coins: index === 1 ? 0 : historical.actualRewards.coins, mood: 1.25 } }))
  await click(document.querySelector('[aria-label="刷新活动记录"]'))
  assert.equal(document.querySelectorAll('.history-item').length, 10)
  assert(document.querySelector('.history-old').textContent.includes('早期记录未保存成果明细'))
  assert(document.querySelectorAll('.history-rewards.actual')[0].textContent.includes('心情 +1.25'))
  assert(document.querySelectorAll('.history-rewards.actual')[0].textContent.includes('宠物币 +0（当日额度已用完）'))
  const nextPage = [...document.querySelectorAll('.history-pagination button')].find(button => button.textContent === '下一页')
  await click(nextPage)
  assert.equal(document.querySelectorAll('.history-item').length, 1)
  assert(document.querySelector('.history-pagination').textContent.includes('第 2 / 2 页'))
  assert(document.querySelector('.history-record h3').textContent.includes('工作记录10'))
  console.log('PASS 工作筛选就是履历，使用真实分页，早期缺成果记录不伪造收益，实际心情保留小数')

  handler = (url, options) => url.startsWith('/api/v3/me/pet/activities?') ? Promise.reject(new ApiError('HTTP JSON 解码失败', 502)) : success(url, options)
  await click(historyFilter('全部'))
  assert(document.querySelector('.history-error').textContent.includes('活动记录暂时无法读取'))
  assert(!document.querySelector('.history-empty'))
  assert(!document.querySelector('.history-error').textContent.includes('JSON'))
  handler = success
  await click(document.querySelector('[aria-label="重新读取活动记录"]'))
  assert(document.querySelector('.history-item'))
  const lateHistory = deferred()
  handler = (url, options) => url.includes('kind=outing') ? lateHistory.promise : success(url, options)
  await click(historyFilter('外出'))
  await click(historyFilter('学校'))
  lateHistory.resolve(response({ serverNow: now, list: [], pagination: { page: 1, pageSize: 10, total: 0, pageCount: 1 } })); await settle()
  assert.equal(historyFilter('学校').getAttribute('aria-pressed'), 'true')
  assert(document.querySelector('.history-empty').textContent.includes('课程记录'))
  handler = success
  showHome.value = false; await settle()
  const afterLeavingHome = historyCount()
  await pets.refresh(); await settle()
  assert.equal(historyCount(), afterLeavingHome, '离开家园后桌宠状态变化不应继续读日志')
  showHome.value = true; await settle()
  assert.equal(document.querySelector('.history-toggle').getAttribute('aria-expanded'), 'false')
  assert.equal(historyCount(), afterLeavingHome)
  await click(document.querySelector('.history-toggle'))
  assert.equal(historyCount(), afterLeavingHome + 1)
  console.log('PASS 离开家园关闭日志读取，返回后保持折叠，重新展开才读取')
  serverState = empty(); context++; auth.account = { oId: 'C' }; auth.accessToken = 'token-c'; await settle()
  assert.equal(document.querySelector('.pet-history'), null)
  assert(!document.body.textContent.includes('工作记录'))
  console.log('PASS 日志失败与空结果分离，技术错误友好展示，快速筛选和换号不回写旧记录')
} finally {
  app?.unmount()
  await fs.rm(temporary, { recursive: true, force: true })
  dom.window.close()
}
