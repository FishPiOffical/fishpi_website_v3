import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { decodeDirectoryPage, fetchDirectoryPage, type DirectoryPage, type DirectoryKind } from '@/api/v3-directory'
import { shouldInvalidatePublicSnapshot, PUBLIC_DIRECTORY_TTL, readPublicSnapshot, removePublicSnapshot, savePublicSnapshot } from '@/utils/publicSnapshots'

export function useDirectory(kind: DirectoryKind, initial: unknown = null) {
  const auth = useAuthStore(), value = ref<DirectoryPage | null>(null), p = ref(1), loading = ref(false), error = ref('')
  if (initial) { try { value.value = decodeDirectoryPage(initial, kind) } catch { /* Read a current page after mount. */ } }
  let mounted = false, seq = 0, fromSnapshot = false
  const key = (page: number) => `directory:${kind}:${page}`
  async function read(next = p.value, restore = false) {
    const run = ++seq, context = getAuthContextVersion(), token = auth.accessToken, actor = auth.account?.oId
    const valid = () => mounted && run === seq && context === getAuthContextVersion() && token === auth.accessToken && actor === auth.account?.oId
    if (next !== p.value || !restore) { value.value = null; fromSnapshot = false }
    p.value = next; loading.value = false; error.value = ''
    if (!mounted || import.meta.env.SSR) return
    const cacheKey = key(next)
    if (restore && !value.value) {
      const snapshot = await readPublicSnapshot(cacheKey, PUBLIC_DIRECTORY_TTL, raw => decodeDirectoryPage(raw, kind, next))
      if (!valid()) return
      if (snapshot) { value.value = snapshot.value; fromSnapshot = true; if (snapshot.fresh) return }
    }
    loading.value = !value.value
    try {
      const result = await fetchDirectoryPage(kind, next)
      if (valid()) { value.value = result; fromSnapshot = false; savePublicSnapshot(cacheKey, result) }
    } catch (e) {
      if (valid()) {
        const invalid = shouldInvalidatePublicSnapshot(e)
        if (invalid) removePublicSnapshot(cacheKey)
        if (invalid || !fromSnapshot) value.value = null
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
    if (!value.value || auth.accessToken) void read(1, true)
  })
  onScopeDispose(() => { mounted = false; seq++; stopIdentity(); value.value = null })
  return { value, p, loading, error, read }
}
