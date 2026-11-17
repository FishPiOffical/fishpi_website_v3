import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'

// 实际组件、Pinia 命令与 API 解码共用；只有 HTTP 传输和 DOM 几何采用本地夹具。
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://127.0.0.1:5173/pets/brawl', pretendToBeVisual: true,
})
for (const key of ['window', 'document', 'navigator', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] })
}
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0)
globalThis.cancelAnimationFrame = clearTimeout
globalThis.fetch = () => { throw new Error('此专项禁止真实网络请求') }
globalThis.BroadcastChannel = class { postMessage() {} close() {} }
Object.defineProperty(document, 'hidden', { configurable: true, value: false })
HTMLElement.prototype.getClientRects = function () { return this.isConnected ? [{ width: 200, height: 44 }] : [] }
// JSDOM 尚未实现 inert 的原生属性反射；浏览器会把 false 移除为无属性状态。
Object.defineProperty(HTMLElement.prototype, 'inert', { configurable: true,
  get() { return this.hasAttribute('inert') },
  set(value) { if (value) this.setAttribute('inert', ''); else this.removeAttribute('inert') },
})
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
const { createApp, h, nextTick, reactive, ref, computed } = await import('vue')
const { createPinia, defineStore, setActivePinia } = await import('pinia')
const useAuthStore = defineStore('brawl-checkout-test-auth', () => {
  const accessToken = ref('test-token-a'), account = ref({ oId: 'A' })
  return { accessToken, account, isLoggedIn: computed(() => !!accessToken.value) }
})
class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code }
}
let context = 1, keySequence = 0, handler
const calls = []
globalThis.__brawlCheckoutTest = {
  ApiError, useAuthStore, getAuthContextVersion: () => context,
  profileOperationKey: () => `checkout-test:${++keySequence}`,
  request: (url, options = {}) => {
    calls.push({ url, method: options.method ?? 'GET', body: options.body, key: options.headers?.['Idempotency-Key'], signal: options.signal })
    return handler(url, options)
  },
}
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'fishpi-brawl-checkout-test-'))
const stub = pathToFileURL(path.join(temporary, 'stubs.mjs')).href
await fs.writeFile(path.join(temporary, 'stubs.mjs'), 'export const {ApiError,useAuthStore,getAuthContextVersion,profileOperationKey,request}=globalThis.__brawlCheckoutTest')
const compiled = new Map()
async function compileFile(file) {
  file = path.resolve(file)
  if (compiled.has(file)) return compiled.get(file)
  const target = path.join(temporary, `${compiled.size}.mjs`), url = pathToFileURL(target).href
  compiled.set(file, url)
  let source = await fs.readFile(file, 'utf8')
  if (file.endsWith('.vue')) source = compileScript(parse(source, { filename: file }).descriptor, { id: `checkout-${compiled.size}`, inlineTemplate: true }).content
  source = source.replaceAll('import.meta.env.SSR', 'false')
  for (const match of [...source.matchAll(/from\s*(['"])([^'"]+)\1/g)]) {
    const specifier = match[2]
    let replacement
    if (['@/api/http', '@/stores/auth', '@/api/v3-profile'].includes(specifier)
        || path.basename(file) === 'v3-pets.ts' && specifier === './http') replacement = stub
    else if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      let dependency = specifier.startsWith('@/') ? path.resolve('src', specifier.slice(2)) : path.resolve(path.dirname(file), specifier)
      if (!path.extname(dependency)) dependency += '.ts'
      replacement = await compileFile(dependency)
    } else replacement = import.meta.resolve(specifier)
    source = source.replaceAll(match[0], `from '${replacement}'`)
  }
  await fs.writeFile(target, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
  return url
}
const deferred = () => { let resolve; const promise = new Promise(accept => { resolve = accept }); return { promise, resolve } }
const response = data => ({ code: 0, data: structuredClone(data) })
const flush = async () => { for (let i = 0; i < 5; i++) { await nextTick(); await new Promise(resolve => setTimeout(resolve, 0)) } }
let app, pets, auth, props, server, count = 0
const pass = name => { count++; console.log(`PASS ${name}`) }
const dialogs = () => [...document.querySelectorAll('[role="dialog"]')].filter(node => !node.closest('.fp-dialog-leave-active'))
const dialog = title => dialogs().find(node => node.querySelector('.fp-dialog-title')?.textContent.trim() === title)
const button = (label, root = document) => [...root.querySelectorAll('button')].find(node => node.textContent.trim() === label && !node.closest('.fp-dialog-leave-active, [inert]'))
const writes = () => calls.filter(call => call.method !== 'GET')
const quotes = () => writes().filter(call => call.url.endsWith('/orders'))
const confirms = () => writes().filter(call => call.url.endsWith('/confirm'))
async function click(label, root = document) {
  const node = button(label, root); assert.ok(node, `缺少按钮：${label}`); assert.equal(node.disabled, false, `${label} 不应禁用`)
  node.click(); await flush()
}
const orderPath = '/api/v3/me/pet/brawl/orders'
function fixture(options = {}) {
  const data = { balance: 1000, charges: 0, rows: [], quoteGate: null, detailGate: null,
    detailFailures: 0, uncertainQuote: false, uncertainConfirm: false, quoteStatus: 'pending', ...options }
  const receipts = new Map()
  handler = async (url, init) => {
    if (!init.method && url === orderPath) return response({ list: data.rows, balance: data.balance, next: null })
    if (!init.method && url.startsWith(orderPath + '/')) {
      if (data.detailFailures > 0) { data.detailFailures--; throw new ApiError('订单暂不可读', 503, 'unavailable') }
      const order = data.rows.find(item => url === `${orderPath}/${item.id}`)
      assert.ok(order, `未知读取地址：${url}`)
      const result = response({ ...order, balance: data.balance })
      if (data.detailGate) { const gate = data.detailGate; await gate.promise }
      return result
    }
    const key = init.headers?.['Idempotency-Key']
    if (receipts.has(key)) return response(receipts.get(key))
    const input = JSON.parse(init.body)
    if (init.method === 'POST' && url === orderPath) {
      const now = Date.now(), id = String(1000 + data.rows.length)
      const order = { id, petId: input.petId, weapon: input.weapon, level: input.level, version: input.version,
        status: data.quoteStatus, createdAt: now, expiresAt: now + 600000,
        materials: input.materials, points: 200 - input.materials * 10,
        ...(input.product ? { product: input.product } : {}) }
      data.rows.unshift(order)
      const receipt = { operation: 'brawl-quote', petId: input.petId, orderId: id, committedAt: now }
      receipts.set(key, receipt)
      if (data.quoteGate) await data.quoteGate.promise
      if (data.uncertainQuote) { data.uncertainQuote = false; throw new ApiError('报价响应断开', 503, 'unavailable') }
      return response(receipt)
    }
    if (init.method === 'POST' && url.endsWith('/confirm')) {
      const order = data.rows.find(item => url === `${orderPath}/${item.id}/confirm`)
      assert.ok(order)
      if (order.status !== 'completed') {
        assert.equal(order.status, 'pending'); assert.ok(data.balance >= order.points)
        data.charges++; data.balance -= order.points; order.status = 'completed'; order.completedAt = Date.now()
      }
      const receipt = { operation: 'brawl-confirm', petId: input.petId, orderId: order.id, committedAt: Date.now() }
      receipts.set(key, receipt)
      if (data.uncertainConfirm) { data.uncertainConfirm = false; throw new ApiError('响应断开，结果未知', 503, 'unavailable') }
      return response(receipt)
    }
    throw new Error(`未允许的 HTTP 夹具请求：${url}`)
  }
  return data
}
let Component, usePetsStore
async function mount(options = {}) {
  if (app) { app.unmount(); pets.$dispose(); auth.$dispose(); await flush() }
  document.body.innerHTML = '<div id="app"></div>'
  calls.length = 0; context++
  server = fixture(options)
  const pinia = createPinia(); setActivePinia(pinia)
  auth = useAuthStore(); pets = usePetsStore()
  props = reactive({ petId: '1', weapon: 'SPOON', level: 0, version: 1, cost: 20, materials: 5, disabled: false, gearOptions: [] })
  app = createApp({ setup: () => () => h(Component, props) }); app.use(pinia); app.mount('#app'); await flush()
  document.querySelector('.checkout-trigger').click(); await flush()
  assert.ok(dialog('积分与材料商店'))
}
try {
  Component = (await import(await compileFile('src/components/pets/PetBrawlCheckout.vue'))).default
  usePetsStore = (await import(await compileFile('src/stores/pets.ts'))).usePetsStore

  await mount(); await click('强化')
  assert.ok(dialog('确认强化'), '必须弹出第二个确认对话框')
  assert.equal(quotes().length, 1); assert.equal(confirms().length, 0); assert.equal(server.charges, 0)
  assert.match(dialog('确认强化').textContent, /150/)
  await click('取消', dialog('确认强化'))
  assert.equal(dialog('确认强化'), undefined); assert.ok(dialog('积分与材料商店'))
  assert.equal(confirms().length, 0); assert.equal(server.charges, 0)
  assert.equal(document.activeElement, button('强化'), '取消后焦点返回强化按钮，不留在底层页面')
  pass('强化仅创建服务端报价，二次确认列出真实费用；取消不提交扣费')

  const gate = deferred(); await mount({ quoteGate: gate })
  const strengthen = button('强化'); strengthen.click(); strengthen.click(); await flush()
  assert.equal(quotes().length, 1); gate.resolve(); await flush()
  const pay = button('确认扣费并强化', dialog('确认强化')); assert.ok(pay)
  pay.click(); pay.click(); await flush()
  assert.equal(confirms().length, 1); assert.equal(server.charges, 1)
  assert.match(document.body.textContent, /强化完成/)
  pass('快速连点强化与确认均只提交一次，完成状态取订单重读')

  await mount({ uncertainConfirm: true }); await click('强化'); await click('确认扣费并强化', dialog('确认强化'))
  assert.equal(server.charges, 1); assert.equal(pets.pending?.kind, 'brawl-confirm')
  const original = confirms()[0]
  auth.accessToken = 'rotated-token-a'; await flush()
  assert.equal(pets.pending?.key, original.key, '正常令牌轮换保留未知扣款原键')
  await click('继续原操作')
  assert.equal(confirms().length, 2); assert.equal(confirms()[1].key, original.key); assert.equal(confirms()[1].body, original.body)
  assert.equal(server.charges, 1); assert.equal(pets.pending, null)
  pass('扣款响应未知与普通令牌轮换保留原命令，恢复使用原键且不重复扣款')

  await mount({ detailFailures: 1 }); await click('强化')
  assert.equal(quotes().length, 1); assert.equal(confirms().length, 0)
  await click('重新读取费用')
  assert.equal(quotes().length, 1); assert.ok(dialog('确认强化'))
  assert.equal(server.charges, 0)
  pass('创建订单后的读取失败仅重读，不重新报价或扣费')

  await mount(); await click('强化'); server.detailFailures = 1
  await click('确认扣费并强化', dialog('确认强化'))
  assert.equal(server.charges, 1); assert.equal(pets.pending, null)
  assert.equal(button('确认扣费并强化'), undefined, '结果读取失败时不能再次提交费用')
  await click('重新读取费用')
  assert.equal(confirms().length, 1); assert.equal(server.charges, 1)
  assert.ok(dialog('强化完成'))
  pass('扣款已确认而后置读取失败时只恢复读取，不能重新扣款')

  await mount({ uncertainQuote: true }); await click('强化')
  assert.equal(pets.pending?.kind, 'brawl-quote'); assert.equal(server.rows.length, 1)
  const originalQuote = quotes()[0]
  await click('继续原操作')
  assert.equal(quotes().length, 2); assert.equal(quotes()[1].key, originalQuote.key); assert.equal(quotes()[1].body, originalQuote.body)
  assert.equal(server.rows.length, 1); assert.ok(dialog('确认强化')); assert.equal(confirms().length, 0)
  pass('报价结果未知时沿原键恢复，仍需二次确认才能扣款')

  for (const options of [{ balance: 100 }, { quoteStatus: 'expired' }]) {
    await mount(options); await click('强化')
    const confirm = button('确认扣费并强化')
    assert.ok(!confirm || confirm.disabled)
    assert.equal(confirms().length, 0); assert.equal(server.charges, 0)
  }
  pass('余额不足与服务端过期订单均不能提交确认')

  await mount(); props.materials = 20; await flush()
  const materialInput = document.querySelector('.deduction-field input')
  materialInput.value = '20'; materialInput.dispatchEvent(new Event('input', { bubbles: true })); await flush()
  await click('强化')
  assert.equal(button('确认扣费并强化'), undefined)
  await click('确认消耗材料并强化', dialog('确认强化'))
  assert.equal(server.charges, 1); assert.equal(server.balance, 1000)
  pass('材料全额抵扣仍显式二次确认，零积分费用不扣积分余额')

  const canceled = deferred(); await mount({ detailGate: canceled }); await click('强化')
  const canceledRead = calls.find(call => call.url.startsWith(orderPath + '/') && call.method === 'GET')
  await click('取消', dialog('确认强化'))
  assert.equal(canceledRead.signal.aborted, true); canceled.resolve(); await flush()
  assert.equal(dialog('确认强化'), undefined); assert.equal(confirms().length, 0)
  assert.ok(dialog('积分与材料商店'))
  pass('读取费用期间取消，中止旧请求且迟到结果不重开二次弹窗')

  const late = deferred(); await mount({ detailGate: late }); await click('强化')
  const detail = calls.find(call => call.url.startsWith(orderPath + '/') && call.method === 'GET')
  assert.ok(detail)
  context++; auth.account = { oId: 'B' }; auth.accessToken = 'token-b'; await flush()
  assert.equal(detail.signal.aborted, true)
  late.resolve(); await flush()
  assert.equal(dialogs().length, 0); assert.equal(pets.pending, null); assert.equal(confirms().length, 0)
  pass('换号中止待确认读取，迟到订单不能重新打开扣费窗口')

  const oldPet = deferred(); await mount({ detailGate: oldPet }); await click('强化')
  props.petId = '2'; await flush(); oldPet.resolve(); await flush()
  assert.equal(dialogs().length, 0); assert.equal(confirms().length, 0)
  pass('换宠清理二次确认和迟到读取')

  await mount(); await click('强化')
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await flush()
  assert.equal(dialog('确认强化'), undefined); assert.ok(dialog('积分与材料商店'))
  assert.equal(confirms().length, 0)
  pass('Escape 只退出顶层扣费确认，不误关商店或提交扣款')
  console.log(`PASS pet-brawl-checkout ${count} 组（真实 Vue / store / API；HTTP 夹具，无真实消费）`)
} finally {
  app?.unmount(); pets?.$dispose(); auth?.$dispose(); await flush()
  await fs.rm(temporary, { recursive: true, force: true }); dom.window.close()
}
