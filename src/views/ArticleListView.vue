<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchArticleFeed, type ArticleFeedKind, type ArticleSummary } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import SideBar from '@/components/SideBar.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeFeedPayload } from '@/seo/payload'
import { SITE_DEFAULT_DESC } from '@/seo/site'

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
const heading = computed(() => (kind.value === 'tag' ? `#${extra.value}` : title.value))

usePageSeo(() => ({
  title: heading.value,
  description: keyword.value
    ? `搜索「${keyword.value}」相关帖子`
    : `${heading.value} · ${SITE_DEFAULT_DESC}`,
  path: route.path,
  robots: String(route.meta.robots || 'index,follow'),
}))

async function load() {
  error.value = ''
  loading.value = true
  try {
    const cached = page.value === 1 ? consumeFeedPayload(kind.value) : null
    items.value = cached || (await fetchArticleFeed(kind.value, apiKey.value, page.value, 30, extra.value))
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

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function prevPage() {
  if (page.value > 1) {
    page.value -= 1
    scrollToTop()
  }
}

function nextPage() {
  page.value += 1
  scrollToTop()
}
</script>

<template>
  <div class="wrapper list-page-wrap">
    <div class="content">
      <div class="module">
        <div class="module-header list-page-head">
          <div class="head-left">
            <h2>{{ kind === 'tag' ? `#${extra}` : title }}</h2>
            <span v-if="keyword" class="search-tag">关键词：{{ keyword }}</span>
          </div>
          <div class="head-right">
            <span class="total-count">第 {{ page }} 页</span>
          </div>
        </div>

        <p v-if="usingMock" class="mock-hint">
          对应 JSON 接口尚未对游客开放，当前为字段对齐的社区帖子展示。
        </p>
        <p v-if="loading" class="hint">正在加载精彩帖子…</p>
        <p v-else-if="error" class="err">{{ error }}</p>

        <ArticleFeed v-else :items="items" empty="该分类下暂无内容" />

        <!-- 现网分页控件 -->
        <div v-if="paged && (items.length > 0 || page > 1)" class="pagination-bar">
          <button
            type="button"
            class="btn page-btn"
            :disabled="page <= 1"
            @click="prevPage"
          >
            ‹ 上一页
          </button>
          <span class="current-page-num">{{ page }}</span>
          <button
            type="button"
            class="btn page-btn"
            :disabled="items.length < 20"
            @click="nextPage"
          >
            下一页 ›
          </button>
        </div>
      </div>
    </div>

    <!-- 侧边栏：结合本地登录态与现网社区模块 -->
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

.search-tag {
  font-size: 12px;
  color: var(--fp-accent);
  background: var(--fp-hover);
  padding: 2px 8px;
  border-radius: 4px;
}

.total-count {
  font-size: 12px;
  color: var(--fp-muted);
}

.mock-hint {
  padding: 10px 18px;
  margin: 0;
  background: var(--fp-hover);
  color: var(--fp-accent);
  font-size: 12px;
  border-bottom: 1px solid var(--fp-border);
}

.hint {
  padding: 30px 18px;
  text-align: center;
  color: var(--fp-muted);
  font-size: 14px;
}

.err {
  padding: 30px 18px;
  text-align: center;
  color: #e07a5f;
  font-size: 14px;
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

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.current-page-num {
  font-size: 14px;
  font-weight: 600;
  color: var(--fp-title);
  min-width: 24px;
  text-align: center;
}
</style>
