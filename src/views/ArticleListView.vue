<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchArticleFeed, type ArticleFeedKind, type ArticleSummary } from '@/api/fishpi'
import { fetchPublicHome } from '@/api/publicHome'
import { useAuthStore } from '@/stores/auth'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'

const route = useRoute()
const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)

const items = ref<ArticleSummary[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)

const kind = computed(() => (route.meta.list as ArticleFeedKind) || 'recent')
const title = computed(() => (route.meta.title as string) || '帖子')
const keyword = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
const needsLogin = computed(() => !isLoggedIn.value && kind.value !== 'search')

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (isLoggedIn.value && apiKey.value) {
      items.value = await fetchArticleFeed(kind.value, apiKey.value, page.value, 40, keyword.value)
    } else if (kind.value === 'search') {
      const pub = await fetchPublicHome()
      const q = keyword.value.trim().toLowerCase()
      items.value = q
        ? pub.articles.filter((a) => (a.articleTitle || '').toLowerCase().includes(q))
        : pub.articles
    } else {
      items.value = []
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
    items.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [kind.value, keyword.value],
  () => {
    page.value = 1
  },
)

watch(
  () => [kind.value, keyword.value, isLoggedIn.value, page.value],
  () => {
    void load()
  },
  { immediate: true },
)
</script>

<template>
  <section class="card">
    <header>
      <h1>{{ title }}</h1>
      <p v-if="keyword" class="hint">关键词：{{ keyword }}</p>
    </header>
    <p v-if="needsLogin" class="hint">
      现网这份列表需要登录。
      <RouterLink to="/login">去登录</RouterLink>
      后可看完整热门/专栏/问答/优选。
    </p>
    <p v-if="kind === 'qna' || kind === 'perfect'" class="hint">当前从最近帖子中筛选，完整分页接口尚未开放。</p>
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ArticleFeed v-else :items="items" />
    <footer v-if="isLoggedIn && (kind === 'hot' || kind === 'long' || kind === 'recent')" class="pager">
      <button type="button" :disabled="page <= 1" @click="page -= 1">上一页</button>
      <span>{{ page }}</span>
      <button type="button" :disabled="items.length < 20" @click="page += 1">下一页</button>
    </footer>
  </section>
</template>

<style scoped>
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 18px 20px 24px;
}
h1 {
  margin: 0 0 8px;
  font-size: 18px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.hint a {
  color: var(--fp-link);
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
