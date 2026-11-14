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
const { defaultHomeLayout, migrateHomeLayout, HOME_MODULES } = await import(modulesUrl)
const classic = defaultHomeLayout('classic')
assert.deepEqual(classic.rows[0], [['recentA'], ['recentB'], ['download', 'rank']])
assert.deepEqual(classic.rows[1], [['side:income'], ['checkin']])
assert.equal(new Set(classic.rows.flat(2)).size, HOME_MODULES.length)
const previous = [[['recentA'], ['recentB'], [...HOME_MODULES.filter(m => m.sidebarId).map(m => m.id), 'rank']], [['long']], [['chat'], ['hotQna'], ['community']]]
assert.deepEqual(migrateHomeLayout({ rows: previous, hidden: { chat: true } }, 'classic'), { rows: classic.rows, hidden: { chat: true } })
const custom = { rows: [[['chat'], ['rank']], [['recentA', 'recentB']]], hidden: { chat: true } }
const migrated = migrateHomeLayout(custom, 'classic')
assert.deepEqual(migrated.rows[0][0], ['chat'])
assert.deepEqual(migrated.rows[0][1].filter(id => ['rank', 'checkin', 'download', 'onlineRank'].includes(id)), ['rank', 'checkin', 'download', 'onlineRank'])
assert.equal(migrated.hidden.chat, true)
assert.deepEqual(migrateHomeLayout(classic, 'classic'), classic)
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
// 用可控帧时钟验证持续滚动、边缘速度及结束后的资源清理。
let frameId = 0
const frames = new Map()
window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId }
window.cancelAnimationFrame = id => frames.delete(id)
const scrolls = []
window.scrollBy = options => scrolls.push(options.top)
document.elementFromPoint = () => card
function tick(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)) }
function pointerAt(y) { document.dispatchEvent(new window.MouseEvent('dragover', { clientX: 150, clientY: y, bubbles: true })) }
layout.editing = true
drag.onDragStart(event(), 'chat')
pointerAt(window.innerHeight - 60); tick(16)
assert.ok(scrolls.at(-1) > 0, '底边向下滚动')
const slower = scrolls.at(-1)
pointerAt(window.innerHeight - 5); tick(32)
assert.ok(scrolls.at(-1) > slower, '越靠近边缘越快')
pointerAt(5); tick(48)
assert.ok(scrolls.at(-1) < 0, '顶边向上滚动')
pointerAt(window.innerHeight / 2); const count = scrolls.length; tick(64)
assert.equal(scrolls.length, count, '回到中间停止滚动')
window.dispatchEvent(new window.Event('blur'))
assert.equal(frames.size, 0, '窗口失焦清理滚动帧')
assert.equal(drag.dragging.value, null)
drag.onDragStart(event(), 'chat'); pointerAt(5)
layout.editing = false; await nextTick()
assert.equal(frames.size, 0, '退出编辑立即取消滚动')
layout.editing = true; drag.onDragStart(event(), 'chat'); pointerAt(5)
scope.stop()
assert.equal(frames.size, 0, '卸载不遗留滚动帧')
console.log('边缘滚动：上下方向、渐进速度、中间停止、失焦、退出和卸载清理通过')
console.log('首页拖动：编辑权限、整卡预览、上下排序、左右分栏、新建行、键盘焦点、取消与迟到 drop 均通过')
