import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getApiMode } from '@/api/mode'
import { getAuthContextVersion } from '@/api/http'
import { decodeDirectoryPage, fetchDirectoryPage, type DirectoryPage, type DirectoryKind } from '@/api/v3-directory'
export function useDirectory(kind: DirectoryKind, initial: unknown = null) {
  const auth = useAuthStore(), credential=computed(()=>getApiMode()==='v1'?auth.apiKey:auth.accessToken), value = ref<DirectoryPage | null>(null), p = ref(1), loading = ref(false), error = ref('')
  if (initial) { try { value.value = decodeDirectoryPage(initial, kind) } catch { /* Read a current page after mount. */ } }
  let mounted = false, seq = 0
  function clear() { seq++; value.value = null; loading.value = false; error.value = '' }
  async function read(next = p.value) {
    clear(); p.value = next
    if (!mounted || import.meta.env.SSR) return
    const run = seq, context = getAuthContextVersion(), token = credential.value, actor = auth.account?.oId
    const valid = () => mounted && run === seq && context === getAuthContextVersion() && token === credential.value && actor === auth.account?.oId
    loading.value = true
    try { const result = await fetchDirectoryPage(kind, next); if (valid()) value.value = result }
    catch (e) { if (valid()) error.value = e instanceof Error ? e.message : '列表读取失败' }
    finally { if (valid()) loading.value = false }
  }
  const stopIdentity = watch([credential, () => auth.account?.oId], (_, old) => {
    const sameActor = auth.account?.oId === old[1] && (getApiMode()==='v1'?credential.value===old[0]:!!credential.value===!!old[0])
    void read(sameActor ? p.value : 1)
  }, { flush: 'sync' })
  onMounted(() => { mounted = true; if (!value.value || credential.value) void read() })
  onScopeDispose(() => { mounted = false; stopIdentity(); clear() })
  return { value, p, loading, error, read }
}
