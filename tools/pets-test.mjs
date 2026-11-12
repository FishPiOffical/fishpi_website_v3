import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { ref } from 'vue'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const compile = source => moduleUrl(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
class ApiError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code } }
let context = 1, serial = 0, handler
const calls = []
const useAuthStore = defineStore('pet-test-auth', () => ({ accessToken: ref('token-a'), account: ref({ oId: 'A' }) }))
globalThis.__petTest = {
  ApiError, getAuthContextVersion: () => context, useAuthStore,
  profileOperationKey: () => `pet:${++serial}`,
  request: (path, options) => { calls.push({ path, options }); return handler(path, options) },
}
globalThis.window = new EventTarget()
globalThis.document = Object.assign(new EventTarget(), { hidden: false })
class Channel {
  static all = []
  messages = []
  constructor() { Channel.all.push(this) }
  postMessage(data) { this.messages.push(data) }
  close() { this.closed = true }
}
globalThis.BroadcastChannel = Channel

const transport = moduleUrl('export const {ApiError,getAuthContextVersion,request}=globalThis.__petTest')
const apiUrl = compile((await fs.readFile('src/api/v3-pets.ts', 'utf8')).replace("from './http'", `from '${transport}'`))
const api = await import(apiUrl)
let source = await fs.readFile('src/stores/pets.ts', 'utf8')
for (const [name, url] of [
  ['vue', import.meta.resolve('vue')], ['pinia', import.meta.resolve('pinia')],
  ['@/api/http', transport], ['@/api/v3-pets', apiUrl],
  ['@/api/v3-profile', moduleUrl('export const {profileOperationKey}=globalThis.__petTest')],
  ['@/stores/auth', moduleUrl('export const {useAuthStore}=globalThis.__petTest')],
]) source = source.replaceAll(`from '${name}'`, `from '${url}'`)
const { usePetsStore } = await import(compile(source.replaceAll('import.meta.env.SSR', 'false')))

const catalog = {
  version: 2,
  activityVersion: 3,
  skills: ['vitality', 'exploration', 'knowledge', 'expression', 'crafting', 'kindness'].map(id => ({ id, name: id, description: '入门技能' })),
  places: [{ id: 'plaza', name: '广场散步', description: '和伙伴走一走', durationMs: 300000,
    cost: { coins: 0, energy: 5, hunger: 2, water: 3 },
    rewards: { coins: 0, proficiency: 0, experience: 10, food: 0, mood: 8, skills: [{ id: 'exploration', experience: 3 }] } }],
  courses: [{ id: 'reading-basics', name: '阅读入门', description: '认识新的知识', durationMs: 600000,
    cost: { coins: 5, energy: 8, hunger: 3, water: 4 },
    rewards: { coins: 0, proficiency: 0, experience: 15, food: 0, mood: 3, skills: [{ id: 'knowledge', experience: 10 }] } }],
  incomeRules: { dailyLimit: 60 },
  jobs: ['delivery-assistant','trail-assistant','library-assistant','broadcast-assistant','craft-assistant','care-assistant'].map((id, index) => ({ id, name: id, description: '见习工作', durationMs: 1200000, cost: { coins: 0, energy: 12, hunger: 4, water: 6 }, rewards: { coins: 12, proficiency: 10, experience: 15, food: 0, mood: 3, skills: [] }, requirement: { skillId: ['vitality','exploration','knowledge','expression','crafting','kindness'][index], experience: 10 } })),
  species: ['momota', 'hexiaotun', 'yubingmiao', 'paixiaoyu'].map(id => ({ id, name: id, description: '社区伙伴' })),
  items: [
    { id: 'food', name: '基础口粮', description: '日常口粮', category: 'food', price: 5, hunger: 35, effects: { hunger: 35, water: 0, mood: 0, energy: 0 } },
    { id: 'fruit', name: '鲜果', description: '香甜鲜果', category: 'food', price: 6, hunger: 20, effects: { hunger: 20, water: 0, mood: 8, energy: 0 } },
    { id: 'spring-water', name: '清泉饮', description: '补充水分', category: 'drink', price: 5, hunger: 0, effects: { hunger: 0, water: 35, mood: 0, energy: 5 } },
    { id: 'reed', name: '芦苇', description: '手作材料', category: 'material', price: 6, hunger: 0, effects: { hunger: 0, water: 0, mood: 0, energy: 0 } },
    { id: 'sea-shell', name: '海贝', description: '海边拾取', category: 'material', price: null, hunger: 0, effects: { hunger: 0, water: 0, mood: 0, energy: 0 } },
  ],
  recipes: [{ id: 'reed-boat', name: '芦苇小舟', description: '留下荷塘的回忆', requirements: [{ skillId: 'exploration', experience: 10 }], ingredients: [{ itemId: 'reed', quantity: 2 }], coins: 2, collectionId: 'reed-boat' }],
  collections: [{ id: 'reed-boat', name: '芦苇小舟', description: '荷塘的回忆' }],
  rules: { maxNameLength: 12, initialCoins: 100, initialFood: 6, dailyCoins: 20, dailyFood: 2,
    restDurationMs: 14400000, restEnergyPerHour: 20, growthDailyLimit: 10 },
}
for (const entry of [...catalog.places, ...catalog.courses, ...catalog.jobs]) {
  entry.requirements = entry.requirement ? [entry.requirement] : []
  entry.rewards.items = []
}
catalog.places.push({ ...structuredClone(catalog.places[0]), id: 'lotus-pond', name: '荷塘采集',
  requirements: [{ skillId: 'exploration', experience: 10 }],
  rewards: { ...structuredClone(catalog.places[0].rewards), items: [{ itemId: 'reed', quantity: 2 }] } })
