<script setup lang="ts">
import type { MetalItem } from '@/api/fishpi'

defineProps<{ items?: MetalItem[] }>()
</script>

<template>
  <ul v-if="items?.length" class="metals">
    <li v-for="(m, i) in items" :key="(m.name || '') + i" :title="m.description || m.name">
      {{ m.name || '徽章' }}
    </li>
  </ul>
</template>

<style scoped>
.metals {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}
.metals li {
  font-size: 11px;
  color: var(--fp-muted);
  border: 1px solid var(--fp-border);
  border-radius: 999px;
  padding: 2px 8px;
}
</style>
