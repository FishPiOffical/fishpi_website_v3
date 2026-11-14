/** 只由用户滚动意图退出跟随，不把动画、图片加载或浏览器滚动锚定当成翻阅历史。 */
export function createChatScrollFollow(
  el: HTMLElement,
  contentSelector: string,
  changed: (following: boolean) => void,
  userScrolled?: () => void,
) {
  let following = true, disposed = false, frame = 0
  let intent: 'up' | 'down' | 'drag' | null = null
  let intentUntil = 0, previousTop = el.scrollTop, touchY = 0
  let content: Element | null = null
  function set(value: boolean) { following = value; changed(value) }
  function nearBottom() { return el.scrollHeight - el.scrollTop - el.clientHeight <= 80 }
  function refresh() {
    if (disposed || !following || frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (disposed || !following) return
      el.scrollTop = el.scrollHeight
      previousTop = el.scrollTop
    })
  }
  function mark(direction: 'up' | 'down' | 'drag') {
    intent = direction
    intentUntil = performance.now() + 1500
    if (direction !== 'down') set(false)
  }
  function onWheel(event: WheelEvent) { if (event.deltaY) mark(event.deltaY < 0 ? 'up' : 'down') }
  function onTouchStart(event: TouchEvent) { touchY = event.touches[0]?.clientY ?? 0 }
  function onTouchMove(event: TouchEvent) {
    const y = event.touches[0]?.clientY ?? touchY
    if (y !== touchY) mark(y > touchY ? 'up' : 'down')
    touchY = y
  }
  function onKey(event: KeyboardEvent) {
    if ((event.target as HTMLElement).closest('input,textarea,[contenteditable="true"]')) return
    if (['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey)) mark('up')
    else if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) mark('down')
  }
  function onPointer(event: PointerEvent) {
    // 滚动条拖动也属于主动阅读；普通消息点击不改变跟随状态。
    const box = el.getBoundingClientRect()
    if (event.clientX >= box.right - Math.max(16, el.offsetWidth - el.clientWidth)) mark('drag')
  }
  function onScroll() {
    const top = el.scrollTop
    if (intent && performance.now() <= intentUntil) {
      if (intent === 'down' || (intent === 'drag' && top >= previousTop)) {
        if (nearBottom()) { set(true); intent = null; refresh() }
      }
      userScrolled?.()
    }
    previousTop = top
  }
  const resize = new ResizeObserver(refresh)
  resize.observe(el)
  function observeContent() {
    const next = el.querySelector(contentSelector)
    if (content !== next) {
      if (content) resize.unobserve(content)
      content = next
      if (content) resize.observe(content)
    }
    refresh()
  }
  // 初次进入时可能只有加载占位；列表稍后挂载或切换时重新绑定尺寸监听。
  const mutation = new MutationObserver(observeContent)
  mutation.observe(el, { childList: true, subtree: true })
  el.addEventListener('wheel', onWheel, { passive: true })
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: true })
  el.addEventListener('keydown', onKey)
  el.addEventListener('pointerdown', onPointer)
  el.addEventListener('scroll', onScroll, { passive: true })
  observeContent()
  return {
    refresh,
    pause() { intent = null; set(false); cancelAnimationFrame(frame); frame = 0 },
    jump() { intent = null; set(true); el.scrollTop = el.scrollHeight; previousTop = el.scrollTop; refresh() },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect()
      el.removeEventListener('wheel', onWheel); el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove); el.removeEventListener('keydown', onKey)
      el.removeEventListener('pointerdown', onPointer); el.removeEventListener('scroll', onScroll)
    },
  }
}
