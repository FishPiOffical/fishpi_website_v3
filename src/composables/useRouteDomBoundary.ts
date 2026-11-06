import { nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance, type Ref } from 'vue'

/** Recover a detached route subtree once, without reloading the document or retrying writes. */
export function useRouteDomBoundary(
  host: Ref<HTMLElement | null>,
  view: Ref<ComponentPublicInstance | null>,
  routeKey: () => string,
  enabled: () => boolean = () => true,
) {
  const revision = ref(0)
  let observer: MutationObserver | undefined
  let active = false, queued = false, attempted = false

  function schedule() {
    if (!active || queued) return
    queued = true
    void nextTick(() => {
      queued = false
      if (!active || !enabled() || attempted || !host.value || !view.value) return
      const node: unknown = view.value.$el
      if (!(node instanceof Node)) return
      if (host.value.isConnected && host.value.contains(node)) return
      attempted = true
      revision.value++
    })
  }

  watch(routeKey, () => { attempted = false; schedule() }, { flush: 'post' })
  watch([host, view], schedule, { flush: 'post' })
  onMounted(() => {
    active = true
    const parent = host.value?.parentNode
    if (parent) {
      observer = new MutationObserver(schedule)
      observer.observe(parent, { childList: true, subtree: true })
    }
    schedule()
  })
  onBeforeUnmount(() => { active = false; observer?.disconnect() })
  return revision
}
