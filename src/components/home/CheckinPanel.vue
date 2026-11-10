<script setup lang="ts">
import ActivityRecovery from '@/components/ActivityRecovery.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useV3ActivityStore } from '@/stores/v3Activity'
import { getAuthContextVersion } from '@/api/http'
import { useActivityStatus } from '@/composables/useActivityStatus'
import { fpConfirm } from '@/composables/useDialog'
const auth = useAuthStore(), writes = useV3ActivityStore(), { checkin, reward } = useActivityStatus(), mounted = ref(false), confirming = ref(false)
const loggedIn = computed(() => mounted.value && !!auth.accessToken && !!auth.account?.oId)
const today = computed(() => checkin.value.value)
const goalProgress = computed(() => {
  const state = today.value
  if (!state) return 0
  if (!state.threshold) return state.checkedIn ? 100 : 0
  return Math.min(100, state.liveness / state.threshold * 100)
})
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
        <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="6" width="16" height="14" rx="3"/><path d="M8 4v4m8-4v4M4 10h16m-11 5 2 2 4-4"/></svg>每日签到</h3>
        <span v-if="today" class="checkin-status" role="status" :class="{ 'is-done': today.checkedIn }">{{ today.checkedIn ? '已签到' : '待签到' }}</span>
        <button type="button" class="refresh-btn" aria-label="刷新签到状态" title="刷新签到状态" :disabled="checkin.loading.value || reward.loading.value" @click="checkin.read(); reward.read()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg></button>
      </div>
      <p v-if="checkin.loading.value" role="status">读取中…</p>
      <div v-else-if="checkin.error.value" role="alert"><p class="fp-retry-copy">{{ checkin.error.value }}</p><button class="fp-retry-icon" type="button" @click="checkin.read()" title="重试签到状态">重试签到状态</button></div>
      <div v-else-if="today" class="activity-meter" :class="{ 'is-done': today.checkedIn }">
        <div class="activity-ring" role="progressbar" aria-label="今日活跃目标进度" :aria-valuenow="Math.round(goalProgress)"
          :aria-valuetext="`当前活跃 ${today.liveness}%，自动签到门槛 ${today.threshold}%`">
          <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <circle class="ring-track" cx="32" cy="32" r="28" />
            <circle class="ring-fill" cx="32" cy="32" r="28" pathLength="100"
              :style="{ '--ring-offset': 100 - goalProgress }" />
          </svg>
          <svg v-if="today.checkedIn" class="ring-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
          <svg v-else class="ring-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m13 3-8 11h6l-1 7 9-11h-6l1-7Z" /></svg>
        </div>
        <div class="activity-details">
          <p class="activity-value"><strong>{{ today.liveness }}%</strong><span>今日活跃</span></p>
          <p v-if="!today.checkedIn" class="activity-target">达 {{ today.threshold }}% 自动签到</p>
          <p v-else class="activity-target">今日签到已完成</p>
        </div>
      </div>
      <div v-if="today || reward.value.value?.claimable" class="checkin-footer">
        <span v-if="today" class="checkin-streak">连续 <strong>{{ today.streak }}</strong> 天</span>
        <button v-if="reward.value.value?.claimable" type="button" class="claim-reward-btn" aria-label="领取昨日活跃奖励" :disabled="writes.busy || !!writes.pending || confirming" @click="collect()">{{ writes.busy ? '领取中…' : confirming ? '待确认…' : '领昨日奖励' }}</button>
      </div>
      <div v-if="reward.error.value" role="alert"><p class="fp-retry-copy">{{ reward.error.value }}</p><button class="fp-retry-icon" type="button" @click="reward.read()" title="重试奖励状态">重试奖励状态</button></div>
      <ActivityRecovery />
      <p v-if="rewardNotice" class="reward-notice" role="status">{{ rewardNotice }}</p>
    </section>
  </div>
</template>
<style scoped lang="scss">
.checkin-panel { margin-bottom:8px; font-size:12px; }
.checkin-section { padding:10px 12px; border:1px solid var(--fp-divider); border-radius:10px; background:var(--fp-surface-subtle); }
.checkin-head { display:flex; align-items:center; gap:6px; margin-bottom:7px; }
h3 {
  display:flex; align-items:center; gap:5px; flex:1; margin:0;
  color:var(--fp-title); font-size:13px; font-weight:650;
  svg { width:15px; height:15px; color:var(--fp-accent); }
}
.checkin-status {
  flex:none; color:var(--fp-accent); font-size:11px; font-weight:600; padding:2px 7px;
  border-radius:999px; background:color-mix(in srgb,var(--fp-accent) 12%,transparent);
  &.is-done { color:var(--fp-success); background:color-mix(in srgb,var(--fp-success) 12%,transparent); }
}
p { margin:2px 0; color:var(--fp-muted); line-height:1.4; overflow-wrap:anywhere; }
.activity-meter {
  --meter-color: var(--fp-accent);
  display:flex; align-items:center; gap:10px; padding:8px;
  border-radius:8px; background:color-mix(in srgb,var(--meter-color) 8%,transparent);
  &.is-done { --meter-color: var(--fp-success); }
}
.activity-ring {
  position:relative; display:grid; place-items:center; flex:none; width:46px; height:46px;
  color:var(--meter-color);
  > svg:first-child { position:absolute; inset:0; width:100%; height:100%; transform:rotate(-90deg); }
}
.ring-track, .ring-fill { stroke-width:5; }
.ring-track { stroke:color-mix(in srgb,var(--meter-color) 24%,transparent); }
.ring-fill {
  stroke:currentColor; stroke-dasharray:100; stroke-dashoffset:var(--ring-offset);
  transition:stroke-dashoffset .55s ease; animation:ring-enter .65s cubic-bezier(.2,.7,.2,1);
}
.ring-symbol { position:relative; width:19px; height:19px; }
.is-done .ring-symbol { animation:check-enter .35s ease-out both; }
.activity-details { min-width:0; }
.activity-value {
  display:flex; align-items:baseline; flex-wrap:wrap; gap:0 6px; margin:0; font-size:11px;
  strong { color:var(--fp-title); font-size:20px; line-height:1.15; font-variant-numeric:tabular-nums; }
}
.activity-target { margin:3px 0 0; font-size:11px; }
.checkin-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px 8px; min-height:20px; margin-top:5px; }
.checkin-streak { color:var(--fp-muted); font-size:11px; strong { color:var(--fp-title); font-variant-numeric:tabular-nums; } }
@keyframes ring-enter { from { stroke-dashoffset:100; } }
@keyframes check-enter { from { opacity:0; transform:scale(.65); } }
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
@media(prefers-reduced-motion:reduce) {
  .ring-fill, .is-done .ring-symbol { animation:none; transition:none; }
}
</style>
