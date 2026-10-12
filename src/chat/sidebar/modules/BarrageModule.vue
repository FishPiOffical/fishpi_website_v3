<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { fetchBarrageCost } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const cost = ref('')
const error = ref('')

onMounted(async () => {
  try {
    cost.value = await fetchBarrageCost(apiKey.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法读取弹幕花费'
  }
})
</script>

<template>
  <p v-if="error" class="hint">{{ error }}</p>
  <template v-else>
    <div class="cost"><span>当前发送花费</span><strong>{{ cost || '读取中…' }}</strong></div>
    <p class="hint">点击聊天输入框下方的「弹幕」发送</p>
  </template>
</template>

<style scoped>
.hint {
  margin: 6px 0 0;
  color: var(--fp-muted);
  font-size: 11px;
}
.cost { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px; color: var(--fp-muted); font-size: 12px; }
.cost strong { color: var(--fp-title); font-size: 16px; font-weight: 600; }
</style>
