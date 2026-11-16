import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { ref, nextTick } from 'vue'
import { createPinia, defineStore } from 'pinia'
const url = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64')
const compile = s => ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const state = globalThis.__appearanceShopTest = { context: 1, calls: [], dispatch: null }
const http = url(`export class ApiError extends Error {constructor(m,status=0,code=''){super(m);this.status=status;this.code=code}} export const getAuthContextVersion=()=>globalThis.__appearanceShopTest.context;export function request(path,init){globalThis.__appearanceShopTest.calls.push({path,init});return globalThis.__appearanceShopTest.dispatch(path,init)}`)
const bubbleStyle = url(compile(await fs.readFile('src/utils/bubbleStyle.ts', 'utf8')))
const api = url(compile(await fs.readFile('src/api/v3-appearance-shop.ts', 'utf8'))
  .replace("from './http'", `from '${http}'`).replace("from '@/utils/bubbleStyle'", `from '${bubbleStyle}'`))
const auth = defineStore('shop-test-auth', () => ({ accessToken: ref('token'), account: ref({ oId: '1' }), reloadAccount: async () => {} }))
globalThis.__shopAuth = auth
const replacements = [['vue', import.meta.resolve('vue')], ['pinia', import.meta.resolve('pinia')], ['@/api/http', http], ['@/api/v3-appearance-shop', api], ['./auth', url('export const useAuthStore=globalThis.__shopAuth')], ['@/api/v3-profile', url("let n=0;export const profileOperationKey=()=> 'shop-'+ ++n")]]
let source = compile(await fs.readFile('src/stores/appearanceShop.ts', 'utf8'))
for (const [a,b] of replacements) source = source.replaceAll(`from '${a}'`, `from '${b}'`)
const { useAppearanceShopStore } = await import(url(source))
const product = { id: 'mount-paper-plane', kind: 'mount', styleId: 'paper-plane', name: '纸飞机', version: 1, price7: 1024, price30: 3584, enabled: true, revision: 1 }
const sakuraFrame = { ...product, id: 'frame-night-sakura', kind: 'frame', styleId: 'sakura-letter', name: '花瓣折笺头像框', price7: 128, price30: 0, vipIncluded: true }
const moonBubble = { ...sakuraFrame, id: 'bubble-sakura-moon', kind: 'bubble', styleId: 'sakura-moon', name: '月弧夜樱气泡', price7: 256 }
const inventory = { list: [], mountId: '', serverNow: Date.now(), balance: 10000 }
const envelope = data => ({ code: 0, data })
let losesResponse = false, readFails = false, deductions = 0
const receipts = new Map()
state.dispatch = async (path, init) => {
  if (init?.method === 'POST') {
    const key = init.headers['Idempotency-Key']
    if (!receipts.has(key)) { deductions++; receipts.set(key, { id: '1', productId: product.id, paidPoints: 1024, expiresAt: Date.now()+86400000 }) }
    if (losesResponse) { losesResponse = false; throw Error('响应丢失') }
    return envelope(receipts.get(key))
  }
  if (path === '/api/v3/appearance-shop?includeVipWeekly=1') return envelope({ list: [product, sakuraFrame, moonBubble] })
  if (readFails) throw Error('读取失败')
  return envelope(inventory)
}
const pinia = createPinia(), store = useAppearanceShopStore(pinia), user = auth(pinia)
assert.equal(state.calls.length, 0)
await store.load(); assert.deepEqual(store.products, [product, sakuraFrame, moonBubble])
await store.buy(moonBubble, 30); assert.equal(deductions, 0)
losesResponse = true; await store.buy(product, 7)
assert.equal(deductions, 1); const key = store.pending.key
user.accessToken = 'rotated'; await nextTick(); assert.equal(store.pending.key, key)
await store.buy(product, 30); assert.equal(deductions, 1)
await store.retry(); assert.equal(deductions, 1); assert.equal(store.pending, null)
readFails = true; await store.buy(product, 7)
assert.equal(deductions, 2); assert.equal(store.pending, null); assert.equal(store.inventory, null)
readFails = false; await store.load(); assert.equal(deductions, 2)
console.log('PASS 原键恢复防重复扣款、令牌轮换、未确认阻止新消费、写成功读失败只重读')
const releases = []; state.dispatch = () => new Promise(resolve => releases.push(resolve))
const old = store.load(); user.account = { oId: '2' }; await nextTick()
releases[0](envelope({ list: [product] })); releases[1](envelope(inventory)); await old
assert.equal(store.inventory, null); assert.equal(store.pending, null)
store.$dispose()
const appearance = await import(url(compile(await fs.readFile('src/utils/chatAppearance.ts','utf8'))
  .replaceAll("'@/utils/bubbleStyle'", `'${bubbleStyle}'`)))
assert.equal(appearance.chatAppearanceSnapshot({ version: 1, bubbleId: 'sea-soda', frameId: 'tide' }).bubbleId, 'sea-soda')
assert.equal(appearance.chatAppearanceSnapshot({ version: 99, bubbleId: 'sea-soda', frameId: 'tide' }).bubbleId, 'classic')
const nightSakura = { version: 1, bubbleId: 'night-sakura', frameId: 'night-sakura' }
assert.deepEqual(appearance.chatAppearanceSnapshot(nightSakura), nightSakura)
assert.equal(appearance.isLoopingSakura(nightSakura.bubbleId), false)
const sakuraDuo = { version: 1, bubbleId: 'sakura-letter', frameId: 'sakura-moon' }
assert.deepEqual(appearance.chatAppearanceSnapshot(sakuraDuo), sakuraDuo)
assert.equal(appearance.isLoopingSakura(sakuraDuo.bubbleId), true)
assert.equal(appearance.isLoopingSakura(sakuraDuo.frameId), true)
console.log('PASS 身份切换拒迟到库存、新样式快照白名单及未知版本回退')
