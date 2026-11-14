<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { ChatQuote } from '@/utils/chatQuote'

defineProps<{ quote: ChatQuote }>()
</script>

<template>
  <component
    :is="quote.kind === 'message' ? RouterLink : 'a'"
    v-bind="quote.kind === 'message'
      ? { to: quote.href }
      : { href: quote.href, target: '_blank', rel: 'noopener noreferrer' }"
    class="chat-quote-card"
    :title="`${quote.kind === 'message' ? '查看原消息' : '查看清风明月'}${quote.author ? ' · ' + quote.author : ''}：${quote.excerpt}`"
  >
    <span class="chat-quote-source">
      <span class="chat-quote-author">{{ quote.author || (quote.kind === 'message' ? '引用消息' : '清风明月') }}</span><span>：</span>
    </span>
    <span class="chat-quote-excerpt">{{ quote.excerpt }}</span>
    <svg class="chat-quote-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m5 11 6-6M6 5h5v5" />
    </svg>
  </component>
</template>

<style scoped>
.chat-quote-card {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 300px;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 7px 9px;
  border: 1px solid var(--fp-border);
  border-inline-start: 2px solid color-mix(in srgb, var(--fp-muted) 65%, transparent);
  border-radius: 7px;
  background: var(--fp-surface-subtle, var(--fp-bg));
  text-align: start;
  text-decoration: none;
  font-size: 12px;
  line-height: 18px;
}
.chat-quote-card:hover { text-decoration: none; border-color: var(--fp-primary); background: var(--fp-hover); }
.chat-quote-card:hover .chat-quote-excerpt { text-decoration: none; }
.chat-quote-card:focus-visible { outline: 2px solid var(--fp-link); outline-offset: 2px; }
.chat-quote-source {
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  max-width: 36%;
  min-width: 0;
  color: var(--fp-muted);
  white-space: nowrap;
}
.chat-quote-author { overflow: hidden; text-overflow: ellipsis; }
.chat-quote-arrow { flex: none; width: 14px; height: 14px; color: var(--fp-muted); margin-inline-start: 3px; }
.chat-quote-excerpt {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--fp-text);
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
