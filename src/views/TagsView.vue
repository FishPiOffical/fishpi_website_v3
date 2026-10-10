<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchTags, type TagItem } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeTagsPayload } from '@/seo/payload'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'
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
    return `/tags/${encodeURIComponent(decodeURIComponent(uri))}`
  } catch {
    return `/tags/${encodeURIComponent(uri)}`
  }
}
</script>

<template>
  <section class="board">
    <header>
      <h1>标签</h1>
      <span v-if="total" class="hint">共 {{ total }} 个</span>
    </header>
    <FpLoading v-if="loading" />
    <p v-else-if="error" class="err">{{ error }}</p>
    <ul v-else>
      <li v-for="tag in tags" :key="tag.tagURI || tag.tagTitle">
        <RouterLink :to="tagPath(tag)">
          <img v-if="tag.tagIconPath" :src="tag.tagIconPath" alt="" />
          <strong>{{ tag.tagTitle }}</strong>
          <em>{{ tag.tagReferenceCount ?? 0 }}</em>
        </RouterLink>
      </li>
    </ul>
    <footer class="pager">
      <button type="button" :disabled="page <= 1 || loading" @click="page -= 1">上一页</button>
      <span>{{ page }}</span>
      <button type="button" :disabled="tags.length < 50 || loading" @click="page += 1">下一页</button>
    </footer>
  </section>
</template>

<style scoped>
.board {
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border-radius: 10px;
  padding: 15px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}
h1 {
  margin: 0;
  font-size: 16px;
  color: var(--fp-head);
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.err {
  color: #e07a5f;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
a {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: var(--fp-title);
  text-decoration: none;
  border-radius: 6px;
  background: var(--fp-hover);
}
a:hover {
  text-decoration: underline;
}
img {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  object-fit: cover;
}
strong {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
em {
  font-style: normal;
  color: var(--fp-muted);
  font-size: 12px;
}
.pager {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 16px;
}
.pager button {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
}
.pager button:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
