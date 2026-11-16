<script setup lang="ts">
import FpListState from '@/components/FpListState.vue'
import FpPagination from '@/components/FpPagination.vue'
import ListPageHeading from '@/components/articles/ListPageHeading.vue'
import { imageThumbnail } from '@/utils/avatar'
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
  <div class="fp-page fp-page--wide fp-ui fp-list-page">
    <div class="content directory-content" id="directory-list">
      <ListPageHeading
        :title="label + '目录'"
        :count="value ? `共 ${value.total.toLocaleString('zh-CN')} 个${label}` : undefined"
      />
      <button type="button" class="btn refresh-dir-btn fp-control" :disabled="loading" @click="read()">刷新目录</button>
      <FpLoading v-if="loading" :rows="6" />
      <FpListState v-if="error" kind="error" :message="error">
        <template #actions>
          <button class="fp-control" type="button" :disabled="loading" @click="read()">重试当前页</button>
        </template>
      </FpListState>
      <template v-if="value">
        <FpListState v-if="!value.list.length" :message="`本页暂无${label}`" />
        <ul v-if="tags.length" class="tag-grid"><li v-for="tag in tags" :key="tag.tagURI"><RouterLink :to="'/tag/' + tag.tagURI" class="tag-card"><img v-if="tag.tagIconPath" :src="imageThumbnail(tag.tagIconPath, 18, 18)" alt="" /><strong>{{ tag.tagTitle }}</strong><em>{{ tag.tagReferenceCount }}</em></RouterLink></li></ul>
        <FpPagination label="目录分页" :page="p" :page-count="value.pageCount" :busy="loading" @change="page">
          <template v-if="p > value.pageCount && p > 1" #actions>
            <button class="fp-control" type="button" @click="page(1)">返回第一页</button>
          </template>
        </FpPagination>
      </template>
    </div>
    <div class="side"><SideBar /></div>
  </div>
</template>
<style scoped lang="scss">
.refresh-dir-btn {
  display: none;
}

.tag-grid {
  list-style: none;
  margin: 0;
  padding: 16px var(--fp-panel-padding);
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

.directory-content { scroll-margin-top: 80px;  }
</style>
