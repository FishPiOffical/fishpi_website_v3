import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createPinia, setActivePinia } from 'pinia'

const compiled = new Map()
function moduleUrl(file) {
  if (compiled.has(file)) return compiled.get(file)
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/from (['"])([^'"]+)\1/g, (_, quote, specifier) => {
    const url = specifier.startsWith('@/')
      ? moduleUrl(path.resolve('src', `${specifier.slice(2)}.ts`))
      : import.meta.resolve(specifier)
    return `from ${JSON.stringify(url)}`
  })
  const url = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
  compiled.set(file, url)
  return url
}

const { useChatSidebarStore } = await import(moduleUrl(path.resolve('src/stores/chatSidebar.ts')))
const { usePageSidebarStore } = await import(moduleUrl(path.resolve('src/stores/pageSidebar.ts')))
const { groupSidebarModules } = await import(moduleUrl(path.resolve('src/utils/sidebarPresentation.ts')))
const targets = [
  { useStore: useChatSidebarStore, key: 'fp.chatSidebar', first: 'breezemoons', last: 'mutes' },
  { useStore: usePageSidebarStore, key: 'fp.pageSidebar.v1', first: 'checkin', last: 'ad' },
]

const memory = new Map()
function installStorage({ readError = false, writeError = false } = {}) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key) { if (readError) throw new Error('denied'); return memory.get(key) ?? null },
      setItem(key, value) { if (writeError) throw new Error('denied'); memory.set(key, value) },
    },
  })
}
function fresh(useStore) {
  setActivePinia(createPinia())
  return useStore()
}

let checks = 0
try {
  for (const { useStore, key, first, last } of targets) {
    memory.clear()
    installStorage()
    let store = fresh(useStore)
    const defaults = JSON.parse(JSON.stringify(store.pref))
    assert.equal(store.presentationOf('profile'), 'card')
    assert.equal(store.presentationOf(first), 'tabs')
    assert.equal(groupSidebarModules(store.visibleModules, store.presentationOf)[0].module.id, 'profile')
    checks++

    // 升级旧配置时保留启用、排序和折叠，只清理重复及失效模块。
    memory.set(key, JSON.stringify({ order: [last, first, first, 'removed', 'profile'], hidden: [last, last, 'removed'], collapsed: [first, first, 'removed'] }))
    store = fresh(useStore)
    assert.equal(store.pref.order.filter(id => id === first).length, 1)
    assert.equal(store.pref.order.includes('removed'), false)
    assert.deepEqual([...store.pref.hidden], [last])
    assert.deepEqual([...store.pref.collapsed], [first])
    assert.equal(store.presentationOf(first), 'tabs')
    const original = JSON.parse(JSON.stringify(store.pref))
    store.setPresentation(first, 'card')
    assert.deepEqual([...store.pref.order], original.order)
    assert.deepEqual([...store.pref.hidden], original.hidden)
    assert.deepEqual([...store.pref.collapsed], original.collapsed)
    store = fresh(useStore)
    assert.equal(store.presentationOf(first), 'card')
    checks++

    const unchanged = JSON.stringify(store.pref)
    store.setPresentation('profile', 'tabs')
    store.setPresentation('removed', 'card')
    store.setPresentation(first, 'invalid')
    assert.equal(JSON.stringify(store.pref), unchanged)
    store.toggle(first)
    assert.equal(store.visibleModules.some(mod => mod.id === first), false)
    store.toggle(first)
    assert.equal(store.presentationOf(first), 'card')
    store.moveTo(first, last)
    assert.equal(store.pref.order.indexOf(first) + 1, store.pref.order.indexOf(last))
    store.reset()
    assert.deepEqual(JSON.parse(JSON.stringify(store.pref)), defaults)
    checks++

    memory.set(key, JSON.stringify({ order: [first], hidden: [], collapsed: [first], presentation: { profile: 'tabs', [first]: 'card', [last]: 'invalid', removed: 'card' } }))
    store = fresh(useStore)
    assert.equal(store.presentationOf('profile'), 'card')
    assert.deepEqual({ ...store.pref.presentation }, { [first]: 'card' })
    assert.equal(store.presentationOf(last), 'tabs')
    assert.ok(store.isOn(last))
    checks++

    for (const raw of ['null', '[]', '{', '123', '{"order":false,"hidden":null,"collapsed":"topic","presentation":[]}']) {
      memory.set(key, raw)
      store = fresh(useStore)
      assert.equal(store.orderedModules.length, defaults.order.length)
      assert.equal(new Set(store.pref.order).size, defaults.order.length)
      assert.equal(store.presentationOf(first), 'tabs')
    }
    checks++

    installStorage({ readError: true, writeError: true })
    store = fresh(useStore)
    assert.doesNotThrow(() => store.setPresentation(first, 'card'))
    assert.equal(store.presentationOf(first), 'card')
    assert.doesNotThrow(() => store.toggle(first))
    assert.doesNotThrow(() => store.toggleCollapsed(first))
    assert.doesNotThrow(() => store.reset())
    checks++
  }

  // 同组标签只生成一个面板，放在首个标签原位置；资料固定置顶。
  const modules = ['income', 'online', 'profile', 'topic', 'appearance', 'breezemoons'].map(id => ({ id }))
  const groups = groupSidebarModules(modules, id => ['income', 'topic'].includes(id) ? 'card' : 'tabs')
  assert.deepEqual(groups, [
    { kind: 'card', module: { id: 'profile' } },
    { kind: 'card', module: { id: 'income' } },
    { kind: 'tabs', modules: [{ id: 'online' }, { id: 'appearance' }, { id: 'breezemoons' }] },
    { kind: 'card', module: { id: 'topic' } },
  ])
  assert.deepEqual(groupSidebarModules([], () => 'tabs'), [])
  assert.deepEqual(groupSidebarModules([{ id: 'profile' }], () => 'tabs'), [{ kind: 'card', module: { id: 'profile' } }])
  assert.equal(groupSidebarModules(modules.filter(mod => mod.id !== 'profile'), () => 'tabs').length, 1)
  assert.equal(groupSidebarModules(modules, () => 'card').length, modules.length)
  checks++

  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('storage unavailable') } })
  for (const { useStore, first } of targets) {
    const store = fresh(useStore)
    assert.equal(store.presentationOf(first), 'tabs')
    assert.doesNotThrow(() => store.setPresentation(first, 'card'))
  }
  checks++
  delete globalThis.localStorage
  for (const { useStore, first } of targets) {
    const store = fresh(useStore)
    assert.equal(store.presentationOf(first), 'tabs')
    assert.doesNotThrow(() => store.setPresentation(first, 'card'))
  }
  checks++
  console.log(`PASS 侧栏展示偏好 ${checks} 组：旧配置迁移、非法值去重、持久恢复、排序/隐藏/折叠独立、混排、重置与存储失败`)
} finally {
  delete globalThis.localStorage
}
