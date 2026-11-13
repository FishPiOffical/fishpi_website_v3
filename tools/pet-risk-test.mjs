import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { ref } from 'vue'

// 仅加载隔离 worktree 中的真实适配器和 store；所有传输都是内存夹具，不访问业务服务。
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const compile = source => url(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
const suite = await fs.readFile('tools/pets-test.mjs', 'utf8')
const start = suite.indexOf('const catalog = {'), end = suite.indexOf('\nconst writes =')
assert(start >= 0 && end > start)
const { catalog, adopted, response } = await import(compile(`${suite.slice(start, end)}\nexport { catalog, adopted, response }`))
class ApiError extends Error { constructor(message, status = 0, code) { super(message); this.status = status; this.code = code } }
let context = 1, serial = 0, handler
const calls = []
const useAuthStore = defineStore('pet-risk-auth', () => ({ accessToken: ref('token-a'), account: ref({ oId: 'A' }) }))
globalThis.__petRisk = { ApiError, getAuthContextVersion: () => context, useAuthStore, profileOperationKey: () => `risk:${++serial}`,
  request: (path, init) => { calls.push({ path, init }); return handler(path, init) } }
globalThis.window = new EventTarget()
globalThis.document = Object.assign(new EventTarget(), { hidden: false })
globalThis.BroadcastChannel = class { postMessage() {} close() {} }
const transport = url('export const { ApiError,getAuthContextVersion,request }=globalThis.__petRisk')
const apiUrl = compile((await fs.readFile('src/api/v3-pets.ts', 'utf8')).replace("from './http'", `from '${transport}'`))
const api = await import(apiUrl)
let source = await fs.readFile('src/stores/pets.ts', 'utf8')
for (const [name, target] of [
  ['vue', import.meta.resolve('vue')], ['pinia', import.meta.resolve('pinia')], ['@/api/http', transport], ['@/api/v3-pets', apiUrl],
  ['@/api/v3-profile', url('export const {profileOperationKey}=globalThis.__petRisk')],
  ['@/stores/auth', url('export const {useAuthStore}=globalThis.__petRisk')],
]) source = source.replaceAll(`from '${name}'`, `from '${target}'`)
const { usePetsStore } = await import(compile(source.replaceAll('import.meta.env.SSR', 'false')))
const proof = { lot_number: 'fixture-lot', captcha_output: 'fixture-output', pass_token: 'fixture-pass', gen_time: '1' }
const writes = () => calls.filter(call => /\/pet\/(?:actions|purchases|supplies)$/.test(call.path))
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
let store, auth, server, fault, blocked, granted, retryAt, serverOffset, readFault, verifyFault, challengeFault, stateReads
function reset() {
  store?.$dispose()
  setActivePinia(createPinia())
  auth = useAuthStore(); store = usePetsStore(); server = adopted(); server.pet.hunger = server.pet.water = 60
  fault = ''; blocked = false; granted = false; retryAt = 0; serverOffset = 0; readFault = ''; verifyFault = ''; challengeFault = ''; stateReads = 0; calls.length = 0
  handler = async (path, init) => {
    const now = Date.now() + serverOffset
    if (path === '/api/v3/pets/catalog') return response(catalog)
    if (path === '/api/v3/me/pet') { stateReads++; if (readFault) { readFault = ''; throw new ApiError('读取中断', 0) } return response(server) }
    if (path.endsWith('/risk')) return response({ serverNow: now, retryAt, verificationRequired: blocked })
    if (path.endsWith('/risk/challenge')) {
      if (challengeFault) throw new ApiError('挑战服务暂不可用', 503)
      const input = JSON.parse(init.body)
      return response({ ...input, challengeId: 'challenge-a', provider: 'geetest4', captchaId: 'fixture-captcha', expiresAt: now + 300_000, serverNow: now, verified: granted })
    }
    if (path.endsWith('/risk/verify')) {
      const input = JSON.parse(init.body)
      assert.equal(input.challengeId, 'challenge-a'); assert.deepEqual(JSON.parse(input.captcha), proof)
      if (verifyFault === 'invalid') throw new ApiError('验证未通过', 422, 'invalid_captcha')
      granted = true
      if (verifyFault === 'body') throw new ApiError('正文中断', 0)
      return response({ verified: true, operation: api.petRiskOperation(store.pending), idempotencyKey: store.pending.key, expiresAt: now + 900_000, serverNow: now })
    }
    if (fault === 'verification') { blocked = true; granted = false; throw new ApiError('请完成验证', 403, 'pet_verification_required') }
    if (fault === 'cooldown') { const e = new ApiError('请稍后', 429, 'pet_rate_limited'); e.retryAfter = '60'; throw e }
    if (fault === 'unknown') throw new ApiError('正文读取中断', 0)
    if (fault === 'rejected') throw new ApiError('无法操作', 409, 'pet_busy')
    const input = JSON.parse(init.body)
    if (path.endsWith('/actions')) server.pet.water = Math.min(100, server.pet.water + 20)
    return response({ petId: server.pet.id, committedAt: now, operation: path.endsWith('/actions') ? input.action : path.endsWith('/purchases') ? 'purchase' : 'supplies' })
  }
}
async function init() { reset(); await store.ensureLoaded() }

await init()
assert.equal(calls.length, 2)
assert.equal(calls.some(call => call.path.includes('/risk')), false)
fault = 'verification'
assert.equal(await store.act('water'), false)
const frozen = structuredClone({ ...store.pending })
assert.equal(store.pendingUncertain, false); assert.equal(store.riskStage, 'verification'); assert.equal(store.confirmedEvent, null)
await store.prepareRisk()
assert.equal(store.riskOpen, true); assert.equal(store.riskChallenge.operation, 'action')
assert.equal(store.riskChallenge.idempotencyKey, frozen.key)
store.closeRisk()
assert.deepEqual({ ...store.pending }, frozen); assert.equal(store.riskChallenge, null)
assert.equal(await store.submitRiskProof(proof), false)
auth.accessToken = 'token-a-rotated'
await store.prepareRisk()
assert.equal(await store.submitRiskProof(proof), true)
assert.equal(store.riskStage, 'ready'); assert.equal(writes().length, 1, '验证后不能偷偷重发业务写')
fault = ''
await store.retryPending()
assert.equal(writes().length, 2); assert.deepEqual(writes()[1].init.body, writes()[0].init.body)
assert.equal(writes()[1].init.headers['Idempotency-Key'], frozen.key)
assert.equal(store.pending, null); assert.equal(store.pet.water, 80); assert.equal(store.confirmedEvent.action, 'water')
console.log('PASS 首次拒绝保留原命令，取消证明、普通令牌轮换、验证和手动同键继续，无额外逐次风控读取')

await init(); fault = 'verification'; await store.buyItem('food', 2); await store.prepareRisk()
verifyFault = 'invalid'
assert.equal(await store.submitRiskProof(proof), false)
assert.equal(store.pendingUncertain, false); assert.equal(store.riskStage, 'verification'); assert.equal(writes().length, 1)
await store.prepareRisk(); verifyFault = 'body'
assert.equal(await store.submitRiskProof(proof), false)
assert.ok(store.pending); assert.equal(writes().length, 1)
verifyFault = ''; await store.prepareRisk()
assert.equal(store.riskStage, 'ready', '验证回执断流后只能重新核对状态，不能消费')
fault = ''; readFault = 'network'
assert.equal(await store.retryPending(), true)
assert.equal(store.pending, null); assert.equal(store.refreshNeeded, true); assert.equal(store.confirmedEvent, null)
await store.refresh()
assert.equal(writes().length, 2); assert.equal(store.confirmedEvent, null)
console.log('PASS 错误证明/验证回执断流不丢命令，确认后GET失败仅重读且不补动画')

await init(); fault = 'unknown'; await store.act('water')
const unknown = store.pending.key
assert.equal(store.pendingUncertain, true)
fault = 'verification'; await store.retryPending()
assert.equal(store.pending.key, unknown); assert.equal(store.pendingUncertain, true)
store.cancelRejectedOperation()
assert.equal(store.pending.key, unknown, '不能取消结果未知的消费')
await store.prepareRisk(); await store.submitRiskProof(proof)
fault = 'rejected'; await store.retryPending()
assert.equal(store.pending.key, unknown, '未知恢复后的4xx不能证明原操作未提交')
assert.equal(store.pendingUncertain, true)
console.log('PASS 未知恢复经历风险验证仍保持未知，禁止放弃或用4xx清除原命令')

await init(); fault = 'verification'; await store.act('water'); await store.prepareRisk(); await store.submitRiskProof(proof)
fault = 'rejected'; await store.retryPending()
assert.equal(store.pending, null, '首次风险拒绝未执行，继续后明确拒绝可以清理')
console.log('PASS 首次明确未执行与未知恢复分开，后续业务拒绝不会永远锁住')

await init(); fault = 'verification'; await store.act('water'); await store.prepareRisk(); await store.submitRiskProof(proof)
const firstRejectedKey = store.pending.key
fault = 'unknown'; await store.retryPending()
assert.equal(store.pending.key, firstRejectedKey); assert.equal(store.pendingUncertain, true); assert.equal(store.riskOpen, false)
fault = 'verification'; await store.retryPending()
store.cancelRejectedOperation()
assert.equal(store.pending.key, firstRejectedKey); assert.equal(store.pendingUncertain, true)
await store.prepareRisk(); await store.submitRiskProof(proof)
store.closeRisk(); await store.prepareRisk()
assert.equal(store.riskStage, 'ready'); assert.equal(store.pending.key, firstRejectedKey)
fault = 'verification'; await store.retryPending()
assert.equal(store.riskStage, 'verification', '服务端再次要求验证时不能沿用旧授权')
await store.prepareRisk()
assert.ok(store.riskChallenge); assert.equal(store.pendingUncertain, true)
console.log('PASS 首次拒绝继续时响应丢失转为未知，关闭重开保留命令，授权失效后重新验证')

await init(); fault = 'cooldown'; await store.act('water')
const rateKey = store.pending.key, count = calls.length
await store.retryPending(); await store.prepareRisk(); await store.act('water')
assert.equal(calls.length, count, '冷却期间点击、重新验证均不得请求')
window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online'))
assert.equal(writes().length, 1)
assert.equal(store.pending.key, rateKey); assert.ok(store.riskUntil - Date.now() > 58_000)
store.cancelRejectedOperation(); assert.equal(store.pending.key, rateKey, '不能借放弃清掉账号冷却并立即换键重试')
store.riskUntil = 0; store.cancelRejectedOperation(); assert.equal(store.pending, null)
console.log('PASS Retry-After期间无写入/验证请求风暴，用户可放弃首次明确拒绝的操作')

await init(); fault = 'verification'; await store.act('water')
serverOffset = -86_400_000
retryAt = Date.now() + serverOffset + 120_000
await store.prepareRisk()
assert.equal(store.riskStage, 'cooldown'); assert.ok(Math.abs(store.riskUntil - Date.now() - 120_000) < 1000)
store.riskUntil = 0; retryAt = 0
await store.prepareRisk(); assert.ok(store.riskChallenge)
assert.equal(await store.submitRiskProof(proof), true, '时钟偏移一天也应可验证有效挑战')
console.log('PASS 后端时间换算为本机倒计时，系统时钟偏移不误伤验证')

await init(); fault = 'verification'; await store.act('water')
challengeFault = true; await store.prepareRisk()
assert.equal(store.riskBusy, false); assert.ok(store.riskError); assert.ok(store.pending)
challengeFault = false
const originalHandler = handler, hold = deferred()
handler = async (path, init) => path.endsWith('/risk/challenge') ? hold.promise : originalHandler(path, init)
const preparing = store.prepareRisk()
await Promise.resolve(); await Promise.resolve()
context++; auth.account = { oId: 'B' }; auth.accessToken = 'token-b'
hold.resolve(response({ challengeId: 'late', operation: 'action', idempotencyKey: 'old', expiresAt: Date.now() + 10000, provider: 'geetest4', captchaId: 'old' }))
await preparing
assert.equal(store.riskOpen, false); assert.equal(store.pending, null); assert.equal(store.riskChallenge, null)
console.log('PASS 挑战服务故障无自动循环，换号取消旧验证并拒绝迟到挑战')

await init(); fault = 'verification'; await store.act('water'); await store.prepareRisk()
const beforeVerify = handler, verification = deferred()
handler = async (path, init) => path.endsWith('/risk/verify') ? verification.promise : beforeVerify(path, init)
const verifying = store.submitRiskProof(proof)
store.closeRisk()
verification.resolve(response({ verified: true, operation: 'action', idempotencyKey: store.pending.key, expiresAt: Date.now() + 300_000 }))
await verifying
assert.equal(store.riskOpen, false); assert.equal(store.riskStage, 'verification'); assert.ok(store.pending)
assert.equal(writes().length, 1)
console.log('PASS 关闭窗口取消验证请求，迟到验证结果不自动继续或丢原命令')

await init(); fault = 'verification'; await store.act('water'); await store.prepareRisk()
const pendingKey = store.pending.key
window.dispatchEvent(new Event('offline'))
assert.equal(store.riskChallenge, null); assert.equal(store.pending.key, pendingKey); assert.equal(store.offline, true)
assert.equal(await store.submitRiskProof(proof), false)
window.dispatchEvent(new Event('online'))
assert.equal(writes().length, 1)
console.log('PASS 离线销毁证明，联网只恢复读取不重发业务操作')

const care = adopted(); care.pet.careAvailableAt = { feed: Date.now(), water: Date.now() + 300000 }
assert.deepEqual(api.decodePetState(care).pet.careAvailableAt, care.pet.careAvailableAt)
assert.equal(api.decodePetState(adopted()).pet.careAvailableAt, undefined)
care.pet.careAvailableAt.feed = -1
assert.throws(() => api.decodePetState(care))
for (const [kind, expected] of [['actions', 'action'], ['purchases', 'purchase'], ['activities', 'activity-start'], ['activities/claim', 'activity-claim'], ['crafts', 'craft'], ['stories/claim', 'story-claim'], ['readoption', 'readoption']]) {
  assert.equal(api.petRiskOperation({ kind }), expected)
}
console.log('PASS 风控命令目录与可选喂食饮水截止时间白名单')
store.$dispose()

// 传输专项使用真实http实现，只替换fetch：宠物局部429不能触发全站首页暂停或全局验证码。
let captchaCalls = 0, fetchCalls = 0
const captchaStub = url('export const ensureRiskCaptcha=()=>globalThis.__captchaProbe()')
globalThis.__captchaProbe = () => { captchaCalls++; return Promise.resolve() }
window.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} }
window.location = { origin: 'http://fixture.invalid' }
globalThis.location = window.location
const http = await import(compile((await fs.readFile('src/api/http.ts', 'utf8'))
  .replace("from '@/utils/riskCaptcha'", `from '${captchaStub}'`).replaceAll('import.meta.env', '({SSR:false})')))
