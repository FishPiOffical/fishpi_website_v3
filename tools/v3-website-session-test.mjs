import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, setActivePinia } from 'pinia'

const listeners = new Set()
let token = null
let requests = []
let handler
let nextActor = 'A'
let now = 10000
const originalNow = Date.now
Date.now = () => now
const publish = value => { token = value; for (const listener of listeners) listener(value) }
class ApiError extends Error { constructor(message, status) { super(message); this.status = status } }
globalThis.__websiteSessionTest = {
  ApiError, getAccessToken: () => token, setAccessToken: publish,
  onAccessTokenChange(listener) { listeners.add(listener); listener(token); return () => listeners.delete(listener) },
  refreshAccessToken: async () => { publish('restored'); return true }, wasRefreshRejected: () => false,
  withHomeSessionPriority: work => work(),
  request: async (path, options) => {
    requests.push(path)
    if (path === '/api/v3/me') return { code: 0, data: { id: nextActor } }
    if (path === '/api/v3/me/membership') return { code: 0, data: { active: false } }
    return handler(path, options)
  },
}
const moduleUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
const transport = moduleUrl('export const {ApiError,getAccessToken,setAccessToken,onAccessTokenChange,refreshAccessToken,wasRefreshRejected,withHomeSessionPriority,request}=globalThis.__websiteSessionTest')
let source = await fs.readFile('src/stores/auth.ts', 'utf8')
source = source.replaceAll('import.meta.env.SSR', 'false')
for (const [name, url] of [
  ['vue', import.meta.resolve('vue')], ['pinia', import.meta.resolve('pinia')],
  ['@/api/http', transport], ['@/utils/swr', moduleUrl('export const clearCache=()=>{}')],
  ['@/api/fishpi', moduleUrl("export const login=async()=> 'logged-in'")],
]) source = source.replaceAll(`from '${name}'`, `from '${url}'`)
const { useAuthStore } = await import(moduleUrl(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText))
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
setActivePinia(createPinia())
const auth = useAuthStore()
await auth.login('fixture', 'not-a-password')
handler = async () => ({ code: 0, data: { userId: 'A', revision: 'one' } })
await auth.syncWebsiteSession()
assert.equal(auth.account.oId, 'A')
const before = requests.length
await auth.syncWebsiteSession()
assert.equal(requests.length, before)
console.log('PASS 聚焦检查节流；相同会话不轮换令牌、不重复读本人资料')
now += 6000
handler = async () => ({ code: 0, data: { linked: false } })
await auth.syncWebsiteSession()
assert.equal(auth.account.oId, 'A')
console.log('PASS 更新前未绑定的独立新版登录不会被状态探测误退出')
now += 6000
const gate = deferred()
handler = () => gate.promise
const countBeforeFlight = requests.length
const first = auth.syncWebsiteSession()
const second = auth.syncWebsiteSession()
assert.equal(requests.length, countBeforeFlight + 1)
gate.resolve({ code: 0, data: { userId: null, revision: null } })
await Promise.all([first, second])
assert.equal(auth.isLoggedIn, false)
console.log('PASS 并发焦点事件共用请求；旧站退出后清理前端身份')
now += 6000
nextActor = 'B'
handler = async () => ({ code: 0, data: { userId: 'B', revision: 'two' } })
await auth.syncWebsiteSession()
assert.equal(auth.account.oId, 'B')
console.log('PASS 旧站换号后建立身份边界并恢复正确账号')
now += 6000
const stale = deferred()
handler = () => stale.promise
const checking = auth.syncWebsiteSession()
nextActor = 'C'
await auth.login('fixture', 'not-a-password')
stale.resolve({ code: 0, data: { userId: null, revision: null } })
await checking
assert.equal(auth.account.oId, 'C')
console.log('PASS 迟到的旧会话响应不能清除新登录')
handler = async () => { throw new Error('storage unavailable') }
await auth.logout()
assert.equal(auth.isLoggedIn, false)
assert.equal(auth.logoutPending, true)
assert.match(auth.error, /退出暂未完成/)
const stopped = requests.length
now += 6000
await auth.restore()
await auth.syncWebsiteSession()
assert.equal(requests.length, stopped)
handler = async () => ({ code: 0, data: {} })
await auth.logout()
assert.equal(auth.logoutPending, false)
assert.equal(auth.error, '')
console.log('PASS 退出失败不静默成功、不自动恢复登录；显式重试可完成撤销')
auth.$dispose()
Date.now = originalNow
