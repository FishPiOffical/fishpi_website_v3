<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { ChatQuote } from '@/utils/chatQuote'

defineProps<{ quote: ChatQuote }>()
</script>

<template>
  <component
    :is="quote.kind === 'message' ? RouterLink : 'a'"
    v-bind="quote.kind === 'message'
      ? { to: quote.href, title: '查看原消息' }
      : { href: quote.href, target: '_blank', rel: 'noopener noreferrer' }"
    class="chat-quote-card"
  >
    <span class="chat-quote-source">
      <span>{{ quote.kind === 'message' ? '引用消息' : '清风明月' }}</span>
      <template v-if="quote.author">
        <span aria-hidden="true">·</span>
        <span class="chat-quote-author">{{ quote.author }}</span>
      </template>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m5 11 6-6M6 5h5v5" />
      </svg>
    </span>
    <span v-if="quote.excerpt" class="chat-quote-excerpt">{{ quote.excerpt }}</span>
  </component>
</template>

<style scoped>
.chat-quote-card {
  display: block;
  width: 208px;
  max-width: 100%;
  box-sizing: border-box;
  padding: 7px 10px 8px;
  border: 1px solid var(--fp-border);
  border-inline-start: 2px solid color-mix(in srgb, var(--fp-muted) 65%, transparent);
  border-radius: 7px;
  background: var(--fp-surface-subtle, var(--fp-bg));
  text-align: start;
  text-decoration: none;
}
.chat-quote-card:hover { text-decoration: none; border-color: var(--fp-primary); background: var(--fp-hover); }
.chat-quote-card:hover .chat-quote-excerpt { text-decoration: none; }
.chat-quote-card:focus-visible { outline: 2px solid var(--fp-link); outline-offset: 2px; }
.chat-quote-source {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--fp-muted);
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}
.chat-quote-author { overflow: hidden; text-overflow: ellipsis; }
.chat-quote-source svg { flex: none; width: 16px; height: 16px; margin-inline-start: auto; }
.chat-quote-excerpt {
  display: -webkit-box;
  margin-top: 1px;
  overflow: hidden;
  color: var(--fp-text);
  font-size: 13px;
  line-height: 19px;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
