<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { fetchCollectedArticles, type ArticleSummary } from '@/api/fishpi'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const items = ref<ArticleSummary[]>([])
const page = ref(1)
const loading = ref(false)
const error = ref('')
const usingMock = computed(() => items.value.some((a) => String(a.oId).startsWith('mock-')))

async function load() {
  if (!apiKey.value) return
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchCollectedArticles(apiKey.value, page.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '收藏加载失败'
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
    <h1>我的收藏</h1>
    <p v-if="usingMock" class="hint">收藏列表接口返回异常数据，请稍后重试。</p>
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ArticleFeed v-else :items="items" empty="还没有收藏" />
    <footer class="pager">
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
  margin: 0 0 12px;
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
  background: transparent;
  color: var(--fp-text);
  border-radius: 8px;
  padding: 4px 12px;
  cursor: pointer;
}
</style>
