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
  <p v-else class="hint">发送弹幕约消耗 {{ cost || '…' }}。本页不代发弹幕。</p>
</template>

<style scoped>
.hint {
  margin: 0;
  color: var(--fp-muted);
  font-size: 12px;
}
</style>
