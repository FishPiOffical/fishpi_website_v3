<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useV3ActivityStore } from '@/stores/v3Activity'
import { getAuthContextVersion } from '@/api/http'
import { useActivityStatus } from '@/composables/useActivityStatus'
import { fpConfirm } from '@/composables/useDialog'
const auth = useAuthStore(), writes = useV3ActivityStore(), { checkin, reward } = useActivityStatus(), mounted = ref(false), confirming = ref(false)
const loggedIn = computed(() => mounted.value && !!auth.accessToken && !!auth.account?.oId)
const rewardNotice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let confirmation: AbortController | null = null
function clearNotice() {
  clearTimeout(noticeTimer)
  noticeTimer = undefined
  rewardNotice.value = ''
}
watch(() => writes.receipt, receipt => {
  clearNotice()
  if (!receipt || !loggedIn.value) return
  rewardNotice.value = `昨日活跃奖励已确认领取 ${receipt.amount} 积分`
  noticeTimer = setTimeout(clearNotice, 5000)
})
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
watch(identity, () => { cancel(); clearNotice() }, { flush: 'sync' })
onMounted(() => { mounted.value = true })
onBeforeUnmount(() => { cancel(); clearNotice() })
</script>
<template>
  <div v-if="loggedIn" class="checkin-panel">
    <section class="checkin-section" aria-label="今日签到活跃状态">
      <div class="checkin-head">
        <h3>每日签到</h3>
        <span v-if="checkin.value.value" class="checkin-status" :class="{ 'is-done': checkin.value.value.checkedIn }">{{ checkin.value.value.checkedIn ? '已签到' : '待签到' }}</span>
        <button type="button" class="refresh-btn" aria-label="刷新签到状态" title="刷新签到状态" :disabled="checkin.loading.value || reward.loading.value" @click="checkin.read(); reward.read()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg></button>
      </div>
      <p v-if="checkin.loading.value" role="status">读取中…</p>
      <div v-else-if="checkin.error.value" role="alert"><p>{{ checkin.error.value }}</p><button type="button" @click="checkin.read()">重试签到状态</button></div>
      <template v-else-if="checkin.value.value">
        <p class="liveness-meta"><span>活跃 {{ checkin.value.value.liveness }}%</span><span v-if="!checkin.value.value.checkedIn">{{ checkin.value.value.threshold }}% 自动签到</span></p>
        <div class="progress-track"><div :style="{ width: Math.min(100, checkin.value.value.liveness) + '%' }" /></div>
      </template>
      <div v-if="checkin.value.value || reward.value.value?.claimable" class="checkin-footer">
        <span v-if="checkin.value.value" class="checkin-streak">连续 {{ checkin.value.value.streak }} 天</span>
        <button v-if="reward.value.value?.claimable" type="button" class="claim-reward-btn" aria-label="领取昨日活跃奖励" :disabled="writes.busy || !!writes.pending || confirming" @click="collect()">{{ writes.busy ? '领取中…' : confirming ? '待确认…' : '领昨日奖励' }}</button>
      </div>
      <div v-if="reward.error.value" role="alert"><p>{{ reward.error.value }}</p><button type="button" @click="reward.read()">重试奖励状态</button></div>
      <p v-if="rewardNotice" class="reward-notice" role="status">{{ rewardNotice }}</p>
    </section>
  </div>
</template>
<style scoped lang="scss">
.checkin-panel { margin-bottom:8px; font-size:12px; }
.checkin-section { padding:7px 10px; border:1px solid var(--fp-divider); border-radius:8px; background:var(--fp-surface-subtle); }
.checkin-head { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
h3 { flex:1; margin:0; color:var(--fp-title); font-size:12px; font-weight:600; }
.checkin-status { color:var(--fp-accent); font-size:11px; font-weight:600; padding:1px 6px; border-radius:999px; background:color-mix(in srgb,var(--fp-accent) 12%,transparent); &.is-done { color:var(--fp-success); background:color-mix(in srgb,var(--fp-success) 12%,transparent); } }
p { margin:2px 0; color:var(--fp-muted); line-height:1.4; overflow-wrap:anywhere; }
.liveness-meta { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:2px 8px; font-size:11px; font-variant-numeric:tabular-nums; }
.progress-track { height:4px; margin:4px 0 5px; border-radius:999px; background:var(--fp-divider); overflow:hidden; div { height:100%; border-radius:inherit; background:linear-gradient(90deg, #60b044, #e59230); transition:width .3s ease; } }
.checkin-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px 8px; min-height:20px; }
.checkin-streak { color:var(--fp-muted); font-size:11px; }
button { padding:3px 8px; border:1px solid var(--fp-border); border-radius:5px; background:var(--fp-card); color:var(--fp-text); font:inherit; font-size:11px; line-height:1.4; cursor:pointer; &:hover:not(:disabled) { background:var(--fp-hover); } &:disabled { cursor:default; opacity:.5; } &:focus-visible { outline:2px solid var(--fp-primary); outline-offset:2px; } }
.refresh-btn { display:none; place-items:center; flex:none; width:22px; height:22px; padding:3px; border-color:transparent; background:transparent; color:var(--fp-muted); svg { width:13px; height:13px; } }
.claim-reward-btn { margin-left:auto; border-color:transparent; background:var(--fp-accent-soft); color:var(--fp-accent); font-weight:600; &:hover:not(:disabled) { background:color-mix(in srgb,var(--fp-accent) 18%,transparent); } }
[role='alert'] p { color:var(--fp-danger); }
.reward-notice { margin-top:5px; color:var(--fp-success); font-size:11px; }
.checkin-panel.embedded-checkin {
  margin-bottom: 0;
  .checkin-section {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
}
@media(prefers-reduced-motion:reduce) { .progress-track div { transition:none; } }
</style>
