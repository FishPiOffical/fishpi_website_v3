<script setup lang="ts">
import ListPageHeading from '@/components/articles/ListPageHeading.vue'
import { imageThumbnail } from '@/utils/avatar'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useDirectory } from '@/composables/useDirectory'
import { consumeDirectoryPayload } from '@/seo/payload'
import { usePageSeo } from '@/composables/usePageSeo'
import type { DomainItem } from '@/api/fishpi'
import FpLoading from '@/components/FpLoading.vue'
import SideBar from '@/components/SideBar.vue'
const kind = 'domains'
const label = '领域'
usePageSeo(() => ({ title: label, path: '/' + kind, description: '摸鱼派' + label + '目录' }))
const { value, p, loading, error, read } = useDirectory(kind, consumeDirectoryPayload(kind))
const domains = computed(() => value.value?.list as DomainItem[] || [])
async function page(next: number) { await read(next, true); document.getElementById('directory-list')?.scrollIntoView({ block: 'start' }) }
</script>

<template>
  <div class="fp-page fp-page--wide fp-ui fp-list-page">
    <div class="content directory-content" id="directory-list">
      <ListPageHeading
        :title="label + '目录'"
        :count="value ? `共 ${value.total.toLocaleString('zh-CN')} 个${label}` : undefined"
      />
      <button type="button" class="btn refresh-dir-btn fp-control" :disabled="loading" @click="read()">刷新目录</button>
      <FpLoading v-if="loading" :rows="6" />
      <div v-if="error" class="err fp-state" role="alert">{{ error }} <button type="button" class="btn fp-control" @click="read()">重试当前页</button></div>
      <template v-if="value">
        <p v-if="!value.list.length" class="err fp-state">本页暂无{{ label }}</p>
        <ul v-if="domains.length" class="domain-list"><li v-for="item in domains" :key="item.uri"><RouterLink :to="'/domain/' + item.uri" class="domain-item"><img v-if="item.domainIconPath" :src="imageThumbnail(item.domainIconPath, 40, 40)" alt="" /><span v-else class="domain-fallback">{{ (item.domainTitle || '域').slice(0, 1) }}</span><div class="domain-info"><strong>{{ item.domainTitle }}</strong><span v-if="item.domainDescription">{{ item.domainDescription }}</span></div></RouterLink></li></ul>
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
.refresh-dir-btn {
  display: none;
}

.err {
  padding: 36px 18px;
  margin: 0;
  text-align: center;
  color: var(--fp-danger, #e07a5f);
  font-size: 14px;
}

.domain-list {
  list-style: none;
  padding: 16px var(--fp-panel-padding);
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.domain-item {
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  text-decoration: none;
  padding: 12px 14px;
  border-radius: var(--fp-radius-md, 8px);
  border: 1px solid var(--fp-border);
  background: var(--fp-bg);
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.domain-item:hover {
  border-color: var(--fp-border-strong, var(--fp-border));
  background: var(--fp-hover);
  text-decoration: none;
}

.domain-item img,
.domain-fallback {
  width: 40px;
  height: 40px;
  border-radius: var(--fp-radius-sm, 6px);
  object-fit: cover;
  flex-shrink: 0;
}

.domain-fallback {
  display: grid;
  place-items: center;
  background: var(--fp-hover);
  color: var(--fp-primary);
  font-weight: 600;
  font-size: 16px;
}

.domain-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.domain-info strong {
  color: var(--fp-title);
  font-size: 14px;
}

.domain-info span {
  color: var(--fp-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.domain-count {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--fp-hover);
  color: var(--fp-muted);
  font-size: 11px;
  font-style: normal;
}

@media (max-width: 700px) {
  .domain-list {
    grid-template-columns: 1fr;
  }
}
.pagination-bar { display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:16px; padding:18px 0; }
.directory-content { scroll-margin-top: 80px;  }
.pagination-bar { flex-wrap:wrap; }
</style>
