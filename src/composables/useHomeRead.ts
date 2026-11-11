import { onMounted, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { decodeHomeRead, fetchHomeRead, type HomeData, type HomeRead } from '@/api/v3-home-reads'
import { shouldInvalidatePublicSnapshot, PUBLIC_DIRECTORY_TTL, PUBLIC_LIST_TTL, readPublicSnapshot, removePublicSnapshot, savePublicSnapshot } from '@/utils/publicSnapshots'
// All five reads omit credentials and use the same public projection as SSR.
const recentReads = new Map<HomeRead, { expires: number; value: unknown }>()
export function useHomeRead<K extends HomeRead>(key: K, initial: unknown, initialExpires = 0, enabled = () => true) {
  const data = shallowRef<HomeData[K] | null>(null), loading = ref(false), error = ref('')
  try { data.value = decodeHomeRead(key, initial) } catch { /* A current read follows mount. */ }
  const snapshotKey = `home:${key}`
  let mounted = false, sequence = 0, fromSnapshot = false
  function clear() { fromSnapshot = false; sequence++; data.value = null; loading.value = false; error.value = '' }
  async function read() {
    if (!mounted || !enabled() || import.meta.env.SSR) return
    sequence++; error.value = ''
    const run = sequence
    const current = () => mounted && run === sequence
    loading.value = data.value === null
    try { const result = await fetchHomeRead(key); if (current()) { data.value = result; fromSnapshot = false; savePublicSnapshot(snapshotKey, result); recentReads.set(key, { expires: Date.now() + 300_000, value: structuredClone(result) }) } }
    catch (e) {
      if (current()) {
        const invalid = shouldInvalidatePublicSnapshot(e)
        const keep = !invalid && (fromSnapshot || ['offline', 'home_reads_paused'].includes((e as {code?:string})?.code || ''))
        if (invalid) { removePublicSnapshot(snapshotKey); recentReads.delete(key) }
        if (!keep) data.value = null
        error.value = e instanceof Error ? e.message : '读取失败'
      }
    }
    finally { if (current()) loading.value = false }
  }
  async function restoreAndRead() {
    if (!mounted || !enabled()) return
    if (data.value === null) {
      const run = ++sequence
      const snapshot = await readPublicSnapshot(snapshotKey, key === 'tags' ? PUBLIC_DIRECTORY_TTL : PUBLIC_LIST_TTL, value => decodeHomeRead(key, value))
      if (!mounted || run !== sequence) return
      if (snapshot) { data.value = snapshot.value; fromSnapshot = true; if (snapshot.fresh) return }
    }
    await read()
  }
  function loadInitial() {
    if (!mounted || !enabled()) return
    const cached = recentReads.get(key)
    if (cached && cached.expires > Date.now() && cached.expires >= initialExpires) { data.value = decodeHomeRead(key, structuredClone(cached.value)); return }
    if (data.value !== null) {
      if (initialExpires > Date.now()) {
        recentReads.set(key, { expires: initialExpires, value: structuredClone(data.value) })
      } else {
        fromSnapshot = true
        void read()
      }
    } else void restoreAndRead()
  }
  watch(enabled, active => { if (active && !loading.value && (data.value === null || initialExpires <= Date.now())) loadInitial() })
  onMounted(() => { mounted = true; loadInitial() })
  const retryPublic=()=>{void read()}
  onMounted(()=>{if(typeof window!=='undefined')window.addEventListener('fp:retry-public',retryPublic)})
  onScopeDispose(() => { if(typeof window!=='undefined')window.removeEventListener('fp:retry-public',retryPublic); mounted = false; clear() })
  return reactive({ data, loading, error, read })
}
