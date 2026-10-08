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

async function load() {
  if (!columnId.value) return
  loading.value = true
  err.value = ''
  usingMock.value = false
  try {
    const cols = await fetchHomeColumns()
    const all = [...cols.recent, ...cols.hot]
    meta.value = all.find((c) => c.columnId === columnId.value) || {
      columnId: columnId.value,
      columnTitle: `专栏 ${columnId.value}`,
      columnArticleCount: 0,
      chapters: [],
      latestChapter: null,
    }
    usingMock.value = String(meta.value.columnId).startsWith('mock-') || meta.value.columnTitle.includes('假数据')

    const longList = await fetchArticleFeed('long', apiKey.value, 1, 50)
    const matched = longList.filter(
      (a) => String(a.columnId || '') === columnId.value || a.columnTitle === meta.value?.columnTitle,
    )
    chapters.value = matched.length
      ? matched
      : (meta.value.chapters || []).map((ch, i) => ({
          oId: ch.articleId || `mock-ch-${i}`,
          articleTitle: ch.title,
          articleTitleEmoj: ch.title,
          columnTitle: meta.value?.columnTitle,
          columnId: columnId.value,
          articleCreateTimeStr: ch.chapterNo,
        }))
    if (meta.value && !meta.value.columnArticleCount) {
      meta.value = { ...meta.value, columnArticleCount: chapters.value.length }
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : '加载失败'
    chapters.value = []
  } finally {
    loading.value = false
  }
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
    <p v-if="loading" class="hint">加载中…</p>
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
