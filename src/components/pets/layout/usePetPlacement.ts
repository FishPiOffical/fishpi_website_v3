import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { clampFloatingPoint, placeFloating, type FloatingPoint, type FloatingRect, type FloatingSize } from './floatingPlacement'

const obstacleSelector = '[data-floating-obstacle], .whisper-panel, .fp-set-handle, .fp-hidden-handle, .fp-whisper-handle, .composer-return, .quick-reply-floating, .cr-composer-panel'
const modalSelector = '[aria-modal="true"], dialog[open], .fp-set-panel, .img-zoom, .vditor--fullscreen'
const surfaceSelector = `[data-site-navigation], ${obstacleSelector}, ${modalSelector}`
const ownSelector = '.pet-desktop, .pet-desktop-panel, .pet-placement-probe'

function visibleRect(node: Element): FloatingRect | null {
  const style = getComputedStyle(node)
  if (style.display === 'none' || style.visibility === 'hidden' || node.getAttribute('aria-hidden') === 'true') return null
  const rect = node.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null
}
function textInput(node: Element | null): node is HTMLElement {
  if (!(node instanceof HTMLElement) || node.matches('[readonly], [disabled]')) return false
  return node.matches('textarea, [contenteditable="true"], [contenteditable=""]')
    || (node instanceof HTMLInputElement && ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(node.type))
}
function equalPoint(a: FloatingPoint, b: FloatingPoint) { return a.x === b.x && a.y === b.y }

