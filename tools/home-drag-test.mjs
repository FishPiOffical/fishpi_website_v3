import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { JSDOM } from 'jsdom'

// 使用真实 DOM 节点检查移动后的焦点恢复。
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://127.0.0.1:5173/' })
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'SVGElement', 'MutationObserver', 'localStorage', 'history']) globalThis[key] = dom.window[key]
const vue = await import('vue')
const { createPinia, setActivePinia } = await import('pinia')
const { effectScope, nextTick } = vue
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
function compile(source, imports = {}) {
  let js = ts.transpileModule(source.replaceAll('import.meta.env.SSR', 'false'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  for (const [key, value] of Object.entries({ vue: import.meta.resolve('vue'), pinia: import.meta.resolve('pinia'), ...imports })) js = js.replaceAll(`from '${key}'`, `from '${value}'`).replaceAll(`from "${key}"`, `from '${value}'`)
  return moduleUrl(js)
}
const meta = compile(await fs.readFile('src/chat/sidebar/meta.ts', 'utf8'))
const modulesUrl = compile(await fs.readFile('src/home/modules.ts', 'utf8'), { '@/chat/sidebar/meta': meta })
const storeUrl = compile(await fs.readFile('src/stores/homeLayout.ts', 'utf8'), { '@/home/modules': modulesUrl })
const { useHomeLayoutStore } = await import(storeUrl)
const { useHomeDrag } = await import(compile(await fs.readFile('src/home/useHomeDrag.ts', 'utf8'), { '@/stores/homeLayout': storeUrl }))
setActivePinia(createPinia())
const layout = useHomeLayoutStore()
const scope = effectScope()
const drag = scope.run(useHomeDrag)
layout.state.rows = [[['recentA'], ['recentB']], [['chat']]]
layout.state.hidden = {}
const card = document.createElement('div')
card.dataset.homeModule = 'recentA'
card.getBoundingClientRect = () => ({ left: 0, right: 300, top: 0, height: 200, width: 300 })
const handle = document.createElement('button')
handle.className = 'mod-drag-bar'
card.append(handle); document.body.append(card)
let prevented = 0, ghost = null
const event = (x = 150, y = 150) => ({ currentTarget: card, clientX: x, clientY: y, preventDefault() { prevented++ }, stopPropagation() {}, dataTransfer: { setData() {}, setDragImage(el) { ghost = el } } })
drag.onDragStart(event(), 'recentA')
assert.equal(drag.dragging.value, null, '非编辑态不能启动拖动')
layout.editing = true
drag.onDragStart({ ...event(), currentTarget: handle }, 'recentA')
assert.equal(ghost, card, '使用整张卡片作为拖动预览')
drag.onModuleOver(event(150, 10), 'recentB')
assert.equal(drag.edgeOf('recentB'), 'top')
assert.equal(drag.dropLabel('recentB'), '插入上方')
drag.onDrop(event())
assert.deepEqual(JSON.parse(JSON.stringify(layout.state.rows)), [[['recentA','recentB']], [['chat']]])
drag.onDragStart(event(), 'recentA')
drag.onModuleOver(event(299), 'recentB')
assert.equal(drag.edgeOf('recentB'), 'right')
drag.onDrop(event())
assert.deepEqual(JSON.parse(JSON.stringify(layout.state.rows[0])), [['recentB'],['recentA']])
drag.onDragStart(event(), 'recentA')
drag.onGapOver(event(), null)
assert.equal(drag.gapActive(null), true)
drag.onDrop(event())
assert.deepEqual(JSON.parse(JSON.stringify(layout.state.rows.at(-1))), [['recentA']])
await drag.onHandleKeydown({ key: 'ArrowUp', preventDefault() {} }, 'recentA')
assert.deepEqual(JSON.parse(JSON.stringify(layout.state.rows.at(-1))), [['recentA','chat']])
assert.equal(document.activeElement, handle, '移动后恢复手柄焦点')
drag.onDragStart(event(), 'recentA'); drag.onGapOver(event(), null)
layout.editing = false
await nextTick()
assert.equal(drag.dragging.value, null)
assert.equal(drag.gapActive(null), false)
const before = JSON.stringify(layout.state.rows)
drag.onDrop(event())
assert.equal(JSON.stringify(layout.state.rows), before)
assert.ok(prevented > 0)
scope.stop()
console.log('首页拖动：编辑权限、整卡预览、上下排序、左右分栏、新建行、键盘焦点、取消与迟到 drop 均通过')
