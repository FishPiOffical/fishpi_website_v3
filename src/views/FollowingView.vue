<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchFollowingArticles, type ArticleSummary } from '@/api/fishpi'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'

usePageSeo(() => ({
  title: '关注动态',
  path: '/following',
  robots: 'noindex',
}))

const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)
const items = ref<ArticleSummary[]>([])
const page = ref(1)
const loading = ref(false)
const error = ref('')

async function load() {
  if (!apiKey.value) {
    items.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchFollowingArticles(apiKey.value, page.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
    items.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [apiKey.value, page.value],
  () => void load(),
  { immediate: true },
)
</script>

<template>
  <section class="card">
    <h1>关注动态</h1>
    <p class="hint">来自 <code>GET /api/user/following/articles</code>，展示你关注的人最近发帖。</p>
    <p v-if="!isLoggedIn" class="hint">
      <RouterLink :to="{ path: '/login', query: { redirect: '/following' } }">登录</RouterLink>
      后可查看。
    </p>
    <p v-else-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ArticleFeed v-else :items="items" empty="关注的人还没有新帖" />
    <footer v-if="isLoggedIn" class="pager">
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
  padding: 18px 20px;
}
h1 {
  margin: 0 0 8px;
  font-size: 18px;
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
  margin-top: 16px;
  align-items: center;
}
.pager button {
  border: 1px solid var(--fp-border);
  background: var(--fp-bg);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
}
a {
  color: var(--fp-link);
}
</style>
