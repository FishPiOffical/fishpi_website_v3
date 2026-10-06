<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const query = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
</script>

<template>
  <div class="card">
    <h1>{{ (route.meta.title as string) || '即将重构' }}</h1>
    <p v-if="query">关键词：{{ query }}</p>
    <p>该页面不在 P0 范围内，顶栏可进入以便对齐现网导航。</p>
  </div>
</template>

<style scoped>
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 24px;
}
</style>
