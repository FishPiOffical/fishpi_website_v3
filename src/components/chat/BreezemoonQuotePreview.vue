<script setup lang="ts">
import BreezemoonQuoteCard from './BreezemoonQuoteCard.vue'
import type { BreezemoonQuote } from '@/utils/breezemoonQuote'

defineProps<{ quotes: BreezemoonQuote[] }>()
defineEmits<{ remove: [href: string] }>()
</script>

<template>
  <div v-if="quotes.length" class="moon-quote-preview">
    <div v-for="quote in quotes" :key="quote.href" class="moon-quote-row">
      <BreezemoonQuoteCard :quote="quote" />
      <button type="button" :aria-label="`移除 ${quote.author} 的清风明月引用`" title="移除引用" @click="$emit('remove', quote.href)">×</button>
    </div>
  </div>
</template>

<style scoped>
.moon-quote-preview { display: grid; gap: 5px; }
.moon-quote-row { display: flex; align-items: flex-start; gap: 6px; }
.moon-quote-row :deep(.moon-quote-card) { min-width: 0; }
.moon-quote-row button {
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--fp-muted);
  font-size: 17px;
  cursor: pointer;
}
.moon-quote-row button:hover { background: var(--fp-hover); color: var(--fp-title); }
</style>
