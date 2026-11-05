import { computed, onMounted, onScopeDispose, ref, watch, type Ref } from 'vue'
import { getApiMode } from '@/api/mode'
import { getAuthContextVersion } from '@/api/http'
import { decodeRecentMembers, fetchPublicLogMetadata, fetchRandomDiscovery, fetchRecentMembers, type DiscoveryExtra } from '@/api/v3-discovery-extras'
import { useAuthStore } from '@/stores/auth'
export function useDiscoveryExtras(kind: DiscoveryExtra['kind'], size: Ref<number> = ref(8), excluded: Ref<string> = ref(''), initial: unknown = null) {
  const auth = useAuthStore(), credential=computed(()=>getApiMode()==='v1'?auth.apiKey:auth.accessToken), value = ref<DiscoveryExtra | null>(null), p = ref(1), loading = ref(false), error = ref('')
  if (kind === 'recent' && initial !== null) { try { value.value = { kind, list: decodeRecentMembers(initial) } } catch { /* A current read will replace invalid bootstrap data. */ } }
  let mounted = false, sequence = 0
  function clear() { sequence++; value.value = null; loading.value = false; error.value = '' }
  async function read(next = p.value) {
    clear(); p.value = next
    if (!mounted || import.meta.env.SSR || kind === 'logs' && (!credential.value || !auth.account?.oId)) return
    const run = sequence, context = getAuthContextVersion(), token = credential.value, actor = auth.account?.oId, count = size.value, target = excluded.value
    const valid = () => mounted && run === sequence && context === getAuthContextVersion() && token === credential.value && actor === auth.account?.oId && count === size.value && target === excluded.value
    loading.value = true
    try {
      const result: DiscoveryExtra = kind === 'recent' ? { kind, list: await fetchRecentMembers() } : kind === 'random' ? { kind, list: await fetchRandomDiscovery(count, target) } : { kind, ...await fetchPublicLogMetadata(next) }
      if (valid()) value.value = result
    } catch (e) { if (valid()) error.value = e instanceof Error ? e.message : '读取失败' }
    finally { if (valid()) loading.value = false }
  }
  const stops = [watch([size, excluded], () => void read(1), { flush: 'sync' }), watch([credential, () => auth.account?.oId], (_, old) => { const same = auth.account?.oId === old[1] && (getApiMode()==='v1'?credential.value===old[0]:!!credential.value===!!old[0]); void read(same ? p.value : 1) }, { flush: 'sync' })]
  onMounted(() => { mounted = true; if (!value.value || credential.value) void read() })
  onScopeDispose(() => { mounted = false; stops.forEach(stop => stop()); clear() })
  return { value, p, loading, error, read }
}
