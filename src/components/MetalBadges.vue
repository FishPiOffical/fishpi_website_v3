<script setup lang="ts">
import { computed } from 'vue'
import { normalizeMetals, type MetalItem } from '@/api/fishpi'

const props = defineProps<{ items?: MetalItem[] | string | unknown }>()

const metals = computed(() => normalizeMetals(props.items))
</script>

<template>
  <ul v-if="metals.length" class="metals">
    <li
      v-for="(m, i) in metals"
      :key="(m.name || '') + i"
      :title="m.description || m.name"
      :style="{
        background: m.backcolor || 'transparent',
        color: m.fontcolor || 'var(--fp-muted)',
        borderColor: m.backcolor || 'var(--fp-border)',
      }"
    >
      <img v-if="m.url" :src="m.url" width="14" height="14" alt="" />
      {{ m.name }}
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  border: 1px solid var(--fp-border);
  border-radius: 999px;
  padding: 2px 8px;
  max-width: 100%;
}
.metals img {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  object-fit: cover;
  flex-shrink: 0;
}
</style>
