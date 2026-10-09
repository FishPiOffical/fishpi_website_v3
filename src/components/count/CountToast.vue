<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useCountStore } from '@/stores/count'

const count = useCountStore()
const { toast } = storeToRefs(count)
const mounted = ref(false)

onMounted(() => {
  mounted.value = true
  count.load()
  count.start()
})

onUnmounted(() => count.stop())
</script>

<template>
  <Teleport v-if="mounted && toast" to="body">
    <div class="count-toast" :class="toast.type" role="status" @click="count.dismissToast()">{{ toast.text }}</div>
  </Teleport>
</template>

<style scoped>
.count-toast {
  position: fixed;
  top: 72px;
  left: 50%;
  z-index: 1400;
  transform: translateX(-50%);
  max-width: min(480px, calc(100vw - 32px));
  padding: 10px 16px;
  border: 1px solid var(--fp-border);
  border-left: 3px solid var(--fp-primary);
  border-radius: 10px;
  background: var(--fp-card);
  color: var(--fp-text);
  font-size: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}
.count-toast.danger {
  border-left-color: var(--fp-accent);
}
</style>
