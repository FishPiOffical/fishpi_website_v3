import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import ts from 'typescript'

// 真实本机 HTTP + 生产请求队列/验证码协调器；opener 代替人工操作，不证明极验供应商可用。
const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replaceAll('import.meta.env.SSR', 'false')
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const riskUrl = url(compile(await fs.readFile('src/utils/riskCaptcha.ts', 'utf8')))
const risk = await import(riskUrl)
const source = compile(await fs.readFile('src/api/http.ts', 'utf8')).replace("from '@/utils/riskCaptcha'", `from '${riskUrl}'`)
const api = await import(url(source))
const received = []
let blocked = true, permanent = false, lateResponse = null, releaseCredential = null
const server = http.createServer(async (req, res) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  received.push({ path: req.url, method: req.method, body: Buffer.concat(chunks).toString(), key: req.headers['idempotency-key'] })
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (req.url === '/api/v3/auth/session') { releaseCredential = () => send(200, { code: 0, data: {} }); return }
  if (req.url === '/validateCaptcha') { blocked = false; send(200, { code: 0 }); return }
  if (req.url === '/api/v3/fixture/unauthorized') { send(401, { code: 'unauthorized' }); return }
  if (req.url === '/api/v3/fixture/late' && blocked) {
    lateResponse = () => send(403, { code: 'captcha_required' })
    return
  }
  if (blocked || permanent) { send(403, { code: 'captcha_required', msg: '请完成人机验证后重试' }); return }
  send(200, { code: 0 })
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const nativeFetch = globalThis.fetch
globalThis.fetch = (path, init) => nativeFetch(new URL(path, base), init)
const storage = new Map()
globalThis.window = Object.assign(new EventTarget(), { sessionStorage: {
  getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
} })
let opens = 0, release, reject, passed = 0
window.addEventListener('fp:captcha-passed', () => passed++)
risk.registerRiskCaptchaOpener(() => {
  opens++
  return new Promise((resolve, fail) => { release = resolve; reject = fail })
})
const until = async predicate => {
  const deadline = Date.now() + 3000
  while (!predicate()) {
    if (Date.now() > deadline) throw Error('等待验证码测试事件超时')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}
async function pass() {
  await api.request('/validateCaptcha', { method: 'POST', body: '{}' })
  release()
}
try {
  api.setHomeReadsActive(true)
  const start = received.length
  const home = ['/api/v3/fixture/articles', '/api/v3/fixture/ranking', '/api/v3/fixture/tags'].map(path => api.request(path))
  await until(() => opens === 1)
  await new Promise(resolve => setTimeout(resolve, 300))
  assert.deepEqual(received.slice(start).map(x => x.path), ['/api/v3/fixture/articles'])
  await pass()
  await Promise.all(home)
  assert.equal(opens, 1)
  assert.equal(api.getHomeReadPause(), null)
  assert.equal(passed, 1)
  assert.equal(received.filter(x => x.path === '/api/v3/fixture/articles').length, 2)
  console.log('PASS captcha home: queued reads wait, proof submission bypasses queue, no pause/deadlock, one verification and one retry')

  api.setHomeReadsActive(false)
  blocked = true
  const before = opens
  const late = api.request('/api/v3/fixture/late')
  await until(() => lateResponse)
  const parallel = Array.from({ length: 4 }, (_, i) => api.request(`/api/v3/fixture/parallel-${i}`))
  await until(() => opens === before + 1)
  await pass()
  await Promise.all(parallel)
  lateResponse()
  await late
  assert.equal(opens, before + 1)
  console.log('PASS captcha concurrency: overlapping challenges and late old response share one completed verification')

  blocked = true
  api.setHomeReadsActive(true)
  const refresh = api.refreshAccessToken()
  await until(() => opens === before + 2)
  await pass()
  // 本机成功响应缺 accessToken，因此刷新明确失败；这里验证恢复没有与凭据队列互等。
  assert.equal(await refresh, false)
  assert.equal(api.getHomeReadPause(), null)
  api.setHomeReadsActive(false)
  console.log('PASS captcha refresh: verification does not hold credential queue while waiting for its own submission')

  blocked = true
  const controller = new AbortController()
  const count = received.filter(x => x.path === '/api/v3/fixture/cancel').length
  const cancelled = api.request('/api/v3/fixture/cancel', { signal: controller.signal })
  const assertion = assert.rejects(cancelled, error => error.code === 'aborted')
  await until(() => opens === before + 3)
  controller.abort()
  await pass()
  await assertion
  assert.equal(received.filter(x => x.path === '/api/v3/fixture/cancel').length, count + 1)

  blocked = true
  const mutationStart = received.length
  const mutation = api.request('/api/v3/fixture/write', { method: 'POST', headers: { 'Idempotency-Key': 'original-command' }, body: '{"value":1}' })
  await until(() => opens === before + 4)
  await pass()
  await mutation
  const writes = received.slice(mutationStart).filter(x => x.path === '/api/v3/fixture/write')
  assert.equal(writes.length, 2)
  assert.ok(writes.every(x => x.key === 'original-command' && x.body === '{"value":1}'))
  console.log('PASS captcha cancellation and pre-business write rejection: aborted read not replayed, allowed replay retains original key/body')

  blocked = true
  const oldIdentity = api.request('/api/v3/fixture/old-identity')
  const oldAssertion = assert.rejects(oldIdentity, error => error.code === 'aborted')
  await until(() => opens === before + 5)
  api.setAccessToken(null)
  await pass()
  await oldAssertion

  blocked = true
  const dismissed = api.request('/api/v3/fixture/dismiss')
  const dismissAssertion = assert.rejects(dismissed, error => error.code === 'captcha_required')
  await until(() => opens === before + 6)
  reject(new Error('已取消人机验证'))
  await dismissAssertion
  assert.equal(blocked, true)

  permanent = true
  const retryOnce = api.request('/api/v3/fixture/persistent')
  const onceAssertion = assert.rejects(retryOnce, error => error.code === 'captcha_required')
  await until(() => opens === before + 7)
  await pass()
  await onceAssertion
  assert.equal(received.filter(x => x.path === '/api/v3/fixture/persistent').length, 2)
  permanent = false
  const noOpen = opens
  await assert.rejects(api.request('/api/v3/fixture/unauthorized'), error => error.status === 401)
  assert.equal(opens, noOpen)
  api.setHomeReadsActive(true)
  blocked = true
  const batchOpens = opens
  const dismissedBatch = Promise.all(Array.from({ length: 3 }, (_, i) => assert.rejects(
    api.request(`/api/v3/fixture/dismiss-queued-${i}`), error => error.code === 'captcha_required')))
  await until(() => opens === batchOpens + 1)
  reject(new Error('已取消人机验证'))
  await dismissedBatch
  assert.equal(opens, batchOpens + 1)
  api.setHomeReadsActive(false)
  console.log('PASS captcha identity/cancel/final rejection: no stale replay, cancellation preserves restriction, one retry maximum, ordinary 401 never opens captcha')

  blocked = true
  const textOpens = opens
  const guard = api.request('/api/v3/fixture/text-guard')
  const guardAssertion = assert.rejects(guard, error => error.code === 'aborted')
  await until(() => opens === textOpens + 1)
  const textStart = received.length
  const text = api.requestText('/api/v3/fixture/text-old-identity')
  const textAssertion = assert.rejects(text, error => error.code === 'aborted')
  api.setAccessToken(null)
  await pass()
  await Promise.all([guardAssertion, textAssertion])
  assert.ok(!received.slice(textStart).some(x => x.path === '/api/v3/fixture/text-old-identity'))
  console.log('PASS text request waiting for shared verification never sends after identity change')

  // 执行真实 entry-client 启动逻辑，替代应用/Store挂载边界，transport仍走本机HTTP。
  const httpUrl = url(source)
  const startup = { mounts: 0, retries: 0, payload: {}, home: false }
  globalThis.__captchaStartup = startup
  window.addEventListener('fp:retry-public', () => startup.retries++)
  const appUrl = url(`export const createFishpiApp=()=>({app:{mount(){globalThis.__captchaStartup.mounts++}},router:{isReady:()=>Promise.resolve(),currentRoute:{value:{name:'fixture'}}},pinia:{}})`)
  const storesUrl = url(`const store=()=>({restore(){},load(){},start(){}});export const useHomeLayoutStore=store,useAppearanceStore=store,useAdsStore=store,useClientStartupStore=store`)
  const payloadUrl = url('export const takeClientPayload=()=>globalThis.__captchaStartup.payload')
  const clientSource = compile(await fs.readFile('src/entry-client.ts', 'utf8'))
    .replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
    .replace("from './api/http'", `from '${httpUrl}'`).replace("from './app'", `from '${appUrl}'`)
    .replace(/from '\.\/stores\/[^']+'/g, `from '${storesUrl}'`)
    .replace("from './seo/payload'", `from '${payloadUrl}'`)
  async function startClient(n, payload) {
    startup.payload = payload
    await import(url(clientSource + `\n// run ${n}`))
  }
  const probes = () => received.filter(x => x.path === '/api/v3/auth/captcha-options').length
  const probeStart = probes(), startupOpens = opens
  await startClient(1, {})
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(probes(), probeStart)
  blocked = false
  await startClient(2, { upstreamCaptcha: true })
  await until(() => startup.retries === 1)
  assert.equal(probes(), probeStart + 1)
  assert.equal(opens, startupOpens)
  blocked = true
  await startClient(3, { upstreamCaptcha: true })
  await until(() => opens === startupOpens + 1)
  assert.equal(startup.mounts, 3)
  await pass()
  await until(() => startup.retries === 2)
  assert.equal(probes(), probeStart + 3)
  assert.equal(opens, startupOpens + 1)
  console.log('PASS SSR client recovery: no flag/no probe, server-only restriction never opens browser captcha, actual browser restriction verifies after mounting and resumes public reads')

  api.setHomeReadsActive(false)
  api.setAccessToken('fixture-old-identity')
  const credentialStart = received.length
  const heldCredential = api.request('/api/v3/auth/session', { method: 'POST' })
  await until(() => releaseCredential)
  const staleRefresh = api.refreshAccessToken()
  await new Promise(resolve => setTimeout(resolve, 20))
  api.setAccessToken(null)
  releaseCredential()
  await heldCredential
  assert.equal(await staleRefresh, false)
  assert.deepEqual(received.slice(credentialStart).map(x => x.path), ['/api/v3/auth/session'])
  console.log('PASS queued refresh rechecks identity at credential dispatch: logout prevents any stale Cookie request')

  const diagnostics = JSON.parse(window.fpCaptchaDiagnostics.export()).events
  const recovery = diagnostics.find(event => event.event === 'recovery.start')
  assert.ok(recovery?.requestId && recovery.flowId)
  assert.ok(diagnostics.some(event => event.event === 'opener.open' && event.flowId === recovery.flowId))
  assert.ok(diagnostics.some(event => event.event === 'recovery.success' && event.flowId === recovery.flowId))
  assert.ok(diagnostics.some(event => event.event === 'proof.result' && event.flowId === recovery.flowId && event.code === 0))
  assert.ok(diagnostics.some(event => event.event === 'request.retry-result' && event.requestId === recovery.requestId && event.flowId === recovery.flowId && event.reason === 'success'))
  assert.ok(diagnostics.some(event => event.event === 'http.dispatch' && typeof event.authorizationAttached === 'boolean'))
  assert.ok(diagnostics.some(event => event.event === 'challenge.late'))
  assert.ok(diagnostics.some(event => event.event === 'request.retry-result' && event.code === 'captcha_required'))
  assert.ok(!window.fpCaptchaDiagnostics.export().includes('fixture-old-identity'))
  assert.ok(!window.fpCaptchaDiagnostics.export().includes('original-command'))
  assert.ok(!window.fpCaptchaDiagnostics.export().includes('"value":1'))
  console.log('PASS captcha diagnostics: request/flow/proof/retry linked, late and persistent challenges visible, credentials and payload omitted')
} finally {
  risk.registerRiskCaptchaOpener(null)
  globalThis.fetch = nativeFetch
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