const now = Date.UTC(2026, 10, 12, 10)
const empty = () => ({ serverNow: now, today: '2026-11-12', catalogVersion: 2, wallet: { coins: 0 },
  income: { date: '2026-11-12', earned: 0, limit: 60, remaining: 60 },
  inventory: [], collections: [], dailySupply: { claimed: false, coins: 20, food: 2 }, pet: null })
const adopted = () => ({ ...empty(), wallet: { coins: 100 }, inventory: [{ itemId: 'food', quantity: 6 }], pet: {
  id: 'pet-a', speciesId: 'hexiaotun', name: '荷小豚', hunger: 90, water: 90, mood: 90, energy: 80,
  experience: 0, level: 1, friendship: 0, adoptedAt: now - 3600000, activity: null,
  skills: catalog.skills.map(skill => ({ id: skill.id, experience: 0, level: 1 })),
  jobs: catalog.jobs.map(job => ({ id: job.id, experience: 0, level: 1, completed: 0 })),
  cooldowns: { pet: 0, play: 0 }, growthToday: { used: 0, limit: 10 },
} })
const response = data => ({ code: 0, data: structuredClone(data) })
let serverState = empty()
const success = async (path, options) => {
  if (options?.method) {
    const body = JSON.parse(options.body)
    const kind = path.split('/').at(-1)
    if (kind === 'adoption') serverState = adopted()
    return response({ operation: kind === 'actions' ? body.action : kind === 'purchases' ? 'purchase' : kind,
      petId: serverState.pet?.id ?? 'pet-a', committedAt: now })
  }
  return response(path.endsWith('/catalog') ? catalog : serverState)
}
const writes = () => calls.filter(call => call.options?.method)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

assert.equal(api.petNameLength('👨‍👩‍👧‍👦👍🏽🇨🇳é'), 4)
assert.equal(api.normalizePetName('  荷小豚  '), '荷小豚')
assert.equal(api.normalizePetName('鱼'.repeat(12)), '鱼'.repeat(12))
for (const name of ['鱼'.repeat(13), ' ', '\ud800', 'a\nb', 'a\u202eb', 'a\u00adb', '<鱼>', 'a'.repeat(257)]) {
  assert.throws(() => api.normalizePetName(name))
}
assert.deepEqual(api.decodePetState(empty()), empty())
assert.deepEqual(api.decodePetCatalog(catalog), catalog)
for (const patch of [{ today: '2026-02-30' }, { wallet: { coins: -1 } }, { pet: undefined },
  { inventory: [{ itemId: 'food', quantity: 1 }, { itemId: 'food', quantity: 2 }] }]) {
  assert.throws(() => api.decodePetState({ ...empty(), ...patch }))
}
assert.throws(() => api.decodePetState({ ...adopted(), pet: { ...adopted().pet, hunger: 101 } }))
assert.throws(() => api.decodePetState({ ...adopted(), pet: { ...adopted().pet,
  activity: { kind: 'school', startedAt: now, endsAt: now + 10 } } }))
console.log('PASS 真实字段校验、Unicode名字边界、无宠物空状态及非法快照拒绝')

handler = success
setActivePinia(createPinia())
const auth = useAuthStore(), store = usePetsStore()
auth.accessToken = null
await store.ensureLoaded()
assert.equal(calls.length, 0)
auth.accessToken = 'token-a'
await Promise.all([store.ensureLoaded(), store.ensureLoaded(), store.ensureLoaded()])
assert.equal(calls.length, 2)
await store.ensureLoaded()
assert.equal(calls.length, 2)
assert.equal(store.pet, null)
assert.equal(store.receivedAt > 0, true)
console.log('PASS 游客零请求，页面与桌宠合并两次初始化GET，重复挂载复用状态')

await store.adopt('hexiaotun', '荷小豚')
assert.equal(store.pet.name, '荷小豚')
assert.equal(store.coins, 100)
assert.equal(store.foodQuantity, 6)
assert.equal(writes().length, 1)
await store.adopt('momota', '不能再领养')
assert.equal(writes().length, 1)
assert.deepEqual(Channel.all.at(-1).messages, [{ type: 'changed', owner: 'A' }])
console.log('PASS 领养成功后只重读聚合状态，重复点击无额外写入，跨标签只传失效元数据')

let purchase = deferred()
handler = (path, options) => options?.method ? purchase.promise : success(path, options)
const purchasing = store.buyFood(1)
assert.equal(store.busy, true)
assert.equal(await store.buyFood(1), false)
assert.equal(writes().length, 2)
purchase.resolve(response({ operation: 'purchase', petId: 'pet-a', committedAt: now }))
await purchasing
assert.equal(store.busy, false)
console.log('PASS 并发点击前端串行，命令携带当前宠物ID与目录版本')

