import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'

// 与数据专项使用相同的可复现种子接口，每轮只替换夹具数值，不改真实组件。
const options = new Map(process.argv.slice(2).map(argument => {
  const match = /^--(seed|cases)=(\d+)$/.exec(argument)
  if (!match) throw new Error(`不支持的测试参数：${argument}；使用 --seed=整数 --cases=整数`)
  return [match[1], match[2]]
}))
const seed = Number(options.get('seed') ?? process.env.PET_TEST_SEED ?? 20261113)
const randomCases = Number(options.get('cases') ?? process.env.PET_TEST_CASES ?? 32)
assert(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'seed 必须为 uint32')
assert(Number.isInteger(randomCases) && randomCases >= 1 && randomCases <= 2000, 'cases 必须为 1～2000')
let randomState = seed
const random = maximum => {
  randomState = (randomState + 0x6d2b79f5) >>> 0
  let value = Math.imul(randomState ^ randomState >>> 15, 1 | randomState)
  value ^= value + Math.imul(value ^ value >>> 7, 61 | value)
  return Math.floor(((value ^ value >>> 14) >>> 0) / 0x100000000 * maximum)
}
console.log(`SEED pets-ui seed=${seed} cases=${randomCases}`)

// 使用真实 Vue 模板与 store，仅替换传输和浏览器几何；测试不会触碰真实账号或站点接口。
const dom = new JSDOM('<!doctype html><html><body><header data-site-navigation></header><div id="app"></div></body></html>', { url: 'http://127.0.0.1:5173/pets', pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'localStorage', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'getComputedStyle']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : dom.window[key] })
}
Object.defineProperty(document, 'hidden', { configurable: true, value: false })
window.matchMedia = query => ({ matches: /max-width: 640px/.test(query) && window.innerWidth <= 640, addEventListener() {}, removeEventListener() {} })
globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} }
globalThis.BroadcastChannel = class { postMessage() {} close() {} }
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0)
globalThis.cancelAnimationFrame = clearTimeout
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
  requirements: [], cost: { coins, energy: 8, hunger: 4, water: 4 }, rewards: { coins: 0, proficiency: 0, experience: 5, food: 1, mood: 3, items: [], skills: [{ id: skill, experience: 7 }] } })
