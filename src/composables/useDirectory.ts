import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { decodeDirectoryPage, fetchDirectoryPage, type DirectoryPage, type DirectoryKind } from '@/api/v3-directory'
import { canKeepPublicSnapshot, DIRECTORY_MAX_AGE, readPublicSnapshot, removePublicSnapshot, savePublicSnapshot } from '@/utils/publicSnapshots'

export function useDirectory(kind: DirectoryKind, initial: unknown = null) {
  const auth = useAuthStore(), value = ref<DirectoryPage | null>(null), p = ref(1), loading = ref(false), error = ref('')
  if (initial) { try { value.value = decodeDirectoryPage(initial, kind) } catch { /* Read a current page after mount. */ } }
  let mounted = false, seq = 0, expires = 0
  const key = (page: number) => `directory:${kind}:${page}`
  async function read(next = p.value, restore = false) {
    const run = ++seq, context = getAuthContextVersion(), token = auth.accessToken, actor = auth.account?.oId
    const valid = () => mounted && run === seq && context === getAuthContextVersion() && token === auth.accessToken && actor === auth.account?.oId
    if (next !== p.value || !restore) { value.value = null; expires = 0 }
    p.value = next; loading.value = false; error.value = ''
    if (!mounted || import.meta.env.SSR) return
    const cacheKey = key(next)
    if (restore && !value.value) {
      const snapshot = await readPublicSnapshot(cacheKey, DIRECTORY_MAX_AGE, raw => decodeDirectoryPage(raw, kind, next))
      if (!valid()) return
      if (snapshot) { value.value = snapshot.value; expires = snapshot.expires }
    }
    loading.value = !value.value
    try {
      const result = await fetchDirectoryPage(kind, next)
      if (valid()) { value.value = result; expires = 0; savePublicSnapshot(cacheKey, result) }
    } catch (e) {
      if (valid()) {
        if (!canKeepPublicSnapshot(e)) removePublicSnapshot(cacheKey)
        if (!canKeepPublicSnapshot(e) || expires <= Date.now()) value.value = null
        error.value = e instanceof Error ? e.message : '列表读取失败'
      }
    } finally { if (valid()) loading.value = false }
  }
  const stopIdentity = watch([() => auth.accessToken, () => auth.account?.oId], (_, old) => {
    const sameActor = auth.account?.oId === old[1] && !!auth.accessToken === !!old[0]
    void read(sameActor ? p.value : 1, true)
  }, { flush: 'sync' })
  onMounted(() => {
    mounted = true
    if (value.value && !auth.accessToken) savePublicSnapshot(key(1), value.value)
    else void read(1, true)
  })
  onScopeDispose(() => { mounted = false; seq++; stopIdentity(); value.value = null })
  return { value, p, loading, error, read }
}
