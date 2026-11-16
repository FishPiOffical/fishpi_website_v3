import { onScopeDispose, reactive, watch, type WatchSource } from 'vue'
import { useV3ChatTimelineStore } from '@/stores/v3ChatTimeline'

export function useSakuraArrivals(visible: WatchSource<boolean>) {
  const timeline = useV3ChatTimelineStore()
  const arrivals = reactive(new Map<string, ReturnType<typeof setTimeout>>())
  const clear = () => {
    for (const timer of arrivals.values()) clearTimeout(timer)
    arrivals.clear()
  }
  let showing = false
  watch(visible, value => {
    showing = value
    if (!value) clear()
  }, { immediate: true, flush: 'sync' })
  watch(() => timeline.sakuraArrival, id => {
    if (!id) { clear(); return }
    if (!showing || arrivals.has(id) || arrivals.size >= 10) return
    arrivals.set(id, setTimeout(() => arrivals.delete(id), 1250))
  }, { flush: 'sync' })
  onScopeDispose(clear)
  return arrivals
}
