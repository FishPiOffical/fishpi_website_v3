import { onMounted, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { decodeHomeRead, fetchHomeRead, type HomeData, type HomeRead } from '@/api/v3-home-reads'
import { shouldInvalidatePublicSnapshot, PUBLIC_DIRECTORY_TTL, PUBLIC_LIST_TTL, readPublicSnapshot, removePublicSnapshot, savePublicSnapshot } from '@/utils/publicSnapshots'
// Browser memory only. Stable identity boundaries invalidate every entry, token rotation does not.
const recentReads = new Map<HomeRead, { expires: number; value: unknown }>()
let cacheBoundary = ''
export function useHomeRead<K extends HomeRead>(key: K, initial: unknown) {
  const auth = useAuthStore(), data = shallowRef<HomeData[K] | null>(null), loading = ref(false), error = ref('')
  try { data.value = decodeHomeRead(key, initial) } catch { /* A current read follows mount. */ }
  const snapshotKey = `home:${key}`
  let mounted = false, sequence = 0, fromSnapshot = false
  const identity = () => `${getAuthContextVersion()}:${!!auth.accessToken}:${auth.account?.oId || ''}`
  let boundary = identity()
  function syncCache() {
    if (cacheBoundary !== identity()) { recentReads.clear(); cacheBoundary = identity() }
  }
  function clear() { fromSnapshot = false; sequence++; data.value = null; loading.value = false; error.value = '' }
  async function read() {
    if (!mounted || import.meta.env.SSR) return
    syncCache(); sequence++; error.value = ''
    const run = sequence, context = getAuthContextVersion(), token = auth.accessToken, actor = auth.account?.oId
    const current = () => mounted && run === sequence && context === getAuthContextVersion() && token === auth.accessToken && actor === auth.account?.oId
    loading.value = data.value === null
    try { const result = await fetchHomeRead(key); if (current()) { data.value = result; fromSnapshot = false; savePublicSnapshot(snapshotKey, result); recentReads.set(key, { expires: Date.now() + 300_000, value: structuredClone(result) }) } }
    catch (e) {
      if (current()) {
        const invalid = shouldInvalidatePublicSnapshot(e)
        const keep = !invalid && (fromSnapshot || (e as {code?:string})?.code === 'offline')
        if (invalid) { removePublicSnapshot(snapshotKey); recentReads.delete(key) }
        if (!keep) data.value = null
        error.value = e instanceof Error ? e.message : '读取失败'
      }
    }
    finally { if (current()) loading.value = false }
  }
  async function restoreAndRead() {
    if (data.value === null) {
      const run = ++sequence
      const snapshot = await readPublicSnapshot(snapshotKey, key === 'tags' ? PUBLIC_DIRECTORY_TTL : PUBLIC_LIST_TTL, value => decodeHomeRead(key, value))
      if (!mounted || run !== sequence) return
      if (snapshot) { data.value = snapshot.value; fromSnapshot = true; if (snapshot.fresh) return }
    }
    await read()
  }
  const stop = watch([() => auth.accessToken, () => auth.account?.oId], () => {
    const next = identity()
    if (next !== boundary) clear()
    boundary = next
    syncCache(); void restoreAndRead()
  }, { flush: 'sync' })
  onMounted(() => {
    mounted = true; syncCache()
    const cached = recentReads.get(key)
    if (cached && cached.expires > Date.now()) { data.value = decodeHomeRead(key, structuredClone(cached.value)); return }
    if (data.value !== null && !auth.accessToken) {
      recentReads.set(key, { expires: Date.now() + 300_000, value: structuredClone(data.value) })
    } else void restoreAndRead()
  })
  const retryPublic=()=>{void read()}
  onMounted(()=>{if(typeof window!=='undefined')window.addEventListener('fp:retry-public',retryPublic)})
  onScopeDispose(() => { if(typeof window!=='undefined')window.removeEventListener('fp:retry-public',retryPublic); mounted = false; stop(); clear() })
  return reactive({ data, loading, error, read })
}
