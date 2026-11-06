import { onMounted, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { decodeHomeRead, fetchHomeRead, type HomeData, type HomeRead } from '@/api/v3-home-reads'
// Browser memory only. Stable identity boundaries invalidate every entry, token rotation does not.
const recentReads = new Map<HomeRead, { expires: number; value: unknown }>()
let cacheBoundary = ''
export function useHomeRead<K extends HomeRead>(key: K, initial: unknown) {
  const auth = useAuthStore(), data = shallowRef<HomeData[K] | null>(null), loading = ref(false), error = ref('')
  try { data.value = decodeHomeRead(key, initial) } catch { /* A current read follows mount. */ }
  let mounted = false, sequence = 0
  const identity = () => `${getAuthContextVersion()}:${!!auth.accessToken}:${auth.account?.oId || ''}`
  let boundary = identity()
  function syncCache() {
    if (cacheBoundary !== identity()) { recentReads.clear(); cacheBoundary = identity() }
  }
  function clear() { sequence++; data.value = null; loading.value = false; error.value = '' }
  async function read() {
    if (!mounted || import.meta.env.SSR) return
    syncCache(); recentReads.delete(key); sequence++; error.value = ''
    const run = sequence, context = getAuthContextVersion(), token = auth.accessToken, actor = auth.account?.oId
    const current = () => mounted && run === sequence && context === getAuthContextVersion() && token === auth.accessToken && actor === auth.account?.oId
    loading.value = data.value === null
    try { const result = await fetchHomeRead(key); if (current()) { data.value = result; recentReads.set(key, { expires: Date.now() + 300_000, value: structuredClone(result) }) } }
    catch (e) { if (current()) { data.value = null; error.value = e instanceof Error ? e.message : '读取失败' } }
    finally { if (current()) loading.value = false }
  }
  const stop = watch([() => auth.accessToken, () => auth.account?.oId], () => {
    const next = identity()
    if (next !== boundary) clear()
    boundary = next
    syncCache(); void read()
  }, { flush: 'sync' })
  onMounted(() => {
    mounted = true; syncCache()
    const cached = recentReads.get(key)
    if (cached && cached.expires <= Date.now()) recentReads.delete(key)
    if (cached && cached.expires > Date.now()) { data.value = decodeHomeRead(key, structuredClone(cached.value)); return }
    if (data.value !== null && !auth.accessToken) recentReads.set(key, { expires: Date.now() + 300_000, value: structuredClone(data.value) })
    else void read()
  })
  onScopeDispose(() => { mounted = false; stop(); clear() })
  return reactive({ data, loading, error, read })
}
