<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  page: number
  pageCount: number
  label: string
  busy?: boolean
  pageLimit?: number
}>()

const emit = defineEmits<{ change: [page: number] }>()
const lastPage = computed(() => Math.min(props.pageCount, props.pageLimit ?? props.pageCount))
</script>

<template>
  <nav class="fp-pagination" :aria-label="label">
    <button type="button" class="fp-control page-btn" :disabled="busy || page <= 1" @click="emit('change', page - 1)">上一页</button>
    <span v-if="pageCount" class="page-label">第 {{ page }} 页 / 共 {{ pageCount }} 页</span>
    <span v-else class="page-label">暂无分页</span>
    <button type="button" class="fp-control page-btn" :disabled="busy || page >= lastPage" @click="emit('change', page + 1)">下一页</button>
    <slot name="actions" />
  </nav>
</template>

<style scoped>
.page-label {
  color: var(--fp-title);
  font-weight: 600;
  text-align: center;
}
</style>
