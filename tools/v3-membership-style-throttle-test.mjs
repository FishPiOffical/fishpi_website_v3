import assert from 'node:assert/strict'
import { fixture } from './helpers/membership-style-fixture.mjs'
const f = await fixture(), { helper, state, token, tick, advance } = f
try {
  token('A')
  let attempts = 0
  state.dispatch = async () => { attempts++; throw Error('会员配置暂不可用') }
  await Promise.all(Array.from({ length: 500 }, (_, i) => helper.loadVipName(String(i + 1))))
  assert.equal(attempts, 1); assert.equal(helper.cachedVipName('1'), undefined)
  await helper.loadVipName('999'); await helper.loadVipName(undefined, 'Alias')
  assert.equal(attempts, 1); assert.equal(state.lookups.length, 0)
  await advance(29_999); await helper.loadVipName('999'); assert.equal(attempts, 1)
  await advance(1); assert.equal(attempts, 1)
  await helper.loadVipName('999'); assert.equal(attempts, 2)
  await advance(30_000); await helper.loadVipName('1000'); assert.equal(attempts, 2)
  await advance(30_000); await helper.loadVipName('1000'); assert.equal(attempts, 3)
  console.log('PASS snapshot throttle 1 500 names share one failed request; 30/60-second global backoff suppresses new IDs and name lookups without caching inactive accounts or replaying failed IDs')
  state.dispatch = async () => ({ code: 0, data: { version: 'b'.repeat(64), unchanged: false, maxAgeMs: 30_000, list: [{ userId: '1', configJson: '{"color":"#123456"}' }] } })
  let fresh
  const { watch } = await import('vue')
  const stop = watch(helper.vipNameRevision, () => { fresh = helper.loadVipName('1') }, { flush: 'sync' })
  token('B'); await fresh; stop()
  assert.equal(helper.cachedVipName('1').color, '#123456')
  helper.invalidateVipName('1'); assert.equal(helper.cachedVipName('1'), undefined)
  await helper.loadVipName('1'); assert.equal(state.calls.at(-1), undefined)
  console.log('PASS snapshot throttle 2 credential changes clear cooldown before mounted consumers reload; local configuration invalidation discards the whole version and reads a fresh directory')
  token('C'); let release
  state.dispatch = () => new Promise(resolve => { release = resolve })
  const pending = helper.loadVipName('1'); await tick(); helper.invalidateVipName('1'); await pending
  assert.equal(helper.cachedVipName('1'), undefined)
  release({ code: 0, data: { version: 'c'.repeat(64), unchanged: false, maxAgeMs: 30000, list: [{ userId: '1', configJson: '{"color":"#FF0000"}' }] } }); await tick()
  assert.equal(helper.cachedVipName('1'), undefined)
  token('D'); let nearExpiry = 0
  state.dispatch = async () => ({ code: 0, data: { version: 'd'.repeat(64), unchanged: false, maxAgeMs: ++nearExpiry === 1 ? 0 : 30000, list: [] } })
  await helper.loadVipName('1'); assert.equal(nearExpiry, 2); assert.equal(helper.cachedVipName('1').isVip, false)
  token('E'); nearExpiry = 0
  state.dispatch = async () => { nearExpiry++; return { code: 0, data: { version: 'e'.repeat(64), unchanged: false, maxAgeMs: 0, list: [] } } }
  await helper.loadVipName('1'); await helper.loadVipName('2'); assert.equal(nearExpiry, 2)
  console.log('PASS snapshot throttle 4 near-expiry server leases permit one fresh read; repeated expired leases enter cooldown instead of looping')
  token(null); assert.equal(f.timers.size, 0)
  console.log('PASS snapshot throttle 3 invalidation settles old waiters and rejects late old directory responses; logout cancels timers')
} finally { f.cleanup() }