handler = async () => { throw new ApiError('商品价格已更新，请重新查看', 409, 'catalog_changed') }
await store.buyFood(1)
assert.equal(store.pending, null)
assert.equal(store.catalog, null)
assert(store.catalogError)
const rejectedPurchases = writes().length
await store.buyFood(1)
assert.equal(writes().length, rejectedPurchases)
handler = success
await store.reloadCatalog()
assert.equal(store.catalog.version, 2)
assert.equal(store.catalogError, '')
console.log('PASS 目录版本变化阻止旧价继续下单，显式刷新目录后恢复购买')

handler = async (path, options) => {
  if (options?.method) return success(path, options)
  throw new Error('正文断流')
}
assert.equal(await store.act('water'), true)
assert.equal(store.pending, null)
assert.equal(store.state, null)
assert.equal(store.refreshNeeded, true)
const completedWrites = writes().length
await store.retryPending()
assert.equal(writes().length, completedWrites)
handler = success
await store.refresh()
assert.equal(store.ready, true)
console.log('PASS 已确认写入后的GET失败仅重读，不重复收费或操作')

handler = async () => { throw new Error('连接断开') }
await store.claimSupply()
const unknown = { ...store.pending }
assert.equal(unknown.expectedDate, '2026-11-12')
auth.accessToken = 'token-a-rotated'
assert.deepEqual(store.pending, unknown)
handler = async () => { throw new ApiError('结果暂不可确认', 409) }
await store.retryPending()
assert.equal(store.pending.key, unknown.key)
assert.equal(writes().at(-1).options.headers['Idempotency-Key'], unknown.key)
assert.equal(JSON.parse(writes().at(-1).options.body).expectedDate, unknown.expectedDate)
handler = success
await store.retryPending()
assert.equal(store.pending, null)
console.log('PASS 未确认补给固定日期及原键，跨日/令牌轮换/恢复4xx不会生成新操作')

handler = async () => response({ operation: 'feed', petId: 'pet-a', committedAt: now })
await store.rename('新名字')
assert.equal(store.pending?.kind, 'name')
assert(store.pendingError)
handler = success
await store.retryPending()
console.log('PASS 回执操作不匹配保留未知命令，不能误清原键')

const activeTrip = { id: 'trip-a', kind: 'outing', entryId: 'plaza', name: '广场散步',
  startedAt: now, endsAt: now + 300000, status: 'running',
  cost: catalog.places[0].cost, rewards: catalog.places[0].rewards }
assert.deepEqual(api.decodePetState({ ...adopted(), pet: { ...adopted().pet, activity: activeTrip } }).pet.activity, activeTrip)
for (const activity of [{ ...activeTrip, status: 'claimable' }, { ...activeTrip, endsAt: now },
  { ...activeTrip, cost: { ...activeTrip.cost, energy: -1 } },
  { ...activeTrip, rewards: { ...activeTrip.rewards, skills: [{ id: 'made-up-skill', experience: 2 }] } }]) {
  assert.throws(() => api.decodePetState({ ...adopted(), pet: { ...adopted().pet, activity } }))
}
assert.throws(() => api.decodePetState({ ...adopted(), pet: { ...adopted().pet, skills: [] } }))
assert.throws(() => api.decodePetCatalog({ ...catalog, places: [catalog.places[0], catalog.places[0]] }))
assert.throws(() => api.decodePetCatalog({ ...catalog, activityVersion: 0 }))
const oldCatalog = structuredClone(catalog), oldState = adopted()
for (const field of ['activityVersion', 'skills', 'places', 'courses']) delete oldCatalog[field]
delete oldState.pet.skills
assert.throws(() => api.decodePetCatalog(oldCatalog), '旧服务缺少活动协议时应明确报错，不能伪装为空目录')
assert.throws(() => api.decodePetState(oldState), '缺少技能字段不能伪装成六项零经验')
const tripStart = deferred(), beforeStart = calls.length
handler = (path, options) => options?.method ? tripStart.promise : success(path, options)
const starting = store.startActivity('outing', 'plaza')
assert.deepEqual(JSON.parse(writes().at(-1).options.body), { petId: 'pet-a', kind: 'outing', entryId: 'plaza', activityVersion: 3 })
assert.equal(await store.startActivity('course', 'reading-basics'), false)
assert.equal(await store.act('rest'), false)
serverState = { ...adopted(), pet: { ...adopted().pet, activity: activeTrip, energy: 75 } }
tripStart.resolve(response({ operation: 'activity-start', petId: 'pet-a', activityId: 'trip-a', committedAt: now }))
await starting
assert.equal(calls.length, beforeStart + 2, '活动开始仅一写一次聚合读取，不额外查询课程或技能')
assert.equal(store.pet.activity.id, 'trip-a')
const blockedCount = calls.length
assert.equal(await store.startActivity('course', 'reading-basics'), false)
assert.equal(await store.act('wake'), false)
assert.equal(await store.act('feed', 'food'), false)
assert.equal(await store.claimActivity(), false)
assert.equal(calls.length, blockedCount)
console.log('PASS 活动快照严格解码，开始双击串行，只重读聚合，进行中禁止覆盖、照顾及提前领取')

