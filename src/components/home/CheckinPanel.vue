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
        <h3>今日活跃与签到</h3>
        <span v-if="checkin.value.value" class="liveness-pill" :class="{ 'is-done': checkin.value.value.checkedIn }">
          {{ checkin.value.value.liveness }}%
        </span>
      </div>
      <p v-if="checkin.loading.value" role="status">正在读取签到状态…</p>
      <div v-else-if="checkin.error.value" role="alert"><p>{{ checkin.error.value }}</p><button type="button" @click="checkin.read()">重试签到状态</button></div>
      <template v-else-if="checkin.value.value">
        <p class="liveness-meta">活跃度 {{ checkin.value.value.liveness }}% · 自动签到门槛 {{ checkin.value.value.threshold }}%</p>
        <div class="progress-track"><div :style="{ width: Math.min(100, checkin.value.value.liveness) + '%' }" /></div>
        <p class="checkin-streak-line">
          <span class="status-dot" :class="{ 'is-checked': checkin.value.value.checkedIn }" />
          {{ checkin.value.value.checkedIn ? '今日已签到' : '今日尚未签到，活跃达标后自动签到' }} · 连续 {{ checkin.value.value.streak }} 天
        </p>
      </template>
      <div class="checkin-actions">
        <button v-if="reward.value.value?.claimable" type="button" class="claim-reward-btn" :disabled="writes.busy || !!writes.pending || confirming" @click="collect()">{{ writes.busy ? '领取中…' : confirming ? '等待确认…' : '领取昨日活跃奖励' }}</button>
        <button type="button" class="refresh-btn" :disabled="checkin.loading.value || reward.loading.value" @click="checkin.read(); reward.read()">刷新签到状态</button>
      </div>
      <div v-if="reward.error.value" class="reward-error" role="alert"><p>{{ reward.error.value }}</p><button type="button" @click="reward.read()">重试奖励状态</button></div>
      <p v-if="rewardNotice" class="reward-notice" role="status">{{ rewardNotice }}</p>
    </section>
  </div>
</template>
<style scoped lang="scss">
.checkin-panel {
  margin-bottom: 10px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  section {
    padding: 10px 12px;
    background: var(--fp-surface-subtle);
    border: 1px solid var(--fp-divider);
    border-radius: 10px;
  }

  .checkin-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  h3 {
    margin: 0;
    color: var(--fp-title);
    font-size: 12.5px;
    font-weight: 700;
  }

  .liveness-pill {
    font-size: 11px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(229, 146, 48, 0.14);
    color: #d67d1e;
    font-variant-numeric: tabular-nums;

    &.is-done {
      background: rgba(96, 176, 68, 0.14);
      color: #60b044;
    }
  }

  p {
    margin: 3px 0;
    color: var(--fp-muted);
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .checkin-streak-line {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 5px;
    font-weight: 500;
    color: var(--fp-text);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #e59230;
    flex-shrink: 0;

    &.is-checked {
      background: #60b044;
    }
  }

  [role='alert'] p {
    color: #bd503c;
  }

  button {
    padding: 5px 10px;
    margin: 6px 6px 2px 0;
    border: 1px solid var(--fp-border);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--fp-text);
    background: var(--fp-card);
    cursor: pointer;
    transition: all 0.15s ease;

    &:disabled {
      cursor: default;
      opacity: 0.5;
    }

    &.claim-reward-btn {
      margin: 0;
      padding: 5px 10px;
      background: linear-gradient(135deg, #e59230, #d67d1e);
      border-color: transparent;
      color: #fff;


      &:hover:not(:disabled) {
        filter: brightness(1.05);
      }
    }
  }
}

.checkin-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 9px;
  button { margin: 0; }
  .refresh-btn {
    padding: 5px 7px;
    border-color: transparent;
    color: var(--fp-muted);
    background: transparent;
    font-weight: 400;
    &:hover:not(:disabled) { color: var(--fp-title); background: var(--fp-hover); }
  }
}
.checkin-panel .reward-notice {
  margin-top: 8px;
  color: var(--fp-success);
  font-size: 12px;
}
.progress-track {
  height: 6px;
  margin: 6px 0;
  background: var(--fp-divider);
  overflow: hidden;
  border-radius: 999px;

  div {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #60b044, #e59230);
    transition: width 0.3s ease;
  }
}
</style>
