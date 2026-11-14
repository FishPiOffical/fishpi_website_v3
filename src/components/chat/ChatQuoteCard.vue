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
  width: fit-content;
  max-width: min(240px, 100%);
  min-width: 0;
  box-sizing: border-box;
  padding: 3px 7px;
  border: 0;
  border-inline-start: 2px solid color-mix(in srgb, var(--fp-muted) 35%, transparent);
  border-radius: 0 4px 4px 0;
  background: transparent;
  color: var(--fp-muted);
  text-align: start;
  text-decoration: none;
  font-size: 12px;
  line-height: 18px;
}
.chat-quote-card:hover { text-decoration: none; color: var(--fp-muted); background: var(--fp-hover); }
.chat-quote-card:hover .chat-quote-excerpt { text-decoration: none; }
.chat-quote-card:focus-visible { outline: 2px solid var(--fp-link); outline-offset: 2px; }
.chat-quote-source {
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  max-width: 80px;
  min-width: 0;
  color: var(--fp-muted);
  white-space: nowrap;
}
.chat-quote-author { overflow: hidden; text-overflow: ellipsis; }
.chat-quote-arrow { flex: none; width: 12px; height: 12px; color: inherit; opacity: .55; margin-inline-start: 2px; }
.chat-quote-card:is(:hover, :focus-visible) .chat-quote-arrow { opacity: 1; }
.chat-quote-excerpt {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: inherit;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
