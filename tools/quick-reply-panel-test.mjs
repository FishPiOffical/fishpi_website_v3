import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<body><button id="trigger">回复</button><div id="app"></div></body>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'SVGElement']) globalThis[key] = dom.window[key]
const { createApp, h, ref, nextTick, onMounted, onUnmounted } = await import('vue')
const { descriptor } = parse(await fs.readFile('src/components/articles/QuickReplyPanel.vue', 'utf8'))
const compiled = compileScript(descriptor, { id: 'quick-reply-test', inlineTemplate: true }).content
const code = ts.transpileModule(compiled, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replaceAll("from 'vue'", 'from "vue"').replaceAll('from "vue"', `from '${import.meta.resolve('vue')}'`)
const Panel = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default
const open = ref(false)
let mounts = 0, unmounts = 0
const Editor = { setup() { const draft = ref('原有草稿'); onMounted(() => mounts++); onUnmounted(() => unmounts++); return () => h('textarea', { value: draft.value, onInput: e => draft.value = e.target.value }) } }
const app = createApp({ render: () => h(Panel, { open: open.value, onClose: () => open.value = false }, { default: () => h(Editor) }) })
app.mount('#app')
const input = document.querySelector('textarea')
input.value = '保留新草稿'; input.dispatchEvent(new dom.window.Event('input'))
document.querySelector('#trigger').focus()
open.value = true; await nextTick(); await nextTick()
assert.equal(document.querySelector('[role="dialog"] textarea'), input)
assert.equal(document.body.style.overflow, 'hidden')
assert.equal(input.value, '保留新草稿')
document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }))
await nextTick()
assert.equal(open.value, false)
assert.equal(document.querySelector('#app textarea'), input)
assert.equal(input.value, '保留新草稿')
assert.equal(document.activeElement.id, 'trigger')
assert.equal(document.body.style.overflow, '')
assert.equal(mounts, 1); assert.equal(unmounts, 0)
open.value = true; await nextTick(); await nextTick(); app.unmount()
assert.equal(document.body.style.overflow, '')
assert.equal(unmounts, 1)
console.log('PASS: 编辑器实例与草稿保留、Escape 关闭、焦点恢复、滚动锁清理')
