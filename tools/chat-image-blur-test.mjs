import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, defineStore } from 'pinia'
import { ref } from 'vue'

const dataUrl = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64')
const state = globalThis.__blurPreferencesTest = { context: 1, calls: 0, dispatch: null }
const authStore = defineStore('blur-test-auth', () => ({ accessToken: ref('first'), account: ref({ oId: '1' }) }))
globalThis.__blurAuth = authStore
let source = ts.transpileModule(await fs.readFile('src/stores/functionPreferences.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
for (const [name, url] of [
  ['vue', import.meta.resolve('vue')], ['pinia', import.meta.resolve('pinia')],
  ['./auth', dataUrl('export const useAuthStore=globalThis.__blurAuth')],
  ['@/api/http', dataUrl('export const getAuthContextVersion=()=>globalThis.__blurPreferencesTest.context')],
  ['@/api/v3-preferences', dataUrl('export function fetchV3Preferences(){globalThis.__blurPreferencesTest.calls++;return globalThis.__blurPreferencesTest.dispatch()}')],
]) source = source.replaceAll(`from '${name}'`, `from '${url}'`)
const { useFunctionPreferencesStore } = await import(dataUrl(source))
const pinia = createPinia(), auth = authStore(pinia), store = useFunctionPreferencesStore(pinia)
let resolve
state.dispatch = () => new Promise(done => { resolve = done })
assert.equal(store.blurChatImages, true)
const first = store.load(), second = store.load()
assert.equal(state.calls, 1)
resolve({ chatImageBlur: false })
await Promise.all([first, second]); assert.equal(store.blurChatImages, false)
await store.load(); assert.equal(state.calls, 1)
auth.accessToken = 'rotated'; await store.load(); assert.equal(state.calls, 1)
const staleRead = store.load(true)
store.accept({ chatImageBlur: true }); resolve({ chatImageBlur: false })
await assert.rejects(staleRead); assert.equal(store.blurChatImages, true)
const oldAccount = store.load(true)
state.context++; auth.account = { oId: '2' }
resolve({ chatImageBlur: false }); await assert.rejects(oldAccount)
assert.equal(store.values, null); assert.equal(store.blurChatImages, true)
auth.accessToken = ''; assert.equal(store.blurChatImages, false)
await assert.rejects(store.load())
state.context++; auth.account = { oId: '3' }; auth.accessToken = 'third'
state.dispatch = async () => { throw Error('暂不可用') }
await assert.rejects(store.load()); assert.equal(store.values, null); assert.equal(store.blurChatImages, true)
console.log('PASS 偏好请求去重、即时保存、普通令牌轮换、旧读取拒回写、换号及失败状态')
