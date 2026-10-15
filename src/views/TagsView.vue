<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchTags, type TagItem } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeTagsPayload } from '@/seo/payload'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'
import SideBar from '@/components/SideBar.vue'
import { createSwrLoader } from '@/utils/swr'

usePageSeo(() => ({ title: '标签', path: '/tags', description: '摸鱼派标签墙' }))

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const tags = ref<TagItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const error = ref('')

const swr = createSwrLoader({ loading, error })

async function load() {
  await swr(
    `tags:${page.value}`,
    async () => (page.value === 1 && consumeTagsPayload()) || fetchTags(apiKey.value, page.value, 50),
    (data) => {
      tags.value = data.tags
      total.value = data.total
      error.value = data.tags.length ? '' : '暂无标签数据'
    },
    '标签加载失败',
  )
}

watch([apiKey, page], () => void load(), { immediate: true })

function tagPath(tag: TagItem) {
  const uri = tag.tagURI || tag.tagTitle
  try {
    return `/tag/${encodeURIComponent(decodeURIComponent(uri))}`
  } catch {
    return `/tag/${encodeURIComponent(uri)}`
  }
}
</script>

<template>
  <div class="wrapper list-page-wrap">
    <div class="content">
      <div class="module">
        <div class="module-header list-page-head">
          <div class="head-left">
            <h2>标签墙</h2>
            <span v-if="total" class="sub-tag">共 {{ total }} 个标签</span>
          </div>
          <div class="head-right">
            <span class="total-count">第 {{ page }} 页</span>
          </div>
        </div>

        <FpLoading v-if="loading" :rows="6" />
        <p v-else-if="error" class="err">{{ error }}</p>
        <ul v-else class="tag-grid">
          <li v-for="tag in tags" :key="tag.tagURI || tag.tagTitle">
            <RouterLink :to="tagPath(tag)" class="tag-card">
              <img v-if="tag.tagIconPath" :src="tag.tagIconPath" alt="" />
              <strong>{{ tag.tagTitle }}</strong>
              <em>{{ tag.tagReferenceCount ?? 0 }}</em>
            </RouterLink>
          </li>
        </ul>

        <div class="pagination-bar">
          <button type="button" class="btn page-btn" :disabled="page <= 1 || loading" @click="page -= 1">
            ‹ 上一页
          </button>
          <span class="current-page-num">{{ page }}</span>
          <button type="button" class="btn page-btn" :disabled="tags.length < 50 || loading" @click="page += 1">
            下一页 ›
          </button>
        </div>
      </div>
    </div>

    <div class="side">
      <SideBar />
    </div>
  </div>
</template>

<style scoped>
.list-page-wrap {
  padding-top: 4px;
}

.list-page-head {
  padding: 12px 18px;
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
</style>
