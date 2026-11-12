import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { ref, nextTick } from 'vue'
import { createPinia, defineStore } from 'pinia'
const url = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64')
const compile = s => ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const state = globalThis.__appearanceShopTest = { context: 1, calls: [], dispatch: null }
const http = url(`export class ApiError extends Error {constructor(m,status=0,code=''){super(m);this.status=status;this.code=code}} export const getAuthContextVersion=()=>globalThis.__appearanceShopTest.context;export function request(path,init){globalThis.__appearanceShopTest.calls.push({path,init});return globalThis.__appearanceShopTest.dispatch(path,init)}`)
const api = url(compile(await fs.readFile('src/api/v3-appearance-shop.ts', 'utf8')).replace("from './http'", `from '${http}'`))
const auth = defineStore('shop-test-auth', () => ({ accessToken: ref('token'), account: ref({ oId: '1' }), reloadAccount: async () => {} }))
globalThis.__shopAuth = auth
const replacements = [['vue', import.meta.resolve('vue')], ['pinia', import.meta.resolve('pinia')], ['@/api/http', http], ['@/api/v3-appearance-shop', api], ['./auth', url('export const useAuthStore=globalThis.__shopAuth')], ['@/api/v3-profile', url("let n=0;export const profileOperationKey=()=> 'shop-'+ ++n")]]
let source = compile(await fs.readFile('src/stores/appearanceShop.ts', 'utf8'))
for (const [a,b] of replacements) source = source.replaceAll(`from '${a}'`, `from '${b}'`)
const { useAppearanceShopStore } = await import(url(source))
const product = { id: 'mount-paper-plane', kind: 'mount', styleId: 'paper-plane', name: '纸飞机', version: 1, price7: 1024, price30: 3584, enabled: true, revision: 1 }
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
  if (path.endsWith('/appearance-shop')) return envelope({ list: [product] })
  if (readFails) throw Error('读取失败')
  return envelope(inventory)
}
const pinia = createPinia(), store = useAppearanceShopStore(pinia), user = auth(pinia)
assert.equal(state.calls.length, 0)
await store.load(); assert.equal(store.products.length, 1)
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
const appearance = await import(url(compile(await fs.readFile('src/utils/chatAppearance.ts','utf8'))))
assert.equal(appearance.chatAppearanceSnapshot({ version: 1, bubbleId: 'sea-soda', frameId: 'tide' }).bubbleId, 'sea-soda')
assert.equal(appearance.chatAppearanceSnapshot({ version: 99, bubbleId: 'sea-soda', frameId: 'tide' }).bubbleId, 'classic')
console.log('PASS 身份切换拒迟到库存、新样式快照白名单及未知版本回退')
