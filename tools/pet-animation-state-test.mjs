import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { JSDOM } from 'jsdom'

// 使用真实动画投影逻辑，仅以响应式快照和可控时钟隔离网络及视频解码。
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { pretendToBeVisual: true })
for (const name of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'Event']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] })
}
Object.defineProperty(document, 'hidden', { configurable: true, writable: true, value: false })
const { createApp, h, reactive, ref, nextTick } = await import('vue')
const pet = (id = 'pet-a', speciesId = 'hexiaotun') => ({ id, speciesId, activity: null })
const pets = reactive({ pet: pet(), confirmedEvent: null, refreshNeeded: false, busy: false })
globalThis.__petAnimationState = { usePetsStore: () => pets }
const moduleUrl = value => `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`
let source = await fs.readFile('src/components/pets/usePetAnimationState.ts', 'utf8')
source = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
source = source.replaceAll("from 'vue'", `from '${import.meta.resolve('vue')}'`)
source = source.replaceAll("from '@/stores/pets'", `from '${moduleUrl('export const { usePetsStore } = globalThis.__petAnimationState')}'`)
const { usePetAnimationState } = await import(moduleUrl(source))
const realSetTimeout = globalThis.setTimeout, realClearTimeout = globalThis.clearTimeout
let time = 0, timerId = 0
const timers = new Map()
globalThis.setTimeout = (callback, delay = 0) => { const id = ++timerId; timers.set(id, { callback, at: time + delay }); return id }
globalThis.clearTimeout = id => timers.delete(id)
const now = ref(100_000), active = ref(true)
let animation, currentApp = null, sequence = 0
function mount() {
  const app = createApp({ setup() { animation = usePetAnimationState(now, active); return () => h('div', animation.action.value) } })
  app.mount('#app'); currentApp = app
  return app
}
function cue(kind = 'actions', action = 'water', petId = pets.pet?.id) {
  pets.confirmedEvent = { sequence: ++sequence, petId, kind, ...(kind === 'actions' ? { action } : {}) }
}
function hidden(value) { document.hidden = value; document.dispatchEvent(new Event('visibilitychange')) }
function advance(ms) {
  time += ms
  for (const [id, timer] of [...timers]) {
    if (timer.at <= time && timers.delete(id)) timer.callback()
  }
}
function unmount() { currentApp?.unmount(); currentApp = null }

