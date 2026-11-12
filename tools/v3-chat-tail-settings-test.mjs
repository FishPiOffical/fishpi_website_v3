import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { ref } from 'vue'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const transpile = source => moduleUrl(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
class ApiError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code } }
let context = 1, operation = 0, handler
const requests = []
const useAuthStore = defineStore('tail-test-auth', () => ({ accessToken: ref('token-a'), account: ref({ oId: 'A' }) }))
globalThis.__chatTailTest = {
  ApiError, getAuthContextVersion: () => context, useAuthStore,
  profileOperationKey: () => `tail:${++operation}`,
  request: async (path, options) => { requests.push({ path, options }); return handler(path, options) },
}
const transport = moduleUrl('export const {ApiError,getAuthContextVersion,request}=globalThis.__chatTailTest')
let apiSource = await fs.readFile('src/api/v3-chat-tail.ts', 'utf8')
apiSource = apiSource.replace("from './http'", `from '${transport}'`)
const apiUrl = transpile(apiSource), api = await import(apiUrl)
assert.equal(api.chatTailLength('👨‍👩‍👧‍👦👍🏽🇨🇳'), 3)
assert.equal(api.chatTailLength('鱼'.repeat(24)), 24)
assert.equal(api.chatTailLength('鱼'.repeat(25)), 25)
for (const text of ['a\nb', 'a\u2028b', '\ud800', 'a\u200bb', 'a'.repeat(513)]) assert.throws(() => api.validateChatTail({ enabled: false, text }))
assert.throws(() => api.validateChatTail({ enabled: true, text: '   ' }))
api.validateChatTail({ enabled: false, text: '' })
api.validateChatTail({ enabled: true, text: '<b>@鱼</b>' })
console.log('PASS 字素计数、512 UTF16边界与单行校验；HTML/@仅为普通字符串')

let storeSource = await fs.readFile('src/stores/v3ChatTail.ts', 'utf8')
for (const [name, url] of [
  ['pinia', import.meta.resolve('pinia')], ['vue', import.meta.resolve('vue')],
  ['@/api/http', transport], ['@/api/v3-chat-tail', apiUrl],
  ['@/api/v3-profile', moduleUrl('export const {profileOperationKey}=globalThis.__chatTailTest')],
  ['@/stores/auth', moduleUrl('export const {useAuthStore}=globalThis.__chatTailTest')],
]) storeSource = storeSource.replaceAll(`from '${name}'`, `from '${url}'`)
storeSource = storeSource.replaceAll('import.meta.env.SSR', 'false')
const { useV3ChatTailStore } = await import(transpile(storeSource))
setActivePinia(createPinia())
const auth = useAuthStore(), store = useV3ChatTailStore()
let settings = { enabled: false, text: '' }
handler = async () => ({ code: 0, data: settings })
await store.load()
assert.deepEqual(store.current, settings)
assert.equal(requests.length, 1)
assert.equal(requests[0].path, '/api/v3/me/settings/chat-tail')

handler = async (_, options) => {
  if (options?.method === 'PUT') { settings = JSON.parse(options.body); return { code: 0, data: { enabled: false, text: '不能用旧回执覆盖' } } }
  return { code: 0, data: settings }
}
await store.save({ enabled: true, text: '摸鱼快乐🐟' })
assert.deepEqual(store.current, settings)
assert.equal(store.pending, null)
assert.equal(requests.at(-2).options.method, 'PUT')
assert.equal(requests.at(-1).options.cache, 'no-store')
assert.equal(store.confirmed, 1)
console.log('PASS 保存成功后当前GET回填，不使用写回执的历史配置')

handler = async (_, options) => { if (options?.method === 'PUT') throw new Error('断流'); return { code: 0, data: settings } }
await store.save({ enabled: true, text: '未确认内容' })
const command = { ...store.pending }, key = command.key
assert.equal(command.text, '未确认内容')
auth.accessToken = 'token-a-refreshed'
assert.equal(store.pending.key, key)
handler = async () => { throw new ApiError('暂不可确认', 409) }
await store.retry()
assert.equal(store.pending.key, key)
assert.equal(requests.at(-1).options.headers['Idempotency-Key'], key)
assert.equal(JSON.parse(requests.at(-1).options.body).text, command.text)
console.log('PASS 未知写操作保留原内容与原键，令牌轮换及恢复4xx不释放原命令')

handler = async (_, options) => {
  if (options?.method === 'PUT') return { code: 0 }
  throw new Error('读取失败')
}
await store.retry()
assert.equal(store.pending, null)
assert.equal(store.current, null)
const writes = requests.filter(r => r.options?.method === 'PUT').length
await store.retry()
assert.equal(requests.filter(r => r.options?.method === 'PUT').length, writes)
console.log('PASS 保存已成功但后置GET失败，不重复写入')

let finish
handler = () => new Promise(resolve => { finish = resolve })
const reading = store.load()
context++; auth.account = { oId: 'B' }; auth.accessToken = 'token-b'
finish({ code: 0, data: { enabled: true, text: 'A的隐私设置' } })
await reading
assert.equal(store.current, null)
assert.equal(store.pending, null)
handler = async () => ({ code: 0, data: { enabled: false, text: 'B' } })
await store.load()
assert.equal(store.current.text, 'B')
auth.accessToken = null
assert.equal(store.current, null)
console.log('PASS 换号拒绝迟到响应，退出清空本人配置')

const component = await fs.readFile('src/components/chat/ChatTailSettingsDialog.vue', 'utf8')
assert(component.includes('{{ text }}') && !component.includes('v-html'))
assert(component.includes('@compositionstart') && component.includes('store.pending'))
const drawer = await fs.readFile('src/components/settings/SettingsDrawer.vue', 'utf8')
assert(drawer.includes('openChatTail') && drawer.includes('气泡、小尾巴和进出场效果'))
console.log('PASS 设置入口、纯文本预览与输入法组合期保护已接线')
