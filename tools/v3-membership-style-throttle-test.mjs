import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
let now = 100_000, timerId = 0
const timers = new Map(), original = { now: Date.now, setTimeout, clearTimeout }
Date.now = () => now
globalThis.setTimeout = (fn, delay = 0) => { const id = ++timerId; timers.set(id, { at: now + delay, fn }); return id }
globalThis.clearTimeout = id => timers.delete(id)
const state = globalThis.__throttleStyle = { token: 'A', listeners: [], calls: [], reject: false, lookups: 0 }
const http = url(`export const getAccessToken=()=>globalThis.__throttleStyle.token;export function onAccessTokenChange(fn){globalThis.__throttleStyle.listeners.push(fn);return()=>{}}`)
const service = url(`export const membershipUserId=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value)?value:'';
export async function fetchV3MembershipStyles(ids){const s=globalThis.__throttleStyle;s.calls.push({ids:[...ids],at:Date.now()});if(s.reject)throw Error('会员配置暂不可用');return ids.map(userId=>({userId,style:{color:'#123456'}}))}
export async function resolveV3NicknameUser(){globalThis.__throttleStyle.lookups++;return{id:'999',userName:'Alias'}}`)
let source = ts.transpileModule(await fs.readFile('src/composables/useVipNickname.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replaceAll('import.meta.env.SSR', 'false')
for (const [from, to] of [['vue', import.meta.resolve('vue')], ['@/api/http', http], ['@/api/v3-membership-styles', service]]) source = source.replaceAll(`from '${from}'`, `from '${to}'`)
const helper = await import(url(source))
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
async function advance(ms) {
  const target = now + ms
  for (let i = 0; i < 100; i++) {
    await tick()
    const next = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
    if (!next) { now = target; await tick(); return }
    now = next[1].at; timers.delete(next[0]); next[1].fn()
  }
  throw Error('Unbounded retry loop')
}
function token(value) { state.token = value; for (const listener of state.listeners) listener(value) }
try {
  const first = helper.loadVipName('1')
  await advance(20)
  const second = helper.loadVipName('2'), duplicate = helper.loadVipName('1')
  await advance(30); await Promise.all([first, second, duplicate])
  assert.deepEqual(state.calls.map(c => c.ids), [['1', '2']])
  const third = helper.loadVipName('3')
  await advance(100)
  const fourth = helper.loadVipName('4')
  await advance(400); await Promise.all([third, fourth])
  assert.deepEqual(state.calls[1].ids, ['3', '4'])
  assert.ok(state.calls[1].at - state.calls[0].at >= 500)
  console.log('PASS style throttle 1 staggered arrivals merge across tasks, duplicate users share work and batches start at least 500ms apart')

  state.reject = true
  const pending = Array.from({ length: 205 }, (_, i) => helper.loadVipName(String(i + 1000)))
  await advance(500); await Promise.all(pending)
  assert.equal(state.calls.length, 3)
  assert.equal(state.calls[2].ids.length, 100)
  assert.equal(helper.cachedVipName('1000'), undefined)
  const before = state.calls.length, lookups = state.lookups
  for (let i = 0; i < 20; i++) await helper.loadVipName(String(i + 3000))
  await helper.loadVipName(undefined, 'Alias')
  assert.equal(state.calls.length, before); assert.equal(state.lookups, lookups)
  await advance(29_999); assert.equal(state.calls.length, before)
  await advance(1); assert.equal(state.calls.length, before, 'Cooldown must re-observe visibility, not replay the failed queue')
  const retry = helper.loadVipName('1000'); await advance(50); await retry
  assert.equal(state.calls.length, before + 1)
  assert.equal(helper.cachedVipName('1000'), undefined)
  await advance(30_000); await helper.loadVipName('1001'); assert.equal(state.calls.length, before + 1)
  console.log('PASS style throttle 2 failure settles all queued users, suppresses other users/name lookups for 30s, then backs off for 60s without caching inactive status')

  state.reject = false
  const { watch } = await import('vue')
  let fresh
  const stop = watch(helper.vipNameRevision, () => { fresh = helper.loadVipName('1000') }, { flush: 'sync' })
  token('B'); await advance(50); await fresh; stop()
  assert.equal(helper.cachedVipName('1000').color, '#123456')
  token(null)
  assert.equal(timers.size, 0)
  assert.equal(helper.cachedVipName('1000'), undefined)
  console.log('PASS style throttle 3 identity changes cancel cooldown/expiry and reject old cache; logout leaves no background timers')
} finally {
  token(null); Date.now = original.now; globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout
  delete globalThis.__throttleStyle
}
