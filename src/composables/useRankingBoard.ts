import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { decodeInitialRanking, fetchRanking, rankingSubType, type RankingType, type RankingPage } from '@/api/v3-rankings'
import { useAuthStore } from '@/stores/auth'
import { canKeepPublicSnapshot, HOME_MAX_AGE, readPublicSnapshot, removePublicSnapshot, savePublicSnapshot } from '@/utils/publicSnapshots'

export function useRankingBoard(type: RankingType, initial: unknown = null, compact = false) {
  const auth = useAuthStore(), subType = ref(rankingSubType(type)), size = compact ? 8 : 20
  const value = ref<RankingPage | null>(null), p = ref(1), loading = ref(false), error = ref('')
  try { if (initial !== null) value.value = decodeInitialRanking(initial, type, subType.value, size) } catch { /* Requery malformed or differently bound SSR payloads. */ }
  let mounted = false, sequence = 0, expires = 0
  function clear() { expires = 0; sequence++; value.value = null; loading.value = false; error.value = '' }
  const key = (sub: string) => `home:ranking:${type}:${sub}`
  async function read(next = p.value, restore = false) {
    if (!mounted || import.meta.env.SSR) return
    if (!compact || next !== p.value || !restore) clear()
    else { sequence++; error.value = ''; loading.value = false }
    p.value = next
    const run = sequence, boundary = getAuthContextVersion(), token = auth.accessToken, owner = auth.account?.oId, sub = subType.value
    const valid = () => mounted && run === sequence && boundary === getAuthContextVersion() && token === auth.accessToken && owner === auth.account?.oId && sub === subType.value
    const cacheKey = key(sub), cacheable = compact && next === 1
    if (cacheable && restore && !value.value) {
      const snapshot = await readPublicSnapshot(cacheKey, HOME_MAX_AGE, raw => decodeInitialRanking(raw, type, sub, size))
      if (!valid()) return
      if (snapshot) { value.value = snapshot.value; expires = snapshot.expires }
    }
    loading.value = !value.value
    try {
      const data = await fetchRanking(type, next, sub, size, cacheable ? 'omit' : undefined)
      if (valid()) { value.value = data; expires = 0; if (cacheable) savePublicSnapshot(cacheKey, data) }
    } catch (e) {
      if (valid()) {
        const keep = canKeepPublicSnapshot(e)
        if (cacheable && !keep) removePublicSnapshot(cacheKey)
        if (!keep || expires <= Date.now()) value.value = null
        error.value = e instanceof Error ? e.message : '排行榜读取失败'
      }
    }
    finally { if (valid()) loading.value = false }
  }
  const stops = [watch(subType, () => { clear(); void read(1, compact) }), watch([() => auth.accessToken, () => auth.account?.oId], (_, previous) => {
    const sameOwner = auth.account?.oId === previous[1] && !!auth.accessToken === !!previous[0]
    if (!compact || !sameOwner && p.value !== 1) clear(); if (!sameOwner) p.value = 1; void read(p.value, compact)
  }, { flush: 'sync' })]
  onMounted(() => {
    mounted = true
    if (!value.value || auth.accessToken) void read(1, compact)
    else if (compact) savePublicSnapshot(key(subType.value), value.value)
  })
  onScopeDispose(() => { mounted = false; stops.forEach(stop => stop()); clear() })
  return { value, p, subType, loading, error, read }
}
