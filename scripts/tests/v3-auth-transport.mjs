import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, setActivePinia } from 'pinia'

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  } }).outputText).toString('base64')}`
}
async function transport(ssr = false) {
  let source = await fs.readFile(new URL('../../src/api/http.ts', import.meta.url), 'utf8')
  source = source.replace("import { ensureRiskCaptcha } from '@/utils/riskCaptcha'", 'const ensureRiskCaptcha = async () => {}')
    .replaceAll('import.meta.env.SSR', String(ssr)).replaceAll('import.meta.env.VITE_API_TARGET', "''")
  // Each case gets an isolated browser realm without touching a real backend or storage.
  return { url: moduleUrl(source + `\n// realm ${Math.random()}`), module: null }
}
async function fixture(ssr = false) {
  const t = await transport(ssr)
  const http = await import(t.url)
  let source = await fs.readFile(new URL('../../src/stores/auth.ts', import.meta.url), 'utf8')
  source = source.replace("from '@/api/http'", `from '${t.url}'`)
    .replace("import { clearCache } from '@/utils/swr'", 'const clearCache = () => {}')
    .replace(/import \{ (?:fetchMembership, )?login as loginApi[^\n]+/, `
const fetchMembership = async () => ({ isVip: false })
const loginApi = async (username, passwd, mfaCode) => {
  const res = await request('/api/v3/auth/login', { method: 'POST', body: JSON.stringify({ nameOrEmail: username, userPassword: passwd, mfaCode }) })
  if (res.code !== 0 || !res.data?.accessToken) throw new ApiError('登录失败', 401)
  return res.data.accessToken
}`)
    .replace("from 'pinia'", `from '${import.meta.resolve('pinia')}'`)
    .replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
    .replaceAll('import.meta.env.SSR', String(ssr))
  const { useAuthStore } = await import(moduleUrl(source))
  setActivePinia(createPinia())
  return { http, store: useAuthStore(), useAuthStore }
}
const response = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
})
const okToken = (token) => response({ code: 0, data: { accessToken: token } })
const me = (name = 'alice') => response({ code: 0, data: { id: '1', userName: name } })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const next = () => new Promise(resolve => setImmediate(resolve))
let groups = 0
async function check(name, run) { await run(); console.log(`PASS ${++groups}: ${name}`) }

