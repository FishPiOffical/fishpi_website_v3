import { watch, type Ref } from 'vue'

const EDGE_DISTANCE = 96
const DEBOUNCE_MS = 120
const THROTTLE_MS = 450

/** 只响应当前列表向下滚动，保留手动加载入口供短列表和失败重试使用。 */
export function useScrollPagination(
  sentinel: Ref<HTMLElement | null>,
  canLoad: () => boolean,
  load: () => unknown,
  scope: () => string,
  container?: Ref<HTMLElement | null>,
) {
  watch([sentinel, () => container?.value, scope], ([target, root], _, onCleanup) => {
    if (!target || (container && !root) || typeof window === 'undefined') return
    const source = root ?? window
    const scrollTop = () => root?.scrollTop ?? window.scrollY
    let previousTop = scrollTop()
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastLoad = -Infinity

    const nearEnd = () => {
      const bounds = target.getBoundingClientRect()
      const view = root?.getBoundingClientRect()
      return bounds.top <= (view?.bottom ?? window.innerHeight) + EDGE_DISTANCE &&
        bounds.bottom >= (view?.top ?? 0)
    }

    function onScroll() {
      const top = scrollTop()
      const goingDown = top > previousTop
      previousTop = top
      if (!goingDown || !canLoad() || !nearEnd()) {
        clearTimeout(timer)
        return
      }
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!canLoad() || !nearEnd()) return
        lastLoad = performance.now()
        void load()
      }, Math.max(DEBOUNCE_MS, lastLoad + THROTTLE_MS - performance.now()))
    }

    source.addEventListener('scroll', onScroll, { passive: true })
    onCleanup(() => {
      source.removeEventListener('scroll', onScroll)
      clearTimeout(timer)
    })
  }, { flush: 'post' })
}
