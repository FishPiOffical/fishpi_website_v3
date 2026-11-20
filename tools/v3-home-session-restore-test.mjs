import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import ts from 'typescript'
import { createPinia } from 'pinia'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const pauseKey = 'fp.home-read-pause-until'
const originalWindow = globalThis.window
const originalFetch = globalThis.fetch
const httpSource = await fs.readFile('src/api/http.ts', 'utf8')
const authSource = await fs.readFile('src/stores/auth.ts', 'utf8')
let requests = []
let refreshStatus = 200
let accountStatus = 200
let challenge = false
let verified = false
let captchaCalls = 0
let fixtureNumber = 0

globalThis.__homeSessionCaptcha = async () => {
  captchaCalls++
  verified = true
}

const server = http.createServer((request, response) => {
  requests.push(request.url)
  const reply = (status, body, headers = {}) => {
    response.writeHead(status, { 'Content-Type': 'application/json', ...headers })
    response.end(JSON.stringify(body))
  }
  if (request.url === '/api/v3/auth/refresh') {
    if (challenge && !verified) return reply(403, { code: 'captcha_required' })
    if (refreshStatus === 0) return request.socket.destroy()
    if (refreshStatus !== 200) return reply(refreshStatus, { code: refreshStatus === 401 ? 'unauthorized' : 'rate_limited' })
    return reply(200, { code: 0, data: { accessToken: 'fixture-session-token' } })
  }
  if (request.url === '/api/v3/me') {
    if (accountStatus !== 200) return reply(accountStatus, { code: accountStatus === 401 ? 'unauthorized' : 'rate_limited' })
    return reply(200, { code: 0, data: { id: 'fixture-user' } })
  }
  if (request.url === '/api/v3/fixture/rate') {
    return reply(429, { code: 'rate_limited' }, { 'Retry-After': '120' })
  }
  return reply(200, { code: 0, data: {} })
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
globalThis.fetch = (path, init) => originalFetch(new URL(path, base), init)

async function fixture(persisted = true) {
  requests = []
  refreshStatus = 200
  accountStatus = 200
  challenge = false
  verified = false
  captchaCalls = 0
  const storage = new Map(persisted ? [[pauseKey, String(Date.now() + 120_000)]] : [])
  const browser = new EventTarget()
  browser.sessionStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }
  globalThis.window = browser
  const captchaUrl = moduleUrl('export const ensureRiskCaptcha=globalThis.__homeSessionCaptcha')
  const transportSource = compile(httpSource)
    .replaceAll('import.meta.env.SSR', 'false')
    .replaceAll('import.meta.env.VITE_API_TARGET', "''")
    .replaceAll('import.meta.env.VITE_BROWSER_API_ORIGIN', "''")
    .replace("from '@/utils/riskCaptcha'", `from '${captchaUrl}'`)
  const transportUrl = moduleUrl(`${transportSource}\nvoid ${++fixtureNumber}`)
  const api = await import(transportUrl)
  let storeSource = compile(authSource).replaceAll('import.meta.env.SSR', 'false')
  for (const [name, target] of [
    ['vue', import.meta.resolve('vue')],
    ['pinia', import.meta.resolve('pinia')],
    ['@/api/http', transportUrl],
    ['@/utils/swr', moduleUrl('export const clearCache=()=>{}')],
    ['@/api/fishpi', moduleUrl('export async function login(){throw new Error("Unexpected password login")}')],
  ]) storeSource = storeSource.replaceAll(`from '${name}'`, `from '${target}'`)
  const { useAuthStore } = await import(moduleUrl(storeSource))
  const auth = useAuthStore(createPinia())
  api.setHomeReadsActive(true)
  return { api, auth, storage, browser }
}

const paused = error => error.code === 'home_reads_paused'
let current
try {
  current = await fixture()
  const initialPause = current.api.getHomeReadPause()
  const initialStorage = current.storage.get(pauseKey)
  const publicRead = assert.rejects(current.api.request('/api/v3/fixture/public'), paused)
  await Promise.all([publicRead, current.auth.restore(), current.auth.restore()])
  assert.equal(current.auth.isLoggedIn, true)
  assert.equal(current.auth.initialized, true)
  assert.equal(current.auth.account.oId, 'fixture-user')
  assert.deepEqual(requests, ['/api/v3/auth/refresh', '/api/v3/me'])
  assert.equal(current.api.getHomeReadPause(), initialPause)
  assert.equal(current.storage.get(pauseKey), initialStorage)
  assert.equal(current.api.resumeHomeReads(), false)
  await assert.rejects(current.api.request('/api/v3/me/membership'), paused)
  current.api.setHomeReadsActive(false)
  current.api.setHomeReadsActive(true)
  assert.equal(current.api.getHomeReadPause(), initialPause)
  const originalNow = Date.now
  try {
    Date.now = () => initialPause.until + 1
    assert.equal(current.api.resumeHomeReads(), true)
    assert.equal(current.storage.has(pauseKey), false)
    assert.equal((await current.api.request('/api/v3/fixture/public')).code, 0)
  } finally { Date.now = originalNow }
  current.auth.$dispose()
  console.log('PASS persisted homepage pause permits one shared auth restore, keeps public/membership reads paused and preserves explicit resume')

  current = await fixture(false)
  await assert.rejects(current.api.request('/api/v3/fixture/rate'), paused)
  const runtimePause = current.api.getHomeReadPause()
  await current.auth.restore()
  assert.equal(current.auth.isLoggedIn, true)
  assert.equal(current.api.getHomeReadPause(), runtimePause)
  await assert.rejects(current.api.request('/api/v3/fixture/public'), paused)
  assert.deepEqual(requests, ['/api/v3/fixture/rate', '/api/v3/auth/refresh', '/api/v3/me'])
  current.auth.$dispose()
  console.log('PASS runtime rate-limit pause still allows session recovery without releasing the public queue')

  for (const stage of ['refresh', 'account']) {
    for (const status of [401, 429]) {
      current = await fixture()
      const existingPause = current.api.getHomeReadPause()
      if (stage === 'refresh') refreshStatus = status
      else accountStatus = status
      await current.auth.restore()
      assert.equal(current.auth.isLoggedIn, false)
      assert.equal(current.auth.initialized, status === 401)
      assert.equal(current.api.getHomeReadPause(), existingPause)
      assert.equal(current.api.wasRefreshRejected(), stage === 'refresh' && status === 401)
      assert.deepEqual(requests, stage === 'refresh'
        ? ['/api/v3/auth/refresh'] : ['/api/v3/auth/refresh', '/api/v3/me'])
      if (status === 429) {
        refreshStatus = 200
        accountStatus = 200
        await current.auth.restore()
        assert.equal(current.auth.isLoggedIn, true)
      }
      current.auth.$dispose()
    }
  }
  console.log('PASS auth 401 remains definitive, auth 429 remains retryable and neither overwrites the existing public pause')

  current = await fixture()
  refreshStatus = 0
  await current.auth.restore()
  assert.equal(current.auth.initialized, false)
  assert.equal(current.api.wasRefreshRejected(), false)
  refreshStatus = 200
  await current.auth.restore()
  assert.equal(current.auth.isLoggedIn, true)
  current.auth.$dispose()
  console.log('PASS network failure during refresh remains retryable while homepage reads are paused')

  current = await fixture()
  challenge = true
  await current.auth.restore()
  assert.equal(current.auth.isLoggedIn, true)
  assert.equal(captchaCalls, 1)
  assert.deepEqual(requests, ['/api/v3/auth/refresh', '/api/v3/auth/refresh', '/api/v3/me'])
  assert.ok(current.api.getHomeReadPause())
  const beforeCancelled = requests.length
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(current.api.request('/api/v3/me', { signal: controller.signal }), error => error.code === 'aborted')
  assert.equal(requests.length, beforeCancelled)
  const staleRead = current.api.request('/api/v3/me')
  current.api.setAccessToken(null)
  await assert.rejects(staleRead, error => error.code === 'aborted')
  assert.equal(requests.length, beforeCancelled)
  assert.equal(current.auth.isLoggedIn, false)
  current.auth.$dispose()
  console.log('PASS captcha recovery, cancellation and identity-boundary checks remain active for priority session reads')
} finally {
  current?.auth.$dispose()
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
  delete globalThis.__homeSessionCaptcha
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
