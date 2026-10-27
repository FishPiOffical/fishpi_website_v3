import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { fetchCheckinState, fetchRewardState, type CheckinState, type RewardState } from '@/api/v3-activity'
import { useAuthStore } from '@/stores/auth'
import { useV3ActivityStore } from '@/stores/v3Activity'
export function useActivityStatus() {
  const auth = useAuthStore(), writes = useV3ActivityStore(); let mounted = false
  function resource<T>(fetch: () => Promise<T>) {
    const value = ref<T | null>(null), loading = ref(false), error = ref(''); let sequence = 0
    function clear() { sequence++; value.value = null; loading.value = false; error.value = '' }
    async function read() {
      clear(); if (!mounted || !auth.accessToken || !auth.account?.oId || import.meta.env.SSR) return
      const run = sequence, boundary = getAuthContextVersion(), token = auth.accessToken, actor = auth.account.oId
      const valid = () => mounted && run === sequence && boundary === getAuthContextVersion() && token === auth.accessToken && actor === auth.account?.oId
      loading.value = true
      try { const data = await fetch(); if (valid()) value.value = data }
      catch (e) { if (valid()) error.value = e instanceof Error ? e.message : '活动状态读取失败' }
      finally { if (valid()) loading.value = false }
    }
    return { value, loading, error, read, clear }
  }
  const checkin = resource<CheckinState>(fetchCheckinState), reward = resource<RewardState>(fetchRewardState)
  function read() { void checkin.read(); void reward.read() }
  const stops = [watch([() => auth.accessToken, () => auth.account?.oId], read, { flush: 'sync' }), watch(() => writes.revision, read)]
  onMounted(() => { mounted = true; read() }); onScopeDispose(() => { mounted = false; stops.forEach(stop => stop()); checkin.clear(); reward.clear() })
  return { checkin, reward }
}