serverState.serverNow = activeTrip.endsAt
serverState.pet.activity.status = 'claimable'
handler = success
await store.refresh()
handler = async () => { throw new Error('领取响应断流') }
await store.claimActivity()
const claimCommand = { ...store.pending }
assert.equal(claimCommand.activityId, 'trip-a')
assert.equal(claimCommand.kind, 'activities/claim')
auth.accessToken = 'token-a-activity-rotated'
assert.deepEqual(store.pending, claimCommand)
handler = async () => response({ operation: 'activity-claim', petId: 'pet-a', activityId: 'trip-b', committedAt: activeTrip.endsAt })
await store.retryPending()
assert.equal(store.pending.key, claimCommand.key, '不能把别的活动回执当成当前领取完成')
handler = async (path, options) => {
  if (options?.method) {
    assert.equal(path, '/api/v3/me/pet/activities/claim')
    assert.deepEqual(JSON.parse(options.body), { petId: 'pet-a', activityId: 'trip-a' })
    assert.equal(options.headers['Idempotency-Key'], claimCommand.key)
    return response({ operation: 'activity-claim', petId: 'pet-a', activityId: 'trip-a', committedAt: activeTrip.endsAt })
  }
  throw new Error('成果已提交但当前读取失败')
}
await store.retryPending()
assert.equal(store.pending, null)
assert.equal(store.refreshNeeded, true)
const claimWrites = writes().length
await store.retryPending()
assert.equal(writes().length, claimWrites)
serverState = adopted(); handler = success
await store.refresh()
console.log('PASS 待领取原activityId/原键冻结，普通令牌轮换与错配回执不丢命令，提交后读错不重复领成果')

const claimableState = () => ({ ...adopted(), serverNow: activeTrip.endsAt,
  pet: { ...adopted().pet, activity: { ...activeTrip, status: 'claimable' } } })
serverState = claimableState(); handler = success; await store.refresh()
const claimedRead = deferred(), beforeAlreadyClaimed = calls.length
handler = (path, options) => options?.method
  ? Promise.reject(new ApiError('这次活动已经领取过了', 409, 'activity_claimed')) : claimedRead.promise
const alreadyClaimed = store.claimActivity(); await tick()
assert.equal(store.pending, null)
assert.equal(store.busy, true)
assert.equal(store.refreshNeeded, true)
assert.equal(calls.length, beforeAlreadyClaimed + 2, '首次明确已领取只提交一次并重读一次聚合状态')
assert.equal(await store.claimActivity(), false)
auth.accessToken = 'token-a-claimed-rotated'
serverState = adopted(); serverState.pet.skills[1].experience = 3
claimedRead.resolve(response(serverState))
assert.equal(await alreadyClaimed, false, '跨设备已领取不能冒充本次写入成功')
assert.equal(store.pet.activity, null)
assert.equal(store.pet.skills[1].experience, 3)
assert.equal(store.error, '')
assert.equal(store.refreshNeeded, false)
assert.equal(calls.length, beforeAlreadyClaimed + 2)
console.log('PASS 首次明确已领取仅重读一次，普通令牌轮换接受同身份迟到状态，不重复领奖')

serverState = claimableState(); handler = success; await store.refresh()
handler = async (path, options) => {
  if (options?.method) throw new ApiError('这次活动已经领取过了', 409, 'activity_claimed')
  throw new Error('读取响应断流')
}
const beforeClaimedReadFailure = calls.length
await store.claimActivity()
assert.equal(calls.length, beforeClaimedReadFailure + 2)
assert.equal(store.pending, null)
assert.equal(store.state, null)
assert.equal(store.refreshNeeded, true)
assert(store.error.includes('宠物暂时没能回到画面'), '重读失败保留友好错误和纯读取恢复入口')
const beforeReadOnlyRecovery = writes().length
await store.retryPending(); await store.claimActivity()
assert.equal(writes().length, beforeReadOnlyRecovery)
serverState = adopted(); handler = success; await store.refresh()
assert.equal(writes().length, beforeReadOnlyRecovery)
console.log('PASS 跨设备已领取后的读取失败只恢复GET，不保留可重复领取的过时画面')

serverState = claimableState(); await store.refresh()
handler = async () => { throw new Error('领取结果未知') }
await store.claimActivity()
const originalClaim = { ...store.pending }, beforeClaimConflict = calls.length
handler = async () => { throw new ApiError('这次活动已经领取过了', 409, 'activity_claimed') }
await store.retryPending()
assert.deepEqual(store.pending, originalClaim, '未知结果恢复收到已领取仍不能释放原命令')
assert.equal(calls.length, beforeClaimConflict + 1, '恢复期间的409不触发额外GET')
assert.equal(writes().at(-1).options.headers['Idempotency-Key'], originalClaim.key)
handler = async (path, options) => options?.method
  ? response({ operation: 'activity-claim', petId: 'pet-a', activityId: 'trip-a', committedAt: activeTrip.endsAt }) : success(path, options)
serverState = adopted(); await store.retryPending()
console.log('PASS 未知原键恢复的已领取409仍保留命令，只能用原键核对结果')

serverState = claimableState(); handler = success; await store.refresh()
const oldSessionRead = deferred()
handler = (path, options) => options?.method
  ? Promise.reject(new ApiError('这次活动已经领取过了', 409, 'activity_claimed')) : oldSessionRead.promise