export function usePetPlacement(options: {
  element: Ref<HTMLElement | null>
  panel: Ref<HTMLElement | null>
  preferred: () => FloatingPoint | null
  collapsed: () => boolean
  active: () => boolean
  panelOpen: () => boolean
}) {
  const position = ref<FloatingPoint>({ x: 0, y: 0 })
  const narrow = ref(false), forcedCompact = ref(false), suppressed = ref(false)
  const panelPosition = ref<FloatingPoint>({ x: 8, y: 88 }), panelWidth = ref(296), panelMaxHeight = ref(400)
  const compact = computed(() => narrow.value || forcedCompact.value || options.collapsed())
  let bounds: FloatingRect = { left: 8, top: 88, right: 992, bottom: 788 }
  let size: FloatingSize = { width: 144, height: 184 }
  let frame = 0, mounted = false, probe: HTMLDivElement | null = null
  let resizeObserver: ResizeObserver | undefined, additions: MutationObserver | undefined, surfaceChanges: MutationObserver | undefined
  const observed = new Set<Element>()

  function schedule() {
    if (!mounted || frame) return
    frame = requestAnimationFrame(() => { frame = 0; refresh() })
  }
  function observe(nodes: Element[]) {
    const next = new Set(nodes)
    if (next.size === observed.size && [...next].every(node => observed.has(node))) return
    resizeObserver?.disconnect(); surfaceChanges?.disconnect(); observed.clear()
    for (const node of next) {
      observed.add(node); resizeObserver?.observe(node)
      // 只观察已识别的浮层，不监听每条聊天消息的样式变化，也不观察桌宠自身的位置写入。
      if (!node.closest(ownSelector)) surfaceChanges?.observe(node, { attributes: true, attributeFilter: ['style', 'class', 'hidden', 'aria-hidden', 'open'] })
    }
  }
  function refresh() {
    if (!mounted) return
    const viewport = window.visualViewport
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0
    const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight
    narrow.value = width <= 640
    const surfaces = [...document.querySelectorAll(surfaceSelector)].filter(node => !node.closest(ownSelector)).slice(0, 48)
    const focused = textInput(document.activeElement) && !document.activeElement.closest(ownSelector) ? document.activeElement : null
    const inputRegion = focused?.closest('.cr-composer-panel, .composer, .vditor, form') ?? focused
    observe([...surfaces, ...(inputRegion ? [inputRegion] : []), ...[options.element.value, options.panel.value].filter((node): node is HTMLElement => !!node)])
    const safe = probe ? getComputedStyle(probe) : null
    const inset = (name: 'paddingLeft' | 'paddingTop' | 'paddingRight' | 'paddingBottom') => Number.parseFloat(safe?.[name] ?? '') || 0
    const nav = surfaces.find(node => node.matches('[data-site-navigation]'))
    const navRect = nav ? visibleRect(nav) : null
    bounds = { left: left + inset('paddingLeft') + 8, top: Math.max(top + inset('paddingTop') + 8, navRect && navRect.bottom > top ? navRect.bottom + 8 : 0),
      right: left + width - inset('paddingRight') - 8, bottom: top + height - inset('paddingBottom') - 12 }
    const obstructed = surfaces.some(node => node.matches(modalSelector) && !!visibleRect(node))
    // 窄屏输入时让出完整编辑空间；这只是本次显示状态，不写本机偏好。
    if (!options.active() || obstructed || (narrow.value && focused)) { suppressed.value = true; return }
    const obstacles = surfaces.filter(node => node.matches(obstacleSelector)).map(visibleRect).filter((rect): rect is FloatingRect => !!rect)
    const inputRect = inputRegion ? visibleRect(inputRegion) : null
    if (inputRect) obstacles.push(inputRect)
    const wantedCompact = narrow.value || options.collapsed()
    function measure(collapsed: boolean): FloatingSize {
      if (narrow.value) return { width: 48, height: 48 }
      const node = options.element.value
      const correctSize = node && node.classList.contains('collapsed') === collapsed
      return { width: collapsed ? 56 : 144, height: correctSize && node.offsetHeight > 0 ? node.offsetHeight : collapsed ? 84 : 184 }
    }
    size = measure(wantedCompact)
    const preferred = options.preferred() ?? { x: bounds.right - size.width - 12, y: bounds.bottom - size.height - (narrow.value ? 8 : 24) }
    let next = placeFloating(preferred, size, bounds, obstacles)
    forcedCompact.value = !wantedCompact && !next
    if (forcedCompact.value) { size = measure(true); next = placeFloating(preferred, size, bounds, obstacles) }
    suppressed.value = !next
    if (next && !equalPoint(position.value, next)) position.value = next
    panelWidth.value = Math.max(1, Math.min(296, bounds.right - bounds.left))
    panelMaxHeight.value = Math.max(1, bounds.bottom - bounds.top)
    if (next && options.panelOpen()) {
      const panelSize = { width: panelWidth.value, height: Math.min(options.panel.value?.offsetHeight || 300, panelMaxHeight.value) }
      const target = { x: next.x + size.width / 2 - panelSize.width / 2, y: next.y - panelSize.height - 10 }
      const available = placeFloating(target, panelSize, bounds, obstacles)
      // 没有可用面板空间时先让位，不把操作区藏在聊天浮窗后面。
      if (!available) suppressed.value = true
      else if (!equalPoint(panelPosition.value, available)) panelPosition.value = available
    }
  }
  const panelStyle = computed(() => ({ left: `${panelPosition.value.x}px`, top: `${panelPosition.value.y}px`, width: `${panelWidth.value}px`, maxHeight: `${panelMaxHeight.value}px` }))
  function clamp(point: FloatingPoint) { return clampFloatingPoint(point, size, bounds) }
  function mutationRelevant(node: Node): boolean {
    return node instanceof Element && !node.closest(ownSelector) && (node.matches(surfaceSelector) || !!node.querySelector(surfaceSelector))
  }
  function onTransition(event: Event) {
    if (event.target instanceof Element && event.target.closest(surfaceSelector)) schedule()
  }
  onMounted(() => {
    mounted = true
    probe = document.createElement('div'); probe.className = 'pet-placement-probe'; probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);'
    document.body.append(probe)
    resizeObserver = new ResizeObserver(schedule)
    surfaceChanges = new MutationObserver(schedule)
    // 只对浮层增删重新收集位置；普通内容更新不引发全页测量。
    additions = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(mutationRelevant))) schedule()
    })
    additions.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)
    document.addEventListener('focusin', schedule); document.addEventListener('focusout', schedule)
    document.addEventListener('transitionend', onTransition)
    refresh()
  })
  watch(() => [options.preferred()?.x, options.preferred()?.y, options.collapsed(), options.active(), options.panelOpen(), options.element.value, options.panel.value], schedule, { flush: 'post' })
  onBeforeUnmount(() => {
    mounted = false; if (frame) cancelAnimationFrame(frame)
    resizeObserver?.disconnect(); surfaceChanges?.disconnect(); additions?.disconnect(); observed.clear(); probe?.remove()
    window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true)
    window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule)
    document.removeEventListener('focusin', schedule); document.removeEventListener('focusout', schedule); document.removeEventListener('transitionend', onTransition)
  })
  return { position, panelStyle, compact, narrow, suppressed, clamp, schedule, refresh }
}
