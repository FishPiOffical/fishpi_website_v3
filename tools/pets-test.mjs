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
  version: 1,
  activityVersion: 1,
  skills: ['vitality', 'exploration', 'knowledge', 'expression', 'crafting', 'kindness'].map(id => ({ id, name: id, description: '入门技能' })),
  places: [{ id: 'plaza', name: '广场散步', description: '和伙伴走一走', durationMs: 300000,
    cost: { coins: 0, energy: 5, hunger: 2, water: 3 },
    rewards: { experience: 10, food: 0, mood: 8, skills: [{ id: 'exploration', experience: 3 }] } }],
  courses: [{ id: 'reading-basics', name: '阅读入门', description: '认识新的知识', durationMs: 600000,
    cost: { coins: 5, energy: 8, hunger: 3, water: 4 },
    rewards: { experience: 15, food: 0, mood: 3, skills: [{ id: 'knowledge', experience: 10 }] } }],
  species: ['momota', 'hexiaotun', 'yubingmiao', 'paixiaoyu'].map(id => ({ id, name: id, description: '社区伙伴' })),
  items: [{ id: 'food', name: '基础口粮', price: 5, hunger: 35 }],
  rules: { maxNameLength: 12, initialCoins: 100, initialFood: 6, dailyCoins: 20, dailyFood: 2,
    restDurationMs: 14400000, restEnergyPerHour: 20, growthDailyLimit: 10 },
}
const now = Date.UTC(2026, 10, 12, 10)
const empty = () => ({ serverNow: now, today: '2026-11-12', catalogVersion: 1, wallet: { coins: 0 },
  inventory: [], dailySupply: { claimed: false, coins: 20, food: 2 }, pet: null })
const adopted = () => ({ ...empty(), wallet: { coins: 100 }, inventory: [{ itemId: 'food', quantity: 6 }], pet: {
  id: 'pet-a', speciesId: 'hexiaotun', name: '荷小豚', hunger: 90, water: 90, mood: 90, energy: 80,
  experience: 0, level: 1, friendship: 0, adoptedAt: now - 3600000, activity: null,
  skills: catalog.skills.map(skill => ({ id: skill.id, experience: 0, level: 1 })),
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
assert.equal(store.catalog.version, 1)
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
assert.deepEqual(JSON.parse(writes().at(-1).options.body), { petId: 'pet-a', kind: 'outing', entryId: 'plaza', activityVersion: 1 })
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
delete globalThis.__petTest
