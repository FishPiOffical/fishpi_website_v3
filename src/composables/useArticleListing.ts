import { computed, onMounted, onScopeDispose, ref, watch, type Ref } from 'vue'
import { getApiMode } from '@/api/mode'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { decodeArticleListing, fetchArticleListing, type ArticleListing, type ColumnOrder } from '@/api/v3-article-list'
import type { ArticleFeedKind } from '@/api/fishpi'
export function useArticleListing(kind: Ref<ArticleFeedKind>, extra: Ref<string>, order: Ref<ColumnOrder>, initial: unknown = null) {
  const auth = useAuthStore(), credential=computed(()=>getApiMode()==='v1'?auth.apiKey:auth.accessToken), value = ref<ArticleListing | null>(null), p = ref(1), loading = ref(false), error = ref('')
  if (initial) { try { value.value = decodeArticleListing(initial, kind.value, extra.value, order.value) } catch { /* Read a current page after mount. */ } }
  let mounted = false, seq = 0
  function clear() { seq++; value.value = null; loading.value = false; error.value = '' }
  async function read(next = p.value) {
    clear(); p.value = next
    if (!mounted || import.meta.env.SSR) return
    const run = seq, context = getAuthContextVersion(), token = credential.value, actor = auth.account?.oId, currentKind = kind.value, target = extra.value, sort = order.value
    const valid = () => mounted && run === seq && context === getAuthContextVersion() && token === credential.value && actor === auth.account?.oId && currentKind === kind.value && target === extra.value && sort === order.value
    loading.value = true
    try { const result = await fetchArticleListing(currentKind, target, sort, next); if (valid()) value.value = result }
    catch (e) { if (valid()) error.value = e instanceof Error ? e.message : '列表读取失败' }
    finally { if (valid()) loading.value = false }
  }
  const stopTarget = watch([kind, extra, order], () => void read(1), { flush: 'sync' })
  const stopIdentity = watch([credential, () => auth.account?.oId], (_, old) => {
    const sameActor = auth.account?.oId === old[1] && (getApiMode()==='v1'?credential.value===old[0]:!!credential.value===!!old[0])
    void read(sameActor ? p.value : 1)
  }, { flush: 'sync' })
  onMounted(() => { mounted = true; if (!value.value || credential.value) void read() })
  onScopeDispose(() => { mounted = false; stopTarget(); stopIdentity(); clear() })
  return { value, p, loading, error, read }
}
