import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const name of ['window','document','HTMLElement','Element','Node','SVGElement','Event']) globalThis[name] = dom.window[name]
const { createApp, h, ref, nextTick } = await import('vue')
const url = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64')
const stub = url('export default {render(){return null}}')
const imports = {
  vue: import.meta.resolve('vue'),
  '@/components/FpLoading.vue': stub,
  '@/components/EmojiPicker.vue': stub,
  '@/stores/appearance': url('export function useAppearanceStore(){return {state:{theme:"light"}}}'),
  '@/utils/markdownPreview': url('export function createMarkdownPreview(){return {reset(){},dispose(){},transform(){},parse(){}}}'),
  '@/utils/markdownEditorAssets': url(ts.transpileModule(await fs.readFile('src/utils/markdownEditorAssets.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText),
  '@/utils/editorUpload': url('export const editorUploadAccept = ""; export function createEditorUpload(){return {cancel(){},dispose(){},handler(){}}}'),
  '@/utils/mentionHints': url('export function createMentionHints(){return {cancel(){},dispose(){},hint(){}}}'),
  '@/api/http': url('export function getAuthContextVersion(){return 1} export function onAccessTokenChange(){return ()=>{}}'),
  '@/utils/chatSendShortcut': url('export function matchesChatSendShortcut(){return false}'),
}
async function component(path) {
  const { descriptor } = parse(await fs.readFile(path, 'utf8'))
  let source = compileScript(descriptor, { id: path, inlineTemplate: true }).content
  for (const [from, to] of Object.entries(imports)) source = source.replaceAll(`from '${from}'`, `from '${to}'`).replaceAll(`from "${from}"`, `from '${to}'`)
  return url(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
}
let instance
let delayReady = false
window.Vditor = class {
  constructor(host, options) {
    instance = this; this.options = options
    this.el = document.createElement('div'); this.el.setAttribute('contenteditable', 'true')
    host.append(this.el); this.el.textContent = options.value
    if (!delayReady) queueMicrotask(options.after)
  }
  getValue() { return this.el.textContent }
  setValue(value) { this.el.textContent = value }
  insertMD(value) { this.el.textContent += value }
  destroy() {}
  focus() {}
}
imports['@/components/MarkdownEditor.vue'] = await component('src/components/MarkdownEditor.vue')
const Composer = (await import(await component('src/components/ChatComposer.vue'))).default
const draft = ref(''), busy = ref(false), blocked = ref(false), sent = []
const app = createApp({ render: () => h(Composer, { modelValue: draft.value, sending: busy.value, disabled: blocked.value,
  'onUpdate:modelValue': value => { draft.value = value }, onSubmit: () => sent.push(draft.value) }) })
app.mount('#app')
const tick = async () => { await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick() }
await tick()
const button = () => document.querySelector('button.send')
async function input(text) { instance.el.textContent = text; instance.el.dispatchEvent(new Event('input', { bubbles: true })); await tick() }
assert.equal(button().disabled, true)
await input('最新正文')
assert.equal(draft.value, '', '不提前写草稿，不触发延迟预览回调')
assert.equal(button().disabled, false, '无需等待 Vditor input 回调')
button().click(); await tick()
assert.deepEqual(sent, ['最新正文'], '发送时 flush 读取编辑器最新正文')
await input(''); assert.equal(button().disabled, true)
await input('   '); assert.equal(button().disabled, true)
await input('第二条'); busy.value = true; await tick(); assert.equal(button().disabled, true)
busy.value = false; blocked.value = true; await tick(); assert.equal(button().disabled, true)
blocked.value = false; await tick(); assert.equal(button().disabled, false)
instance.el.dispatchEvent(new Event('compositionstart', { bubbles: true })); await input('输入法组合中'); assert.equal(button().disabled, true)
instance.el.dispatchEvent(new Event('compositionend', { bubbles: true })); await tick(); assert.equal(button().disabled, false)
instance.options.input(instance.getValue()); await tick()
draft.value = ''; await tick(); assert.equal(button().disabled, true)
assert.equal(instance.options.preview.delay, 750)
assert.equal(instance.options.undoDelay, undefined, '保留 Vditor 默认撤销节流')
instance.el.dispatchEvent(new Event('input', { bubbles: true })); app.unmount(); await tick()
console.log('PASS 输入即时启用、清空/空白禁用、最新正文发送、发送中/未确认禁用、IME、外部清空及卸载；撤销和预览节流不变')

delayReady = true
let nextFrame
globalThis.requestAnimationFrame = callback => { nextFrame = callback; return 1 }
globalThis.cancelAnimationFrame = () => { nextFrame = undefined }
const replyDraft = ref(''), replies = []
const reply = createApp({ render: () => h(Composer, { modelValue: replyDraft.value, instantInput: true, allowEmpty: true,
  'onUpdate:modelValue': value => { replyDraft.value = value }, onSubmit: () => replies.push(replyDraft.value) }) })
reply.mount('#app'); await tick()
const textarea = document.querySelector('textarea')
assert.ok(textarea, '编辑器就绪前显示可输入的正文')
textarea.value = '起始：'
textarea.dispatchEvent(new Event('input', { bubbles: true }))
await tick()
assert.equal(replyDraft.value, '起始：')
textarea.dispatchEvent(new Event('compositionstart', { bubbles: true }))
textarea.value = '起始：zhongwen'
textarea.dispatchEvent(new Event('input', { bubbles: true }))
instance.options.after(); await tick()
assert.equal(document.querySelector('textarea'), textarea, '选字时保留原输入节点')
assert.equal(replyDraft.value, '起始：', '组合中的拼音不写入草稿')
button().click()
assert.deepEqual(replies, [], '选字期间不提交')
textarea.dispatchEvent(new Event('compositionend', { bubbles: true }))
textarea.value = '起始：中文'
textarea.dispatchEvent(new Event('input', { bubbles: true }))
await tick()
assert.equal(document.querySelector('textarea'), textarea, '等待确认选字后的最后一次 input')
nextFrame(); await tick()
assert.equal(document.querySelector('textarea'), null)
assert.equal(instance.getValue(), '起始：中文')
button().click(); await tick()
assert.deepEqual(replies, ['起始：中文'])
reply.unmount(); dom.window.close()
console.log('PASS 回复可提前输入，选字期间不接管或提交，Vditor 接管最后确认的正文')
