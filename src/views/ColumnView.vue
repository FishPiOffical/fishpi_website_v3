<script setup lang="ts">
import { articleTitle } from '@/utils/text'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchArticleFeed,
  fetchHomeColumns,
  type ArticleSummary,
  type HomeColumnCard,
} from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'
import { createSwrLoader } from '@/utils/swr'

const route = useRoute()
const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)

const columnId = computed(() => String(route.params.columnId || ''))
const meta = ref<HomeColumnCard | null>(null)
const chapters = ref<ArticleSummary[]>([])
const loading = ref(true)
const err = ref('')
const usingMock = ref(false)

const title = computed(() => meta.value?.columnTitle || `专栏 ${columnId.value}`)

usePageSeo(() => ({
  title: title.value,
  path: `/column/${columnId.value}`,
  description: `${title.value} · 摸鱼派长篇专栏`,
}))

const swr = createSwrLoader({ loading, error: err })

async function load() {
  const id = columnId.value
  if (!id) return
  await swr(
    `column:${id}`,
    async () => {
      const cols = await fetchHomeColumns()
      const all = [...cols.recent, ...cols.hot]
      let m: HomeColumnCard = all.find((c) => c.columnId === id) || {
        columnId: id,
        columnTitle: `专栏 ${id}`,
        columnArticleCount: 0,
        chapters: [],
        latestChapter: null,
      }
      const longList = await fetchArticleFeed('long', apiKey.value, 1, 50)
      const matched = longList.filter((a) => String(a.columnId || '') === id || a.columnTitle === m.columnTitle)
      const list: ArticleSummary[] = matched.length
        ? matched
        : (m.chapters || []).map((ch, i) => ({
            oId: ch.articleId || `mock-ch-${i}`,
            articleTitle: ch.title,
            articleTitleEmoj: ch.title,
            columnTitle: m.columnTitle,
            columnId: id,
            articleCreateTimeStr: ch.chapterNo,
          }))
      if (!m.columnArticleCount) m = { ...m, columnArticleCount: list.length }
      return { meta: m, chapters: list }
    },
    (data) => {
      meta.value = data.meta
      chapters.value = data.chapters
      usingMock.value = String(data.meta.columnId).startsWith('mock-') || data.meta.columnTitle.includes('假数据')
    },
  )
}

watch(columnId, () => void load(), { immediate: true })
</script>

<template>
  <section class="card">
    <p class="crumb">
      <RouterLink to="/column">专栏列表</RouterLink>
      ·
      <RouterLink to="/">首页</RouterLink>
    </p>
    <header class="head">
      <h1>{{ title }}</h1>
      <span v-if="meta" class="count">{{ meta.columnArticleCount }} 章</span>
    </header>
    <p v-if="usingMock" class="hint">
      专栏详情 JSON 未开放，当前为假数据/长篇列表近似（见 docs/MISSING_APIS.md）。
    </p>
    <FpLoading v-if="loading" />
    <p v-else-if="err" class="err">{{ err }}</p>
    <ol v-else class="chapters">
      <li v-if="!chapters.length" class="hint">暂无章节</li>
      <li v-for="item in chapters" :key="item.oId">
        <RouterLink :to="`/article/${item.oId}`">
          {{ articleTitle(item) }}
        </RouterLink>
        <span>{{ item.articleCreateTimeStr || item.timeAgo || '' }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.card {
  max-width: 800px;
  margin: 0 auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 20px 22px;
}
.crumb {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--fp-muted);
}
.crumb a {
  color: var(--fp-link);
}
.head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}
h1 {
  margin: 0;
  font-size: 22px;
  color: var(--fp-title);
}
.count {
  font-size: 13px;
  color: var(--fp-muted);
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.err {
  color: #e07a5f;
  font-size: 13px;
}
.chapters {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
}
.chapters li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--fp-border);
  font-size: 14px;
}
.chapters a {
  color: var(--fp-link);
  text-decoration: none;
}
.chapters span {
  color: var(--fp-muted);
  font-size: 12px;
  flex-shrink: 0;
}
</style>
