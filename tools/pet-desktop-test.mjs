import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'

// 编译真实桌宠和摆放逻辑，只隔离服务端状态与浏览器几何，不生成测试网络请求。
const dom = new JSDOM('<!doctype html><html><body><header data-site-navigation></header><div id="app"></div></body></html>', { url: 'http://127.0.0.1:5173/pets', pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'localStorage', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'getComputedStyle']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : dom.window[key] })
Object.defineProperty(document, 'hidden', { configurable: true, value: false })
const viewport = new window.EventTarget()
Object.assign(viewport, { width: 1200, height: 800, offsetLeft: 0, offsetTop: 0 })
Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
window.matchMedia = query => ({ matches: /max-width: 640px/.test(query) && viewport.width <= 640, addEventListener() {}, removeEventListener() {} })
const resizeObservers = new Set()
globalThis.ResizeObserver = class { nodes = new Set(); constructor(callback) { this.callback = callback; resizeObservers.add(this) } observe(node) { this.nodes.add(node) } disconnect() { this.nodes.clear() } }
let frames = 0
const scheduled = new Set()
globalThis.requestAnimationFrame = callback => { const id = setTimeout(() => { scheduled.delete(id); frames++; callback() }, 0); scheduled.add(id); return id }
globalThis.cancelAnimationFrame = id => { clearTimeout(id); scheduled.delete(id) }
const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top })
const externalRects = new WeakMap()
HTMLElement.prototype.getBoundingClientRect = function () {
  if (externalRects.has(this)) return externalRects.get(this)
  if (this.matches('[data-site-navigation]')) return rect(0, 0, viewport.width, 80)
  if (this.matches('.pet-desktop, .pet-desktop-panel')) return rect(Number.parseFloat(this.style.left) || 0, Number.parseFloat(this.style.top) || 0, this.offsetWidth, this.offsetHeight)
  return rect(0, 0, 0, 0)
}
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return this.matches('.pet-desktop') ? this.classList.contains('narrow') ? 48 : this.classList.contains('collapsed') ? 56 : 144 : this.matches('.pet-desktop-panel') ? Number.parseFloat(this.style.width) || 296 : 0 } })
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return this.matches('.pet-desktop') ? this.classList.contains('narrow') ? 48 : this.classList.contains('collapsed') ? 84 : 184 : this.matches('.pet-desktop-panel') ? Math.min(260, Number.parseFloat(this.style.maxHeight) || 260) : 0 } })
HTMLElement.prototype.setPointerCapture = function () {}
HTMLElement.prototype.releasePointerCapture = function () {}
HTMLElement.prototype.hasPointerCapture = function () { return false }
const { createApp, h, ref, computed, reactive, nextTick } = await import('vue')
const { createPinia, defineStore } = await import('pinia')
let reads = 0
const useAuthStore = defineStore('desktop-test-auth', () => ({ isLoggedIn: ref(true), account: ref({ oId: 'local-fixture' }), accessToken: ref('test') }))
const useLayoutStore = defineStore('desktop-test-layout', () => ({ immersive: ref(false) }))
const usePetsStore = defineStore('desktop-test-pets', () => ({ confirmedEvent: ref(null), pet: ref({ id: 'pet-one', name: '小伙伴', speciesId: 'hexiaotun', level: 2, hunger: 60, water: 60, mood: 60, energy: 60, activity: null, cooldowns: { pet: 0, play: 0 } }), state: ref({ serverNow: Date.now() }), receivedAt: ref(Date.now()), refreshNeeded: ref(false), loading: ref(false), busy: ref(false), pending: ref(null), foodQuantity: ref(5), ensureLoaded: () => { reads++ }, refresh: () => { reads++ } }))
const route = reactive({ path: '/pets' })
const RouterLink = { props: ['to'], setup(props, { slots }) { return () => h('a', { href: props.to }, slots.default?.()) } }
globalThis.__desktopTest = { getAuthContextVersion: () => 1, useAuthStore, useLayoutStore, usePetsStore, RouterLink, useRoute: () => route }
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'fishpi-pet-desktop-')), compiled = new Map()
const stub = pathToFileURL(path.join(temporary, 'stub.mjs')).href
await fs.writeFile(path.join(temporary, 'stub.mjs'), 'export const { getAuthContextVersion,useAuthStore,useLayoutStore,usePetsStore,RouterLink,useRoute }=globalThis.__desktopTest')
const stubs = new Set(['@/api/http', '@/stores/auth', '@/stores/layout', '@/stores/pets', 'vue-router'])
async function compileFile(file) {
  file = path.resolve(file)
  if (compiled.has(file)) return compiled.get(file)
  const target = path.join(temporary, `${compiled.size}.mjs`), url = pathToFileURL(target).href
  compiled.set(file, url)
  let source = await fs.readFile(file, 'utf8')
  if (file.endsWith('.vue')) source = compileScript(parse(source, { filename: file }).descriptor, { id: `pet-desktop-${compiled.size}`, inlineTemplate: true }).content
  source = source.replaceAll('import.meta.env.SSR', 'false')
  // 先转译移除纯类型依赖，防止测试隔离层引入无关 API 传输。
  source = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  for (const match of [...source.matchAll(/from\s*(['"])([^'"]+)\1/g)]) {
    const specifier = match[2]; let replacement
    if (stubs.has(specifier)) replacement = stub
    else if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      let dependency = specifier.startsWith('@/') ? path.resolve('src', specifier.slice(2)) : path.resolve(path.dirname(file), specifier)
      if (!path.extname(dependency)) dependency += '.ts'
      replacement = await compileFile(dependency)
    } else replacement = import.meta.resolve(specifier)
    source = source.replaceAll(match[0], `from '${replacement}'`)
  }
  await fs.writeFile(target, source); return url
}
const { placeFloating, overlapsFloatingRect } = await import(await compileFile('src/components/pets/layout/floatingPlacement.ts'))
const { default: Desktop } = await import(await compileFile('src/components/pets/PetDesktop.vue'))
const { usePetDisplayStore } = await import(await compileFile('src/stores/petDisplay.ts'))
const pinia = createPinia(), app = createApp(Desktop).use(pinia)
let activeApp = app
const settle = async () => { await nextTick(); for (let i = 0; i < 4; i++) { await new Promise(resolve => setTimeout(resolve, 0)); await nextTick() } }
const pet = () => document.querySelector('.pet-desktop')
const panel = () => document.querySelector('.pet-desktop-panel')
const pos = () => ({ x: Number.parseFloat(pet().style.left), y: Number.parseFloat(pet().style.top) })
function box(selector, bounds) { const node = document.createElement('div'); if (selector.startsWith('.')) node.className = selector.slice(1); else node.setAttribute(selector, 'true'); externalRects.set(node, bounds); document.body.append(node); return node }
function pointer(node, type, x, y) { const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }); Object.defineProperty(event, 'pointerId', { value: 1 }); Object.defineProperty(event, 'isPrimary', { value: true }); node.dispatchEvent(event) }
async function tap(node) { pointer(node, 'pointerdown', 20, 20); pointer(node, 'pointerup', 20, 20); node.click(); await settle() }
async function viewportSize(width, height, offsetLeft = 0, offsetTop = 0) { Object.assign(viewport, { width, height, offsetLeft, offsetTop }); viewport.dispatchEvent(new Event('resize')); await settle() }
try {
  const bounds = { left: 8, top: 88, right: 1192, bottom: 788 }, obstacle = { left: 800, top: 400, right: 1192, bottom: 788 }
  const result = placeFloating({ x: 1000, y: 550 }, { width: 144, height: 184 }, bounds, [obstacle])
  assert(result && !overlapsFloatingRect(rect(result.x, result.y, 144, 184), obstacle, 8))
  assert.equal(placeFloating({ x: 10, y: 100 }, { width: 144, height: 184 }, bounds, [bounds]), null)
  assert.equal(placeFloating({ x: 10, y: 100 }, { width: 144, height: 184 }, { left: 0, top: 0, right: 100, bottom: 100 }, []), null)
  console.log('PASS 有限候选避让边缘、无可用空间及小于宠物的视口明确处理')
  app.mount('#app'); await settle()
  const display = usePetDisplayStore()
  display.move(1000, 550, true); await settle()
  const preference = localStorage.getItem('fishpi.pet.display.v1')
  const chat = box('.whisper-panel', rect(800, 400, 392, 388)); await settle()
  assert(!overlapsFloatingRect(pet().getBoundingClientRect(), chat.getBoundingClientRect(), 8))
  assert.deepEqual(display.position, { x: 1000, y: 550 }); assert.equal(localStorage.getItem('fishpi.pet.display.v1'), preference)
  externalRects.set(chat, rect(400, 120, 350, 300)); chat.style.left = '400px'; await settle()
  assert.deepEqual(pos(), { x: 1000, y: 550 })
  chat.remove(); await settle()
  console.log('PASS 聊天浮窗增删和拖动实时避让，临时位置不覆盖用户保存坐标')

  for (const selector of ['aria-modal', '.fp-set-panel', '.img-zoom', '.vditor--fullscreen']) {
    const overlay = box(selector, rect(0, 80, 1200, 720)); await settle(); assert.equal(pet(), null)
    overlay.remove(); await settle(); assert(pet()); assert.deepEqual(pos(), { x: 1000, y: 550 })
  }
  const retainedModal = box('aria-modal', rect(40, 120, 500, 400)); await settle(); assert.equal(pet(), null)
  retainedModal.style.display = 'none'; await settle(); assert(pet())
  retainedModal.style.display = 'block'; await settle(); assert.equal(pet(), null)
  retainedModal.setAttribute('aria-hidden', 'true'); await settle(); assert(pet())
  retainedModal.remove(); await settle()
  assert.equal(localStorage.getItem('fishpi.pet.display.v1'), preference)
  console.log('PASS 模态保留DOM并切换显示或aria-hidden时，同步让位恢复且不改偏好')
  const editor = document.createElement('textarea'); externalRects.set(editor, rect(950, 500, 242, 280)); document.body.append(editor); editor.focus(); await settle()
  assert(!overlapsFloatingRect(pet().getBoundingClientRect(), editor.getBoundingClientRect(), 8))
  editor.blur(); editor.remove(); await settle()
  assert.deepEqual(pos(), { x: 1000, y: 550 })
  console.log('PASS 设置、模态窗口、图片和全屏编辑器暂时让位，桌面输入框避让且恢复原位')

  const networkBefore = reads
  for (const width of [390, 320]) {
    await viewportSize(width, 700)
    assert(pet().classList.contains('narrow')); assert(pet().classList.contains('collapsed'))
    assert(pos().x >= 8 && pos().x + 48 <= width - 8); assert(pos().y >= 88 && pos().y + 48 <= 688)
    assert.equal(display.collapsed, false); assert.equal(localStorage.getItem('fishpi.pet.display.v1'), preference)
    await tap(document.querySelector('.pet-character')); assert(panel())
    const panelRect = panel().getBoundingClientRect(); assert(panelRect.left >= 8 && panelRect.right <= width - 8 && panelRect.top >= 88 && panelRect.bottom <= 688)
    await tap(document.querySelector('.pet-character')); assert.equal(panel(), null, '第二次轻点确实收起面板')
  }
  const input = document.createElement('input'); document.body.append(input); input.focus(); await settle(); assert.equal(pet(), null)
  await viewportSize(320, 340, 12, 40); input.blur(); await settle()
  assert(pet()); assert(pos().x >= 20 && pos().x + 48 <= 324); assert(pos().y + 48 <= 368)
  input.type = 'file'; input.focus(); await settle(); assert(pet(), '选择文件不会误判为文字键盘')
  input.blur(); input.type = 'text'; input.readOnly = true; input.focus(); await settle(); assert(pet(), '只读文本不触发键盘避让')
  input.remove(); await viewportSize(1200, 800)
  assert.equal(reads, networkBefore, '尺寸、聚焦、避让和窗口开合不读取宠物接口')
  assert.deepEqual(pos(), { x: 1000, y: 550 }); assert.equal(display.collapsed, false)
  console.log('PASS 320/390窄屏自动48像素收纳、点击收起、键盘与visualViewport偏移边界及宽屏恢复')

  await viewportSize(390, 200)
  await tap(document.querySelector('.pet-character')); assert(panel())
  const shortPanel = panel().getBoundingClientRect()
  assert(shortPanel.top >= 88 && shortPanel.bottom <= 188)
  assert.equal(Number.parseFloat(panel().style.maxHeight), 100, '短视口面板限制高度，正文交给内部滚动')
  await tap(document.querySelector('.pet-character')); assert.equal(panel(), null)
  await viewportSize(780, 390)
  assert(!pet().classList.contains('narrow'))
  assert(pos().y >= 88 && pet().getBoundingClientRect().bottom <= 378)
  await viewportSize(320, 700)
  const editable = document.createElement('div'); editable.setAttribute('contenteditable', 'true'); editable.tabIndex = 0; document.body.append(editable)
  editable.focus(); await settle(); assert.equal(pet(), null)
  editable.blur(); editable.remove(); await settle(); assert(pet())
  assert.equal(localStorage.getItem('fishpi.pet.display.v1'), preference)
  assert.equal(reads, networkBefore)
  console.log('PASS 短视口和横竖屏切换保持面板边界，contenteditable输入让位且不新增读取')

  await viewportSize(320, 700)
  const character = document.querySelector('.pet-character')
  const before = { ...display.position }, actual = pos()
  pointer(character, 'pointerdown', 100, 400); pointer(character, 'pointermove', 80, 380); await settle()
  assert.deepEqual(display.position, before, '拖动过程不持久化每一帧')
  pointer(character, 'pointercancel', 80, 380); await settle(); assert.deepEqual(display.position, before)
  pointer(character, 'pointerdown', 100, 400); pointer(character, 'pointermove', 80, 380); pointer(character, 'pointerup', 80, 380); await settle()
  assert.deepEqual(display.position, { x: actual.x - 20, y: actual.y - 20 })
  assert.deepEqual(JSON.parse(localStorage.getItem('fishpi.pet.display.v1')).position, display.position)
  character.click(); await settle(); assert.equal(panel(), null, '拖动结束产生的click不误开面板')
  console.log('PASS 拖动越阈值才进入移动，取消保留原偏好，松手仅保存最终位置且不误开面板')

  await viewportSize(1200, 800)
  const fixed = box('data-floating-obstacle', rect(0, 80, 1200, 720)); await settle(); assert.equal(pet(), null)
  fixed.remove(); await settle(); assert(pet())
  const startFrames = frames
  for (let i = 0; i < 20; i++) viewport.dispatchEvent(new Event('resize'))
  await settle(); assert(frames - startFrames <= 2, '高频视口变化合并成单帧测量')
  const idleFrames = frames
  const messages = document.createElement('div'); document.body.append(messages)
  for (let i = 0; i < 30; i++) messages.append(document.createElement('p'))
  await settle(); assert.equal(frames, idleFrames, '普通消息增删不触发布局测量')
  console.log('PASS 没有空间时暂时隐藏，高频事件合并，普通消息更新不触发观察循环')
  const layout = useLayoutStore(pinia), auth = useAuthStore(pinia), pets = usePetsStore(pinia)
  const savedPosition = { ...display.position }, lifecycleReads = reads
  layout.immersive = true; await settle(); assert.equal(pet(), null)
  layout.immersive = false; await settle(); assert(pet())
  assert.equal(reads, lifecycleReads, '沉浸切换只处理显示状态')
  auth.isLoggedIn = false; auth.accessToken = ''; auth.account = null; await settle()
  assert.equal(pet(), null); assert.equal(panel(), null)
  assert(!document.body.textContent.includes('小伙伴'), '退出后不残留旧宠物姓名')
  pets.pet = { ...pets.pet, id: 'pet-two', name: '新的伙伴' }
  auth.account = { oId: 'another-fixture' }; auth.isLoggedIn = true; auth.accessToken = 'new-test'; await settle()
  assert.equal(pet().getAttribute('aria-label'), '新的伙伴桌宠')
  assert.deepEqual(display.position, savedPosition, '身份变化不清除纯本机摆放偏好')
  console.log('PASS 沉浸场景暂时隐藏，退出清可见身份内容，换号只显示当前宠物且保留本机位置')
  app.unmount(); activeApp = null; await settle()
  assert.equal(document.querySelector('.pet-placement-probe'), null)
  assert([...resizeObservers].every(observer => observer.nodes.size === 0)); assert.equal(scheduled.size, 0)
  const disposedFrames = frames; viewport.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('scroll')); await settle(); assert.equal(frames, disposedFrames)
  console.log('PASS 卸载清理观察器、视口监听、辅助节点与待执行帧')
  for (let cycle = 0; cycle < 3; cycle++) {
    activeApp = createApp(Desktop).use(pinia); activeApp.mount('#app'); await settle()
    assert.equal(document.querySelectorAll('.pet-desktop').length, 1)
    assert.equal(document.querySelectorAll('.pet-placement-probe').length, 1)
    const mountedFrames = frames
    viewport.dispatchEvent(new Event('resize')); await settle(); assert(frames - mountedFrames <= 2)
    activeApp.unmount(); activeApp = null; await settle()
    assert.equal(document.querySelectorAll('.pet-desktop, .pet-placement-probe').length, 0)
    assert([...resizeObservers].every(observer => observer.nodes.size === 0)); assert.equal(scheduled.size, 0)
    const afterUnmount = frames
    viewport.dispatchEvent(new Event('resize')); await settle(); assert.equal(frames, afterUnmount)
  }
  console.log('PASS 连续挂载卸载不累积桌宠节点、辅助节点、活跃观察目标或视口回调')
} finally {
  activeApp?.unmount()
  dom.window.close(); await fs.rm(temporary, { recursive: true, force: true }); delete globalThis.__desktopTest
}
