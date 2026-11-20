import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { locks } from 'node:worker_threads'
import ts from 'typescript'

// Each import owns its in-memory identity and queue. Both use the same native lock manager.
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const source = ts.transpileModule(await readFile('src/api/http.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replaceAll('import.meta.env.SSR', 'false')
  .replaceAll('import.meta.env.VITE_BROWSER_API_ORIGIN', "''")
  .replace("from '@/utils/riskCaptcha'", `from '${moduleUrl('export function ensureRiskCaptcha() { throw Error("Unexpected captcha") }')}'`)
const transport = moduleUrl(source)
const a = await import(transport + '#a')
const b = await import(transport + '#b')
const refresh = '/api/v3/auth/refresh'
const session = '/api/v3/auth/session'
const normal = '/api/v3/me'
const post = { method: 'POST' }
const calls = []
const names = []
const shared = { request(name, ...args) { names.push(name); return locks.request(name, ...args) } }
const browser = new EventTarget()
const reply = data => Response.json({ code: 0, data })
let serve
globalThis.window = browser
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} })
browser.navigator = globalThis.navigator
browser.navigator.locks = shared
globalThis.fetch = async (url, init) => {
  const path = new URL(url, 'http://localhost').pathname
  calls.push(path)
  return serve(path, init)
}

// Delay the body so the first rotation stays in flight even after headers arrive.
const bodyRead = Promise.withResolvers()
const bodyReady = Promise.withResolvers()
let revision = 0
serve = async path => {
  if (path === normal) return reply({ id: 'fixture' })
  assert.equal(path, refresh)
  const seq = ++revision
  const res = reply({ accessToken: 'fixture-' + seq })
  if (seq === 1) {
    const text = res.text.bind(res)
    res.text = async () => { bodyRead.resolve(); await bodyReady.promise; return text() }
  }
  return res
}
const first = a.refreshAccessToken()
await bodyRead.promise
const second = b.refreshAccessToken()
await nextTurn()
assert.deepEqual(calls, [refresh])
assert.equal(names.length, 2)
assert.equal(names[0], names[1], 'two tabs must use the same lock')
assert.deepEqual((await b.request(normal)).data, { id: 'fixture' })
assert.equal(names.length, 2, 'normal reads do not request the credential lock')
bodyReady.resolve()
assert.deepEqual(await Promise.all([first, second]), [true, true])
assert.deepEqual(calls, [refresh, normal, refresh])
assert.equal(a.getAccessToken(), 'fixture-1')
assert.equal(b.getAccessToken(), 'fixture-2')
console.log('PASS 同浏览器两页独立续期按顺序完成，等待读完响应正文，普通资料读取可并行')

for (const cancel of ['account', 'abort']) {
  calls.length = 0
  const entered = Promise.withResolvers()
  const release = Promise.withResolvers()
  serve = async () => { entered.resolve(); await release.promise; return reply({}) }
  const holder = a.request(session, post)
  await entered.promise
  const controller = new AbortController()
  const waiting = b.request('/api/v3/auth/logout', { ...post, signal: controller.signal })
  const rejected = assert.rejects(waiting, e => e.code === 'aborted' || e.name === 'AbortError')
  await nextTurn()
  if (cancel === 'account') b.setAccessToken(null)
  else controller.abort()
  release.resolve()
  await Promise.all([holder, rejected])
  assert.deepEqual(calls, [session], 'cancelled queued request must not reach fetch')
}
console.log('PASS 获得锁前换号或取消都能阻止旧的凭据请求')

for (const manager of [undefined, { request() { throw new DOMException('Restricted', 'SecurityError') } }]) {
  browser.navigator.locks = manager
  calls.length = 0
  const entered = Promise.withResolvers()
  const release = Promise.withResolvers()
  serve = async () => { entered.resolve(); await release.promise; return reply({}) }
  const holder = a.request(session, post)
  await entered.promise
  const queued = a.request('/api/v3/auth/logout', post)
  await nextTurn()
  assert.deepEqual(calls, [session])
  release.resolve()
  await Promise.all([holder, queued])
  assert.deepEqual(calls, [session, '/api/v3/auth/logout'])
}
console.log('PASS 锁缺失或访问受限时仍按本页队列执行')

browser.navigator.locks = shared
calls.length = 0
serve = async () => { throw new DOMException('Rejected by transport', 'SecurityError') }
await assert.rejects(a.request(session, post), { name: 'SecurityError' })
assert.deepEqual(calls, [session], 'a request already sent under the lock must not be repeated')
serve = async () => reply({})
await b.request(session, post)
assert.deepEqual(calls, [session, session])
console.log('PASS 锁内请求失败只发送一次，锁随后释放')
