import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, defineStore } from 'pinia'
import { ref, nextTick } from 'vue'
const url = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64')
const auth = defineStore('summary-test-auth', () => ({ accessToken: ref('token'), account: ref({ oId:'1', userName:'one' }) }))
const follow = defineStore('summary-test-follow', () => ({ lastChange: ref({ targetId:'', revision:0 }) }))
const relation = defineStore('summary-test-relation', () => ({ lastChange: ref({ kind:'', targetId:'', revision:0 }) }))
let context = 1, calls = [], dispatch = () => Promise.resolve({ total:7 })
globalThis.__summaryTest = { auth, follow, relation, context: () => context, read: (...args) => { calls.push(args); return dispatch(...args) } }
const mocks = {
  'vue': import.meta.resolve('vue'), 'pinia': import.meta.resolve('pinia'),
  '@/api/http': url('export const getAuthContextVersion=globalThis.__summaryTest.context'),
  '@/api/v3-user-relations': url("export function fetchV3UserRelations(...args){return globalThis.__summaryTest.read('following',...args)}"),
  '@/api/v3-saved-content': url("export function fetchV3SavedContent(...args){return globalThis.__summaryTest.read('collections',...args)}"),
  './auth': url('export const useAuthStore=globalThis.__summaryTest.auth'),
  './v3UserFollow': url('export const useV3UserFollowStore=globalThis.__summaryTest.follow'),
  './v3ContentRelations': url('export const useV3ContentRelationsStore=globalThis.__summaryTest.relation'),
}
let source = ts.transpileModule((await fs.readFile('src/stores/personSummary.ts','utf8')).replaceAll('import.meta.env.SSR','false'), {compilerOptions:{target:99,module:99}}).outputText
for (const [name, replacement] of Object.entries(mocks)) source = source.replaceAll(`from '${name}'`, `from '${replacement}'`)
const { usePersonSummaryStore } = await import(url(source))
const pinia = createPinia(), store = usePersonSummaryStore(pinia), user = auth(pinia)
const tick = async () => { for(let n=0;n<10;n++) await Promise.resolve(); await nextTick() }
const detach1 = store.attach(), detach2 = store.attach()
await tick(); assert.equal(calls.length,2); assert.equal(store.following,7); assert.equal(store.collections,7)
store.attach()(); await tick(); assert.equal(calls.length,2)
user.accessToken = 'rotated'; await tick(); assert.equal(calls.length,2)
console.log('PASS multiple cards deduplicate reads and token rotation preserves counts')
let releases=[]; dispatch=()=>new Promise(resolve=>releases.push(resolve))
follow(pinia).lastChange={targetId:'9',revision:1}; await tick(); assert.equal(releases.length,2)
context++; user.account={oId:'2',userName:'two'}; await tick(); assert.equal(releases.length,4)
releases[0]({total:99}); releases[1]({total:99}); await tick(); assert.equal(store.following,null)
releases[2]({total:3}); releases[3]({total:4}); await tick(); assert.equal(store.following,3); assert.equal(store.collections,4)
console.log('PASS account boundary rejects late private counts')
dispatch=()=>Promise.reject(new Error('offline')); relation(pinia).lastChange={kind:'collection',targetId:'5',revision:1};await tick()
assert.equal(store.following,null); assert.equal(store.collections,null)
const before=calls.length; store.attach()();await tick();assert.equal(calls.length,before)
user.accessToken='';await tick();assert.equal(store.following,null);assert.equal(calls.length,before)
detach1();detach2();store.$dispose()
console.log('PASS failures remain unknown, back off, and logout clears state')