try {
  cue('actions', 'feed')
  mount()
  assert.equal(animation.action.value, 'idle', '挂载不能播放上次操作留下的确认信号')
  assert.equal(timers.size, 0)
  assert.equal(animation.loop.value, true)
  console.log('PASS 动画初挂载只读取当前活动，不重播历史确认事件')

  for (const [kind, action, expected] of [
    ['actions', 'feed', 'eat'], ['actions', 'water', 'drink'], ['actions', 'pet', 'pet'], ['actions', 'play', 'play'],
    ['crafts', '', 'work'], ['adoption', '', 'celebrate'], ['readoption', '', 'celebrate'],
    ['activities/claim', '', 'celebrate'], ['stories/claim', '', 'celebrate'], ['supplies', '', 'celebrate'],
  ]) {
    cue(kind, action)
    assert.equal(animation.action.value, expected)
    assert.equal(animation.loop.value, false)
    assert.equal(timers.size, 1, '新的单次动作替换旧动作，不累积结束计时器')
    animation.end(animation.playbackKey.value)
    assert.equal(animation.action.value, 'idle')
    assert.equal(animation.loop.value, true)
    assert.equal(timers.size, 0)
  }
  for (const [kind, action] of [['actions', 'rest'], ['actions', 'wake'], ['name', ''], ['purchases', '']]) {
    cue(kind, action)
    assert.equal(animation.action.value, 'idle')
    assert.equal(animation.loop.value, true)
  }
  console.log('PASS 已确认互动、制作和领取对应单次动作，无关操作不产生动画')

  cue('actions', 'feed')
  const oldKey = animation.playbackKey.value
  cue('actions', 'water')
  animation.end(oldKey)
  assert.equal(animation.action.value, 'drink', '迟到的结束事件不能结束新动作')
  advance(11_999)
  assert.equal(animation.action.value, 'drink')
  advance(1)
  assert.equal(animation.action.value, 'idle')
  assert.equal(timers.size, 0)
  console.log('PASS 迟到结束事件隔离，视频不能结束时12秒内回到当前活动')

  cue('actions', 'play')
  active.value = false
  assert.equal(animation.action.value, 'idle')
  cue('actions', 'feed')
  active.value = true
  assert.equal(animation.action.value, 'idle', '隐藏期间收到的确认不能在重新显示时补播')
  cue('actions', 'pet')
  hidden(true)
  assert.equal(animation.action.value, 'idle')
  cue('actions', 'water')
  hidden(false)
  assert.equal(animation.action.value, 'idle', '浏览器标签页恢复不能积攒成功动画')
  assert.equal(timers.size, 0)
  console.log('PASS 分区隐藏、桌宠收起及后台标签页丢弃单次动作，恢复后不补播')

  cue('actions', 'feed')
  pets.pet = pet('pet-b')
  assert.equal(animation.action.value, 'idle')
  cue('actions', 'water', 'pet-a')
  assert.equal(animation.action.value, 'idle')
  cue('actions', 'water')
  assert.equal(animation.action.value, 'drink')
  pets.pet = null
  pets.confirmedEvent = null
  assert.equal(animation.action.value, 'idle')
  pets.pet = pet('pet-c', 'paixiaoyu')
  cue('actions', 'water')
  assert.equal(animation.action.value, 'idle', '没有对应素材的宠物继续静态展示')
  pets.pet = pet('pet-d')
  cue('actions', 'pet')
  pets.refreshNeeded = true
  assert.equal(animation.action.value, 'idle')
  pets.refreshNeeded = false
  assert.equal(animation.action.value, 'idle')
  cue('actions', 'play')
  pets.busy = true
  assert.equal(animation.action.value, 'idle', '新操作进行中清除上次单次反馈')
  pets.busy = false
  console.log('PASS 换宠、空状态、错误目标与过时状态清理，其他宠物无冒用动画')

  for (const [kind, expected] of [['rest', 'sleep'], ['outing', 'explore'], ['course', 'study'], ['work', 'work']]) {
    pets.pet.activity = { kind, endsAt: now.value + 5000, ...(kind !== 'rest' ? { status: 'running' } : {}) }
    assert.equal(animation.action.value, expected)
    assert.equal(animation.loop.value, true)
    assert.equal(timers.size, 0, '长期活动不能通过额外计时器或接口模拟成果')
    const oldEvent = pets.confirmedEvent
    now.value += 5000
    assert.equal(animation.action.value, 'idle', '活动到期停止原活动动画')
    assert.equal(pets.confirmedEvent, oldEvent, '到期不能伪造领取确认或庆祝')
    assert.equal(pets.pet.activity.kind, kind, '动画到期不能自行修改服务端活动状态')
  }
  pets.pet.activity = { kind: 'course', endsAt: now.value + 5000, status: 'claimable' }
  assert.equal(animation.action.value, 'idle')
  pets.pet.activity.status = 'running'
  pets.refreshNeeded = true
  assert.equal(animation.action.value, 'idle')
  pets.refreshNeeded = false
  assert.equal(animation.action.value, 'study')
  console.log('PASS 休息、外出、学习、工作按真实活动循环；到期或待领取回待机，不奖励、不改状态')

  pets.pet.activity = null
  cue('actions', 'feed')
  unmount()
  assert.equal(timers.size, 0)
  mount()
  assert.equal(animation.action.value, 'idle', '路由返回或桌宠重建不能重播已消费的单次动作')
  cue('actions', 'water')
  assert.equal(timers.size, 1)
  unmount()
  hidden(true); hidden(false)
  assert.equal(timers.size, 0)
  await nextTick()
  console.log('PASS 卸载清计时器和可见性监听，重建不补播已确认动作')
} finally {
  unmount()
  globalThis.setTimeout = realSetTimeout
  globalThis.clearTimeout = realClearTimeout
  delete globalThis.__petAnimationState
  dom.window.close()
}
