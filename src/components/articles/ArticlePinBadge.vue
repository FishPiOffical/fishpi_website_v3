<script setup lang="ts">
import { computed } from 'vue'
import { articlePinKind, type PinnableArticle } from '@/utils/articlePin'

const props = defineProps<{ article: PinnableArticle }>()
const kind = computed(() => articlePinKind(props.article))
const label = computed(() => kind.value === 'permanent' ? '永久置顶' : kind.value === 'temporary' ? '限时置顶' : '置顶')
</script>

<template>
  <span v-if="kind" class="article-pin-badge" :data-pin="kind">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M16 3 21 8 17 9 13 13 13 17 7 11 11 11 15 7Z" />
      <path d="m10 14-6 6" />
    </svg>
    {{ label }}
  </span>
</template>

<style scoped>
.article-pin-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: 0 0 auto;
  padding: 1px 5px;
  border: 1px solid color-mix(in srgb, var(--fp-primary) 24%, transparent);
  border-radius: 5px;
  background: var(--fp-primary-soft);
  color: var(--fp-primary-ink, var(--fp-primary));
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  vertical-align: middle;
}
.article-pin-badge[data-pin="permanent"] {
  border-color: color-mix(in srgb, var(--fp-accent) 28%, transparent);
  background: var(--fp-accent-soft);
  color: color-mix(in srgb, var(--fp-accent) 58%, var(--fp-title));
}
.article-pin-badge svg { width: 12px; height: 12px; flex: 0 0 auto; }
.article-pin-badge[data-pin="permanent"] svg { fill: currentColor; }
</style>
