import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, setActivePinia } from 'pinia'
const source = await fs.readFile('src/stores/chatPreferences.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace("from 'vue'", `from '${import.meta.resolve('vue')}'`).replace("from 'pinia'", `from '${import.meta.resolve('pinia')}'`)
const { useChatPreferencesStore } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const storage = new Map()
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
setActivePinia(createPinia())
const store = useChatPreferencesStore()
assert.equal(store.simpleMode, false)
store.setSimpleMode(true)
assert.equal(store.showMountEffects, false)
assert.equal(store.mountEffects, true, '精简模式不能覆盖用户原来的座驾开关')
setActivePinia(createPinia())
const restored = useChatPreferencesStore()
assert.equal(restored.simpleMode, false, 'SSR 初始状态保持一致')
restored.restore()
assert.equal(restored.simpleMode, true)
restored.setSimpleMode(false)
assert.equal(restored.showMountEffects, true)
restored.setMountEffects(false)
restored.setSimpleMode(true)
restored.setSimpleMode(false)
assert.equal(restored.showMountEffects, false)
globalThis.localStorage = { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } }
restored.setSimpleMode(true)
restored.restore()
assert.equal(restored.simpleMode, true)
console.log('PASS 精简模式默认值、持久化、SSR 首帧、座驾偏好保留及存储失败处理')
