<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ heading: string; columns: string[] }>()
const captionId = useId()
</script>

<template>
  <div class="member-records" tabindex="0" role="region" :aria-labelledby="captionId">
    <table>
      <caption :id="captionId" class="sr-only">{{ heading }}</caption>
      <thead><tr><th v-for="column in columns" :key="column" scope="col">{{ column }}</th></tr></thead>
      <tbody><slot /></tbody>
    </table>
  </div>
</template>

<style scoped>
.member-records {
  overflow-x: auto;
  max-inline-size: 100%;
  container-type: inline-size;
}
table { border-collapse: collapse; inline-size: 100%; font-size: 14px; }
.sr-only { position: absolute; inline-size: 1px; block-size: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
th, :slotted(tr) :is(th, td) { padding: 10px; text-align: start; line-height: 1.45; overflow-wrap: anywhere; }
thead { background: var(--fp-surface-subtle); color: var(--fp-muted); }
:slotted(tr) { border-block-end: 1px solid var(--fp-divider); }
:slotted(tr) :is(th, td) { font-variant-numeric: tabular-nums; }
@container (width < 440px) {
  table { font-size: 12px; }
  th, :slotted(tr) :is(th, td) { padding: 8px 4px; }
}
</style>
