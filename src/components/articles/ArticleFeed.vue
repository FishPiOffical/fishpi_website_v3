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
      <span v-if="item.articleStick" class="cb-stick" />
      <RouterLink v-if="item.articleAuthorName" :to="`/member/${item.articleAuthorName}`">
        <span
          class="avatar-small"
          :style="item.articleAuthorThumbnailURL48 ? { backgroundImage: `url('${item.articleAuthorThumbnailURL48}')` } : undefined"
        />
      </RouterLink>
      <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{ titleOf(item) }}</RouterLink>
      <span class="count">{{ views(item) }}</span>
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
  position: relative;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 15px;
  font-size: 14px;
}
.title {
  flex: 1;
  color: var(--fp-title);
  text-decoration: none;
}
.title:hover {
  color: var(--fp-link);
}
.count {
  color: var(--fp-head);
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
