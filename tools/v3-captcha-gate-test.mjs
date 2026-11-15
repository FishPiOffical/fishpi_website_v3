import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { JSDOM } from 'jsdom'

// 实际 Vue 组件、对话框和极验生命周期；供应商及服务端结果用可控边界替代。
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'SVGElement']) globalThis[key] = dom.window[key]
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0)
const { createApp, nextTick } = await import('vue')
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
function compile(source) {
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replaceAll('import.meta.env.SSR', 'false').replace(/from ['"]vue['"]/g, `from '${import.meta.resolve('vue')}'`)
}
const riskUrl = moduleUrl(compile(await fs.readFile('src/utils/riskCaptcha.ts', 'utf8')))
const helperUrl = moduleUrl(compile(await fs.readFile('src/composables/useGeetest4.ts', 'utf8')))
async function component(path, replacements = {}) {
  const { descriptor } = parse(await fs.readFile(path, 'utf8'))
  let source = compile(compileScript(descriptor, { id: path, inlineTemplate: true }).content)
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to)
  return moduleUrl(source)
}
const dialogUrl = await component('src/components/FpDialog.vue')
let resolveProof, rejectProof, submissions = 0, mounts = 0, destroys = 0
globalThis.__captchaGateProof = () => {
  submissions++
  return new Promise((resolve, reject) => { resolveProof = resolve; rejectProof = reject })
}
const widgets = []
window.initGeetest4 = (_options, ready) => {
  mounts++
  const widget = {
    appendTo() { return this }, onSuccess(fn) { this.success = fn; return this },
    getValidate() { return {} }, reset() {}, destroy() { destroys++ },
  }
  widgets.push(widget)
  ready(widget)
}
const gateUrl = await component('src/components/RiskCaptchaGate.vue', {
  '@/api/fishpi': moduleUrl('export const validateRiskCaptcha=()=>globalThis.__captchaGateProof()'),
  '@/utils/riskCaptcha': riskUrl, '@/composables/useGeetest4': helperUrl, '@/components/FpDialog.vue': dialogUrl,
})
const risk = await import(riskUrl)
const Gate = (await import(gateUrl)).default
const flush = async () => {
  for (let i = 0; i < 20; i++) await nextTick()
  // 实际 FpDialog 的 Transition 需经过两帧才移除离场 DOM。
  await new Promise(resolve => setTimeout(resolve, 30))
}
const escape = () => window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }))
let app = createApp(Gate)
app.mount('#app')
try {
  const early = risk.ensureRiskCaptcha()
  const earlyAssertion = assert.rejects(early, /关闭/)
  // 下一微任务卸载，覆盖验证码尚未挂载时的关闭窗口。
  await Promise.resolve(); app.unmount(); await flush(); await earlyAssertion
  assert.equal(mounts, 0)
  app = createApp(Gate); app.mount('#app')

  const first = risk.ensureRiskCaptcha()
  assert.equal(risk.ensureRiskCaptcha(), first)
  const firstAssertion = assert.rejects(first, /取消/)
  await flush(); assert.equal(mounts, 1)
  widgets.at(-1).success(); await flush(); assert.equal(submissions, 1)
  escape(); resolveProof(); await flush(); await firstAssertion
  assert.equal(document.querySelector('[role="dialog"]'), null)
  assert.equal(mounts, 1)

  const second = risk.ensureRiskCaptcha()
  await flush(); assert.equal(mounts, 2)
  widgets[0].success(); await flush(); assert.equal(submissions, 1)
  widgets.at(-1).success(); await flush(); rejectProof(new Error('服务端未确认'))
  await flush(); assert.equal(mounts, 3)
  assert.ok(document.body.textContent.includes('服务端未确认'))
  widgets.at(-1).success(); await flush(); resolveProof(); await second; await flush()
  assert.equal(document.querySelector('[role="dialog"]'), null)

  const last = risk.ensureRiskCaptcha()
  const lastAssertion = assert.rejects(last, /关闭/)
  await flush(); app.unmount(); await lastAssertion
  await assert.rejects(risk.ensureRiskCaptcha(), /人机验证/)
  assert.ok(destroys >= 3)
  console.log('PASS captcha gate: early dismissal, shared opener, late proof isolation, stale widget callbacks, failed proof retry, success and unmount cleanup')
} finally {
  if (document.querySelector('#app')?.__vue_app__) app.unmount()
  dom.window.close()
}
