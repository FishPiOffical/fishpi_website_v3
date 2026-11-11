import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { decodeInitialRanking, fetchRanking, rankingSubType, type RankingType, type RankingPage } from '@/api/v3-rankings'
import { useAuthStore } from '@/stores/auth'
import { shouldInvalidatePublicSnapshot, PUBLIC_LIST_TTL, readPublicSnapshot, removePublicSnapshot, savePublicSnapshot } from '@/utils/publicSnapshots'

export function useRankingBoard(type: RankingType, initial: unknown = null, compact = false, initialExpires = Infinity) {
  const auth = useAuthStore(), subType = ref(rankingSubType(type)), size = compact ? 8 : 20
  const value = ref<RankingPage | null>(null), p = ref(1), loading = ref(false), error = ref('')
  try { if (initial !== null) value.value = decodeInitialRanking(initial, type, subType.value, size) } catch { /* Requery malformed or differently bound SSR payloads. */ }
  let mounted = false, sequence = 0, fromSnapshot = compact && value.value !== null
  function clear() { fromSnapshot = false; sequence++; value.value = null; loading.value = false; error.value = '' }
  const key = (sub: string, page: number) => compact ? `home:ranking:${type}:${sub}` : `ranking:${type}:${sub}:${page}`
  async function read(next = p.value, restore = false) {
    if (!mounted || import.meta.env.SSR) return
    if (next !== p.value || !restore) clear()
    else { sequence++; error.value = ''; loading.value = false }
    p.value = next
    const run = sequence, boundary = getAuthContextVersion(), token = auth.accessToken, owner = auth.account?.oId, sub = subType.value
    const valid = () => mounted && run === sequence && sub === subType.value
      && (compact || boundary === getAuthContextVersion() && token === auth.accessToken && owner === auth.account?.oId)
    const cacheKey = key(sub, next), cacheable = !compact || next === 1
    if (cacheable && restore && !value.value) {
      const snapshot = await readPublicSnapshot(cacheKey, PUBLIC_LIST_TTL, raw => decodeInitialRanking(raw, type, sub, size, next))
      if (!valid()) return
      if (snapshot) { value.value = snapshot.value; fromSnapshot = true; if (snapshot.fresh) return }
    }
    loading.value = !value.value
    try {
      const data = await fetchRanking(type, next, sub, size, cacheable ? 'omit' : undefined)
      if (valid()) { value.value = data; fromSnapshot = false; if (cacheable) savePublicSnapshot(cacheKey, data) }
    } catch (e) {
      if (valid()) {
        const invalid = shouldInvalidatePublicSnapshot(e)
        if (cacheable && invalid) removePublicSnapshot(cacheKey)
        if (invalid || !fromSnapshot) value.value = null
        error.value = e instanceof Error ? e.message : '排行榜读取失败'
      }
    }
    finally { if (valid()) loading.value = false }
  }
  const stops = [watch(subType, () => { clear(); void read(1, true) })]
  if (!compact) stops.push(watch([() => auth.accessToken, () => auth.account?.oId], (_, previous) => {
    const sameOwner = auth.account?.oId === previous[1] && !!auth.accessToken === !!previous[0]
    clear(); if (!sameOwner) p.value = 1; void read(p.value, true)
  }, { flush: 'sync' }))
  onMounted(() => {
    mounted = true
    if (!value.value || (compact ? initialExpires <= Date.now() : auth.accessToken)) void read(1, true)
  })
  onScopeDispose(() => { mounted = false; stops.forEach(stop => stop()); clear() })
  return { value, p, subType, loading, error, read }
}
