<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="card">
    <h1>{{ (route.meta.title as string) || '即将重构' }}</h1>
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
