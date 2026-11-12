import { onMounted, onScopeDispose, ref, watch, type Ref } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3PublicMedals, type PublicMedal } from '@/api/v3-medals'
import { useAuthStore } from '@/stores/auth'
export function usePublicMedals(userName: Ref<string>) {
  const auth = useAuthStore(), value = ref<{ list: PublicMedal[]; p: number; size: number; total: number; pageCount: number } | null>(null), p = ref(1), loading = ref(false), error = ref('')
  let mounted = false, sequence = 0
  function clear() { sequence++; value.value = null; loading.value = false; error.value = '' }
  async function read(next = p.value) {
    if (!mounted || import.meta.env.SSR || !auth.isLoggedIn) { clear(); return }
    clear(); p.value = next
    const run = sequence, name = userName.value, boundary = getAuthContextVersion(), token = auth.accessToken, actor = auth.account?.oId
    const valid = () => mounted && run === sequence && name === userName.value && boundary === getAuthContextVersion() && token === auth.accessToken && actor === auth.account?.oId
    loading.value = true
    try { const result = await fetchV3PublicMedals(name, next); if (valid()) value.value = result }
    catch (e) { if (valid()) error.value = e instanceof Error ? e.message : '公开勋章读取失败' }
    finally { if (valid()) loading.value = false }
  }
  const stops = [watch(userName, () => { clear(); p.value = 1; void read() }, { flush: 'sync' }), watch([() => auth.accessToken, () => auth.account?.oId], (_, previous) => {
    const sameOwner = actorId() === previous[1] && !!auth.accessToken === !!previous[0]
    clear(); if (!sameOwner) p.value = 1; void read()
  }, { flush: 'sync' })]
  function actorId() { return auth.account?.oId }
  onMounted(() => { mounted = true; void read() }); onScopeDispose(() => { mounted = false; stops.forEach(stop => stop()); clear() })
  return { value, p, loading, error, read }
}
