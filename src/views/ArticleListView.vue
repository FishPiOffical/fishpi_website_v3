<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchArticleFeed, type ArticleFeedKind, type ArticleSummary } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'

const route = useRoute()
const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)

const items = ref<ArticleSummary[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)

const kind = computed(() => (route.meta.list as ArticleFeedKind) || 'recent')
const title = computed(() => (route.meta.title as string) || '帖子')
const keyword = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
const domainUri = computed(() => String(route.params.uri || ''))
const extra = computed(() => {
  if (kind.value === 'domain') return domainUri.value
  if (kind.value === 'tag') return String(route.params.tag || '')
  return keyword.value
})
const usingMock = computed(() => items.value.some((a) => String(a.oId).startsWith('mock-')))
const paged = computed(() => true)

async function load() {
  error.value = ''
  loading.value = true
  try {
    items.value = await fetchArticleFeed(kind.value, apiKey.value, page.value, 40, extra.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
    items.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [kind.value, extra.value],
  () => {
    page.value = 1
  },
)

watch(
  () => [kind.value, extra.value, apiKey.value, page.value],
  () => {
    void load()
  },
  { immediate: true },
)
</script>

<template>
  <section class="board">
    <header>
      <h1>{{ kind === 'tag' ? `#${extra}` : title }}</h1>
      <p v-if="keyword" class="hint">关键词：{{ keyword }}</p>
    </header>
    <p v-if="usingMock" class="hint">
      对应 JSON 接口尚未对游客开放或仍为 404，当前为字段对齐的 mock。
    </p>
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ArticleFeed v-else :items="items" />
    <footer v-if="paged" class="pager">
      <button type="button" :disabled="page <= 1" @click="page -= 1">上一页</button>
      <span>{{ page }}</span>
      <button type="button" :disabled="items.length < 20" @click="page += 1">下一页</button>
    </footer>
  </section>
</template>

<style scoped>
.board {
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border-radius: 10px;
  padding: 15px 0 20px;
}
h1 {
  margin: 0 15px 8px;
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
  border-radius: 8px;
  padding: 4px 12px;
  cursor: pointer;
}
</style>
