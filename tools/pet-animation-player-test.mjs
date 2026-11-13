import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'

// 真实 Vue 组件，媒体解码和浏览器偏好采用可控夹具；真实透明视频另由浏览器专项验证。
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'Element', 'HTMLElement', 'HTMLVideoElement', 'HTMLMediaElement', 'HTMLCanvasElement', 'SVGElement', 'Node', 'Event']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] })
}
let hidden = false, support = 'probably', opaque = false, rejectPlay = false
Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
const motion = new dom.window.EventTarget(), connection = new dom.window.EventTarget()
motion.matches = false; connection.saveData = false
window.matchMedia = () => motion
Object.defineProperty(navigator, 'connection', { configurable: true, value: connection })
const observers = []
globalThis.IntersectionObserver = class {
  constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this) }
  observe(target) { this.target = target }
  disconnect() { this.disconnected = true }
  send(isIntersecting) { this.callback([{ target: this.target, isIntersecting }]) }
}
const calls = { play: 0, pause: 0, load: 0 }
HTMLMediaElement.prototype.canPlayType = () => support
HTMLMediaElement.prototype.play = function () { calls.play += 1; return rejectPlay ? Promise.reject(new Error('blocked')) : Promise.resolve() }
HTMLMediaElement.prototype.pause = function () { calls.pause += 1 }
HTMLMediaElement.prototype.load = function () { calls.load += 1 }
Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 256 })
Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 256 })
HTMLCanvasElement.prototype.getContext = () => ({
  drawImage() {},
  getImageData() {
    const data = new Uint8ClampedArray(16 * 16 * 4)
    for (let index = 3; index < data.length; index += 4) data[index] = opaque || index > data.length / 2 ? 255 : 0
    return { data }
  },
})
const { createApp, createSSRApp, h, reactive, nextTick } = await import('vue')
const { renderToString } = await import('@vue/server-renderer')
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'fishpi-pet-animation-player-'))
let count = 0
const pass = name => { count += 1; console.log(`PASS ${name}`) }
try {
  const mappingSource = await fs.readFile('src/components/pets/animations.ts', 'utf8')
  const mappingFile = path.join(directory, 'animations.mjs')
  await fs.writeFile(mappingFile, ts.transpileModule(mappingSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
  const mapping = await import(pathToFileURL(mappingFile).href)
  const descriptor = parse(await fs.readFile('src/components/pets/PetAnimation.vue', 'utf8')).descriptor
  const source = compileScript(descriptor, { id: 'pet-animation-test', inlineTemplate: true }).content
    .replaceAll('from "vue"', `from '${import.meta.resolve('vue')}'`).replaceAll("from 'vue'", `from '${import.meta.resolve('vue')}'`)
    .replaceAll("from './animations'", `from '${pathToFileURL(mappingFile).href}'`)
  const componentFile = path.join(directory, 'PetAnimation.mjs')
  await fs.writeFile(componentFile, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
  const Component = (await import(pathToFileURL(componentFile).href)).default
  const flush = async () => { await nextTick(); await Promise.resolve(); await nextTick() }
  const mount = async options => {
    const props = reactive({ species: 'hexiaotun', alt: '荷小豚', action: 'idle', playbackKey: 1, loop: true, ...options })
    const ended = []
    const host = document.createElement('div'); document.body.appendChild(host)
    const app = createApp({ setup: () => () => h(Component, { ...props, onEnded: value => ended.push(value) }) })
    app.mount(host); await flush()
    return { props, ended, host, observer: observers.at(-1), app, video: () => host.querySelector('video'), destroy: () => { app.unmount(); host.remove() } }
  }
  const speciesIds = ['hexiaotun', 'momota', 'yubingmiao', 'paixiaoyu']
  for (const species of speciesIds) {
    const manifest = JSON.parse(await fs.readFile(`public/images/pets/animations/${species}-v1/manifest.json`, 'utf8'))
    assert.deepEqual(mapping.petAnimationActions, manifest.clips.map(clip => clip.id))
    for (const clip of manifest.clips) {
      const entry = mapping.petAnimationClip(species, clip.id)
      assert.ok(entry, `${species} 应有 ${clip.id} 素材`)
      assert.match(entry.src, /^https:\/\/file\.fishpi\.cn\/.*\.webm$/)
      assert.match(entry.poster, /^https:\/\/file\.fishpi\.cn\/.*\.webp$/)
      const local = `public/images/pets/animations/${species}-v1/${clip.id}`
      assert.equal((await fs.stat(local + '.webm')).size, clip.bytes)
      assert.ok((await fs.stat(local + '.webp')).size > 0)
    }
  }
  for (const species of ['unlisted-species', '../momota', 'toString', '__proto__', 'https://example.invalid/pet']) {
    assert.equal(mapping.petAnimationClip(species, 'idle'), null, '仅允许显式目录，不能从物种名称拼接路径')
  }
  for (const action of ['../unknown', 'constructor', '__proto__', 'https://example.invalid/action']) {
    assert.equal(mapping.petAnimationClip('hexiaotun', action), null)
  }
  pass('四物种四十项素材与实际 manifest 一致，未知物种和动作不能拼接视频地址')

  for (const species of speciesIds) {
    const html = await renderToString(createSSRApp(Component, { species, alt: species }))
    assert.ok(html.includes(`src="${mapping.petPortrait(species)}"`)); assert.doesNotMatch(html, /<video|\.webm/)
  }
  pass('四物种 SSR 都只有静态图，不生成媒体下载地址')

  const instance = await mount({ active: false })
  assert.equal(instance.video(), null)
  instance.observer.send(true); await flush(); assert.equal(instance.video(), null)
  instance.props.active = true; await flush()
  let video = instance.video(); assert.ok(video); assert.equal(video.src, mapping.petAnimationClip('hexiaotun', 'idle').src); assert.equal(video.crossOrigin, 'anonymous')
  assert.equal(video.preload, 'none'); assert.equal(instance.host.querySelectorAll('video').length, 1)
  assert.equal(calls.play, 1)
  video.dispatchEvent(new Event('loadeddata')); await flush()
  assert.ok(instance.host.querySelector('.is-playing'))
  pass('只加载当前动作，未激活时零视频，透明解码后替换静态图')

  const beforeHidden = calls.pause
  hidden = true; document.dispatchEvent(new Event('visibilitychange')); await flush()
  assert.ok(calls.pause > beforeHidden); assert.equal(instance.host.querySelector('.is-playing'), null)
  hidden = false; document.dispatchEvent(new Event('visibilitychange')); await flush()
  assert.equal(instance.video(), video); assert.ok(instance.host.querySelector('.is-playing'))
  const beforeOffscreen = calls.pause
  instance.observer.send(false); await flush(); assert.ok(calls.pause > beforeOffscreen)
  instance.observer.send(true); await flush(); assert.equal(instance.video(), video)
  pass('页面隐藏及离开视口暂停，返回复用原视频节点')

  instance.props.action = 'eat'; instance.props.loop = false; instance.props.playbackKey = 2; await flush()
  const old = video; video = instance.video()
  assert.notEqual(video, old); assert.equal(video.src, mapping.petAnimationClip('hexiaotun', 'eat').src); assert.equal(old.getAttribute('src'), null)
  old.dispatchEvent(new Event('ended')); await flush(); assert.deepEqual(instance.ended, [])
  video.dispatchEvent(new Event('loadeddata')); video.dispatchEvent(new Event('ended')); video.dispatchEvent(new Event('ended')); await flush()
  assert.deepEqual(instance.ended, [2])
  const completedPlayCount = calls.play
  instance.observer.send(false); await flush(); instance.observer.send(true); await flush()
  assert.equal(calls.play, completedPlayCount)
  pass('动作切换释放旧资源，旧节点结束事件不结束新动作，当前单次结束只上报一次')

  instance.props.playbackKey = 3; await flush()
  assert.notEqual(instance.video(), video); assert.equal(instance.video().src, mapping.petAnimationClip('hexiaotun', 'eat').src)
  instance.video().dispatchEvent(new Event('ended')); await flush(); assert.deepEqual(instance.ended, [2, 3])
  instance.props.loop = true; instance.props.action = 'idle'; instance.props.playbackKey = 4; await flush()
  instance.video().dispatchEvent(new Event('ended')); await flush(); assert.deepEqual(instance.ended, [2, 3])
  pass('同动作的新操作可重新播放，循环动作不发单次结束事件')

  for (const species of ['momota', 'yubingmiao', 'paixiaoyu']) {
    const previousVideo = instance.video()
    instance.props.species = species; await flush()
    assert.equal(previousVideo.getAttribute('src'), null, '切换物种立即释放前一套媒体')
    assert.equal(instance.video().src, mapping.petAnimationClip(species, 'idle').src)
    assert.equal(instance.host.querySelector('.is-playing'), null, '不同物种首帧不能沿用透明解码结果')
    for (const action of ['eat', 'drink', 'pet', 'play', 'sleep', 'explore', 'study', 'work', 'celebrate', 'idle']) {
      instance.props.action = action; await flush()
      assert.equal(instance.video().src, mapping.petAnimationClip(species, action).src)
      assert.equal(instance.host.querySelectorAll('video').length, 1, '一次只挂载一个当前动作')
      assert.equal(instance.video().playbackRate, 1, '直接使用已调速的素材，不重复在播放器加速')
      instance.video().dispatchEvent(new Event('loadeddata')); await flush()
      assert.ok(instance.host.querySelector('.is-playing'), `${species} 的 ${action} 首帧应切换到视频`)
    }
  }
  pass('三个新增物种切换后释放旧视频，每套十种动作沿原速播放且重新验证透明首帧')

  instance.video().dispatchEvent(new Event('loadeddata')); await flush(); assert.ok(instance.host.querySelector('.is-playing'))
  motion.matches = true; motion.dispatchEvent(new Event('change')); await flush()
  assert.equal(instance.video(), null); assert.ok(instance.host.querySelector('img'))
  motion.matches = false; motion.dispatchEvent(new Event('change')); await flush(); assert.ok(instance.video())
  assert.equal(instance.host.querySelector('.is-playing'), null)
  instance.video().dispatchEvent(new Event('loadeddata')); await flush(); assert.ok(instance.host.querySelector('.is-playing'))
  connection.saveData = true; connection.dispatchEvent(new Event('change')); await flush(); assert.equal(instance.video(), null)
  connection.saveData = false; connection.dispatchEvent(new Event('change')); await flush(); assert.ok(instance.video())
  assert.equal(instance.host.querySelector('.is-playing'), null)
  pass('减少动态效果和省流模式即时回退静态图')

  opaque = true; instance.video().dispatchEvent(new Event('loadeddata')); await flush()
  assert.equal(instance.video(), null); assert.ok(instance.host.querySelector('img'))
  instance.observer.send(false); instance.observer.send(true); await flush(); assert.equal(instance.video(), null)
  opaque = false; instance.props.playbackKey = 5; await flush(); assert.ok(instance.video())
  instance.video().dispatchEvent(new Event('error')); await flush(); assert.equal(instance.video(), null)
  pass('透明通道丢失或媒体错误不显示黑底，不循环重试')

  rejectPlay = true; instance.props.playbackKey = 6; await flush(); assert.equal(instance.video(), null)
  rejectPlay = false
  pass('自动播放拒绝回退静态，不伪造动作完成')

  instance.props.playbackKey = 7; await flush(); assert.ok(instance.video())
  const finalVideo = instance.video(), beforeDestroy = calls.pause
  instance.destroy(); await flush()
  assert.ok(calls.pause > beforeDestroy); assert.equal(finalVideo.getAttribute('src'), null); assert.equal(instance.observer.disconnected, true)
  pass('卸载暂停并释放 src，清理观察器')

  support = ''
  const unsupported = await mount(); unsupported.observer.send(true); await flush(); assert.equal(unsupported.video(), null); unsupported.destroy()
  support = 'probably'
  const other = await mount({ species: 'unlisted-species', image: '/images/pets/momota.webp' }); other.observer.send(true); await flush(); assert.equal(other.video(), null); assert.match(other.host.querySelector('img').src, /momota.webp$/); other.destroy()
  pass('不支持 VP9 或未知物种保持原静态图')
  console.log(`PASS pet-animation-player ${count} 组`)
} finally { await fs.rm(directory, { recursive: true, force: true }); dom.window.close() }
