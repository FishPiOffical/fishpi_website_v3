import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer, h, nextTick } from 'vue'
import { fixture, compile, url } from './helpers/membership-style-fixture.mjs'
const f = await fixture(), { helper, helperURL, state, token, tick, advance } = f
const originalObserver = globalThis.IntersectionObserver
let app
try {
  const descriptor = parse(await fs.readFile('src/components/user/VipNickname.vue', 'utf8')).descriptor
  const Component = (await import(url(compile(compileScript(descriptor, { id: 'snapshot-expiry', inlineTemplate: true }).content).replace(/from ['"]vue['"]/g, `from '${import.meta.resolve('vue')}'`).replace("from '@/composables/useVipNickname'", `from '${helperURL}'`)))).default
  const nodes = [], renderer = createRenderer({ patchProp(n, k, o, v) { n.props[k] = v }, insert() {}, remove() {}, createElement(tag) { const n = { tag, props: {} }; nodes.push(n); return n }, createText() { return {} }, createComment() { return {} }, setText() {}, setElementText() {}, parentNode() { return null }, nextSibling() { return null } })
  token('A')
  app = renderer.createApp({ setup: () => () => h(Component, { userId: '1', text: 'visible', lazy: false }) }); app.mount({}); await tick(); await nextTick()
  const span = nodes.find(n => n.tag === 'span')
  assert.match(span.props.class, /rainbow/); assert.deepEqual(state.calls, [undefined])
  let release
  state.dispatch = () => new Promise(resolve => { release = resolve })
  await advance(29_999); assert.match(span.props.class, /rainbow/)
  await advance(1); await nextTick(); assert.equal(span.props.style, undefined); assert.equal(state.calls.at(-1), state.version)
  release({ code: 0, data: { version: state.version, unchanged: true, maxAgeMs: 30_000 } }); await tick(); await nextTick()
  assert.match(span.props.class, /rainbow/)
  console.log('PASS snapshot expiry 1 mounted CSS expires on the server lease; a tiny unchanged-version response revalidates retained data without downloading the directory')
  state.version = 'b'.repeat(64)
  state.dispatch = async () => ({ code: 0, data: { version: state.version, unchanged: false, maxAgeMs: 30_000, list: [{ userId: '1', configJson: '{"color":"#ABCDEF"}' }] } })
  await advance(30_000); await nextTick()
  assert.equal(span.props.style['--vip-color'], '#ABCDEF')
  console.log('PASS snapshot expiry 2 same member count with a new content version replaces the old nickname configuration')
  app.unmount(); app = null
  const observers = []
  globalThis.IntersectionObserver = class { constructor(callback) { this.callback = callback; observers.push(this) } observe() {} disconnect() {} }
  app = renderer.createApp({ setup: () => () => h(Component, { userId: '1', text: 'offscreen', lazy: true }) }); app.mount({}); await tick()
  const reads = state.calls.length
  await advance(30_000); await nextTick(); assert.equal(state.calls.length, reads)
  const lazy = nodes.filter(n => n.tag === 'span').at(-1); assert.equal(lazy.props.style, undefined)
  observers.at(-1).callback([{ isIntersecting: true }]); await tick(); await nextTick(); assert.equal(state.calls.length, reads + 1)
  assert.equal(lazy.props.style['--vip-color'], '#ABCDEF')
  console.log('PASS snapshot expiry 3 offscreen nicknames do not poll; entering visibility shares one conditional snapshot check')
  state.dispose(); await tick(); await nextTick(); assert.equal(lazy.props.style, undefined); assert.equal(f.timers.size, 0)
  console.log('PASS snapshot expiry 4 HMR/exit clears current CSS and all shared validation/cooldown timers')
} finally { if (app) app.unmount(); globalThis.IntersectionObserver = originalObserver; f.cleanup() }
