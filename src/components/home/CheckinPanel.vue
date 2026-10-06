<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { dailyCheckin, fetchCheckedIn, fetchCollectedLiveness, fetchLiveness, rewardLiveness } from '@/api/fishpi'
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

async function checkin() {
  if (!apiKey.value) return
  busy.value = true
  msg.value = ''
  try {
    const n = await dailyCheckin(apiKey.value)
    checkedIn.value = true
    msg.value = n > 0 ? `签到成功，随机积分 ${n}` : '今日已签到'
  } catch (e) {
    msg.value = e instanceof Error ? e.message : '签到失败'
  } finally {
    busy.value = false
  }
}

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
  <div v-if="isLoggedIn" class="card">
    <header>
      <h3>签到</h3>
    </header>
    <p>活跃度 {{ liveness.toFixed(1) }}</p>
    <p>{{ checkedIn ? '今日已签到' : '今日尚未签到' }}</p>
    <button type="button" :disabled="busy || checkedIn" @click="checkin">
      {{ checkedIn ? '已签到' : '签到' }}
    </button>
    <button type="button" :disabled="busy || collected" @click="collect">
      {{ collected ? '已领昨日奖励' : '领昨日活跃奖励' }}
    </button>
    <p v-if="msg" class="hint">{{ msg }}</p>
  </div>
</template>

<style scoped>
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  padding: 12px 14px;
}
h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
p {
  margin: 4px 0;
  font-size: 13px;
}
.hint {
  color: var(--fp-muted);
}
button {
  margin: 6px 6px 0 0;
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>