const oldSessionClaim = store.claimActivity(); await tick()
context++; auth.accessToken = 'token-a-new-session'
serverState = adopted(); serverState.pet.name = '新会话当前名字'; handler = success; await store.ensureLoaded()
const afterNewSessionRead = calls.length
oldSessionRead.resolve(response(claimableState())); await oldSessionClaim
assert.equal(store.pet.name, '新会话当前名字')
assert.equal(store.pet.activity, null)
assert.equal(store.pending, null)
assert.equal(calls.length, afterNewSessionRead, '同账号新的认证代际不能触发旧恢复读的后续操作')
console.log('PASS 同账号重新认证后拒绝旧恢复读取，不复活已领取活动或覆盖当前宠物')

const lateRead = deferred()
handler = () => lateRead.promise
const reading = store.refresh()
context++; auth.account = { oId: 'B' }; auth.accessToken = 'token-b'
lateRead.resolve(response(adopted()))
await reading
assert.equal(store.state, null)
assert.equal(store.catalog, null)
assert.equal(store.pending, null)
serverState = { ...adopted(), pet: { ...adopted().pet, id: 'pet-b', name: '小鱼' } }
handler = success
await store.ensureLoaded()
assert.equal(store.pet.id, 'pet-b')
const lateWrite = deferred()
handler = () => lateWrite.promise
const writing = store.rename('B的新名字')
context++; auth.account = { oId: 'C' }; auth.accessToken = 'token-c'
lateWrite.resolve(response({ operation: 'name', petId: 'pet-b', committedAt: now }))
const countBeforeLate = calls.length
await writing
assert.equal(calls.length, countBeforeLate)
assert.equal(store.state, null)
assert.equal(store.pending, null)
console.log('PASS 换号废弃迟到读取/写回执，不污染新身份且不触发旧身份后置GET')

serverState = adopted()
handler = success
await store.ensureLoaded()
const channel = Channel.all.at(-1), beforeNotice = calls.length
channel.onmessage({ data: { type: 'changed', owner: 'A' } })
assert.equal(calls.length, beforeNotice)
document.hidden = true
channel.onmessage({ data: { type: 'changed', owner: 'C' } })
assert.equal(calls.length, beforeNotice)
document.hidden = false
document.dispatchEvent(new Event('visibilitychange'))
await tick()
assert.equal(calls.length, beforeNotice + 1)
window.dispatchEvent(new Event('focus'))
assert.equal(calls.length, beforeNotice + 1)
auth.accessToken = null
assert.equal(store.state, null)
assert.equal(store.catalog, null)
store.$dispose()
assert.equal(channel.closed, true)
console.log('PASS 跨账号广播忽略，后台标签延迟重读，聚焦去重，退出和销毁清理')

setActivePinia(createPinia())
const { usePetsStore: useSsrStore } = await import(compile(source.replaceAll('import.meta.env.SSR', 'true')))
const ssr = useSsrStore(), beforeSsr = calls.length
await ssr.ensureLoaded()
await ssr.refresh()
assert.equal(calls.length, beforeSsr)
ssr.$dispose()
console.log('PASS SSR不读取宠物私有数据')
// 第三批沿用真实 API 与 Pinia 状态，隔离传输，验证开工门槛和日志竞态。
setActivePinia(createPinia())
const workAuth = useAuthStore(), workStore = usePetsStore()
serverState = adopted(); handler = success; await workStore.ensureLoaded()
const beforeLocked = calls.length
assert.equal(await workStore.startActivity('work', 'library-assistant'), false)
assert.equal(calls.length, beforeLocked)
serverState.pet.skills[2].experience = 9; await workStore.refresh()
assert.equal(await workStore.startActivity('work', 'library-assistant'), false)
serverState.pet.skills[2].experience = 10
serverState.income = { date: '2026-11-12', earned: 60, limit: 60, remaining: 0 }
await workStore.refresh()
assert.equal(await workStore.startActivity('work', 'library-assistant'), false)
serverState.income = { date: '2026-11-12', earned: 55, limit: 60, remaining: 5 }
await workStore.refresh()
const working = { ...activeTrip, id: 'work-a', kind: 'work', entryId: 'library-assistant', name: '图书助理',
  status: 'running', endsAt: now + 1200000, cost: catalog.jobs[2].cost, rewards: catalog.jobs[2].rewards }
handler = async (path, options) => {
  if (options?.method) {
    assert.deepEqual(JSON.parse(options.body), { petId: 'pet-a', kind: 'work', entryId: 'library-assistant', activityVersion: 3 })
    serverState.pet.activity = working
    return response({ operation: 'activity-start', petId: 'pet-a', activityId: 'work-a', committedAt: now })
  }
  return success(path, options)
}
const beforeWork = calls.length
assert.equal(await workStore.startActivity('work', 'library-assistant'), true)
assert.equal(calls.length, beforeWork + 2)
api.decodePetState(serverState)
assert.equal(workStore.pet.activity.kind, 'work')
assert.equal(workStore.coins, 100, '启动工作不能预先把工资加入钱包')
assert.equal(workStore.pet.jobs[2].experience, 0, '未领取不能预先增加职业熟练度')
assert.equal(await workStore.startActivity('outing', 'plaza'), false)
console.log('PASS 工作只按对应技能门槛与服务端收入额度解锁，单槽互斥，报酬和熟练度不在本地预发')

const historyPage = (records = [], page = 1, total = records.length) => ({ serverNow: now + 1200001, list: records.map(record => ({ ...record, recordType: record.recordType ?? 'activity' })),
  pagination: { page, pageSize: 10, total, pageCount: Math.max(1, Math.ceil(total / 10)) } })
