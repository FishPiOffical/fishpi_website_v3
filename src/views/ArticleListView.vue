<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchArticleFeed, fetchHomeColumns, type ArticleFeedKind, type ArticleSummary, type HomeColumnCard } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import SideBar from '@/components/SideBar.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeFeedPayload } from '@/seo/payload'
import { SITE_DEFAULT_DESC, SITE_ORIGIN } from '@/seo/site'
import FpLoading from '@/components/FpLoading.vue'
import { createSwrLoader, writeCache } from '@/utils/swr'
import { articleTitle } from '@/utils/text'

const route = useRoute()
const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)

const items = ref<ArticleSummary[]>([])
const columns = ref<{ recent: HomeColumnCard[]; hot: HomeColumnCard[] }>({ recent: [], hot: [] })
const columnShelf = ref<'recent' | 'hot'>('recent')
const loading = ref(false)
const error = ref('')
const page = ref(1)
const DEFAULT_COLUMN_COVER = `${SITE_ORIGIN}/images/holiday/book-bg.jpg`

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
const isColumnPage = computed(() => kind.value === 'long')
const visibleColumns = computed(() => {
  const source = columns.value[columnShelf.value]
  const articleById = new Map(items.value.map((item) => [item.oId, item]))
  const found = new Set<string>()
  const cards = source.map((column) => {
    found.add(column.columnId)
    const chapter = column.latestChapter?.articleId ? articleById.get(column.latestChapter.articleId) : undefined
    return {
      ...column,
      preview: column.latestChapter?.preview || chapter?.articlePreviewContent || column.latestChapter?.title || '持续更新中',
      latest: column.latestChapter,
      authorName: chapter?.articleAuthorName,
      authorId: chapter?.articleAuthorId,
    }
  })
  const groups = new Map<string, ArticleSummary[]>()
  for (const item of items.value) {
    if (!item.columnId || found.has(item.columnId)) continue
    const group = groups.get(item.columnId) || []
    group.push(item)
    groups.set(item.columnId, group)
  }
  for (const [id, chapters] of groups) {
    const newest = chapters[0]
    cards.push({
      columnId: id,
      columnTitle: newest.columnTitle || `专栏 ${id}`,
      columnArticleCount: chapters.length,
      columnCoverURL: '',
      chapters: chapters.map((chapter) => ({ articleId: chapter.oId, permalink: `/article/${chapter.oId}`, chapterNo: '', title: articleTitle(chapter) })),
      latestChapter: { articleId: newest.oId, permalink: `/article/${newest.oId}`, chapterNo: '', title: articleTitle(newest) },
      preview: newest.articlePreviewContent || articleTitle(newest),
      latest: { articleId: newest.oId, permalink: `/article/${newest.oId}`, chapterNo: '', title: articleTitle(newest) },
      authorName: newest.articleAuthorName,
      authorId: newest.articleAuthorId,
    })
  }
  return cards
})

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
    if (kind.value === 'long') columns.value = await fetchHomeColumns()
    return
  }
  await swr(
    key,
    async () => {
      const [articles, columnData] = await Promise.all([
        fetchArticleFeed(kind.value, apiKey.value, page.value, 30, extra.value),
        kind.value === 'long' ? fetchHomeColumns() : Promise.resolve(null),
      ])
      return { articles, columnData }
    },
    (data) => {
      items.value = data.articles
      if (data.columnData) columns.value = data.columnData
    },
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
        <section v-if="isColumnPage" class="column-intro">
          <div class="column-intro-copy">
            <div class="eyebrow"><span class="eyebrow-dot"></span> FISHPI · STORIES</div>
            <h1>长篇专栏</h1>
            <p>把故事慢慢写完，也把喜欢的章节一页页读下去。</p>
          </div>
          <div class="column-intro-mark" aria-hidden="true"><span>卷</span><i></i><b></b></div>
          <div class="column-intro-footer"><span>专栏集 · {{ visibleColumns.length }} 部作品</span><span>每一次更新，都是故事的新一页</span></div>
        </section>

        <div v-if="!isColumnPage" class="module-header list-page-head">
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

        <div v-if="isColumnPage" class="column-shelf-head">
          <div><strong>正在连载</strong><span>精选最近更新与热门故事</span></div>
          <div class="column-switch" role="tablist" aria-label="专栏排序">
            <button type="button" role="tab" :aria-selected="columnShelf === 'recent'" :class="{ selected: columnShelf === 'recent' }" @click="columnShelf = 'recent'">最近更新</button>
            <button type="button" role="tab" :aria-selected="columnShelf === 'hot'" :class="{ selected: columnShelf === 'hot' }" @click="columnShelf = 'hot'">热门作品</button>
          </div>
        </div>
        <p v-if="usingMock" class="mock-hint">
          对应 JSON 接口尚未对游客开放，当前为字段对齐的社区帖子展示。
        </p>
        <FpLoading v-if="loading" :rows="8" />
        <p v-else-if="error" class="err">{{ error }}</p>

        <div v-else-if="isColumnPage" class="column-grid">
          <article v-for="column in visibleColumns" :key="column.columnId" class="column-card">
            <RouterLink class="column-cover-link" :to="`/column/${column.columnId}`" :aria-label="`阅读《${column.columnTitle}》`">
              <img :src="column.columnCoverURL || DEFAULT_COLUMN_COVER" alt="" loading="lazy">
              <span class="cover-label">{{ columnShelf === 'hot' ? '人气连载' : '持续更新' }}</span>
            </RouterLink>
            <div class="column-card-copy">
              <RouterLink class="column-title" :to="`/column/${column.columnId}`">{{ column.columnTitle }}</RouterLink>
              <p class="column-preview">{{ column.preview }}</p>
              <div class="column-author-row">
                <RouterLink v-if="column.authorName" :to="`/member/${column.authorName}`" class="column-author">{{ column.authorName }}</RouterLink>
                <span v-else class="column-author">摸鱼派作者</span>
                <span class="chapter-count">{{ column.columnArticleCount }} 章</span>
              </div>
              <div class="latest-chapter" v-if="column.latest">
                <span>最近更新</span>
                <RouterLink :to="column.latest.permalink || `/article/${column.latest.articleId}`">{{ column.latest.title }}</RouterLink>
              </div>
              <RouterLink class="read-column" :to="`/column/${column.columnId}`">进入专栏 <span aria-hidden="true">→</span></RouterLink>
            </div>
          </article>
          <p v-if="!visibleColumns.length && !loading" class="column-empty">暂时还没有专栏，稍后再来看看吧。</p>
        </div>
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

.column-intro {
  min-height: 188px;
  margin: 14px 16px 0;
  padding: 26px 30px 18px;
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  color: #fff8ec;
  background: linear-gradient(115deg, #362b25 0%, #594130 54%, #93623d 100%);
  box-shadow: inset 0 1px rgba(255,255,255,.12);
}

.column-intro::before,
.column-intro::after {
  content: '';
  position: absolute;
  border: 1px solid rgba(255, 231, 195, .15);
  border-radius: 50%;
  pointer-events: none;
}

.column-intro::before { width: 320px; height: 320px; right: 20px; top: -180px; }
.column-intro::after { width: 220px; height: 220px; right: 70px; top: -130px; }
.column-intro-copy { position: relative; z-index: 1; }
.eyebrow { display: flex; align-items: center; gap: 8px; color: #e7c7a0; font-size: 10px; letter-spacing: .2em; font-weight: 700; }
.eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: #e6a963; box-shadow: 0 0 12px #e6a963; }
.column-intro h1 { margin: 13px 0 5px; color: #fff8ec; font-size: 30px; line-height: 1.2; letter-spacing: .04em; }
.column-intro-copy p { margin: 0; color: rgba(255,248,236,.72); font-size: 13px; }
.column-intro-mark { position: absolute; right: 70px; top: 17px; width: 108px; height: 108px; display: grid; place-items: center; transform: rotate(8deg); }
.column-intro-mark::before { content: ''; position: absolute; inset: 4px; border: 1px solid rgba(246,219,181,.38); border-radius: 50%; }
.column-intro-mark::after { content: ''; position: absolute; inset: 12px; border: 1px dashed rgba(246,219,181,.3); border-radius: 50%; }
.column-intro-mark span { color: rgba(255,238,211,.88); font-family: serif; font-size: 45px; font-weight: 700; }
.column-intro-mark i,.column-intro-mark b { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: #e8b67a; }
.column-intro-mark i { top: 6px; left: 50%; }.column-intro-mark b { bottom: 7px; right: 18px; }
.column-intro-footer { position: absolute; z-index: 1; left: 30px; right: 30px; bottom: 17px; display: flex; justify-content: space-between; gap: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.16); color: rgba(255,248,236,.66); font-size: 11px; }
.column-shelf-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 23px 20px 17px; }
.column-shelf-head > div:first-child { display: flex; align-items: baseline; gap: 10px; }
.column-shelf-head strong { color: var(--fp-title); font-size: 17px; }
.column-shelf-head span { color: var(--fp-muted); font-size: 12px; }
.column-switch { display: flex; padding: 3px; gap: 3px; border-radius: 9px; background: var(--fp-hover); }
.column-switch button { border: 0; padding: 6px 11px; border-radius: 7px; background: transparent; color: var(--fp-muted); font: inherit; font-size: 12px; cursor: pointer; }
.column-switch button.selected { color: var(--fp-title); background: var(--fp-card); box-shadow: 0 1px 4px rgba(0,0,0,.08); }
.column-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; padding: 0 16px 20px; }
.column-card { min-width: 0; display: grid; grid-template-columns: 112px minmax(0,1fr); gap: 16px; padding: 14px; border: 1px solid var(--fp-border); border-radius: 12px; background: var(--fp-card); transition: border-color .18s ease, transform .18s ease, box-shadow .18s ease; }
.column-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--fp-accent) 40%, var(--fp-border)); box-shadow: 0 8px 24px rgba(60,45,30,.08); }
.column-cover-link { position: relative; display: block; aspect-ratio: 3 / 4; overflow: hidden; border-radius: 7px; background: linear-gradient(145deg,#ead6b6,#b38c61); box-shadow: 0 5px 14px rgba(50,35,20,.17); }
.column-cover-link::after { content: ''; position: absolute; inset: 0; border: 1px solid rgba(255,255,255,.22); border-radius: inherit; }
.column-cover-link img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .25s ease; }
.column-card:hover .column-cover-link img { transform: scale(1.035); }
.cover-label { position: absolute; z-index: 1; left: 6px; bottom: 6px; padding: 3px 6px; border-radius: 4px; color: #fff; background: rgba(43,35,29,.72); font-size: 9px; }
.column-card-copy { min-width: 0; display: flex; flex-direction: column; }
.column-title { color: var(--fp-title); font-size: 16px; font-weight: 700; line-height: 1.4; text-decoration: none; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.column-title:hover,.latest-chapter a:hover { text-decoration: underline; }
.column-preview { margin: 8px 0 10px; min-height: 36px; color: var(--fp-muted); font-size: 12px; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.column-author-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--fp-border); color: var(--fp-muted); font-size: 11px; }
.column-author { color: var(--fp-muted); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.column-author:hover { text-decoration: underline; }
.chapter-count { flex: none; color: var(--fp-accent); }
.latest-chapter { display: flex; align-items: baseline; gap: 7px; min-width: 0; margin-top: 9px; font-size: 11px; }
.latest-chapter > span { flex: none; color: var(--fp-muted); }
.latest-chapter a { color: var(--fp-title); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.read-column { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 11px; color: var(--fp-accent); font-size: 12px; text-decoration: none; }
.read-column:hover { text-decoration: underline; }
.column-empty { grid-column: 1 / -1; margin: 0; padding: 50px 12px; text-align: center; color: var(--fp-muted); }

@media (max-width: 900px) { .column-grid { grid-template-columns: 1fr; } }
@media (max-width: 560px) {
  .column-intro { margin: 10px 10px 0; min-height: 172px; padding: 22px 18px 16px; }
  .column-intro-mark { right: 20px; top: 18px; transform: scale(.76) rotate(8deg); transform-origin: top right; }
  .column-intro h1 { font-size: 25px; }
  .column-intro-footer { left: 18px; right: 18px; font-size: 10px; }
  .column-shelf-head { padding: 18px 12px 13px; align-items: flex-start; flex-direction: column; }
  .column-grid { padding: 0 10px 14px; gap: 10px; }
  .column-card { grid-template-columns: 88px minmax(0,1fr); gap: 12px; padding: 10px; }
  .column-title { font-size: 14px; }
  .column-preview { margin: 5px 0 7px; min-height: 34px; font-size: 11px; }
}
</style>