await check('first /me sees login token synchronously; no persistent credentials', async () => {
  const { store, http } = await fixture()
  globalThis.fetch = async (path, init) => {
    if (path.endsWith('/login')) return okToken('login-token')
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer login-token')
    return me()
  }
  await store.login('alice', 'hash')
  assert.equal(store.account.userName, 'alice')
  assert.equal(http.getAccessToken(), store.accessToken)
  assert.equal(store.apiKey, null)
})
await check('concurrent 401s share one refresh and synchronize store token', async () => {
  const { store, http } = await fixture()
  http.setAccessToken('old')
  let refreshes = 0
  const gate = deferred()
  globalThis.fetch = async (path, init) => {
    if (path.endsWith('/refresh')) { refreshes++; await gate.promise; return okToken('new') }
    return new Headers(init.headers).get('Authorization') === 'Bearer new' ? me() : response({}, 401)
  }
  const calls = Array.from({ length: 8 }, () => http.request('/api/v3/me'))
  await next(); assert.equal(refreshes, 1); gate.resolve()
  await Promise.all(calls)
  assert.equal(refreshes, 1); assert.equal(store.accessToken, 'new')
})
await check('late old-token 401 retries current token without second rotation', async () => {
  const { http } = await fixture()
  http.setAccessToken('old')
  let refreshes = 0
  const slow = deferred()
  globalThis.fetch = async (path, init) => {
    if (path.endsWith('/refresh')) { refreshes++; return okToken('new') }
    if (new Headers(init.headers).get('Authorization') === 'Bearer new') return me()
    if (path.endsWith('/slow')) await slow.promise
    return response({}, 401)
  }
  const delayed = http.request('/api/v3/slow')
  await http.request('/api/v3/me')
  slow.resolve(); await delayed
  assert.equal(refreshes, 1)
})
await check('auth endpoints never refresh recursively; login failures stay failures', async () => {
  const { store, http } = await fixture()
  const paths = []
  globalThis.fetch = async path => { paths.push(path); return response({}, 401) }
  await assert.rejects(store.login('wrong', 'wrong'))
  assert.deepEqual(paths, ['/api/v3/auth/login'])
  await http.refreshAccessToken(); assert.equal(paths.length, 2)
  await store.logout(); assert.equal(paths.length, 3)
  assert.equal(store.accessToken, null)
})
await check('logout invalidates pending refresh and cookie requests run FIFO before new login', async () => {
  const { store, http } = await fixture()
  http.setAccessToken('old')
  const gate = deferred(), paths = []
  globalThis.fetch = async (path, init) => {
    paths.push(path)
    if (path.endsWith('/refresh')) { await gate.promise; return okToken('stale') }
    if (path.endsWith('/logout')) return response({ code: 0, data: {} })
    if (path.endsWith('/login')) return okToken('fresh')
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer fresh')
    return me('bob')
  }
  const restoring = http.refreshAccessToken()
  await next()
  const leaving = store.logout()
  const entering = store.login('bob', 'hash')
  gate.resolve()
  assert.equal(await restoring, false)
  await Promise.all([leaving, entering])
  assert.deepEqual(paths.slice(0, 3), ['/api/v3/auth/refresh', '/api/v3/auth/logout', '/api/v3/auth/login'])
  assert.equal(store.accessToken, 'fresh'); assert.equal(store.account.userName, 'bob')
})
await check('restore single flight; route and mounted calls do not rotate twice', async () => {
  const { store } = await fixture()
  let count = 0
  globalThis.fetch = async path => {
    if (path.endsWith('/refresh')) { count++; return okToken('restored') }
    return me()
  }
  await Promise.all([store.restore(), store.restore(), store.restore()])
  await store.restore()
  assert.equal(count, 1); assert.equal(store.initialized, true)
})
await check('SSR stores never share transport credentials or issue auth restoration', async () => {
  const { http, store, useAuthStore } = await fixture(true)
  globalThis.fetch = async (_path, init) => {
    assert.equal(new Headers(init.headers).get('Authorization'), null)
    return me()
  }
  http.setAccessToken('must-not-leak')
  await store.restore(); assert.equal(http.getAccessToken(), null)
  setActivePinia(createPinia())
  const other = useAuthStore()
  assert.equal(other.accessToken, null); assert.equal(store.accessToken, null)
  await http.request('/api/v3/me')
})
await check('legacy and external URLs get no Bearer; explicit auth does not refresh', async () => {
  const { http } = await fixture()
  http.setAccessToken('secret')
  let count = 0
  globalThis.fetch = async (_path, init) => {
    count++; assert.notEqual(new Headers(init.headers).get('Authorization'), 'Bearer secret')
    return response({}, 401)
  }
  await assert.rejects(http.request('/api/user'))
  await assert.rejects(http.request('https://elsewhere.test/api/v3/me'))
  await assert.rejects(http.request('/api/v3/me', { headers: { Authorization: 'Bearer explicit' } }))
  assert.equal(count, 3)
})
await check('concurrent logins cannot let an older /me replace a later identity', async () => {
  const { store } = await fixture()
  const firstMe = deferred()
  globalThis.fetch = async (path, init) => {
    if (path.endsWith('/login')) return okToken(JSON.parse(init.body).nameOrEmail)
    const token = new Headers(init.headers).get('Authorization')
    if (token === 'Bearer alice') { await firstMe.promise; return me('alice') }
    return me('bob')
  }
  const first = store.login('alice', 'hash')
  const oldResult = assert.rejects(first, /登录状态已变更/)
  await next()
  await store.login('bob', 'hash')
  firstMe.resolve(); await oldResult
  assert.equal(store.account.userName, 'bob'); assert.equal(store.accessToken, 'bob')
})
await check('malformed or temporarily failing refresh preserves prior token; definitive expiry clears it', async () => {
  const { store, http } = await fixture()
  http.setAccessToken('still-current')
  globalThis.fetch = async () => response({ code: 0, data: {} })
  assert.equal(await http.refreshAccessToken(), false)
  assert.equal(store.accessToken, 'still-current')
  globalThis.fetch = async () => response({}, 503)
  assert.equal(await http.refreshAccessToken(), false)
  assert.equal(store.accessToken, 'still-current')
  globalThis.fetch = async () => response({}, 401)
  assert.equal(await http.refreshAccessToken(), false)
  assert.equal(store.accessToken, null)
})
await check('definitive anonymous restore is not repeated on every public navigation', async () => {
  const { store, http } = await fixture()
  let refreshes = 0
  globalThis.fetch = async () => { refreshes++; return response({}, 401) }
  await store.restore()
  await store.restore()
  assert.equal(refreshes, 1)
  assert.equal(store.initialized, true)
  assert.equal(http.wasRefreshRejected(), true)
  http.setAccessToken('new-explicit-login')
  assert.equal(http.wasRefreshRejected(), false)
})
await check('login membership refresh uses only current-owner v3 resource', async () => {
  const { store } = await fixture()
  const paths = []
  globalThis.fetch = async (path) => {
    paths.push(path)
    if (path.endsWith('/login')) return okToken('member-token')
    if (path.endsWith('/membership')) return response({ code: 0, data: { active: true } })
    return me()
  }
  await store.login('alice', 'hash')
  assert.equal(store.isVip, true)
  assert.ok(paths.every(path => path.startsWith('/api/v3/')))
  assert.ok(paths.includes('/api/v3/me/membership'))
})
console.log(`${groups} auth transport groups passed; only mocked fetch was used.`)