const oldRecord = { ...activeTrip, petId: 'pet-a', status: 'claimed', claimedAt: activeTrip.endsAt, actualRewards: null }
const workRecord = { ...working, petId: 'pet-a', status: 'claimed', claimedAt: working.endsAt,
  actualRewards: { ...working.rewards, coins: 5, mood: 2.3 } }
assert.equal(api.decodePetActivityHistory(historyPage([oldRecord])).list[0].actualRewards, null)
assert.equal(api.decodePetActivityHistory(historyPage([workRecord])).list[0].actualRewards.coins, 5)
assert.equal(api.decodePetActivityHistory(historyPage([workRecord])).list[0].actualRewards.mood, 2.3)
for (const record of [{ ...workRecord, actualRewards: undefined }, { ...workRecord, claimedAt: null },
  { ...workRecord, actualRewards: { ...workRecord.actualRewards, coins: -1 } },
  { ...workRecord, actualRewards: { ...workRecord.actualRewards, mood: NaN } },
  { ...workRecord, status: 'running', claimedAt: null }]) {
  assert.throws(() => api.decodePetActivityHistory(historyPage([record])))
}
assert.throws(() => api.decodePetActivityHistory({ ...historyPage(), pagination: { page: 1, pageSize: 10, total: 11, pageCount: 1 } }))
console.log('PASS 工作履历实际发币、封顶小数心情与旧记录未知成果分别保留，非法奖励/分页拒绝')

globalThis.__petTest.usePetsStore = usePetsStore
let historySource = await fs.readFile('src/stores/petActivityHistory.ts', 'utf8')
for (const [name, url] of [
  ['vue', import.meta.resolve('vue')], ['pinia', import.meta.resolve('pinia')], ['@/api/http', transport],
  ['@/api/v3-pets', apiUrl], ['@/stores/auth', moduleUrl('export const {useAuthStore}=globalThis.__petTest')],
  ['@/stores/pets', moduleUrl('export const {usePetsStore}=globalThis.__petTest')],
]) historySource = historySource.replaceAll(`from '${name}'`, `from '${url}'`)
const { usePetActivityHistoryStore } = await import(compile(historySource.replaceAll('import.meta.env.SSR', 'false')))
const historyStore = usePetActivityHistoryStore()
const isHistory = path => path.includes('/pet/journal?')
let historyRequests = () => calls.filter(call => isHistory(call.path))
handler = (path, options) => isHistory(path) ? Promise.resolve(response(historyPage([oldRecord, workRecord]))) : success(path, options)
await workStore.refresh()
assert.equal(historyRequests().length, 0, '折叠状态没有日志请求')
await Promise.all([historyStore.open(), historyStore.open(), historyStore.refresh()])
assert.equal(historyRequests().length, 1, '展开双击与刷新合并')
assert.equal(historyStore.history.list.length, 2)
const oldPage = deferred(), latestPage = deferred()
handler = path => path.includes('kind=work') ? latestPage.promise : oldPage.promise
const staleHistory = historyStore.refresh()
const switchFilter = historyStore.setFilter('work')
latestPage.resolve(response(historyPage([workRecord], 1, 11))); await switchFilter
oldPage.resolve(response(historyPage([oldRecord]))); await staleHistory
assert.equal(historyStore.history.list[0].id, 'work-a')
assert.equal(historyStore.filter, 'work')
const pageTwo = deferred()
handler = () => pageTwo.promise
const nextPage = historyStore.setPage(2)
assert.equal(historyStore.history, null, '换页期间不能把旧页当作新页')
pageTwo.resolve(response(historyPage([], 2, 11))); await nextPage
assert.equal(historyStore.history.pagination.page, 2)
console.log('PASS 日志按需展开与并发合并，分类/页码切换废弃旧响应，真实分页')

const staleBeforeClaim = deferred(), currentAfterClaim = deferred()
let historyCounter = 0
handler = (path, options) => isHistory(path) ? (++historyCounter === 1 ? staleBeforeClaim.promise : currentAfterClaim.promise) : success(path, options)
const staleClaimRead = historyStore.refresh()
await workStore.refresh()
assert.equal(historyCounter, 2, '状态重读必须废弃领取前在途履历再读取一次')
currentAfterClaim.resolve(response(historyPage([], 2, 11))); await tick()
staleBeforeClaim.resolve(response(historyPage([workRecord], 2, 11))); await staleClaimRead
assert.equal(historyStore.history.list.length, 0)
historyStore.close()
const beforeClosed = historyRequests().length
handler = success; await workStore.refresh()
assert.equal(historyRequests().length, beforeClosed)
console.log('PASS 状态更新废弃旧在途履历后刷新一次，关闭后桌宠更新不再读日志')

