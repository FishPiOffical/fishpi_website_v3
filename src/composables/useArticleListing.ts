import { onMounted, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { decodeArticleListing, fetchArticleListing, type ArticleListing, type ColumnOrder } from '@/api/v3-article-list'
import type { ArticleFeedKind } from '@/api/fishpi'
import { PUBLIC_LIST_TTL, readPublicSnapshot, removePublicSnapshot, savePublicSnapshot, shouldInvalidatePublicSnapshot } from '@/utils/publicSnapshots'
export function useArticleListing(kind: Ref<ArticleFeedKind>, extra: Ref<string>, order: Ref<ColumnOrder>, initial: unknown = null) {
  const auth = useAuthStore(), value = ref<ArticleListing | null>(null), p = ref(1), loading = ref(false), error = ref('')
  if (initial) { try { value.value = decodeArticleListing(initial, kind.value, extra.value, order.value) } catch { /* Read a current page after mount. */ } }
  let mounted = false, seq = 0, fromSnapshot = false, readerContext=getAuthContextVersion()
  function clear() { fromSnapshot = false; seq++; value.value = null; loading.value = false; error.value = '' }
  async function read(next = p.value, restore = false) {
    const previous = value.value && value.value.kind===kind.value && value.value.extra===extra.value && value.value.order===order.value && value.value.p===next ? value.value : null
    const previousFromSnapshot = fromSnapshot
    clear(); value.value=previous; fromSnapshot = !!previous && previousFromSnapshot; p.value = next
    if (!mounted || import.meta.env.SSR) return
    const run = seq, context = getAuthContextVersion(), token = auth.accessToken, actor = auth.account?.oId, currentKind = kind.value, target = extra.value, sort = order.value
    const valid = () => mounted && run === seq && context === getAuthContextVersion() && token === auth.accessToken && actor === auth.account?.oId && currentKind === kind.value && target === extra.value && sort === order.value
    const cacheKey = currentKind === 'search' ? null : JSON.stringify(['listing', currentKind, target, sort, next])
    if (cacheKey && restore && !value.value) {
      const snapshot = await readPublicSnapshot(cacheKey, PUBLIC_LIST_TTL, raw => decodeArticleListing(raw, currentKind, target, sort, next))
      if (!valid()) return
      if (snapshot) { value.value = snapshot.value; fromSnapshot = true; if (snapshot.fresh) return }
    }
    loading.value = !fromSnapshot
    try {
      const result = await fetchArticleListing(currentKind, target, sort, next, cacheKey ? 'omit' : undefined)
      if (valid()) { value.value = result; fromSnapshot = false; if (cacheKey) savePublicSnapshot(cacheKey, result) }
    } catch (e) {
      if (valid()) {
        const invalid = shouldInvalidatePublicSnapshot(e)
        if (cacheKey && invalid) removePublicSnapshot(cacheKey)
        if (invalid || !fromSnapshot && (e as {code?:string})?.code !== 'offline') value.value = null
        error.value = e instanceof Error ? e.message : '列表读取失败'
      }
    }
    finally { if (valid()) loading.value = false }
  }
  const stopTarget = watch([kind, extra, order], () => void read(1, true), { flush: 'sync' })
  const stopIdentity = watch([() => auth.accessToken, () => auth.account?.oId], (_, old) => {
    const sameActor = readerContext===getAuthContextVersion() && auth.account?.oId === old[1] && !!auth.accessToken === !!old[0]
    readerContext=getAuthContextVersion()
    if(!sameActor)clear()
    void read(sameActor ? p.value : 1, true)
  }, { flush: 'sync' })
  onMounted(() => { mounted = true; if (!value.value || auth.accessToken) void read(1, true) })
  const retryPublic=()=>{void read()}
  onMounted(()=>{if(typeof window!=='undefined')window.addEventListener('fp:retry-public',retryPublic)})
  onScopeDispose(() => { if(typeof window!=='undefined')window.removeEventListener('fp:retry-public',retryPublic); mounted = false; stopTarget(); stopIdentity(); clear() })
  return { value, p, loading, error, read }
}
