<script setup lang="ts">
import AppearancePicker from '@/components/packs/AppearancePicker.vue'
</script>

<template>
  <div class="appearance"><AppearancePicker compact /></div>
</template>

<style scoped>
.appearance :deep(.picker) { gap: 14px; }
.appearance :deep(h4) { margin: 0 0 6px; font-size: 11px; font-weight: 400; }
.appearance :deep(.grid) { gap: 6px; }
.appearance :deep(button) { display: flex; align-items: center; gap: 6px; min-width: 0; min-height: 34px; padding: 6px; border-radius: 5px; background: transparent; transition: background 150ms ease, border-color 150ms ease; }
.appearance :deep(button:hover) { background: var(--fp-hover); }
.appearance :deep(button.on) { box-shadow: none; background: color-mix(in srgb, var(--fp-primary) 6%, transparent); }
.appearance :deep(button i) { flex: none; width: 18px; height: 18px; margin: 0; border-radius: 4px; border: 1px solid var(--fp-border); }
.appearance :deep(button span) { min-width: 0; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.appearance :deep(button em) { position: static; flex: none; margin-left: auto; padding: 0 2px; border-radius: 3px; background: var(--fp-hover); color: var(--fp-muted); font-size: 8px; }
.appearance :deep(button:focus-visible) { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
</style>
