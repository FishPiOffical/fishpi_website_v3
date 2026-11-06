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
        <button type="button" class="refresh-btn" @click="checkin.read()">刷新签到状态</button>
      </template>
    </section>
    <section class="reward-section" aria-label="昨日活跃奖励">
      <div class="checkin-head">
        <h3>昨日活跃奖励</h3>
        <span v-if="reward.value.value" class="reward-amount-pill">{{ reward.value.value.amount }} 积分</span>
      </div>
      <p v-if="reward.loading.value" role="status">正在读取奖励状态…</p>
      <div v-else-if="reward.error.value" role="alert"><p>{{ reward.error.value }}</p><button type="button" @click="reward.read()">重试奖励状态</button></div>
      <template v-else-if="reward.value.value">
        <p class="reward-meta">{{ reward.value.value.date }} · {{ reward.value.value.amount }} 积分 · {{ reward.value.value.claimed ? '今日已领取' : reward.value.value.claimable ? '可以领取' : '当前无可领取奖励' }}</p>
        <button v-if="reward.value.value.claimable" type="button" class="claim-reward-btn" :disabled="writes.busy || !!writes.pending || confirming" @click="collect()">领取昨日活跃奖励</button>
        <button type="button" class="refresh-btn" :disabled="reward.loading.value" @click="reward.read()">刷新奖励状态</button>
      </template>
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

  .liveness-pill,
  .reward-amount-pill {
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

    &.refresh-btn {
      display: none;
    }

    &.claim-reward-btn {
      width: 100%;
      margin: 6px 0 0;
      padding: 6px 12px;
      background: linear-gradient(135deg, #e59230, #d67d1e);
      border-color: transparent;
      color: #fff;
      box-shadow: 0 2px 6px rgba(214, 125, 30, 0.25);

      &:hover:not(:disabled) {
        filter: brightness(1.05);
      }
    }
  }
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