const rotateHistory = deferred(); handler = () => rotateHistory.promise
const rotatedRead = historyStore.open()
workAuth.accessToken = 'token-a-rotated-for-history'
rotateHistory.resolve(response(historyPage([], 2, 11))); await rotatedRead
assert.equal(historyStore.history.pagination.page, 2, '同账号令牌轮换保留在途读取')
const oldIdentity = deferred(); handler = () => oldIdentity.promise
const identityRead = historyStore.refresh()
context++; workAuth.account = { oId: 'another-owner' }; workAuth.accessToken = 'other-token'
oldIdentity.resolve(response(historyPage([workRecord], 2, 11))); await identityRead
assert.equal(historyStore.history, null)
assert.equal(historyStore.opened, false)
assert.equal(historyStore.filter, 'all')
assert.equal(historyStore.page, 1)
workAuth.accessToken = null
const beforeGuestHistory = calls.length; await historyStore.open(); await historyStore.refresh()
assert.equal(calls.length, beforeGuestHistory)
historyStore.$dispose(); workStore.$dispose()
console.log('PASS 日志普通轮换保留，换号清除/关闭且拒迟到响应，游客零请求')
// 第四批测试在同一真实 API/store 上继续运行。

const careRecord = { recordType: 'event', id: 'care-1', petId: 'pet-a', kind: 'care', action: 'feed', name: '喂食鲜果',
  occurredAt: now, itemChanges: [{ itemId: 'fruit', quantity: -1 }], coinsDelta: 0,
  effects: { hunger: 10.25, water: 0, mood: 8, energy: 0, experience: 2, friendship: 1 }, collectionId: null }
const craftRecord = { ...careRecord, id: 'craft-1', kind: 'craft', action: 'craft', name: '制作芦苇小舟',
  coinsDelta: -2, itemChanges: [{ itemId: 'reed', quantity: -2 }],
  effects: { hunger: 0, water: 0, mood: 0, energy: 0, experience: 0, friendship: 0 }, collectionId: 'reed-boat' }
const mixedJournal = api.decodePetJournal(historyPage([careRecord, craftRecord, oldRecord, workRecord]))
assert.equal(mixedJournal.list[0].effects.hunger, 10.25)
assert.equal(mixedJournal.list[0].itemChanges[0].quantity, -1)
assert.equal(mixedJournal.list[1].collectionId, 'reed-boat')
assert.equal(mixedJournal.list[2].actualRewards, null)
for (const patch of [{ recordType: 'fake' }, { kind: 'care', action: 'purchase' }, { effects: { ...careRecord.effects, hunger: Infinity } },
  { itemChanges: [{ itemId: 'fruit', quantity: 0 }] }, { collectionId: 'reed-boat' }, { coinsDelta: '2' },
  { itemChanges: [{ itemId: 'fruit', quantity: -1 }, { itemId: 'fruit', quantity: -2 }] }]) {
  assert.throws(() => api.decodePetJournal(historyPage([{ ...careRecord, ...patch }])))
}
assert.throws(() => api.decodePetJournal(historyPage([{ ...craftRecord, collectionId: null }])))
assert.throws(() => api.decodePetJournal({ ...historyPage([]), list: [workRecord], pagination: { page: 1, pageSize: 10, total: 1, pageCount: 1 } }))
console.log('PASS 统一日志按记录类型解码，保留实际小数效果、消费负数及旧成果未知，拒绝伪造类型与非法变化')

for (const patch of [{ recipes: undefined }, { collections: [{ id: 'other', name: '其他', description: '无对应收藏' }] },
  { recipes: [{ ...catalog.recipes[0], ingredients: [{ itemId: 'absent', quantity: 1 }] }] },
  { items: [{ ...catalog.items[0], effects: { ...catalog.items[0].effects, hunger: 20 } }, ...catalog.items.slice(1)] },
  { places: [{ ...catalog.places[0], rewards: { ...catalog.places[0].rewards, items: [{ itemId: 'absent', quantity: 1 }] } }] }]) {
  assert.throws(() => api.decodePetCatalog({ ...catalog, ...patch }))
}
assert.throws(() => api.decodePetState({ ...adopted(), collections: undefined }))
assert.throws(() => api.decodePetState({ ...adopted(), collections: [{ id: 'reed-boat', unlockedAt: now }, { id: 'reed-boat', unlockedAt: now }] }))
assert.equal(api.decodePetCatalog(catalog).items.find(item => item.id === 'sea-shell').price, null)
console.log('PASS 商品用途/不可购买材料与配方引用严格验证，缺失收藏数据不伪装为空')

setActivePinia(createPinia())
const exploreAuth = useAuthStore(), exploreStore = usePetsStore()
serverState = adopted(); handler = success; await exploreStore.ensureLoaded()
const beforeUntrained = calls.length
assert.equal(await exploreStore.startActivity('outing', 'lotus-pond'), false)
assert.equal(await exploreStore.craft('reed-boat'), false)
assert.equal(await exploreStore.buyItem('sea-shell', 1), false)
assert.equal(await exploreStore.buyItem('fruit', 21), false)
assert.equal(calls.length, beforeUntrained)
serverState.pet.skills[1].experience = 10
serverState.inventory.push({ itemId: 'reed', quantity: 1 })
await exploreStore.refresh()
const beforeInsufficient = calls.length
assert.equal(await exploreStore.craft('reed-boat'), false)
assert.equal(calls.length, beforeInsufficient)
let launched = false
handler = async (path, options) => {
  if (options?.method) {
    const body = JSON.parse(options.body)
    assert.equal(body.entryId, 'lotus-pond'); assert.equal(body.activityVersion, 3)
    launched = true
    return response({ operation: 'activity-start', petId: 'pet-a', activityId: 'advanced-1', committedAt: now })
  }
  return success(path, options)
}
assert.equal(await exploreStore.startActivity('outing', 'lotus-pond'), true)
assert(launched)
assert.equal(exploreStore.state.inventory.find(item => item.itemId === 'reed').quantity, 1, '出发回执不能预发材料')
console.log('PASS 进阶探索与制作门槛在本地阻止无效请求，出发不预发材料，不可购买资源无写请求')

