import assert from 'node:assert/strict'
import { fixture } from './helpers/membership-style-fixture.mjs'
const f = await fixture(), { api, state, helper, token, tick } = f
try {
  const initial = await api.fetchV3MembershipStyles()
  assert.equal(state.requests.at(-1), '/api/v3/membership/styles')
  assert.equal(initial.list[0].style.color, 'rainbow')
  assert.deepEqual(await api.fetchV3MembershipStyles(initial.version), { version: state.version, unchanged: true, maxAgeMs: 30_000 })
  assert.ok(state.requests.at(-1).endsWith('?version=' + state.version))
  const normalDispatch = state.dispatch
  for (const data of [
    { version: state.version, unchanged: true, maxAgeMs: 30000, list: [] },
    { version: 'x', unchanged: false, maxAgeMs: 30000, list: [] },
    { version: state.version, unchanged: false, maxAgeMs: 30001, list: [] },
    ...[null, '[]', '{"secret":true}', '{"bold":"true"}', '{"color":"#123"}'].filter(v => v !== null).map(configJson => ({ version: state.version, unchanged: false, maxAgeMs: 30000, list: [{ userId: '1', configJson }] })),
    { version: state.version, unchanged: false, maxAgeMs: 30000, list: [{ userId: '1', configJson: '{}' }, { userId: '1', configJson: '{}' }] },
  ]) { state.dispatch = async () => ({ code: 0, data }); await assert.rejects(api.fetchV3MembershipStyles(), /格式/) }
  state.dispatch = normalDispatch
  await assert.rejects(api.fetchV3MembershipStyles('bad'), /版本/)
  state.rows = [{ userId: '1', configJson: null }, { userId: '2', configJson: '{}' }]
  assert.deepEqual((await api.fetchV3MembershipStyles()).list, [{ userId: '1', style: null }, { userId: '2', style: {} }])
  assert.equal(api.membershipUserId(Number.MAX_SAFE_INTEGER + 1), '')
  assert.equal(api.membershipUserId('1234567890123456789'), '1234567890123456789')
  console.log('PASS snapshot API 1 full/unchanged envelopes, normalized three-field config, nullable unknowns, version/size/duplicate/type rejection and exact string IDs')

  state.rows = [{ userId: '1', configJson: '{"color":"#112233"}' }, { userId: '42', configJson: '{"color":"galaxy"}' }, { userId: '77', configJson: null }]
  state.calls.length = 0
  assert.equal((await helper.loadVipName('1')).isVip, false); assert.equal(state.calls.length, 0)
  token('A')
  const results = await Promise.all(Array.from({ length: 500 }, (_, i) => helper.loadVipName(String(i + 1))))
  assert.equal(state.calls.length, 1); assert.equal(results[0].color, '#112233'); assert.equal(results[41].effect, 'galaxy')
  await helper.loadVipName('99999'); await helper.loadVipName('77'); assert.equal(helper.cachedVipName('77'), undefined); assert.equal(state.calls.length, 1)
  const alias = await helper.loadVipName(undefined, 'Alice'); assert.equal(alias.color, '#112233')
  const lookups = state.lookups.length; await helper.loadVipName(undefined, 'ALICE'); assert.equal(state.lookups.length, lookups)
  assert.equal(helper.cachedVipName('99', 'Alice').isVip, false)
  console.log('PASS snapshot API 2 500 visible users plus unseen IDs share one full directory; missing IDs never cause individual membership reads and verified name aliases remain isolated')

  token('B'); let release
  state.dispatch = () => new Promise(resolve => { release = resolve })
  const old = helper.loadVipName('1'); await tick()
  token('C'); state.dispatch = async () => ({ code: 0, data: { version: 'c'.repeat(64), unchanged: false, maxAgeMs: 30000, list: [{ userId: '1', configJson: '{"color":"#0000FF"}' }] } })
  await helper.loadVipName('1'); release({ code: 0, data: { version: 'b'.repeat(64), unchanged: false, maxAgeMs: 30000, list: [{ userId: '1', configJson: '{"color":"#FF0000"}' }] } }); await old; await tick()
  assert.equal(helper.cachedVipName('1').color, '#0000FF')
  state.ssr = true; assert.equal(helper.cachedVipName('1'), undefined); assert.equal((await helper.loadVipName('1')).isVip, false); state.ssr = false
  token(null); assert.equal(helper.cachedVipName('1'), undefined); assert.equal(f.timers.size, 0)
  console.log('PASS snapshot API 3 old identity cannot restore an old directory; SSR/anonymous do not use the browser snapshot and logout clears all timers')
} finally { f.cleanup() }
