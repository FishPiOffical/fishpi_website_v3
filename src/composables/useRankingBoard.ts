import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { decodeInitialRanking, fetchRanking, rankingSubType, type RankingType, type RankingPage } from '@/api/v3-rankings'
import { useAuthStore } from '@/stores/auth'

export function useRankingBoard(type: RankingType, initial: unknown = null, compact = false) {
  const auth = useAuthStore(), subType = ref(rankingSubType(type)), size = compact ? 8 : 20
  const value = ref<RankingPage | null>(null), p = ref(1), loading = ref(false), error = ref('')
  try { if (initial !== null) value.value = decodeInitialRanking(initial, type, subType.value, size) } catch { /* Requery malformed or differently bound SSR payloads. */ }
  let mounted = false, sequence = 0
  function clear() { sequence++; value.value = null; loading.value = false; error.value = '' }
  async function read(next = p.value) {
    if (!mounted || import.meta.env.SSR) return
    clear(); p.value = next
    const run = sequence, boundary = getAuthContextVersion(), token = auth.accessToken, owner = auth.account?.oId, sub = subType.value
    const valid = () => mounted && run === sequence && boundary === getAuthContextVersion() && token === auth.accessToken && owner === auth.account?.oId && sub === subType.value
    loading.value = true
    try { const data = await fetchRanking(type, next, sub, size); if (valid()) value.value = data }
    catch (e) { if (valid()) error.value = e instanceof Error ? e.message : '排行榜读取失败' }
    finally { if (valid()) loading.value = false }
  }
  const stops = [watch(subType, () => void read(1)), watch([() => auth.accessToken, () => auth.account?.oId], (_, previous) => {
    const sameOwner = auth.account?.oId === previous[1] && !!auth.accessToken === !!previous[0]
    clear(); if (!sameOwner) p.value = 1; void read()
  }, { flush: 'sync' })]
  onMounted(() => { mounted = true; if (!value.value || auth.accessToken) void read() })
  onScopeDispose(() => { mounted = false; stops.forEach(stop => stop()); clear() })
  return { value, p, subType, loading, error, read }
}
