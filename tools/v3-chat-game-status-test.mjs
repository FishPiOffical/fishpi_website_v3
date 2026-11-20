import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setTimeout as wait } from 'node:timers/promises'
import ts from 'typescript'
import { createPinia } from 'pinia'
import { reactive } from 'vue'

const moduleURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
async function compile(path, aliases) {
  const source = (await readFile(path, 'utf8')).replaceAll('import.meta.env.SSR', 'false')
  let js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  for (const [name, value] of Object.entries(aliases)) js = js.replaceAll(`from '${name}'`, `from '${value}'`)
  return moduleURL(js)
}
const calls = []
const auth = reactive({ accessToken: 'one', account: { oId: '1' }, isLoggedIn: true })
let context = 1
function success(ids) {
  return { code: 0, data: { list: ids.filter(id => id !== '2').map(userId => ({ userId, parkingFree: false, partner: { full: true, displayValue: '102010000' } })) } }
}
let reply = success
globalThis.__chatGames = {
  auth, version: () => context, request(path) {
    const ids = new URL(path, 'https://example.test').searchParams.get('userIds').split(',')
    calls.push(ids)
    return reply(ids)
  },
}
globalThis.document = Object.assign(new EventTarget(), { hidden: false })
const http = moduleURL('export class ApiError extends Error {constructor(message,status,code){super(message);this.status=status;this.code=code}} export const getAuthContextVersion=globalThis.__chatGames.version,request=globalThis.__chatGames.request')
const api = await compile('src/api/v3-chat-game-status.ts', { './http': http })
const { readChatGameStatuses } = await import(api)
const { useChatGameStatusStore } = await import(await compile('src/stores/chatGameStatus.ts', {
  pinia: import.meta.resolve('pinia'), vue: import.meta.resolve('vue'), '@/api/http': http,
  '@/api/v3-chat-game-status': api, './auth': moduleURL('export const useAuthStore=()=>globalThis.__chatGames.auth'),
}))
const store = useChatGameStatusStore(createPinia())
async function until(check) {
  for (let i = 0; i < 200; i++) { if (check()) return; await wait(10) }
  assert.fail('等待游戏状态更新超时')
}
try {
  const off = Array.from({ length: 52 }, (_, i) => store.subscribe(String(i + 1)))
  const offAgain = store.subscribe('1')
  await until(() => store.entry('52')?.status)
  assert.deepEqual(calls.map(batch => batch.length), [50, 2])
  assert.equal(store.entry('2').status, null)
  assert.equal(store.entry('1').status.parkingFree, false)
  assert.equal(store.entry('1').status.partner.displayValue, '102010000')
  offAgain()
  auth.accessToken = 'rotated'
  await wait(60)
  assert.equal(calls.length, 2)
  for (const unsubscribe of off) unsubscribe()
  let finish
  reply = () => new Promise(resolve => { finish = resolve })
  const unsub = store.subscribe('53')
  await until(() => finish)
  document.hidden = true
  context++
  auth.account = { oId: '2' }
  finish(success(['53']))
  await wait(60)
  assert.equal(store.entry('53'), undefined)
  assert.equal(store.entry('1'), undefined)
  reply = () => { throw Error('读取失败') }
  document.hidden = false
  document.dispatchEvent(new Event('visibilitychange'))
  await until(() => store.entry('53')?.error)
  reply = success
  store.retry('53')
  await until(() => store.entry('53')?.status)
  unsub()
  const { ApiError } = await import(http)
  reply = () => { throw new ApiError('旧服务没有接口', 404, 'not_found') }
  const requestsBefore404 = calls.length
  const offOld = Array.from({ length: 60 }, (_, i) => store.subscribe(String(i + 100)))
  await until(() => store.entry('159')?.error)
  const offNew = store.subscribe('160')
  await wait(120)
  assert.equal(calls.length, requestsBefore404 + 1)
  offNew()
  offOld.forEach(release => release())
  for (const faulty of [[{ userId: '4' }], [{ userId: '3', parkingFree: 'false' }], [{ userId: '3' }, { userId: '3' }]]) {
    reply = () => ({ code: 0, data: { list: faulty } })
    await assert.rejects(readChatGameStatuses(['3']), /数据格式异常/)
  }
  console.log('PASS 游园状态批量分片、重复订阅、空结果、换号隔离、刷新、重试和响应边界')
} finally {
  store.$dispose()
}
