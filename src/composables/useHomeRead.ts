import { computed, onMounted, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getApiMode } from '@/api/mode'
import { getAuthContextVersion } from '@/api/http'
import { decodeHomeRead, fetchHomeRead, type HomeData, type HomeRead } from '@/api/v3-home-reads'
export function useHomeRead<K extends HomeRead>(key: K, initial: unknown) {
  const auth = useAuthStore(), credential=computed(()=>getApiMode()==='v1'?auth.apiKey:auth.accessToken), data = shallowRef<HomeData[K] | null>(null), loading = ref(false), error = ref('')
  try { data.value = decodeHomeRead(key, initial) } catch { /* A current read follows mount. */ }
  let mounted = false, sequence = 0
  function clear() { sequence++; data.value = null; loading.value = false; error.value = '' }
  async function read() {
    clear()
    if (!mounted || import.meta.env.SSR) return
    const run = sequence, context = getAuthContextVersion(), token = credential.value, actor = auth.account?.oId
    const current = () => mounted && run === sequence && context === getAuthContextVersion() && token === credential.value && actor === auth.account?.oId
    loading.value = true
    try { const result = await fetchHomeRead(key); if (current()) data.value = result }
    catch (e) { if (current()) error.value = e instanceof Error ? e.message : '读取失败' }
    finally { if (current()) loading.value = false }
  }
  const stop = watch([credential, () => auth.account?.oId], () => void read(), { flush: 'sync' })
  onMounted(() => { mounted = true; if (data.value === null || credential.value) void read() })
  onScopeDispose(() => { mounted = false; stop(); clear() })
  return reactive({ data, loading, error, read })
}
