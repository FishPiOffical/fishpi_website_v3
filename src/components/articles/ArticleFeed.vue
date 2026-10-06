<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { ArticleSummary } from '@/api/fishpi'

const props = defineProps<{
  items: ArticleSummary[]
  empty?: string
}>()

const rows = computed(() => props.items)

function titleOf(a: ArticleSummary) {
  return a.articleTitleEmoj || a.articleTitle
}

function views(a: ArticleSummary) {
  return a.articleViewCntDisplayFormat || a.articleViewCount || ''
}
</script>

<template>
  <ol class="feed">
    <li v-if="!rows.length" class="empty">{{ empty || '暂无帖子' }}</li>
    <li v-for="item in rows" :key="item.oId">
      <span v-if="item.articleStick" class="pin" />
      <span v-if="item.articleType === 5" class="tag">问</span>
      <span v-if="Number(item.articlePerfect) === 1" class="tag perfect">优</span>
      <RouterLink :to="`/article/${item.oId}`">{{ titleOf(item) }}</RouterLink>
      <em>{{ item.articleAuthorName }}</em>
      <em>{{ views(item) }}</em>
    </li>
  </ol>
</template>

<style scoped>
.feed {
  list-style: none;
  margin: 0;
  padding: 0;
}
.feed li {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid var(--fp-border);
  font-size: 14px;
}
.feed a {
  flex: 1;
  color: var(--fp-text);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.feed em {
  color: var(--fp-muted);
  font-style: normal;
  font-size: 12px;
}
.empty {
  color: var(--fp-muted);
  border: 0 !important;
}
.pin {
  width: 0;
  height: 0;
  border: 6px solid #999;
  border-right-color: transparent;
  border-bottom-color: transparent;
}
.tag {
  font-size: 11px;
  color: var(--fp-primary);
  border: 1px solid var(--fp-primary);
  border-radius: 4px;
  padding: 0 4px;
}
.tag.perfect {
  color: #d4a017;
  border-color: #d4a017;
}
</style>
