<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { fetchCheckedIn, fetchCollectedLiveness, fetchLiveness, rewardLiveness } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)

const checkedIn = ref(false)
const liveness = ref(0)
const collected = ref(false)
const msg = ref('')
const busy = ref(false)

async function load() {
  if (!apiKey.value) return
  try {
    const [cin, live, col] = await Promise.all([
      fetchCheckedIn(apiKey.value),
      fetchLiveness(apiKey.value),
      fetchCollectedLiveness(apiKey.value),
    ])
    checkedIn.value = cin
    liveness.value = live
    collected.value = col
  } catch (e) {
    msg.value = e instanceof Error ? e.message : '签到状态失败'
  }
}

onMounted(() => void load())
watch(apiKey, () => void load())

async function collect() {
  if (!apiKey.value) return
  busy.value = true
  msg.value = ''
  try {
    const sum = await rewardLiveness(apiKey.value)
    collected.value = true
    msg.value = sum < 0 ? '昨日奖励已领取' : `领取昨日活跃奖励 ${sum} 积分`
  } catch (e) {
    msg.value = e instanceof Error ? e.message : '领取失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="isLoggedIn" class="checkin-card">
    <div class="checkin-head">
      <span class="title">今日活跃 &amp; 签到</span>
      <span class="liveness-badge" :class="{ done: liveness >= 100 || checkedIn }">
        活跃度 {{ Math.round(liveness) }}%
      </span>
    </div>

    <!-- 活跃度水波进度槽 -->
    <div class="progress-bar">
      <div
        class="progress-fill"
        :class="{ full: liveness >= 100 || checkedIn }"
        :style="{ width: `${Math.min(100, Math.max(0, liveness))}%` }"
      />
    </div>

    <div class="checkin-footer">
      <div class="auto-status" :class="{ ok: checkedIn }">
        <span class="status-dot" />
        <span v-if="checkedIn">活跃达标，已自动签到</span>
        <span v-else>活跃度达标后将自动签到</span>
      </div>

      <button
        v-if="!collected"
        type="button"
        class="btn orange collect-btn"
        :disabled="busy"
        title="领取昨日活跃度奖励积分"
        @click="collect"
      >
        领昨日活跃
      </button>
      <span v-else class="collected-label">✓ 昨日活跃已领</span>
    </div>

    <p v-if="msg" class="checkin-msg" :class="{ ok: msg.includes('成功') || msg.includes('获得') }">
      {{ msg }}
    </p>
  </div>
</template>

<style scoped>
.checkin-card {
  padding: 12px 14px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  margin-bottom: 14px;
}

.checkin-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.title {
  font-size: 13px;
  font-weight: 600;
  color: var(--fp-title);
}

.liveness-badge {
  font-size: 11px;
  color: var(--fp-muted);
  background: var(--fp-hover);
  padding: 2px 7px;
  border-radius: 10px;
  font-weight: 500;
}

.liveness-badge.done {
  color: #27ae60;
  background: rgba(39, 174, 96, 0.1);
}

.progress-bar {
  height: 6px;
  background: var(--fp-border);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #60b044, #e59230);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-fill.full {
  background: linear-gradient(90deg, #60b044, #27ae60);
}

.checkin-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.auto-status {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fp-muted);
  font-size: 11px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f39c12;
  flex-shrink: 0;
}

.auto-status.ok {
  color: #27ae60;
  font-weight: 500;
}

.auto-status.ok .status-dot {
  background: #27ae60;
}

.collect-btn {
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 4px;
  white-space: nowrap;
}

.collected-label {
  font-size: 11px;
  color: var(--fp-muted);
  white-space: nowrap;
}

.checkin-msg {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--fp-muted);
  text-align: center;
}

.checkin-msg.ok {
  color: #27ae60;
  font-weight: 500;
}
</style>
