<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchArticleFeed, type ArticleFeedKind, type ArticleSummary } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import SideBar from '@/components/SideBar.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeFeedPayload } from '@/seo/payload'
import { SITE_DEFAULT_DESC } from '@/seo/site'
import FpLoading from '@/components/FpLoading.vue'
import { createSwrLoader, writeCache } from '@/utils/swr'

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
const RECENT_TABS = [
  { to: '/recent', label: '默认' },
  { to: '/recent/hot', label: '热议' },
  { to: '/recent/good', label: '👍 好评' },
  { to: '/recent/reply', label: '最近回帖' },
]
const showRecentTabs = computed(() => RECENT_TABS.some((t) => t.to === route.path))

usePageSeo(() => ({
  title: heading.value,
  description: keyword.value
    ? `搜索「${keyword.value}」相关帖子`
    : `${heading.value} · ${SITE_DEFAULT_DESC}`,
  path: route.path,
  robots: String(route.meta.robots || 'index,follow'),
}))

const swr = createSwrLoader({ loading, error })

async function load() {
  const key = `feed:${kind.value}:${extra.value}:${page.value}`
  const boot = page.value === 1 ? consumeFeedPayload(kind.value) : null
  if (boot) {
    items.value = boot
    writeCache(key, boot)
    return
  }
  await swr(
    key,
    () => fetchArticleFeed(kind.value, apiKey.value, page.value, 30, extra.value),
    (data) => (items.value = data),
  )
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
            <nav v-if="showRecentTabs" class="sort-tabs">
              <RouterLink v-for="t in RECENT_TABS" :key="t.to" :to="t.to" :class="{ current: route.path === t.to }">
                {{ t.label }}
              </RouterLink>
            </nav>
            <span class="total-count">第 {{ page }} 页</span>
          </div>
        </div>

        <p v-if="usingMock" class="mock-hint">
          对应 JSON 接口尚未对游客开放，当前为字段对齐的社区帖子展示。
        </p>
        <FpLoading v-if="loading" :rows="8" />
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

.head-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sort-tabs {
  display: flex;
  gap: 4px;
  font-size: 13px;
}

.sort-tabs a {
  color: var(--fp-muted);
  padding: 2px 6px;
}

.sort-tabs a + a::before {
  content: '/';
  margin-right: 8px;
  color: var(--fp-border);
}

.sort-tabs a.current {
  color: var(--fp-title);
  font-weight: 600;
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