const catalog = { version: 3, activityVersion: 4, species: [
  { id: 'momota', name: '摸摸獭', description: '水边的小伙伴' }, { id: 'hexiaotun', name: '荷小豚', description: '戴荷叶帽的小伙伴' },
  { id: 'yubingmiao', name: '鱼饼喵', description: '好奇的小伙伴' }, { id: 'paixiaoyu', name: '派小鱼', description: '熟悉的小伙伴' },
], items: [
  { id: 'food', name: '基础口粮', description: '日常口粮', category: 'food', price: 5, hunger: 35, effects: { hunger: 35, water: 0, mood: 0, energy: 0 } },
  { id: 'fruit', name: '鲜果', description: '香甜的鲜果', category: 'food', price: 6, hunger: 20, effects: { hunger: 20, water: 0, mood: 8, energy: 0 } },
  { id: 'spring-water', name: '清泉饮', description: '清凉补水', category: 'drink', price: 5, hunger: 0, effects: { hunger: 0, water: 35, mood: 0, energy: 5 } },
  ...[['reed', '芦苇', 6], ['forest-seed', '森林种子', null], ['sea-shell', '海贝', null]].map(([id, name, price]) => ({ id, name, description: '制作收藏的材料', category: 'material', price, hunger: 0, effects: { hunger: 0, water: 0, mood: 0, energy: 0 } })),
], recipes: [
  { id: 'reed-boat', name: '芦苇小舟', description: '把旅行的收获带回家', requirements: [{ skillId: 'exploration', experience: 10 }], ingredients: [{ itemId: 'reed', quantity: 2 }], coins: 2, collectionId: 'reed-boat' },
  { id: 'forest-chime', name: '森林风铃', description: '风吹过森林的声音', requirements: [{ skillId: 'vitality', experience: 10 }], ingredients: [{ itemId: 'forest-seed', quantity: 2 }], coins: 2, collectionId: 'forest-chime' },
  { id: 'shell-frame', name: '贝壳相框', description: '来自海边的纪念', requirements: [{ skillId: 'knowledge', experience: 10 }], ingredients: [{ itemId: 'sea-shell', quantity: 2 }], coins: 2, collectionId: 'shell-frame' },
], collections: [
  { id: 'reed-boat', name: '芦苇小舟', description: '把旅行的收获带回家' },
  { id: 'forest-chime', name: '森林风铃', description: '风吹过森林的声音' },
  { id: 'shell-frame', name: '贝壳相框', description: '来自海边的纪念' },
],
  stories: [
    { id: 'care-companion', name: '陪伴的日常', description: '从一顿饭、一杯水和一次玩耍，认识彼此。',
      steps: [{ id: 'feed', description: '给宠物喂一次食物' }, { id: 'water', description: '给宠物饮水一次' }, { id: 'play', description: '陪宠物玩耍一次' }], rewards: { items: [{ itemId: 'food', quantity: 2 }] } },
    { id: 'pond-keepsake', name: '荷塘见闻', description: '从观察课堂走向荷塘，再把发现带回课堂。',
      steps: [{ id: 'nature-class', description: '完成并领取自然观察课' }, { id: 'lotus-trip', description: '完成并领取荷塘采集' }, { id: 'nature-research', description: '完成并领取自然研究课' }], rewards: { items: [{ itemId: 'fruit', quantity: 2 }, { itemId: 'reed', quantity: 2 }] } },
    { id: 'first-career', name: '第一次小小工作', description: '学一点本领，试一次工作，再继续进修。',
      steps: [{ id: 'first-class', description: '完成并领取任意一门课程' }, { id: 'first-work', description: '完成并领取任意见习工作' }, { id: 'advanced-class', description: '完成并领取任意一门进阶课程' }], rewards: { items: [{ itemId: 'spring-water', quantity: 2 }, { itemId: 'sea-shell', quantity: 2 }] } },
  ], readoptionRules: { coins: 512 },
  skills: Object.entries(skillNames).map(([id, name]) => ({ id, name, description: '本地测试技能' })),
  places: [entry('plaza', '广场散步', 300000, 0, 'vitality'), entry('river', '河岸探索', 900000, 3, 'exploration'), entry('forest', '林间远足', 1800000, 5, 'exploration'),
    ...[['lotus-pond', '荷塘采集', 'exploration', 'reed'], ['deep-forest', '森林寻种', 'vitality', 'forest-seed'], ['tidal-flat', '潮汐拾贝', 'knowledge', 'sea-shell']].map(([id, name, skill, itemId]) => ({
      ...entry(id, name, 1200000, 5, skill), requirements: [{ skillId: skill, experience: 10 }], rewards: { coins: 0, proficiency: 0, experience: 25, food: 0, mood: 6, skills: [{ id: skill, experience: 8 }], items: [{ itemId, quantity: 2 }] },
    })),
  ],
  courses: [...Object.entries(skillNames).map(([id, name]) => entry(`basic-${id}`, `${name}入门`, 600000, 5, id)),
    ...[['fitness-advanced', '体能训练课', 'vitality'], ['nature-advanced', '自然研究课', 'exploration'], ['reading-advanced', '阅读研习课', 'knowledge'], ['expression-advanced', '表达进阶课', 'expression'], ['craft-advanced', '创作进阶课', 'crafting'], ['manners-advanced', '伙伴协作课', 'kindness']].map(([id, name, skill]) => ({ ...entry(id, name, 1800000, 10, skill), requirements: [{ skillId: skill, experience: 20 }] }))],
  jobs: Object.entries(jobNames).map(([id, name], index) => ({ ...entry(id, name, 1200000, 0, Object.keys(skillNames)[index]),
    cost: { coins: 0, energy: 12, hunger: 4, water: 6 }, rewards: { coins: 12, proficiency: 10, experience: 15, food: 0, mood: 3, skills: [], items: [] },
    requirement: { skillId: Object.keys(skillNames)[index], experience: 10 }, requirements: [{ skillId: Object.keys(skillNames)[index], experience: 10 }] })),
  incomeRules: { dailyLimit: 60 },
  growthRules: { experiencePerLevel: 100, maxLevel: 30, careExperience: 10, careFriendship: 2 },
  rules: { maxNameLength: 12, initialCoins: 100, initialFood: 6,
  dailyCoins: 20, dailyFood: 2, restDurationMs: 14400000, restEnergyPerHour: 20, growthDailyLimit: 10 } }
const now = Date.UTC(2026, 10, 12, 10)
const empty = () => ({ serverNow: now, today: '2026-11-12', catalogVersion: 3, wallet: { coins: 0 }, inventory: [], collections: [],
  stories: catalog.stories.map(story => ({ id: story.id, completedSteps: 0, status: 'active', completedAt: null, claimedAt: null })),
  income: { date: '2026-11-12', earned: 0, limit: 60, remaining: 60 },
  dailySupply: { claimed: false, coins: 20, food: 2 }, pet: null })
