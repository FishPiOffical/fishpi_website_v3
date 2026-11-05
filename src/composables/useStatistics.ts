import {getApiMode} from '@/api/mode'
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { decodeStatistics, fetchStatistics, type CommunityStatistics } from '@/api/v3-statistics'
import { useAuthStore } from '@/stores/auth'

export function useStatistics(initial: unknown = null) {
  const auth = useAuthStore()
  const credential=()=>getApiMode()==='v1'?auth.apiKey:auth.accessToken
  const value = ref<CommunityStatistics | null>(null)
  try { if (initial !== null) value.value = decodeStatistics(initial) } catch { /* Invalid SSR data requires a current read. */ }
  const loading = ref(false), error = ref('')
  let mounted = false, sequence = 0
  function clear() { sequence++; value.value = null; loading.value = false; error.value = '' }
  async function read() {
    if (!mounted || import.meta.env.SSR) return
    clear()
    const run = sequence, boundary = getAuthContextVersion(), token = credential(), owner = auth.account?.oId
    const valid = () => mounted && run === sequence && boundary === getAuthContextVersion() && token === credential() && owner === auth.account?.oId
    loading.value = true
    try { const result = await fetchStatistics(); if (valid()) value.value = result }
    catch (e) { if (valid()) error.value = e instanceof Error ? e.message : '统计读取失败' }
    finally { if (valid()) loading.value = false }
  }
  const stop = watch([credential, () => auth.account?.oId], () => { clear(); void read() }, { flush: 'sync' })
  onMounted(() => { mounted = true; if (!value.value || credential()) void read() })
  onScopeDispose(() => { mounted = false; stop(); clear() })
  return { value, loading, error, read }
}
