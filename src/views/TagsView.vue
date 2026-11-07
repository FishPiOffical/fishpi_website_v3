<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useDirectory } from '@/composables/useDirectory'
import { consumeDirectoryPayload } from '@/seo/payload'
import { usePageSeo } from '@/composables/usePageSeo'
import type { TagItem } from '@/api/fishpi'
import FpLoading from '@/components/FpLoading.vue'
import SideBar from '@/components/SideBar.vue'
const kind = 'tags'
const label = '标签'
usePageSeo(() => ({ title: label, path: '/' + kind, description: '摸鱼派' + label + '目录' }))
const { value, p, loading, error, read } = useDirectory(kind, consumeDirectoryPayload(kind))
const tags = computed(() => value.value?.list as TagItem[] || [])
async function page(next: number) { await read(next, true); document.getElementById('directory-list')?.scrollIntoView({ block: 'start' }) }
</script>

<template>
  <div class="wrapper list-page-wrap fp-page fp-page--wide fp-ui fp-list-page">
    <div class="content directory-content" id="directory-list">
      <div class="module-header list-page-head">
        <div class="head-left"><h1 class="fp-page-title">{{ label }}目录</h1><span v-if="value" class="sub-tag">共 {{ value.total }} 个{{ label }}</span></div>
        <button type="button" class="btn refresh-dir-btn fp-control" :disabled="loading" @click="read()">刷新目录</button>
      </div>
      <FpLoading v-if="loading" :rows="6" />
      <div v-if="error" class="err fp-state" role="alert">{{ error }} <button type="button" class="btn fp-control" @click="read()">重试当前页</button></div>
      <template v-if="value">
        <p v-if="!value.list.length" class="err fp-state">本页暂无{{ label }}</p>
        <ul v-if="tags.length" class="tag-grid"><li v-for="tag in tags" :key="tag.tagURI"><RouterLink :to="'/tag/' + tag.tagURI" class="tag-card"><img v-if="tag.tagIconPath" :src="tag.tagIconPath" alt="" /><strong>{{ tag.tagTitle }}</strong><em>{{ tag.tagReferenceCount }}</em></RouterLink></li></ul>
        <div class="pagination-bar fp-pagination">
          <button type="button" class="btn page-btn fp-control" :disabled="p <= 1" @click="page(p - 1)">‹ 上一页</button>
          <span class="current-page-num">第 {{ p }} 页 / 共 {{ value.pageCount }} 页</span>
          <button type="button" class="btn page-btn fp-control" :disabled="p >= value.pageCount" @click="page(p + 1)">下一页 ›</button>
          <button class="fp-control btn" v-if="p > 1 && p > value.pageCount" type="button"  @click="page(1)">返回第一页</button>
        </div>
      </template>
    </div>
    <div class="side"><SideBar /></div>
  </div>
</template>
<style scoped lang="scss">
.list-page-wrap {
  padding-top: 4px;
}

.list-page-head {
  padding: 12px 18px;
}
.refresh-dir-btn {
  display: none;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-left h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--fp-title);
}

.sub-tag {
  font-size: 12px;
  color: var(--fp-muted);
}

.head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.total-count {
  font-size: 12px;
  color: var(--fp-muted);
}

.err {
  padding: 36px 18px;
  margin: 0;
  text-align: center;
  color: var(--fp-danger, #e07a5f);
  font-size: 14px;
}

.tag-grid {
  list-style: none;
  margin: 0;
  padding: 16px 18px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
}

.tag-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  color: var(--fp-title);
  text-decoration: none;
  border-radius: var(--fp-radius-md, 8px);
  border: 1px solid var(--fp-border);
  background: var(--fp-bg);
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.tag-card:hover {
  border-color: var(--fp-border-strong, var(--fp-border));
  background: var(--fp-hover);
  text-decoration: none;
}

.tag-card img {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: cover;
}

.tag-card strong {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-card em {
  font-style: normal;
  color: var(--fp-muted);
  font-size: 12px;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 18px 0;
  border-top: 1px solid var(--fp-border);
}

.page-btn {
  min-width: 80px;
}

.current-page-num {
  font-size: 14px;
  font-weight: 600;
  color: var(--fp-title);
  min-width: 24px;
  text-align: center;
}
.directory-content { scroll-margin-top: 80px;  }
.pagination-bar { flex-wrap:wrap; }
</style>
