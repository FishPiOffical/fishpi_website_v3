import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createRenderer, h } from 'vue'
import { createMemoryHistory, createRouter, isNavigationFailure, NavigationFailureType } from 'vue-router'

const compiled = ts.transpileModule(await fs.readFile('src/composables/useChatQuoteNavigation.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replaceAll("from 'vue'", `from '${import.meta.resolve('vue')}'`)
  .replaceAll("from 'vue-router'", `from '${import.meta.resolve('vue-router')}'`)
const { useChatQuoteNavigation } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

const insert = (node, parent, anchor) => {
  if (node.parent) node.parent.children = node.parent.children.filter(child => child !== node)
  const index = anchor ? parent.children.indexOf(anchor) : -1
  parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
  node.parent = parent
}
const renderer = createRenderer({
  patchProp() {}, insert,
  remove(node) { if (node.parent) node.parent.children = node.parent.children.filter(child => child !== node) },
  createElement: tag => ({ tag, children: [] }), createText: text => ({ text, children: [] }), createComment: () => ({ children: [] }),
  setText(node, text) { node.text = text }, setElementText(node, text) { node.text = text },
  parentNode: node => node.parent,
  nextSibling(node) { const children = node.parent?.children || []; return children[children.indexOf(node) + 1] || null },
  insertStaticContent(text, parent, anchor) { const node = { text, children: [] }; insert(node, parent, anchor); return [node, node] },
})
const Empty = { render: () => null }
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/', component: Empty }, { path: '/cr', component: Empty }, { path: '/other', component: Empty },
] })
await router.push('/')
const events = [], app = renderer.createApp({
  setup() { useChatQuoteNavigation((id, duplicated) => events.push({ id, duplicated })); return () => h('div') },
})
app.use(router); app.mount({ children: [] })

await router.push('/cr#chatroom12')
assert.deepEqual(events, [{ id: '12', duplicated: false }])
const duplicate = await router.push('/cr#chatroom12')
assert.ok(isNavigationFailure(duplicate, NavigationFailureType.duplicated))
assert.deepEqual(events.at(-1), { id: '12', duplicated: true })
assert.equal(events.length, 2)
console.log('PASS 引用导航成功和相同 hash 重复导航均通知，重复状态准确')

const stopAbort = router.beforeEach(to => to.hash === '#chatroom13' ? false : true)
const aborted = await router.push('/cr#chatroom13')
assert.ok(isNavigationFailure(aborted, NavigationFailureType.aborted))
assert.equal(events.length, 2)
stopAbort()
let release
const stopDelay = router.beforeEach(to => to.hash === '#chatroom21' ? new Promise(resolve => { release = resolve }) : true)
const obsolete = router.push('/cr#chatroom21')
for (let index = 0; index < 40 && !release; index++) await Promise.resolve()
assert.ok(release)
await router.push('/cr#chatroom22')
release(true)
assert.ok(isNavigationFailure(await obsolete, NavigationFailureType.cancelled))
assert.deepEqual(events.at(-1), { id: '22', duplicated: false })
assert.equal(events.length, 3)
stopDelay()
console.log('PASS 守卫拒绝和被新导航取消的旧请求不通知、不误关覆盖层')

for (const target of ['/other#chatroom22', '/cr#member22', '/cr#chatroomx', '/cr#chatroom' + '1'.repeat(33), '/cr']) {
  await router.push(target)
}
assert.equal(events.length, 3)
await router.push('/cr#chatroom' + '1'.repeat(32))
assert.deepEqual(events.at(-1), { id: '1'.repeat(32), duplicated: false })
assert.equal(events.length, 4)
app.unmount()
await router.push('/cr#chatroom23')
assert.equal(events.length, 4)
console.log('PASS 仅接受聊天室数字消息锚点，普通导航不通知，卸载后解除 afterEach')
