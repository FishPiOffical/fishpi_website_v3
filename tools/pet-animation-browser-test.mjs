import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'

// 真实组件和视频在独立浏览器运行，只有传输与身份使用本地夹具，不连接业务服务。
const root = process.cwd()
const temporary = path.join(root, '.temp/pet-animation-browser')
const sourceDirectory = path.join(temporary, 'fixture')
const output = path.join(temporary, 'built')
await fs.mkdir(sourceDirectory, { recursive: true })
const suite = await fs.readFile(path.join(root, 'tools/pets-ui-test.mjs'), 'utf8')
const begin = suite.indexOf('const skillNames =')
const end = suite.indexOf('\nhandler = success')
assert(begin >= 0 && end > begin, '宠物界面测试夹具的来源锚点已变化')
await fs.copyFile(path.join(root, 'tools/pet-preview-care.mjs'), path.join(sourceDirectory, 'pet-preview-care.mjs'))
await fs.writeFile(path.join(sourceDirectory, 'data.js'), `
import { ApiError } from './stubs.ts'
import { createPetPreviewCare } from './pet-preview-care.mjs'
const assert = { equal(actual, expected) { if (actual !== expected) throw new Error('本地夹具状态不匹配') } }
let serial = 0
export const calls = []
export const nextKey = () => 'animation-browser:' + ++serial
${suite.slice(begin, end).replace('const now = Date.UTC', 'let now = Date.UTC')}
serverState = adopted('animation-pet', '荷小满', new URLSearchParams(location.search).get('species') || 'hexiaotun')
serverState.pet.hunger = 45; serverState.pet.water = 50; serverState.pet.energy = 60; serverState.pet.mood = 50
for (const skill of serverState.pet.skills) skill.experience = 30
serverState.wallet.coins = 920
let fault = '', hold = null
const receipts = new Map()
const clockBase = now, clockStarted = Date.now()
let clockOffset = 0
const fixedClock = new URLSearchParams(location.search).has('testClock')
const care = createPetPreviewCare({ getState: () => serverState, catalog,
  fail: (message, code) => { throw new ApiError(message, 409, code) },
  journal: (action, name, changes) => journalEvent('care', action, name, changes) })
const syncClock = () => {
  now = clockBase + clockOffset + (fixedClock ? 0 : Date.now() - clockStarted)
  care.settle(now)
}
syncClock()
// 测试只推进此页面的内存时钟，不修改机器时间或长测服务。
export const advanceTime = ms => { if (!Number.isFinite(ms) || ms < 0) throw new Error('时间增量无效'); clockOffset += ms; syncClock() }
export const setFault = value => { fault = value }
export const readState = () => { syncClock(); return structuredClone(serverState) }
export const readJournal = () => structuredClone(historyRows)
export const setActivity = kind => {
  syncClock()
  if (!kind) { serverState.pet.activity = null; return }
  if (kind === 'rest') { serverState.pet.activity = { kind, startedAt: now, endsAt: now + catalog.rules.restDurationMs }; return }
  const choice = catalog[kind === 'course' ? 'courses' : kind === 'work' ? 'jobs' : 'places'][0]
  serverState.pet.activity = { id: 'browser-activity', kind, entryId: choice.id, name: choice.name,
    startedAt: now, endsAt: now + 600000, status: 'running', cost: choice.cost, rewards: choice.rewards }
}
export const finishActivity = () => { serverState.pet.activity.startedAt = now - 600000; serverState.pet.activity.endsAt = now - 1; serverState.pet.activity.status = 'claimable' }
export const request = async (url, options) => {
  const key = options?.headers?.['Idempotency-Key']
  calls.push({ url, method: options?.method || 'GET', key })
  const write = options?.method && options.method !== 'GET'
  if (!write && fault === 'read' && url === '/api/v3/me/pet') { fault = ''; throw new ApiError('读取失败夹具', 503) }
  if (write && fault === 'hold') { fault = ''; await new Promise(resolve => { hold = resolve }) }
  if (key && receipts.has(key)) return receipts.get(key)
  syncClock()
  const result = write && url.endsWith('/actions')
    ? response(care.act(JSON.parse(options.body), now))
    : await success(url, options)
  if (key) receipts.set(key, result)
  if (write && fault === 'unknown') { fault = ''; throw new ApiError('未知结果夹具', 0) }
  return result
}
export const releaseWrite = () => { hold?.(); hold = null }
`)
await fs.writeFile(path.join(sourceDirectory, 'stubs.ts'), `
import { ref, computed, h, reactive } from 'vue'
import { defineStore } from 'pinia'
export { request } from './data.js'
import { nextKey } from './data.js'
export const profileOperationKey = nextKey
export class ApiError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code } }
export const getAuthContextVersion = () => 1
export const usePageSeo = () => {}
export const useAuthStore = defineStore('animation-auth', () => {
  const accessToken = ref('isolated-fixture')
  return { accessToken, account: ref({ oId: 'fixture-owner' }), isLoggedIn: computed(() => !!accessToken.value) }
})
export const RouterLink = { props: ['to'], setup(props, { slots }) { return () => h('a', { href: '#', onClick: e => e.preventDefault() }, slots.default?.()) } }
const route = reactive({ path: '/pets' })
export const useRoute = () => route
export const useLayoutStore = defineStore('animation-layout', () => ({ immersive: ref(false) }))
`)
const copied = new Map()
const stubs = new Set(['@/api/http', '@/stores/auth', '@/stores/layout', '@/api/v3-profile', '@/composables/usePageSeo', 'vue-router'])
async function copy(file) {
  file = path.resolve(file)
  if (copied.has(file)) return copied.get(file)
  const name = `module-${copied.size}${path.extname(file)}`
  copied.set(file, name)
  let contents = await fs.readFile(file, 'utf8')
  for (const match of [...contents.matchAll(/from\s*(['"])([^'"]+)\1/g)]) {
    const specifier = match[2]
    let replacement
    if (stubs.has(specifier) || (path.basename(file) === 'v3-pets.ts' && specifier === './http')) replacement = './stubs.ts'
    else if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      let dependency = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(file), specifier)
      if (!path.extname(dependency)) dependency += '.ts'
      replacement = `./${await copy(dependency)}`
    }
    if (replacement) contents = contents.replaceAll(match[0], `from '${replacement}'`)
  }
  await fs.writeFile(path.join(sourceDirectory, name), contents)
  return name
}
const view = await copy(path.join(root, 'src/views/PetsView.vue'))
const desktop = await copy(path.join(root, 'src/components/pets/PetDesktop.vue'))
const petsStore = await copy(path.join(root, 'src/stores/pets.ts'))
const displayStore = await copy(path.join(root, 'src/stores/petDisplay.ts'))
await fs.writeFile(path.join(sourceDirectory, 'Shell.vue'), `
<script setup>
import { onMounted } from 'vue'
import View from './${view}'
import Desktop from './${desktop}'
import { usePetsStore } from './${petsStore}'
import { usePetDisplayStore } from './${displayStore}'
import { useAuthStore, useRoute } from './stubs.ts'
import * as fixture from './data.js'
const pets = usePetsStore(), display = usePetDisplayStore(), auth = useAuthStore(), route = useRoute()
const desktopOnly = new URLSearchParams(location.search).has('desktop')
onMounted(() => {
  window.petFixture = { pets, display, auth, route, ...fixture }
  document.body.dataset.fixtureReady = 'true'
})
</script>
<template>
  <header class="fixture-nav" data-site-navigation><strong>摸鱼派</strong><span>动画接入 · 本地隔离验收</span></header>
  <main v-if="!desktopOnly"><View /></main>
  <main v-else class="desktop-fixture"><h1>桌宠陪伴</h1><p>此处仅检查桌宠播放、拖动和收纳，不连接真实服务。</p></main>
  <Desktop />
</template>
<style>
.fixture-nav { display: flex; align-items: center; justify-content: space-between; gap: 12px; max-width: 1180px; margin: 0 auto 20px; min-height: 40px; border-bottom: 1px solid var(--fp-border); padding-bottom: 14px; color: var(--fp-text); }
.fixture-nav span { font-size: 12px; color: var(--fp-muted); }
.desktop-fixture { min-height: 70vh; padding: 30px; }
</style>
`)
await fs.writeFile(path.join(sourceDirectory, 'main.ts'), `
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Shell from './Shell.vue'
import '${path.join(root, 'src/styles/base.css')}'
import '${path.join(root, 'src/styles/inner-pages.css')}'
import '${path.join(root, 'src/packs/themes/classic-light/style.css')}'
import '${path.join(root, 'src/packs/themes/classic-dark/style.css')}'
document.documentElement.dataset.theme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'classic-dark' : 'classic-light'
createApp(Shell).use(createPinia()).mount('#app')
`)
await fs.writeFile(path.join(sourceDirectory, 'index.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>荷小豚动画接入 · 隔离验证</title><style>body{margin:0;padding:24px 16px;font-family:system-ui,sans-serif!important}*{box-sizing:border-box}@media(max-width:600px){body{padding:16px 10px}}</style></head><body><div id="app"></div><script type="module" src="./main.ts"></script></body></html>`)
await build({ configFile: false, root: sourceDirectory, publicDir: false, plugins: [vue()], logLevel: 'warn',
  resolve: { alias: { '@': path.join(root, 'src') } }, build: { outDir: output, emptyOutDir: true } })

const requests = [], failures = [], exceptions = [], results = [], expectedMediaFailures = []
let failingVideo = ''
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.webm': 'video/webm', '.json': 'application/json' }
const server = http.createServer(async (request, response) => {
  try {
    assert(['GET', 'HEAD'].includes(request.method), '验证服务不接收写请求')
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    requests.push(pathname)
    if (failingVideo && pathname.endsWith(`/${failingVideo}.webm`)) {
      expectedMediaFailures.push(pathname); response.writeHead(404); response.end(); return
    }
    const base = pathname.startsWith('/images/pets/') ? path.join(root, 'public') : output
    const filename = path.resolve(base, pathname === '/' ? 'index.html' : `.${pathname}`)
    assert(filename.startsWith(`${base}/`), '不能访问夹具目录之外的文件')
    const bytes = await fs.readFile(filename)
    const headers = { 'content-type': mime[path.extname(filename)] || 'application/octet-stream', 'cache-control': 'public,max-age=3600' }
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || '')
    if (range) {
      const start = Number(range[1]), end = Math.min(range[2] ? Number(range[2]) : bytes.length - 1, bytes.length - 1)
      assert(start <= end, '视频区间有效')
      response.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${bytes.length}`, 'content-length': end - start + 1, 'accept-ranges': 'bytes' })
      response.end(request.method === 'HEAD' ? undefined : bytes.subarray(start, end + 1))
    } else {
      response.writeHead(200, { ...headers, 'content-length': bytes.length })
      response.end(request.method === 'HEAD' ? undefined : bytes)
    }
  } catch {
    if (request.url !== '/favicon.ico') failures.push(request.url)
    response.writeHead(404); response.end()
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const profile = path.join(temporary, `chrome-${Date.now()}`)
const browser = spawn(process.env.PET_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let socket
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
try {
  let address
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const [debugPort, endpoint] = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n'); address = `ws://127.0.0.1:${debugPort}${endpoint}`; break } catch { await delay(100) }
  }
  assert(address, '独立浏览器启动成功')
  socket = new WebSocket(address)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let nextId = 0
  const pending = new Map()
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id)
      pending.delete(message.id); clearTimeout(timer)
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text)
  }
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId, timer = setTimeout(() => { pending.delete(id); reject(new Error(`超时：${method}`)) }, 20000)
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
  })
  const version = await send('Browser.getVersion')
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const call = (method, params = {}) => send(method, params, sessionId)
  const evaluate = async expression => {
    const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text)
    return response.result.value
  }
  async function until(expression, label, timeout = 7000) {
    const start = Date.now()
    while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await delay(70) }
    throw new Error(`等待失败：${label}；${JSON.stringify(await evaluate(`({error:petFixture?.pets.error,pending:!!petFixture?.pets.pending,busy:petFixture?.pets.busy,event:petFixture?.pets.confirmedEvent,videos:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc,ready:v.readyState,paused:v.paused,time:v.currentTime}))})`))}`)
  }
  async function screenshot(name) {
    const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    await fs.writeFile(path.join(temporary, name), Buffer.from(data, 'base64'))
  }
  await call('Runtime.enable'); await call('Page.enable'); await call('Network.enable')
  // 用浏览器启动脚本模拟省流偏好，其余媒体检测仍由真实浏览器执行。
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `if(new URLSearchParams(location.search).has('saveData')){const connection=new EventTarget();connection.saveData=true;Object.defineProperty(navigator,'connection',{configurable:true,value:connection})}` })
  await call('Network.setBlockedURLs', { urls: ['https://*', 'http://localhost:*'] })
  const setViewport = (width, height = 1000) => call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
  async function navigate(query = '') {
    const parameters = new URLSearchParams(query.replace(/^\?/, ''))
    parameters.set('testClock', '1')
    await call('Page.navigate', { url: `http://127.0.0.1:${port}/?${parameters}` })
    await until(`!!window.petFixture?.pets.pet`, '宠物夹具已加载')
  }
  const sceneVideo = `document.querySelector('.pet-scene video')`
  const sceneAction = action => `${sceneVideo}?.currentSrc.includes('/${action}.webm') && ${sceneVideo}.readyState >= 2 && !${sceneVideo}.paused`
  await setViewport(1440)
  await navigate()
  await until(sceneAction('idle'), '待机真实播放')
  assert.deepEqual([...new Set(requests.filter(url => url.endsWith('.webm')).map(url => path.basename(url)))], ['idle.webm'])
  const alpha = await evaluate(`(()=>{const v=${sceneVideo};const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.drawImage(v,0,0,256,256);const a=x.getImageData(0,0,256,256).data;let clear=0,solid=0;for(let i=3;i<a.length;i+=4){if(!a[i])clear++;if(a[i]>240)solid++}return {clear,solid,width:v.videoWidth,height:v.videoHeight}})()`)
  assert(alpha.clear > 10000 && alpha.solid > 10000)
  assert.equal(alpha.width, 256); assert.equal(alpha.height, 256)
  await screenshot('home-desktop.png')
  results.push('首屏只加载待机，真实256透明视频正常播放')

  const careButton = (label, scope = '.care-panel') => `[...document.querySelectorAll('${scope} .pet-actions button')].find(button=>button.querySelector(':scope > span')?.textContent===${JSON.stringify(label)})`
  async function clickCare(label, scope) {
    assert.equal(await evaluate(`!!${careButton(label, scope)} && !${careButton(label, scope)}.disabled`), true, `${label}入口可用`)
    await evaluate(`${careButton(label, scope)}.click()`)
  }
  const careSnapshot = () => evaluate(`(()=>{const s=petFixture.pets,p=s.pet;return {hunger:p.hunger,water:p.water,mood:p.mood,energy:p.energy,experience:p.experience,friendship:p.friendship,used:p.growthToday.used,food:s.foodQuantity,coins:s.coins,petCooldown:p.cooldowns.pet,playCooldown:p.cooldowns.play,now:s.state.serverNow}})()`)
  async function checkHomeState(expected) {
    assert.deepEqual(await evaluate(`Object.fromEntries(['hunger','water','mood','energy'].map(key=>[key,Number(document.querySelector('.pet-stat.'+key+' [role=progressbar]').getAttribute('aria-valuenow'))]))`),
      { hunger: expected.hunger, water: expected.water, mood: expected.mood, energy: expected.energy })
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.growth-values strong')].map(node=>Number(node.textContent))`), [expected.experience, expected.friendship])
    assert.equal(await evaluate(`document.querySelector('.daily-growth strong').textContent.trim()`), `${expected.used} / 10 次`)
    assert.match(await evaluate(`${careButton('喂食')}.title`), new RegExp(`余 ${expected.food} 份口粮`))
  }
  async function finishCare(label) {
    // 家园与桌宠都由确认事件播放一次；加速结束媒体，不篡改业务状态。
    await evaluate(`document.querySelectorAll('.pet-animation video').forEach(video=>{if(!video.loop&&Number.isFinite(video.duration))video.currentTime=video.duration-.15})`)
    await until(sceneAction('idle'), `${label}播放完回待机`)
  }
  const careCases = [
    { action: 'feed', label: '喂食', clip: 'eat', effects: { hunger: 35 }, food: -1 },
    { action: 'water', label: '饮水', clip: 'drink', effects: { water: 40 }, food: 0 },
    { action: 'pet', label: '抚摸', clip: 'pet', effects: { mood: 10 }, food: 0 },
    { action: 'play', label: '玩耍', clip: 'play', effects: { mood: 20, energy: -10 }, food: 0 },
  ]
  const expectedCareLogs = []
  for (const { action, label, clip, effects, food } of careCases) {
    const before = await careSnapshot(), beforeCalls = await evaluate('petFixture.calls.length')
    await clickCare(label)
    await until(sceneAction(clip), `${label}对应动画`)
    const after = await careSnapshot()
    for (const key of ['hunger', 'water', 'mood', 'energy']) assert.equal(after[key], Math.max(0, Math.min(100, before[key] + (effects[key] || 0))), `${label}实际改变${key}`)
    assert.equal(after.food, before.food + food)
    assert.equal(after.coins, before.coins)
    assert.equal(after.experience, before.experience + 10)
    assert.equal(after.friendship, before.friendship + 2)
    assert.equal(after.used, before.used + 1)
    if (action === 'pet' || action === 'play') assert.equal(after[`${action}Cooldown`] - after.now, 30 * 60_000)
    await checkHomeState(after)
    assert.deepEqual(await evaluate(`petFixture.calls.slice(${beforeCalls}).map(x=>x.method)`), ['POST', 'GET'])
    assert.equal(await evaluate(`${sceneVideo}.loop`), false)
    expectedCareLogs.push({ action, label, food, effects: Object.fromEntries(['hunger', 'water', 'mood', 'energy', 'experience', 'friendship'].map(key => [key, after[key] - before[key]])) })
    await finishCare(label)
  }
  results.push('四种真实照顾按钮同步改变四项状态、经验、亲密度和口粮；DOM与store一致，成功后各播一次且无额外API')
  await screenshot('home-care-changes.png')

  // 饱食和水分临近上限时只记录实际增量，已满和冷却中的按钮不能再次消耗。
  for (const { action, label, clip, food } of careCases.slice(0, 2)) {
    const before = await careSnapshot()
    await clickCare(label)
    await until(sceneAction(clip), `${label}达到上限`)
    const after = await careSnapshot()
    assert.equal(after[action === 'feed' ? 'hunger' : 'water'], 100)
    await checkHomeState(after)
    expectedCareLogs.push({ action, label, food, effects: Object.fromEntries(['hunger', 'water', 'mood', 'energy', 'experience', 'friendship'].map(key => [key, after[key] - before[key]])) })
    await finishCare(label)
  }
  const beforeBlocked = await evaluate('petFixture.calls.length')
  for (const { label } of careCases) {
    assert.equal(await evaluate(`${careButton(label)}.disabled`), true, `${label}上限或冷却期间禁用`)
    await evaluate(`${careButton(label)}.click()`)
  }
  assert.equal(await evaluate('petFixture.calls.length'), beforeBlocked)
  assert.match(await evaluate(`${careButton('抚摸')}.title`), /分钟后/)
  assert.match(await evaluate(`${careButton('玩耍')}.title`), /分钟后/)
  results.push('饱食、水分封顶100，已满或冷却中的重复点击不请求、不扣口粮')

  await evaluate(`document.getElementById('pet-home-tab-history').click()`)
  await until(`document.querySelectorAll('.history-item').length===${expectedCareLogs.length}`, '照顾日志按真实操作展示')
  const journal = await evaluate('petFixture.readJournal().filter(row=>row.kind==="care")')
  assert.equal(journal.length, expectedCareLogs.length)
  for (const [index, expected] of [...expectedCareLogs].reverse().entries()) {
    const row = journal[index]
    assert.equal(row.action, expected.action)
    assert.deepEqual(row.effects, expected.effects)
    assert.deepEqual(row.itemChanges, expected.food ? [{ itemId: 'food', quantity: expected.food }] : [])
    assert.equal(row.coinsDelta, 0)
    const text = await evaluate(`document.querySelectorAll('.history-item')[${index}].textContent`)
    assert(text.includes(expected.label))
    for (const [key, name] of Object.entries({ hunger: '饱食', water: '水分', mood: '心情', energy: '精力', experience: '经验', friendship: '亲密度' })) {
      const value = expected.effects[key]
      if (value) assert(text.includes(`${name} ${value > 0 ? '+' : ''}${value}`), `${expected.label}日志展示${name}净变化`)
    }
    if (expected.food) assert(text.includes('基础口粮 -1'))
  }
  results.push('活动记录展示六次实际互动及封顶净增量；无额外扣币或失败重复日志')

  // 独立页面重置测试数据，避免前一组的真实冷却让弱网场景根本没有发送。
  await navigate()
  await until(sceneAction('idle'), '延迟场景先待机')
  const beforeHold = await careSnapshot()
  await evaluate(`petFixture.setFault('hold')`)
  await clickCare('抚摸')
  await delay(150)
  assert.deepEqual(await careSnapshot(), beforeHold)
  assert.equal(await evaluate(`${sceneVideo}?.currentSrc.includes('/pet.webm')`), false)
  await evaluate('petFixture.releaseWrite()')
  await until(sceneAction('pet'), '确认后才播动作')
  assert.equal((await careSnapshot()).mood, beforeHold.mood + 10)
  await finishCare('延迟确认')
  await navigate()
  await until(sceneAction('idle'), '未知结果场景先待机')
  const beforeUnknown = await careSnapshot()
  await evaluate(`petFixture.setFault('unknown')`)
  await clickCare('喂食')
  await until('!!petFixture.pets.pending && !petFixture.pets.busy', '等待原操作核对')
  assert.equal(await evaluate('!!petFixture.pets.pending'), true)
  assert.equal(await evaluate(`${sceneVideo}?.currentSrc.includes('/eat.webm')`), false)
  assert.deepEqual(await careSnapshot(), beforeUnknown)
  const committed = await evaluate('petFixture.readState()'), pendingKey = await evaluate('petFixture.pets.pending.key')
  assert.equal(committed.pet.hunger, beforeUnknown.hunger + 35)
  assert.equal(committed.inventory.find(item => item.itemId === 'food').quantity, beforeUnknown.food - 1)
  assert.equal(await evaluate('petFixture.readJournal().length'), 1)
  await evaluate(`document.querySelector('button[aria-label="核对上次宠物操作"]').click()`)
  await until(sceneAction('eat'), '原键恢复确认后播放')
  const recovered = await careSnapshot()
  assert.equal(recovered.hunger, beforeUnknown.hunger + 35)
  assert.equal(recovered.food, beforeUnknown.food - 1)
  assert.equal(recovered.experience, beforeUnknown.experience + 10)
  assert.equal(recovered.friendship, beforeUnknown.friendship + 2)
  assert.equal(recovered.used, beforeUnknown.used + 1)
  assert.equal(await evaluate('petFixture.readJournal().length'), 1)
  assert.deepEqual(await evaluate('petFixture.calls.filter(call=>call.method==="POST").map(call=>call.key)'), [pendingKey, pendingKey])
  await checkHomeState(recovered)
  await finishCare('原键恢复')
  results.push('等待时状态与动画不提前成功；未知结果原键核对后只消耗一次口粮、成长一次、日志一条')

  await evaluate('petFixture.display.show();petFixture.display.setCollapsed(false)')
  await until(`!!document.querySelector('.pet-character')`, '家园中的桌宠可见')
  await evaluate(`document.querySelector('.pet-character').click()`)
  await until(`!!document.querySelector('.pet-desktop-panel .pet-actions')`, '打开桌宠照顾面板')
  const beforeDesktopCare = await careSnapshot()
  await clickCare('饮水', '.pet-desktop-panel')
  await until(sceneAction('drink'), '桌宠饮水同步播放家园动画')
  await until(`document.querySelector('.pet-character video')?.currentSrc.includes('/drink.webm')`, '桌宠同步播放饮水动画')
  const afterDesktopCare = await careSnapshot()
  assert.equal(afterDesktopCare.water, beforeDesktopCare.water + 40)
  assert.equal(afterDesktopCare.experience, beforeDesktopCare.experience + 10)
  assert.equal(afterDesktopCare.friendship, beforeDesktopCare.friendship + 2)
  await checkHomeState(afterDesktopCare)
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.desktop-stats b')].map(node=>Number(node.textContent))`),
    [afterDesktopCare.hunger, afterDesktopCare.water, afterDesktopCare.mood, afterDesktopCare.energy])
  await evaluate(`document.querySelector('button[aria-label="关闭桌宠面板"]').click()`)
  await finishCare('桌宠饮水')
  results.push('从桌宠真实按钮饮水，家园四项状态与成长、桌宠面板和两处动画同步')

  await navigate()
  await until(sceneAction('idle'), '冷却和成长上限场景先待机')
  const initialGrowth = await careSnapshot()
  for (let index = 0; index < 11; index++) {
    if (index > 0) {
      await evaluate('petFixture.advanceTime(30*60_000+1);petFixture.pets.refresh()')
      await until(`!${careButton('抚摸')}.disabled`, '三十分钟冷却到期恢复按钮')
    }
    const beforePetting = await careSnapshot()
    await clickCare('抚摸')
    await until(sceneAction('pet'), `第${index + 1}次抚摸成功`)
    const current = await careSnapshot(), rewarded = Math.min(index + 1, 10)
    assert.equal(current.used, rewarded)
    assert.equal(current.experience, initialGrowth.experience + rewarded * 10)
    assert.equal(current.friendship, initialGrowth.friendship + rewarded * 2)
    assert.equal(current.mood, Math.min(100, beforePetting.mood + 10))
    assert.equal(await evaluate(`${careButton('抚摸')}.disabled`), true)
    await checkHomeState(current)
    await finishCare(`第${index + 1}次抚摸`)
  }
  const finalCareLog = await evaluate('petFixture.readJournal()[0]')
  assert.equal(finalCareLog.effects.experience, 0)
  assert.equal(finalCareLog.effects.friendship, 0)
  assert(finalCareLog.effects.mood >= 0 && finalCareLog.effects.mood < 10)
  results.push('抚摸冷却到期恢复可用；前十次成长，十一次仍可互动但不重复发成长，心情封顶只记实际增量')

  await navigate()
  await until(sceneAction('idle'), '真实休息场景先待机')
  const beforeRest = await careSnapshot()
  await clickCare('休息')
  await until(sceneAction('sleep'), '休息按钮进入睡眠')
  assert.equal(await evaluate('petFixture.pets.pet.activity.kind'), 'rest')
  assert.equal(await evaluate(`${careButton('唤醒')}.disabled`), false)
  assert.equal(await evaluate(`['喂食','饮水','抚摸','玩耍'].every(label=>[...document.querySelectorAll('.care-panel .pet-actions button')].find(button=>button.querySelector(':scope > span')?.textContent===label).disabled)`), true)
  await evaluate('petFixture.advanceTime(60*60_000);petFixture.pets.refresh()')
  await until('petFixture.pets.pet.energy > ' + beforeRest.energy, '一小时休息实际恢复精力')
  assert.equal((await careSnapshot()).energy, Math.min(100, beforeRest.energy + 20))
  await clickCare('唤醒')
  await until('!petFixture.pets.busy && petFixture.pets.pet.activity===null', '唤醒清除休息状态')
  await until(sceneAction('idle'), '唤醒回待机')
  const afterRest = await careSnapshot()
  assert.equal(afterRest.used, beforeRest.used)
  assert.equal(afterRest.experience, beforeRest.experience)
  assert.equal(afterRest.friendship, beforeRest.friendship)
  await checkHomeState(afterRest)
  results.push('真实休息与唤醒按钮更新活动，休息一小时精力增加20，不误发日常成长')

  await navigate()
  await until(sceneAction('idle'), '长期动作场景先待机')
  for (const [kind, clip] of [['rest', 'sleep'], ['outing', 'explore'], ['course', 'study'], ['work', 'work']]) {
    await evaluate(`petFixture.setActivity('${kind}');petFixture.pets.refresh()`)
    await until(sceneAction(clip), `${kind} 当前活动动画`)
    assert.equal(await evaluate(`${sceneVideo}.loop`), true)
  }
  await evaluate('petFixture.finishActivity();petFixture.pets.refresh()')
  await until(sceneAction('idle'), '活动到期待领取使用待机')
  results.push('休息、外出、上课、工作使用循环动作；到期待领取不继续活动动画')
  const beforeSupply = await evaluate('({ coins:petFixture.pets.coins, food:petFixture.pets.foodQuantity, calls:petFixture.calls.length, reward:{ coins:petFixture.pets.state.dailySupply.coins, food:petFixture.pets.state.dailySupply.food } })')
  await evaluate("document.querySelector('.supply-panel button').click()")
  await until(sceneAction('celebrate'), '补给确认后庆祝')
  assert.deepEqual(await evaluate('({ coins:petFixture.pets.coins, food:petFixture.pets.foodQuantity, claimed:petFixture.pets.state.dailySupply.claimed })'),
    { coins: beforeSupply.coins + beforeSupply.reward.coins, food: beforeSupply.food + beforeSupply.reward.food, claimed: true })
  assert.equal(await evaluate("document.querySelector('.supply-panel button').textContent"), '今日已领取')
  assert.equal(await evaluate("document.querySelector('.supply-panel button').disabled"), true)
  assert.equal(await evaluate("document.querySelector('.pet-guide-supply') === null"), true)
  assert.deepEqual(await evaluate(`petFixture.calls.slice(${beforeSupply.calls}).map(x=>x.method)`), ['POST', 'GET'])
  const afterSupplyCalls = await evaluate('petFixture.calls.length')
  await evaluate("document.querySelector('.supply-panel button').click();petFixture.pets.claimSupply()")
  assert.equal(await evaluate('petFixture.calls.length'), afterSupplyCalls)
  await evaluate(`(()=>{const v=${sceneVideo};v.currentTime=v.duration-.15})()`)
  await until(sceneAction('idle'), '庆祝完回待机')
  results.push('补给实际到账并禁用领取按钮，重复点击不请求；庆祝一次后回待机')

  // 模拟已发奖但响应丢失，恢复原幂等键只能核对结果，不能再发一份。
  await navigate()
  const recoverySupply = await evaluate('({ coins:petFixture.pets.coins, food:petFixture.pets.foodQuantity, reward:{ coins:petFixture.pets.state.dailySupply.coins, food:petFixture.pets.state.dailySupply.food } })')
  await evaluate("petFixture.setFault('unknown');petFixture.pets.claimSupply()")
  assert.equal(await evaluate('!!petFixture.pets.pending'), true)
  assert.equal(await evaluate('petFixture.pets.confirmedEvent'), null)
  assert.equal(await evaluate('petFixture.readState().dailySupply.claimed'), true)
  assert.equal(await evaluate('petFixture.pets.state.dailySupply.claimed'), false)
  await evaluate('petFixture.pets.retryPending()')
  await until(sceneAction('celebrate'), '补给未知结果恢复后庆祝')
  assert.deepEqual(await evaluate('({ coins:petFixture.pets.coins, food:petFixture.pets.foodQuantity, claimed:petFixture.pets.state.dailySupply.claimed })'),
    { coins: recoverySupply.coins + recoverySupply.reward.coins, food: recoverySupply.food + recoverySupply.reward.food, claimed: true })
  await evaluate(`(()=>{const v=${sceneVideo};v.currentTime=v.duration-.15})()`)
  await until(sceneAction('idle'), '补给恢复动作结束回待机')
  results.push('补给响应丢失保持未知，原键恢复只发一次奖励且正确更新领取状态')

  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await until(`!${sceneVideo} || ${sceneVideo}.paused`, '减少动态停止播放')
  await screenshot('home-reduced-motion.png')
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await until(sceneAction('idle'), '恢复动态播放')
  results.push('系统减少动态偏好即时停播并回退静态')

  // 真实滚动使主画面离开视口，检查播放暂停，而非直接篡改可见性判断。
  await setViewport(1440, 450)
  await evaluate('window.scrollTo(0, document.documentElement.scrollHeight)')
  await until(`!${sceneVideo} || ${sceneVideo}.paused`, '离开视口暂停')
  await evaluate('window.scrollTo(0,0)')
  await setViewport(1440)
  await until(sceneAction('idle'), '回到视口恢复')
  results.push('滚出视口暂停，回到视口恢复当前长期动作')

  for (const width of [390, 320]) {
    await setViewport(width, 900)
    await delay(250)
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
    await screenshot(`home-${width}.png`)
  }
  results.push('390px与320px布局无横向溢出')

  await setViewport(1440)
  await navigate('?desktop')
  const desktopVideo = `document.querySelector('.pet-character video')`
  await until(`${desktopVideo}?.readyState >= 2 && !${desktopVideo}.paused`, '桌宠待机播放')
  await screenshot('desktop-pet.png')
  await evaluate('petFixture.display.setCollapsed(true)')
  await until(`!${desktopVideo} || ${desktopVideo}.paused`, '桌宠收起停播')
  await evaluate('petFixture.display.setCollapsed(false)')
  await until(`${desktopVideo}?.readyState >= 2 && !${desktopVideo}.paused`, '桌宠展开恢复')
  await evaluate('petFixture.display.hide()')
  await until(`!document.querySelector('.pet-desktop')`, '隐藏桌宠释放')
  results.push('桌宠展开播放、收起停播、隐藏卸载')

  const beforeStatic = requests.length
  await navigate('?species=paixiaoyu')
  await delay(250)
  assert.equal(await evaluate('document.querySelectorAll("video").length'), 0)
  assert.equal(requests.slice(beforeStatic).filter(url => url.endsWith('.webm')).length, 0)
  results.push('其他宠物维持静态展示，无多余视频请求')

  const beforeSaveData = requests.length
  await navigate('?saveData=1')
  await delay(250)
  assert.equal(await evaluate('document.querySelectorAll("video").length'), 0)
  assert.equal(requests.slice(beforeSaveData).filter(url => url.endsWith('.webm')).length, 0)
  results.push('省流偏好首次加载不请求视频，直接展示静态图')

  await call('Network.setCacheDisabled', { cacheDisabled: true })
  await navigate()
  await until(sceneAction('idle'), '故障场景先正常待机')
  failingVideo = 'work'
  await evaluate("petFixture.setActivity('work');petFixture.pets.refresh()")
  await until(`document.querySelector('.pet-scene [data-pet-action="work"]') && !${sceneVideo}`, '视频失败回退静态')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.pet-scene .pet-animation img')).opacity"), '1')
  assert(expectedMediaFailures.length > 0)
  const attempts = expectedMediaFailures.length
  await evaluate('petFixture.pets.refresh()')
  await delay(400)
  assert.equal(expectedMediaFailures.length, attempts)
  results.push('视频加载故障回退静态，同一动作不自动反复请求')
  failingVideo = ''

  assert.deepEqual(failures, []); assert.deepEqual(exceptions, [])
  assert.equal(requests.some(url => url.startsWith('/api/')), false)
  const report = { date: new Date().toISOString(), browser: version.product, passed: results.length, results, alpha,
    media: [...new Set(requests.filter(url => url.endsWith('.webm')))].map(url => path.basename(url)),
    failedResources: failures, expectedMediaFailures, exceptions, screenshots: temporary,
    note: '真实组件、浏览器、WebM与本地模拟传输；未访问真实账号，未中断原8小时测试，不代表真机Safari验收。' }
  await fs.writeFile(path.join(temporary, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  socket?.close(); browser.kill('SIGTERM')
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
}