handler = async (path, options) => {
  if (options?.method) {
    assert.deepEqual(JSON.parse(options.body), { petId: 'pet-a', itemId: 'fruit', quantity: 2, catalogVersion: 2 })
    serverState.inventory.push({ itemId: 'fruit', quantity: 2 }, { itemId: 'spring-water', quantity: 1 })
    serverState.wallet.coins -= 12
    return response({ operation: 'purchase', petId: 'pet-a', committedAt: now })
  }
  return success(path, options)
}
const beforeShop = calls.length
assert.equal(await exploreStore.buyItem('fruit', 2), true)
assert.equal(calls.length, beforeShop + 2, '购买仅一写一次聚合读取')
assert.equal(exploreStore.coins, 88)
const beforeWrongUse = calls.length
assert.equal(await exploreStore.act('feed', 'reed'), false)
assert.equal(await exploreStore.act('feed', 'spring-water'), false)
assert.equal(await exploreStore.act('water', 'fruit'), false)
assert.equal(calls.length, beforeWrongUse)
handler = success
assert.equal(await exploreStore.act('feed', 'fruit'), true)
assert.deepEqual(JSON.parse(writes().at(-1).options.body), { petId: 'pet-a', action: 'feed', itemId: 'fruit' })
assert.equal(await exploreStore.act('water', 'spring-water'), true)
assert.deepEqual(JSON.parse(writes().at(-1).options.body), { petId: 'pet-a', action: 'water', itemId: 'spring-water' })
assert.equal(await exploreStore.act('water'), true)
assert.deepEqual(JSON.parse(writes().at(-1).options.body), { petId: 'pet-a', action: 'water' })
console.log('PASS 商店冻结商品与价格版本，物品按用途使用，原免费饮水保留')

serverState.inventory.find(item => item.itemId === 'reed').quantity = 2
await exploreStore.refresh()
handler = async () => { throw new Error('制作回包中断') }
assert.equal(await exploreStore.craft('reed-boat'), false)
const frozenCraft = structuredClone({ ...exploreStore.pending })
assert.equal(frozenCraft.kind, 'crafts'); assert.equal(frozenCraft.recipeId, 'reed-boat')
assert.equal(exploreStore.state.collections.length, 0, '未知制作不能本地解锁收藏')
exploreAuth.accessToken = 'token-craft-rotated'
assert.deepEqual({ ...exploreStore.pending }, frozenCraft)
const beforeOtherCraft = calls.length
assert.equal(await exploreStore.craft('reed-boat'), false)
assert.equal(calls.length, beforeOtherCraft)
handler = async (path, options) => {
  if (options?.method) {
    assert.equal(options.headers['Idempotency-Key'], frozenCraft.key)
    assert.deepEqual(JSON.parse(options.body), { petId: 'pet-a', recipeId: 'reed-boat', catalogVersion: 2 })
    serverState.inventory.find(item => item.itemId === 'reed').quantity = 0
    serverState.wallet.coins -= 2
    serverState.collections.push({ id: 'reed-boat', unlockedAt: now })
    return response({ operation: 'craft', petId: 'pet-a', committedAt: now })
  }
  throw new Error('制作成功后状态读取断流')
}
assert.equal(await exploreStore.retryPending(), true)
assert.equal(exploreStore.pending, null)
assert.equal(exploreStore.state, null)
const confirmedCrafts = writes().length
assert.equal(await exploreStore.retryPending(), false)
assert.equal(writes().length, confirmedCrafts)
handler = success; await exploreStore.refresh()
assert.equal(exploreStore.state.collections[0].id, 'reed-boat')
const beforeDuplicate = calls.length
assert.equal(await exploreStore.craft('reed-boat'), false)
assert.equal(calls.length, beforeDuplicate)
console.log('PASS 制作未知结果保留原材料命令/键，令牌轮换不丢失，成功后读取失败不再消费，收藏不可重复制作')

const exploreHistory = usePetActivityHistoryStore()
handler = (path, options) => isHistory(path) ? Promise.resolve(response(historyPage([careRecord]))) : success(path, options)
await exploreHistory.open()
await exploreHistory.setFilter('care')
assert(calls.at(-1).path.includes('/journal?kind=care'))
assert.equal(exploreHistory.history.list[0].action, 'feed')
handler = (path, options) => isHistory(path) ? Promise.resolve(response(historyPage([workRecord]))) : success(path, options)
await exploreHistory.refresh()
assert.equal(exploreHistory.history, null, '分类错配不能让其他记录冒充日常')
assert(exploreHistory.error)
const staleCare = deferred(); handler = () => staleCare.promise
const staleCareRead = exploreHistory.refresh()
exploreHistory.close()
staleCare.resolve(response(historyPage([careRecord]))); await staleCareRead
assert.equal(exploreHistory.history, null)
exploreHistory.$dispose(); exploreStore.$dispose()
console.log('PASS 日常日志过滤走新接口，错误分类明确失败，关闭后迟到响应不再回写')
delete globalThis.__petTest