const adopted = (id = 'pet-a', name = '我的小鱼', speciesId = 'momota') => ({ ...empty(), wallet: { coins: 100 }, inventory: [{ itemId: 'food', quantity: 6 }], pet: {
  id, name, speciesId, hunger: 90, water: 90, mood: 90, energy: 80, experience: 0, level: 1, friendship: 0, adoptedAt: now,
  activity: null, skills: Object.keys(skillNames).map(id => ({ id, level: 1, experience: 0 })),
  jobs: Object.keys(jobNames).map(id => ({ id, level: 1, experience: 0, completed: 0 })), cooldowns: { pet: 0, play: 0 }, growthToday: { used: 0, limit: 10 },
} })
let serverState = empty()
let historyRows = [], journalSerial = 0
function changeInventory(itemId, quantity) {
  const item = serverState.inventory.find(item => item.itemId === itemId)
  if (item) item.quantity += quantity
  else serverState.inventory.push({ itemId, quantity })
}
function journalEvent(kind, action, name, changes = {}) {
  historyRows.unshift({ recordType: 'event', id: `event-${++journalSerial}`, petId: serverState.pet.id, kind, action, name, occurredAt: now,
    itemChanges: [], coinsDelta: 0, effects: { hunger: 0, water: 0, mood: 0, energy: 0, experience: 0, friendship: 0 }, collectionId: null, ...changes })
}
const response = data => ({ code: 0, data: structuredClone(data) })
const success = async (url, options) => {
  if (options?.method) {
    const body = JSON.parse(options.body), kind = url.split('/').at(-1)
    if (kind === 'adoption') serverState = adopted('pet-a', body.name, body.speciesId)
    if (url.endsWith('/stories/claim')) {
      const story = catalog.stories.find(story => story.id === body.storyId), progress = serverState.stories.find(story => story.id === body.storyId)
      assert.equal(progress.status, 'claimable')
      progress.status = 'claimed'; progress.claimedAt = now
      for (const item of story.rewards.items) changeInventory(item.itemId, item.quantity)
      journalEvent('story', 'story-claim', `完成${story.name}`, { itemChanges: structuredClone(story.rewards.items) })
      return response({ operation: 'story-claim', storyId: story.id, petId: serverState.pet.id, committedAt: now })
    }
    if (kind === 'readoption') {
      assert.equal(body.resetAccepted, true)
      const previous = serverState.pet
      serverState.pet = adopted(`pet-replaced-${serial}`, body.name, body.speciesId).pet
      serverState.pet.cooldowns = previous.cooldowns; serverState.pet.growthToday = previous.growthToday
      serverState.wallet.coins -= catalog.readoptionRules.coins
      journalEvent('readoption', 'readoption', `重新领养${body.name}`, { coinsDelta: -catalog.readoptionRules.coins })
      return response({ operation: 'readoption', petId: serverState.pet.id, previousPetId: previous.id, committedAt: now })
    }
    if (kind === 'activities') {
      const choice = catalog[body.kind === 'outing' ? 'places' : body.kind === 'work' ? 'jobs' : 'courses'].find(item => item.id === body.entryId)
      serverState.pet.activity = { id: `activity-${serial}`, kind: body.kind, entryId: choice.id, name: choice.name, startedAt: now, endsAt: now + choice.durationMs, status: 'running', cost: choice.cost, rewards: choice.rewards }
      serverState.wallet.coins -= choice.cost.coins
      for (const key of ['energy', 'hunger', 'water']) serverState.pet[key] -= choice.cost[key]
      historyRows.unshift({ recordType: 'activity', ...structuredClone(serverState.pet.activity), petId: serverState.pet.id, claimedAt: null, actualRewards: null })
      return response({ operation: 'activity-start', petId: serverState.pet.id, activityId: serverState.pet.activity.id, committedAt: now })
    }
    if (kind === 'claim') {
      const activity = serverState.pet.activity
      serverState.pet.experience += activity.rewards.experience
      serverState.inventory[0].quantity += activity.rewards.food
      for (const skill of activity.rewards.skills) serverState.pet.skills.find(value => value.id === skill.id).experience += skill.experience
      for (const reward of activity.rewards.items) changeInventory(reward.itemId, reward.quantity)
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
    if (kind === 'purchases') {
      const item = catalog.items.find(item => item.id === body.itemId)
      const coinsDelta = -item.price * body.quantity
      serverState.wallet.coins += coinsDelta; changeInventory(item.id, body.quantity)
      journalEvent('purchase', 'purchase', `购买${item.name}`, { coinsDelta, itemChanges: [{ itemId: item.id, quantity: body.quantity }] })
    }
    if (kind === 'crafts') {
      const recipe = catalog.recipes.find(item => item.id === body.recipeId)
      serverState.wallet.coins -= recipe.coins
      for (const item of recipe.ingredients) changeInventory(item.itemId, -item.quantity)
      serverState.collections.push({ id: recipe.collectionId, unlockedAt: now })
      journalEvent('craft', 'craft', `制作${recipe.name}`, { coinsDelta: -recipe.coins, itemChanges: recipe.ingredients.map(item => ({ ...item, quantity: -item.quantity })), collectionId: recipe.collectionId })
    }
    if (kind === 'actions') {
      const effects = { hunger: 0, water: 0, mood: 0, energy: 0, experience: 0, friendship: 0 }
      const item = catalog.items.find(item => item.id === body.itemId)
      if (item) {
        changeInventory(item.id, -1)
        for (const [key, value] of Object.entries(item.effects)) { const before = serverState.pet[key]; serverState.pet[key] = Math.min(100, before + value); effects[key] = serverState.pet[key] - before }
      }
      if (body.action === 'wake') serverState.pet.activity = null
      journalEvent('care', body.action, ({ feed: '喂食', water: '饮水', pet: '抚摸', play: '玩耍', rest: '休息', wake: '唤醒' })[body.action], { effects, itemChanges: item ? [{ itemId: item.id, quantity: -1 }] : [] })
    }
    return response({ operation: kind === 'actions' ? body.action : kind === 'purchases' ? 'purchase' : kind === 'crafts' ? 'craft' : kind, petId: serverState.pet?.id, committedAt: now })
  }
  if (url.startsWith('/api/v3/me/pet/journal?')) {
    const params = new URL(url, 'http://localhost').searchParams, kind = params.get('kind'), page = Number(params.get('p') || 1), size = Number(params.get('size') || 10)
    const historyNow = Math.max(now, ...historyRows.map(item => item.recordType === 'event' ? item.occurredAt : item.claimedAt ?? item.startedAt))
    const list = historyRows.filter(item => kind === 'all' || item.kind === kind).map(item => item.recordType === 'event' ? item : ({ ...item,
      status: item.status === 'claimed' ? 'claimed' : item.endsAt <= historyNow ? 'claimable' : 'running' }))
    return response({ serverNow: historyNow, list: list.slice((page - 1) * size, page * size), pagination: { page, pageSize: size, total: list.length, pageCount: Math.max(1, Math.ceil(list.length / size)) } })
  }
  return response(url.endsWith('/catalog') ? catalog : serverState)
}
handler = success
const writes = () => calls.filter(call => call.options?.method)
const settle = async () => { await nextTick(); await new Promise(resolve => setTimeout(resolve, 0)); await nextTick(); await new Promise(resolve => setTimeout(resolve, 0)); await nextTick() }
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
  const desktopPosition = () => ({ x: Number.parseFloat(document.querySelector('.pet-desktop').style.left), y: Number.parseFloat(document.querySelector('.pet-desktop').style.top) })
  display.move(-9999, -9999); window.dispatchEvent(new Event('resize')); await settle()
  assert(desktopPosition().x >= 8); assert(desktopPosition().y >= 88)
  assert.deepEqual(display.position, { x: -9999, y: -9999 })
  display.move(9999, 9999); window.dispatchEvent(new Event('resize')); await settle()
  assert(desktopPosition().x <= window.innerWidth - 144 - 8)
  assert(desktopPosition().y <= window.innerHeight - 184 - 12)
  assert.deepEqual(display.position, { x: 9999, y: 9999 })
  await click(document.querySelector('[aria-label="收起桌宠"]'))
  assert(document.querySelector('.pet-desktop.collapsed'))
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 })
  window.dispatchEvent(new Event('resize')); await settle()
  assert(desktopPosition().x >= 8 && desktopPosition().x <= 304)
  assert(desktopPosition().y >= 88 && desktopPosition().y <= 580)
  const handle = document.querySelector('.pet-drag-handle'), before = desktopPosition().x
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })); await settle()
  assert.equal(display.position.x, Math.max(8, before - 12))
  handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await settle()
  assert.equal(display.position, null, '归位清除用户偏好，临时视口位置不写回存储')
  assert(desktopPosition().x >= 8 && desktopPosition().y >= 88)
  assert.equal(JSON.parse(localStorage.getItem('fishpi.pet.display.v1')).visible, true)
  console.log('PASS 桌宠隐藏恢复、收起展开、视口和导航边界、窄屏缩放、键盘移动及双击归位')

  serverState.pet.level = 2; serverState.pet.experience = 140
  await pets.refresh(); await settle()
  assert.equal(document.querySelector('[aria-label="宠物升级进度"]').getAttribute('aria-valuenow'), '40')
  assert(document.querySelector('.growth-summary').textContent.includes('再获得 60 经验，升到 Lv. 3'))
  serverState.pet.level = 30; serverState.pet.experience = 3000
  await pets.refresh(); await settle()
  assert.equal(document.querySelector('[aria-label="宠物升级进度"]').getAttribute('aria-valuenow'), '100')
  assert(document.querySelector('.growth-summary').textContent.includes('已达到当前最高等级'))
  const originalGrowthRules = catalog.growthRules; delete catalog.growthRules
  await pets.reloadCatalog(); await settle()
  assert.equal(document.querySelector('[aria-label="宠物升级进度"]'), null)
  assert(document.querySelector('.growth-summary').textContent.includes('累计经验 3000'))
  catalog.growthRules = originalGrowthRules; await pets.reloadCatalog(); await settle()
  console.log('PASS 成长进度使用真实目录规则，封顶明确展示，旧目录缺字段保留累计值且不伪造进度')

  const growthWriteCount = writes().length
  for (let index = 0; index < randomCases; index++) {
    try {
      const unit = [1, 7, 100, 256][random(4)], maximum = [1, 2, 10, 30][random(4)]
      const experience = [0, unit - 1, unit, (maximum - 1) * unit, maximum * unit + random(1000), random(maximum * unit + 1)][index % 6]
      catalog.growthRules = { ...originalGrowthRules, experiencePerLevel: unit, maxLevel: maximum }
      serverState.pet.experience = experience
      serverState.pet.level = Math.min(maximum, 1 + Math.floor(experience / unit))
      serverState.pet.friendship = random(101)
      await pets.reloadCatalog(); await pets.refresh(); await settle()
      const complete = serverState.pet.level === maximum
      const remaining = unit - experience % unit
      const bar = document.querySelector('[aria-label="宠物升级进度"]')
      assert(bar)
      assert.equal(Number(bar.getAttribute('aria-valuenow')), complete ? 100 : Math.round((unit - remaining) / unit * 100))
      const summary = document.querySelector('.growth-summary').textContent
      assert(summary.includes(`累计经验 ${experience}`))
      assert(summary.includes(`亲密度 ${serverState.pet.friendship}`))
      assert(summary.includes(complete ? '已达到当前最高等级' : `再获得 ${remaining} 经验，升到 Lv. ${serverState.pet.level + 1}`))
      if (index % 4 === 0) {
        delete catalog.growthRules; await pets.reloadCatalog(); await settle()
        assert.equal(document.querySelector('[aria-label="宠物升级进度"]'), null)
        assert(!document.querySelector('.growth-summary').textContent.includes('再获得'))
        assert(document.querySelector('.growth-summary').textContent.includes(`累计经验 ${experience}`))
      }
      assert.equal(writes().length, growthWriteCount, '成长展示和规则切换不能发写请求')
    } catch (error) {
      error.message = `seed=${seed} growth-case=${index}: ${error.message}`
      throw error
    }
  }
  catalog.growthRules = originalGrowthRules; await pets.reloadCatalog(); await settle()
  console.log(`PASS 随机真实Vue成长边界：不同等级步长、零值、整级、封顶、亲密度和缺失规则（${randomCases}例，seed=${seed}）`)

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
  assert.equal(document.querySelectorAll('.activity-option').length, 6)
  assert.equal(document.querySelectorAll('.activity-group-heading').length, 2)
  assert.equal(document.querySelectorAll('.pet-skill').length, 6)
  await click(document.querySelector('#pet-course-tab'))
  assert.equal(document.querySelectorAll('.activity-option').length, 12)
  assert.equal(document.querySelectorAll('.activity-group-heading').length, 2)
  document.querySelector('#pet-course-tab').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })); await settle()
  assert.equal(document.activeElement.id, 'pet-outing-tab')
  assert.equal(calls.length, beforeTabs, '活动目录切换应使用已读目录，不额外请求')
  console.log('PASS 日常与进阶地点、十二门课程按门槛分组，标签支持键盘切换且不新增读取')

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

  assert(!calls.some(call => call.url.startsWith('/api/v3/me/pet/journal?')), '日志默认收起，不随初始化或照顾动作请求')
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

  const historyCount = () => calls.filter(call => call.url.startsWith('/api/v3/me/pet/journal?')).length
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
  await new Promise(resolve => setTimeout(resolve, 1050)); await settle()
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

  handler = (url, options) => url.startsWith('/api/v3/me/pet/journal?') ? Promise.reject(new ApiError('HTTP JSON 解码失败', 502)) : success(url, options)
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
  assert(document.querySelector('.history-empty').textContent.includes('学校记录'))
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
  await click(document.querySelector('.history-toggle'))
  serverState = adopted('pet-b', '小伙伴'); historyRows = []
  await pets.refresh(); await settle()
  await click(document.querySelector('#pet-outing-tab'))
  assert.equal(document.querySelectorAll('.activity-group-heading').length, 2)
  assert(document.querySelector('[aria-label="开始荷塘采集"]').disabled)
  assert(document.querySelector('[aria-label="开始荷塘采集"]').title.includes('探索经验 10'))
  for (const skill of serverState.pet.skills) skill.experience = 10
  await pets.refresh(); await settle()
  assert(!document.querySelector('[aria-label="开始荷塘采集"]').disabled)
  assert(document.querySelector('[aria-label="开始荷塘采集"]').closest('article').textContent.includes('芦苇 +2'))
  const journalBeforeExplore = historyCount()
  await click(document.querySelector('[aria-label="开始荷塘采集"]'))
  assert(document.querySelector('.current-rewards').textContent.includes('芦苇 +2'))
  assert(document.querySelector('[aria-label="制作芦苇小舟"]').disabled)
  serverState.serverNow = serverState.pet.activity.endsAt; serverState.pet.activity.status = 'claimable'
  await pets.refresh(); await settle(); await click(document.querySelector('.activity-primary'))
  assert(document.querySelector('.material-chip.available').textContent.includes('芦苇2'))
  assert(!document.querySelector('[aria-label="制作芦苇小舟"]').disabled)
  assert.equal(historyCount(), journalBeforeExplore, '关闭日志时进阶探索和领取不能额外读取日志')
  console.log('PASS 进阶探索按真实技能解锁，材料随显式领取入背包，占用活动时不能制作')

  handler = (url, options) => options?.method && url.endsWith('/crafts') ? Promise.reject(new Error('模拟制作响应断流')) : success(url, options)
  await click(document.querySelector('[aria-label="制作芦苇小舟"]'))
  const craftKey = pets.pending.key, craftInput = JSON.parse(writes().at(-1).options.body)
  assert.equal(pets.pending.kind, 'crafts')
  assert(document.querySelector('[aria-label="购买芦苇"]').disabled)
  await click([...document.querySelectorAll('.workshop-tabs button')].find(button => button.textContent === '我的收藏'))
  auth.accessToken = 'token-b-workshop'; await settle()
  assert.equal(pets.pending.key, craftKey)
  assert(document.querySelector('.collection-grid'), '普通令牌轮换应保留当前收藏页')
  handler = success
  await click(document.querySelector('[aria-label="核对上次宠物操作"]'))
  assert.equal(writes().at(-1).options.headers['Idempotency-Key'], craftKey)
  assert.deepEqual(JSON.parse(writes().at(-1).options.body), craftInput)
  assert.equal(document.querySelectorAll('.collection-card.collected').length, 1)
  assert(document.querySelector('.collection-card.collected').textContent.includes('芦苇小舟'))
  assert(document.querySelector('.collection-card.collected time'))
  assert.equal(pets.state.collections.length, 1)
  await click([...document.querySelectorAll('.workshop-tabs button')].find(button => button.textContent === '制作配方'))
  assert(document.querySelector('[aria-label="制作芦苇小舟"]').disabled)
  assert.equal(document.querySelector('[aria-label="制作芦苇小舟"]').textContent, '已收入收藏')
  assert(document.querySelector('[aria-label="制作森林风铃"]').title.includes('材料尚未集齐'))
  console.log('PASS 制作未知结果保留原键与内容，恢复后收藏和材料同步，已收藏配方不能重复消费')

  assert.equal(document.querySelectorAll('.shop-item').length, 4, '探索专属材料不应显示成可购买商品')
  const shopFilter = label => [...document.querySelectorAll('.shop-filters button')].find(button => button.textContent === label)
  await click(shopFilter('材料'))
  assert.equal(document.querySelectorAll('.shop-item').length, 1)
  assert.equal(document.querySelector('[aria-label="使用芦苇"]'), null)
  const quantityInput = document.querySelector('#pet-item-quantity-reed')
  quantityInput.value = '5'; quantityInput.dispatchEvent(new Event('change', { bubbles: true })); await settle()
  const beforePurchaseCoins = pets.coins
  await click(document.querySelector('[aria-label="购买芦苇"]'))
  assert.equal(pets.coins, beforePurchaseCoins - 30)
  assert(document.querySelector('.material-chip.available').textContent.includes('芦苇5'))
  await click(shopFilter('食品'))
  await click(document.querySelector('[aria-label="购买鲜果"]'))
  const beforeFruitHunger = pets.pet.hunger
  await click(document.querySelector('[aria-label="使用鲜果"]'))
  assert.equal(pets.pet.hunger, Math.min(100, beforeFruitHunger + 20))
  assert.equal(pets.state.inventory.find(item => item.itemId === 'fruit').quantity, 0)
  assert(document.querySelector('[aria-label="使用鲜果"]').disabled)
  await click(shopFilter('饮品'))
  await click(document.querySelector('[aria-label="购买清泉饮"]'))
  serverState.pet.water = 96; serverState.pet.energy = 99
  await pets.refresh(); await settle()
  await click(document.querySelector('[aria-label="使用清泉饮"]'))
  assert.equal(pets.pet.water, 100); assert.equal(pets.pet.energy, 100)
  await click(document.querySelector('[aria-label="购买清泉饮"]'))
  assert(document.querySelector('[aria-label="使用清泉饮"]').disabled)
  assert(document.querySelector('[aria-label="使用清泉饮"]').title.includes('当前状态充足'))
  console.log('PASS 扩展商店分类与批量购买，食品饮品真实使用，纯材料无使用入口，满状态不浪费消耗品')

  await click(document.querySelector('.history-toggle'))
  assert.equal(document.querySelectorAll('.history-filters button').length, 9)
  await click(historyFilter('日常互动'))
  assert.equal(document.querySelectorAll('.history-item').length, 2)
  assert.equal(document.querySelectorAll('.history-status').length, 0, '日常互动不是计时活动，不显示待领取或预计奖励')
  assert(document.querySelector('.history-rewards.actual').textContent.includes('水分 +4'))
  assert(document.querySelector('.history-rewards.actual').textContent.includes('精力 +1'))
  assert(!document.querySelector('.history-rewards.actual').textContent.includes('水分 +35'))
  assert(document.querySelector('.history-cost').textContent.includes('清泉饮 -1'))
  await click(historyFilter('制作'))
  assert.equal(document.querySelectorAll('.history-item').length, 1)
  assert(document.querySelector('.history-cost').textContent.includes('芦苇 -2'))
  assert(document.querySelector('.history-cost').textContent.includes('宠物币 -2'))
  assert(document.querySelector('.history-rewards.actual').textContent.includes('已收藏「芦苇小舟」'))
  await click(historyFilter('购买'))
  assert.equal(document.querySelectorAll('.history-item').length, 4)
  assert([...document.querySelectorAll('.history-cost')].some(item => item.textContent.includes('宠物币 -30') && item.textContent.includes('芦苇 +5')))
  assert.equal(document.querySelectorAll('.history-rewards').length, 0, '纯购买不显示伪造的成长奖励')
  console.log('PASS 统一日志展示照顾、制作和购买的实际变动，保留正负方向，不把即时操作渲染成待领奖活动')

  await click(document.querySelector('.history-toggle'))
  serverState = adopted('phase-five-pet', '老伙伴'); serverState.wallet.coins = 1000
  for (const skill of serverState.pet.skills) skill.experience = 20
  serverState.pet.skills.find(skill => skill.id === 'knowledge').experience = 19
  await pets.refresh(); await settle(); await click(document.querySelector('#pet-course-tab'))
  assert.equal(document.querySelectorAll('.activity-option').length, 12)
  assert.deepEqual([...document.querySelectorAll('.activity-group-heading')].map(node => node.firstChild.textContent.trim()), ['入门课程', '进阶课程'])
  assert(document.querySelector('[aria-label="开始阅读研习课"]').disabled)
  assert(document.querySelector('[aria-label="开始阅读研习课"]').title.includes('知识经验 20'))
  serverState.pet.skills.find(skill => skill.id === 'knowledge').experience = 20
  await pets.refresh(); await settle()
  await click(document.querySelector('[aria-label="开始阅读研习课"]'))
  assert.deepEqual(JSON.parse(writes().at(-1).options.body), { petId: 'phase-five-pet', kind: 'course', entryId: 'reading-advanced', activityVersion: 4 })
  assert(document.querySelector('.current-copy').textContent.includes('阅读研习课'))
  serverState.serverNow = serverState.pet.activity.endsAt; serverState.pet.activity.status = 'claimable'
  await pets.refresh(); await settle(); await click(document.querySelector('.activity-primary'))
  assert.equal(pets.pet.skills.find(skill => skill.id === 'knowledge').experience, 27)
  console.log('PASS 六门进阶课程复用计时活动和真实门槛，选择与领取使用当前目录版本')

  const story = serverState.stories.find(item => item.id === 'care-companion')
  story.completedSteps = 1
  await pets.refresh(); await settle()
  const firstStory = () => document.querySelector('.story-card')
  assert.equal(firstStory().querySelectorAll('.story-steps .complete').length, 1)
  assert(firstStory().querySelector('.story-steps .current').textContent.includes('饮水'))
  assert.equal(firstStory().querySelector('button'), null)
  const beforeStoryReady = writes().length
  story.completedSteps = 3; story.status = 'claimable'; story.completedAt = now
  await pets.refresh(); await settle()
  assert.equal(writes().length, beforeStoryReady, '整链完成不能自动发奖')
  assert(document.querySelector('[aria-label="领取陪伴的日常奖励"]'))
  handler = (url, options) => options?.method && url.endsWith('/stories/claim') ? Promise.reject(new Error('模拟旅程领取断流')) : success(url, options)
  await click(document.querySelector('[aria-label="领取陪伴的日常奖励"]'))
  const storyKey = pets.pending.key, originalStory = JSON.parse(writes().at(-1).options.body), oldFood = serverState.inventory.find(item => item.itemId === 'food').quantity
  assert.equal(pets.pending.kind, 'stories/claim')
  assert(document.querySelector('[aria-label="领取陪伴的日常奖励"]').disabled)
  auth.accessToken = 'phase-five-rotation'; await settle(); handler = success
  await click(document.querySelector('[aria-label="核对上次宠物操作"]'))
  assert.equal(writes().at(-1).options.headers['Idempotency-Key'], storyKey)
  assert.deepEqual(JSON.parse(writes().at(-1).options.body), originalStory)
  assert.equal(pets.state.inventory.find(item => item.itemId === 'food').quantity, oldFood + 2)
  assert(firstStory().textContent.includes('奖励已领取'))
  assert.equal(firstStory().querySelector('button'), null)
  assert.equal(document.querySelectorAll('.story-card.claimed').length, 1)
  console.log('PASS 成长旅程只展示服务端顺序进度，完成后显式领奖，未知结果同键恢复且其他旅程独立')

  serverState.wallet.coins = 100; await pets.refresh(); await settle()
  const readoptionWrites = writes().length
  assert(document.querySelector('.pet-readoption').textContent.includes('512 宠物币'))
  await click(document.querySelector('.readoption-open'))
  assert(document.querySelector('[role="dialog"]'))
  assert(document.querySelector('.readoption-form').textContent.includes('宠物币不足'))
  assert(document.querySelector('.readoption-submit').disabled)
  assert(document.querySelector('.readoption-rules').textContent.includes('剩余宠物币、背包、收藏、成长旅程进度'))
  await click([...document.querySelectorAll('.readoption-actions button')].find(button => button.textContent === '取消'))
  await settle(); await settle()
  assert.equal(document.querySelector('.readoption-form'), null)
  assert.equal(writes().length, readoptionWrites)
  assert.equal(document.activeElement, document.querySelector('.readoption-open'))
  console.log('PASS 余额不足也可查看重新领养规则和费用，取消不写入并把焦点归还入口')

  serverState.wallet.coins = 1000; serverState.pet.level = 3; serverState.pet.experience = 220; serverState.pet.friendship = 19
  serverState.pet.growthToday.used = 4; serverState.pet.cooldowns.pet = now + 4000
  serverState.dailySupply.claimed = true; serverState.income.earned = 20; serverState.income.remaining = 40
  serverState.collections = [{ id: 'reed-boat', unlockedAt: now }]
  await pets.refresh(); await settle(); await click(document.querySelector('.readoption-open'))
  const readoptionForm = () => document.querySelector('.readoption-form')
  const choosePet = document.querySelector('.readoption-species input[value="paixiaoyu"]')
  await click(choosePet); await input(document.querySelector('#readoption-name'), '新的派派')
  const beforeConfirmation = writes().length
  readoptionForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await settle()
  assert.equal(writes().length, beforeConfirmation)
  assert(document.querySelector('.readoption-submit').disabled)
  await click(document.querySelector('.readoption-accept input'))
  auth.accessToken = 'readoption-rotation'; await settle()
  assert.equal(document.querySelector('#readoption-name').value, '新的派派')
  assert(document.querySelector('.readoption-accept input').checked)
  assert(!document.querySelector('.readoption-submit').disabled)
  const readoptionWait = deferred()
  handler = (url, options) => options?.method && url.endsWith('/readoption') ? readoptionWait.promise : success(url, options)
  readoptionForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await settle()
  readoptionForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await settle()
  assert.equal(writes().length, beforeConfirmation + 1)
  assert(document.querySelector('#readoption-name').disabled)
  assert(document.querySelector('.readoption-actions button').disabled)
  assert.equal(document.querySelector('.fp-dialog-x'), null)
  readoptionWait.reject(new Error('模拟重新领养响应断流')); await settle()
  const readoptionKey = pets.pending.key, readoptionBody = JSON.parse(writes().at(-1).options.body)
  assert.equal(readoptionBody.resetAccepted, true)
  assert.equal(readoptionBody.name, '新的派派')
  assert.equal(readoptionBody.speciesId, 'paixiaoyu')
  assert.equal(readoptionBody.catalogVersion, 3)
  assert(document.querySelector('.readoption-feedback'))
  assert(document.querySelector('#readoption-name').disabled, '未知结果冻结原命令，不能编辑成另一次领养')
  assert(!document.querySelector('.readoption-feedback').textContent.includes('JSON'))
  const retained = structuredClone({ inventory: serverState.inventory, collections: serverState.collections, stories: serverState.stories, dailySupply: serverState.dailySupply, income: serverState.income, cooldowns: serverState.pet.cooldowns, growthToday: serverState.pet.growthToday })
  handler = success
  await click(document.querySelector('[aria-label="核对重新领养操作"]')); await settle(); await settle()
  assert.equal(writes().at(-1).options.headers['Idempotency-Key'], readoptionKey)
  assert.deepEqual(JSON.parse(writes().at(-1).options.body), readoptionBody)
  assert.equal(document.querySelector('.readoption-form'), null, '新宠物ID生效即关闭并废弃旧确认')
  assert.notEqual(pets.pet.id, 'phase-five-pet'); assert.equal(pets.pet.name, '新的派派'); assert.equal(pets.pet.speciesId, 'paixiaoyu')
  assert.equal(pets.coins, 488); assert.equal(pets.pet.level, 1); assert.equal(pets.pet.experience, 0); assert.equal(pets.pet.friendship, 0)
  assert(pets.pet.skills.every(skill => skill.experience === 0)); assert(pets.pet.jobs.every(job => job.experience === 0))
  for (const key of ['inventory', 'collections', 'stories', 'dailySupply', 'income']) assert.deepEqual(structuredClone(vue.toRaw(pets.state[key])), retained[key])
  assert.deepEqual(structuredClone(vue.toRaw(pets.pet.cooldowns)), retained.cooldowns); assert.deepEqual(structuredClone(vue.toRaw(pets.pet.growthToday)), retained.growthToday)
  await click(document.querySelector('.readoption-open'))
  assert.equal(document.querySelector('#readoption-name').value, '')
  assert.equal(document.querySelector('.readoption-accept input').checked, false)
  await click(document.querySelector('.fp-dialog-x')); await settle(); await settle()
  console.log('PASS 重新领养必须明确确认，轮换保草稿，重复提交拦截，未知同键恢复，新ID关闭旧确认并显示服务端资产与成长')

  await click(document.querySelector('.history-toggle'))
  await click(historyFilter('成长旅程'))
  assert.equal(document.querySelectorAll('.history-item').length, 1)
  assert(document.querySelector('.history-cost').textContent.includes('基础口粮 +2'))
  assert.equal(document.querySelector('.history-status'), null)
  await click(historyFilter('重新领养'))
  assert.equal(document.querySelectorAll('.history-item').length, 1)
  assert(document.querySelector('.history-cost').textContent.includes('宠物币 -512'))
  assert(document.querySelector('.history-record h3').textContent.includes('新的派派'))
  assert.equal(document.querySelector('.history-status'), null)
  console.log('PASS 旅程领奖和重新领养归入独立日志分类，展示实际物品及扣费，不出现计时或待领奖状态')

  serverState.wallet.coins = 1600; await pets.refresh(); await settle(); await click(document.querySelector('.readoption-open'))
  await input(document.querySelector('#readoption-name'), '只需更新状态'); await click(document.querySelector('.readoption-accept input'))
  handler = (url, options) => options?.method && url.endsWith('/readoption') ? Promise.reject(new Error('模拟领养断流')) : success(url, options)
  await click(document.querySelector('.readoption-submit'))
  let replacementCommitted = false
  handler = async (url, options) => {
    if (options?.method && url.endsWith('/readoption')) { const receipt = await success(url, options); replacementCommitted = true; return receipt }
    if (replacementCommitted && url === '/api/v3/me/pet') throw new Error('模拟后置读取失败')
    return success(url, options)
  }
  await click(document.querySelector('[aria-label="核对重新领养操作"]')); await settle(); await settle()
  assert.equal(document.querySelector('.readoption-form'), null, '写入确认后不应让后置读取失败留住旧确认弹窗')
  assert.equal(pets.pending, null); assert.equal(pets.refreshNeeded, true)
  const confirmedWriteCount = writes().length
  handler = success
  await click(document.querySelector('[aria-label="刷新宠物状态"]'))
  assert.equal(writes().length, confirmedWriteCount)
  assert.equal(pets.pet.name, '只需更新状态'); assert.equal(pets.coins, 1088)
  console.log('PASS 重新领养恢复确认后读取失败，只开放状态重读，不保留旧确认或再次扣费')

  serverState.wallet.coins = 800; await pets.refresh(); await settle(); await click(document.querySelector('.readoption-open'))
  await input(document.querySelector('#readoption-name'), '跨设备旧草稿'); await click(document.querySelector('.readoption-accept input'))
  serverState.pet = adopted('other-device-new-pet', '跨设备新伙伴', 'yubingmiao').pet
  await pets.refresh(); await settle(); await settle()
  assert.equal(document.querySelector('.readoption-form'), null)
  await click(document.querySelector('.readoption-open'))
  assert.equal(document.querySelector('#readoption-name').value, '')
  assert.equal(document.querySelector('.readoption-accept input').checked, false)
  console.log('PASS 其他设备更换宠物后废弃旧确认，重新打开必须再次选择和确认')
  serverState = empty(); context++; auth.account = { oId: 'C' }; auth.accessToken = 'token-c'; await settle()
  await settle(); await settle()
  assert.equal(document.querySelector('.readoption-form'), null)
  assert.equal(document.querySelector('.pet-history'), null)
  assert(!document.body.textContent.includes('工作记录'))
  console.log('PASS 日志失败与空结果分离，技术错误友好展示，快速筛选和换号不回写旧记录')
} finally {
  app?.unmount()
  await fs.rm(temporary, { recursive: true, force: true })
  dom.window.close()
}