http.setAccessToken('fixture')
http.setHomeReadsActive(true)
let responseCode = 'pet_rate_limited', responseStatus = 429
globalThis.fetch = async () => { fetchCalls++; return new Response(JSON.stringify({ code: responseCode, msg: '局部保护', data: null }), { status: responseStatus, headers: { 'Content-Type': 'application/json', 'Retry-After': '75' } }) }
for (const code of ['pet_rate_limited', 'pet_transport_limited']) {
  responseCode = code
  await assert.rejects(() => http.request('/api/v3/me/pet/risk'), error => error.code === code && error.retryAfter === '75')
  assert.equal(http.getHomeReadPause(), null)
}
responseCode = 'pet_verification_required'; responseStatus = 403
await assert.rejects(() => http.request('/api/v3/me/pet/actions', { method: 'POST', body: '{}' }), error => error.code === 'pet_verification_required')
assert.equal(captchaCalls, 0); assert.equal(fetchCalls, 3)
responseCode = 'rate_limited'; responseStatus = 429
await assert.rejects(() => http.request('/api/v3/articles'), error => error.code === 'home_reads_paused')
assert.ok(http.getHomeReadPause(), '其它接口仍保持原有全站保护')
console.log('PASS 真实HTTP保留宠物429及Retry-After，只局部冷却，不自动验证码/重试，不改变其它接口保护')
console.log('PASS 宠物风控前端专项全部通过（无真实账号/数据库/后台长测请求）')
