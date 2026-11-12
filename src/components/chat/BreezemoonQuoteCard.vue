<script setup lang="ts">
import type { BreezemoonQuote } from '@/utils/breezemoonQuote'

defineProps<{ quote: BreezemoonQuote }>()
</script>

<template>
  <a class="moon-quote-card" :href="quote.href" target="_blank" rel="noopener noreferrer">
    <span class="moon-quote-source">
      <span>清风明月</span>
      <span aria-hidden="true">·</span>
      <span class="moon-quote-author">{{ quote.author }}</span>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m5 11 6-6M6 5h5v5" />
      </svg>
    </span>
    <span v-if="quote.excerpt" class="moon-quote-excerpt">{{ quote.excerpt }}</span>
  </a>
</template>

<style scoped>
.moon-quote-card {
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
.moon-quote-card:hover { text-decoration: none; }
.moon-quote-card:hover .moon-quote-excerpt { text-decoration: underline; text-underline-offset: 2px; }
.moon-quote-card:focus-visible { outline: 2px solid var(--fp-link); outline-offset: 2px; }
.moon-quote-source {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--fp-muted);
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}
.moon-quote-author { overflow: hidden; text-overflow: ellipsis; }
.moon-quote-source svg { flex: none; width: 16px; height: 16px; margin-inline-start: auto; }
.moon-quote-excerpt {
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
