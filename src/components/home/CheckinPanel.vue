<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useV3ActivityStore } from '@/stores/v3Activity'
import { getAuthContextVersion } from '@/api/http'
import { useActivityStatus } from '@/composables/useActivityStatus'
import { fpConfirm } from '@/composables/useDialog'
const auth = useAuthStore(), writes = useV3ActivityStore(), { checkin, reward } = useActivityStatus(), mounted = ref(false), confirming = ref(false)
let confirmation: AbortController | null = null
const loggedIn = computed(() => mounted.value && !!auth.accessToken && !!auth.account?.oId)
function cancel() { confirmation?.abort(); confirmation = null; confirming.value = false }
const identity = () => JSON.stringify([getAuthContextVersion(), !!auth.accessToken, auth.account?.oId || ''])
async function collect() {
  if (!loggedIn.value || writes.busy || writes.pending || confirming.value || !reward.value.value?.claimable) return
  const original = reward.value.value, reader = identity(), controller = new AbortController(); confirmation = controller; confirming.value = true
  try {
    const yes = await fpConfirm({ title: '领取活跃奖励', message: `领取服务端日期 ${original.date} 的活跃奖励，当前显示为 ${original.amount} 积分，实际到账以服务端结果为准。是否继续？`, confirmText: '确认领取奖励', signal: controller.signal })
    if (yes && !controller.signal.aborted && reader === identity() && reward.value.value === original) { const result = await writes.claim(original.date); if (!result && reader === identity()) void reward.read() }
  } finally { if (confirmation === controller) { confirmation = null; confirming.value = false } }
}
watch(identity, cancel, { flush: 'sync' }); onMounted(() => { mounted.value = true }); onBeforeUnmount(cancel)
</script>
<template>
  <div v-if="loggedIn" class="checkin-panel">
    <section aria-label="今日签到活跃状态">
      <h3>今日活跃与签到</h3>
      <p v-if="checkin.loading.value" role="status">正在读取签到状态…</p>
      <div v-else-if="checkin.error.value" role="alert"><p>{{ checkin.error.value }}</p><button type="button" @click="checkin.read()">重试签到状态</button></div>
      <template v-else-if="checkin.value.value"><p>活跃度 {{ checkin.value.value.liveness }}% · 自动签到门槛 {{ checkin.value.value.threshold }}%</p><div class="progress-track"><div :style="{ width: Math.min(100, checkin.value.value.liveness) + '%' }" /></div><p>{{ checkin.value.value.checkedIn ? '今日已签到' : '今日尚未签到，活跃达标后自动签到' }} · 连续 {{ checkin.value.value.streak }} 天</p><button type="button" @click="checkin.read()">刷新签到状态</button></template>
    </section>
    <section aria-label="昨日活跃奖励">
      <h3>昨日活跃奖励</h3>
      <p v-if="reward.loading.value" role="status">正在读取奖励状态…</p>
      <div v-else-if="reward.error.value" role="alert"><p>{{ reward.error.value }}</p><button type="button" @click="reward.read()">重试奖励状态</button></div>
      <template v-else-if="reward.value.value"><p>{{ reward.value.value.date }} · {{ reward.value.value.amount }} 积分 · {{ reward.value.value.claimed ? '今日已领取' : reward.value.value.claimable ? '可以领取' : '当前无可领取奖励' }}</p><button v-if="reward.value.value.claimable" type="button" :disabled="writes.busy || !!writes.pending || confirming" @click="collect()">领取昨日活跃奖励</button><button type="button" :disabled="reward.loading.value" @click="reward.read()">刷新奖励状态</button></template>
    </section>
  </div>
</template>
<style scoped lang="scss">
.checkin-panel { margin-bottom: 16px; font-size: 13px; section { padding: 10px 0; border-bottom: 1px solid var(--fp-border); } h3 { margin: 0 0 8px; color: var(--fp-title); font-size: 14px; } p { color: var(--fp-muted); overflow-wrap: anywhere; } [role=alert] p { color: #bd503c; } button { padding: 6px 9px; margin: 4px 6px 4px 0; border: 1px solid var(--fp-border); border-radius: 6px; color: var(--fp-text); background: var(--fp-card); cursor: pointer; &:disabled { cursor: default; opacity: .5; } } }
.progress-track { height: 6px; background: var(--fp-border); overflow: hidden; border-radius: 3px; div { height: 100%; background: #6cad5a; } }
</style>
