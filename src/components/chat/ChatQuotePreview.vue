<script setup lang="ts">
import ChatQuoteCard from './ChatQuoteCard.vue'
import type { ChatQuote } from '@/utils/chatQuote'

defineProps<{ quotes: ChatQuote[] }>()
defineEmits<{ remove: [href: string] }>()
</script>

<template>
  <div v-if="quotes.length" class="chat-quote-preview">
    <div v-for="quote in quotes" :key="quote.href" class="chat-quote-row">
      <ChatQuoteCard :quote="quote" />
      <button type="button" :aria-label="quote.kind === 'message' ? '移除消息引用' : `移除 ${quote.author} 的清风明月引用`" title="移除引用" @click="$emit('remove', quote.href)">×</button>
    </div>
  </div>
</template>

<style scoped>
.chat-quote-preview { display: grid; grid-template-columns: minmax(0, 1fr); gap: 5px; min-width: 0; }
.chat-quote-row { display: flex; align-items: flex-start; gap: 6px; min-width: 0; }
.chat-quote-row :deep(.chat-quote-card) { min-width: 0; }
.chat-quote-row button {
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
.chat-quote-row button:hover { background: var(--fp-hover); color: var(--fp-title); }
</style>
