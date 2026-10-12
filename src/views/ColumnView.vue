<script setup lang="ts">
import { articleTitle } from '@/utils/text'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchArticle,
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
const firstChapter = computed(() => chapters.value[chapters.value.length - 1] || chapters.value[0] || null)
const latestChapter = computed(() => chapters.value[0] || null)
const author = computed(() => latestChapter.value?.articleAuthorName || '')
const synopsis = computed(() => latestChapter.value?.articlePreviewContent || firstChapter.value?.articlePreviewContent || '一段正在展开的故事，欢迎从第一章开始阅读。')

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
      let list: ArticleSummary[] = matched.length
        ? matched
        : (m.chapters || []).map((ch, i) => ({
            oId: ch.articleId || `mock-ch-${i}`,
            articleTitle: ch.title,
            articleTitleEmoj: ch.title,
            columnTitle: m.columnTitle,
            columnId: id,
            articleCreateTimeStr: ch.chapterNo,
          }))

      // 专栏卡片接口只附带最新两章；文章详情的 longArticleColumnView 才包含完整目录。
      const latestArticleId = m.latestChapter?.articleId || matched[0]?.oId
      if (latestArticleId) {
        try {
          const detail = await fetchArticle(latestArticleId, apiKey.value)
          const columnView = detail.longArticleColumnView
          if (columnView?.column.oId === id && columnView.chapters.length) {
            const summaries = new Map(matched.map((item) => [item.oId, item]))
            list = [...columnView.chapters]
              .sort((a, b) => b.chapterNo - a.chapterNo)
              .map((chapter) => {
                const existing = summaries.get(chapter.articleId)
                return {
                  ...existing,
                  oId: chapter.articleId,
                  articleTitle: chapter.articleTitle,
                  articleTitleEmoj: chapter.articleTitleEmoj || chapter.articleTitle,
                  columnTitle: columnView.column.columnTitle,
                  columnId: columnView.column.oId,
                  articleCreateTimeStr: chapter.articleCreateTime || existing?.articleCreateTimeStr,
                  articlePreviewContent: chapter.articlePreviewContent || existing?.articlePreviewContent,
                }
              })
            m = {
              ...m,
              columnId: columnView.column.oId,
              columnTitle: columnView.column.columnTitle,
              columnArticleCount: columnView.column.columnArticleCount || columnView.chapters.length,
              columnCoverURL: columnView.column.columnCoverURL || m.columnCoverURL,
            }
          }
        } catch {
          // 文章详情不可用时保留专栏卡片/长篇列表中的可用章节。
        }
      }
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
  <main class="column-page">
    <p class="crumb"><RouterLink to="/column">长篇专栏</RouterLink><span>/</span>{{ title }}</p>
    <FpLoading v-if="loading" />
    <p v-else-if="err" class="err">{{ err }}</p>
    <template v-else>
      <section class="book-hero">
        <div class="cover-wrap"><img :src="meta?.columnCoverURL || '/images/holiday/book-bg.jpg'" alt="" class="book-cover"><span class="cover-shine"></span></div>
        <div class="book-info">
          <div class="book-kicker"><span>摸鱼派 · 长篇专栏</span><span class="ongoing"><i></i> 专栏作品</span></div>
          <h1>{{ title }}</h1>
          <div class="book-byline"><RouterLink v-if="author" :to="`/member/${author}`">{{ author }}</RouterLink><span v-else>社区创作</span><i>·</i><span>{{ meta?.columnArticleCount || chapters.length }} 章</span></div>
          <p class="synopsis">{{ synopsis }}</p>
          <div class="book-actions">
            <RouterLink v-if="firstChapter" class="primary-action" :to="`/article/${firstChapter.oId}`">开始阅读 <span>→</span></RouterLink>
            <RouterLink v-if="latestChapter && latestChapter.oId !== firstChapter?.oId" class="secondary-action" :to="`/article/${latestChapter.oId}`">阅读最新章</RouterLink>
          </div>
          <div class="book-facts"><span><b>{{ meta?.columnArticleCount || chapters.length }}</b> 章节</span><span><b>{{ chapters.length }}</b> 章目录</span><span v-if="latestChapter?.timeAgo"><b>{{ latestChapter.timeAgo }}</b> 最近更新</span></div>
        </div>
        <div class="hero-stamp" aria-hidden="true"><span>连载</span><i>Pi</i></div>
      </section>

      <p v-if="usingMock" class="hint">专栏详情 JSON 暂未开放，章节目录由长篇文章列表整理展示。</p>

      <div class="column-body">
        <section class="chapter-panel">
          <header class="chapter-heading"><div><span class="section-kicker">CONTENTS</span><h2>章节目录</h2></div><span>{{ chapters.length }} 条记录</span></header>
          <ol class="chapters">
            <li v-if="!chapters.length" class="empty">暂无章节</li>
            <li v-for="(item, index) in chapters" :key="item.oId">
              <span class="chapter-index">{{ String(chapters.length - index).padStart(2, '0') }}</span>
              <RouterLink :to="`/article/${item.oId}`">{{ articleTitle(item) }}</RouterLink>
              <span class="chapter-time">{{ item.timeAgo || item.articleCreateTimeStr || '' }}</span>
              <span class="chapter-arrow" aria-hidden="true">›</span>
            </li>
          </ol>
        </section>
        <aside class="column-aside">
          <div class="aside-card">
            <span class="section-kicker">ABOUT THIS COLUMN</span><h3>关于本专栏</h3>
            <p>沿着章节顺序阅读，跟随作者一起把故事写下去。</p>
            <div class="aside-rule"></div>
            <div class="aside-stat"><span>专栏章节</span><b>{{ meta?.columnArticleCount || chapters.length }}</b></div>
            <div class="aside-stat"><span>当前收录</span><b>{{ chapters.length }}</b></div>
            <RouterLink to="/column" class="back-catalog">浏览更多专栏 <span>→</span></RouterLink>
          </div>
        </aside>
      </div>
    </template>
  </main>
</template>

<style scoped>
.column-page { max-width: 1120px; margin: 0 auto; padding: 8px 0 30px; }
.crumb { display: flex; align-items: center; gap: 9px; margin: 4px 0 15px; color: var(--fp-muted); font-size: 12px; }
.crumb a { color: var(--fp-muted); text-decoration: none; }
.crumb a:hover { text-decoration: underline; }
.book-hero { position: relative; display: grid; grid-template-columns: 172px minmax(0,1fr); gap: 28px; overflow: hidden; padding: 30px; border: 1px solid var(--fp-border); border-radius: 16px; color: var(--fp-title); background: linear-gradient(115deg,color-mix(in srgb,var(--fp-card) 92%,#ecdcc4),var(--fp-card) 62%); box-shadow: 0 8px 26px rgba(62,45,28,.07); }
.book-hero::after { content: ''; position: absolute; width: 310px; height: 310px; border: 1px solid color-mix(in srgb,var(--fp-accent) 10%,transparent); border-radius: 50%; right: -75px; top: -195px; pointer-events: none; }
.cover-wrap { position: relative; align-self: start; aspect-ratio: 3/4; overflow: hidden; border-radius: 9px; background: #d1b38b; box-shadow: 0 12px 28px rgba(40,28,18,.24),0 0 0 5px rgba(255,255,255,.45); }
.book-cover { display: block; width: 100%; height: 100%; object-fit: cover; }
.cover-shine { position: absolute; inset: 0; background: linear-gradient(105deg,rgba(255,255,255,.16),transparent 37%,transparent); pointer-events: none; }
.book-info { z-index: 1; min-width: 0; display: flex; flex-direction: column; }
.book-kicker { display: flex; align-items: center; gap: 13px; color: var(--fp-muted); font-size: 11px; letter-spacing: .04em; }
.ongoing { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 999px; color: #56895f; background: rgba(88,154,94,.1); letter-spacing: 0; }
.ongoing i { width: 6px; height: 6px; border-radius: 50%; background: #68ad6e; }
.book-info h1 { margin: 12px 0 7px; color: var(--fp-title); font-size: clamp(24px,3vw,34px); line-height: 1.25; letter-spacing: .01em; }
.book-byline { display: flex; align-items: center; gap: 9px; color: var(--fp-muted); font-size: 13px; }
.book-byline a { color: var(--fp-accent); text-decoration: none; }.book-byline a:hover { text-decoration: underline; }.book-byline i { color: var(--fp-border); font-style: normal; }
.synopsis { max-width: 690px; margin: 19px 0 16px; color: var(--fp-muted); font-size: 14px; line-height: 1.8; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.book-actions { display: flex; align-items: center; gap: 10px; }
.primary-action,.secondary-action { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 12px; padding: 0 16px; border-radius: 7px; font-size: 13px; text-decoration: none; }
.primary-action { color: #fff; background: var(--fp-accent); box-shadow: 0 4px 12px color-mix(in srgb,var(--fp-accent) 25%,transparent); }.primary-action:hover { filter: brightness(1.05); }.primary-action span { font-size: 17px; line-height: 1; }
.secondary-action { color: var(--fp-title); background: var(--fp-hover); }.static-action { cursor: default; }
.book-facts { display: flex; flex-wrap: wrap; gap: 22px; margin-top: auto; padding-top: 16px; color: var(--fp-muted); font-size: 11px; }
.book-facts span { display: flex; align-items: baseline; gap: 5px; }.book-facts b { color: var(--fp-title); font-size: 13px; font-weight: 600; }
.hero-stamp { position: absolute; right: 30px; top: 25px; width: 58px; height: 58px; border: 1px solid color-mix(in srgb,var(--fp-accent) 25%,transparent); border-radius: 50%; display: grid; place-items: center; color: color-mix(in srgb,var(--fp-accent) 55%,var(--fp-muted)); transform: rotate(12deg); opacity: .75; }
.hero-stamp::before { content: ''; position: absolute; inset: 4px; border: 1px dashed currentColor; border-radius: inherit; }.hero-stamp span { position: absolute; top: 9px; font-family: serif; font-size: 9px; }.hero-stamp i { margin-top: 15px; font: 700 18px Georgia,serif; }
.column-body { display: grid; grid-template-columns: minmax(0,1fr) 250px; gap: 18px; align-items: start; margin-top: 18px; }
.chapter-panel,.aside-card { border: 1px solid var(--fp-border); border-radius: 12px; background: var(--fp-card); }.chapter-panel { overflow: hidden; }
.chapter-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 19px 22px 15px; border-bottom: 1px solid var(--fp-border); }
.section-kicker { color: var(--fp-accent); font-size: 9px; font-weight: 700; letter-spacing: .18em; }.chapter-heading h2 { margin: 4px 0 0; color: var(--fp-title); font-size: 17px; }.chapter-heading>span { color: var(--fp-muted); font-size: 11px; }
.chapters { list-style: none; padding: 0; margin: 0; }.chapters li { min-height: 49px; display: grid; grid-template-columns: 35px minmax(0,1fr) auto 16px; align-items: center; gap: 12px; padding: 0 20px; border-bottom: 1px solid color-mix(in srgb,var(--fp-border) 70%,transparent); }.chapters li:last-child { border-bottom: 0; }
.chapter-index { color: #b9a88f; font-family: Georgia,serif; font-size: 11px; }.chapters a { min-width: 0; overflow: hidden; color: var(--fp-title); text-decoration: none; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }.chapters a:hover { text-decoration: underline; }
.chapter-time { color: var(--fp-muted); font-size: 10px; white-space: nowrap; }.chapter-arrow { color: var(--fp-border); font-size: 20px; }.chapters .empty { display: block; padding: 35px; color: var(--fp-muted); text-align: center; }
.aside-card { padding: 20px; }.aside-card h3 { margin: 7px 0 8px; color: var(--fp-title); font-size: 16px; }.aside-card p { margin: 0; color: var(--fp-muted); font-size: 12px; line-height: 1.7; }
.aside-rule { margin: 16px 0 12px; border-top: 1px solid var(--fp-border); }.aside-stat { display: flex; justify-content: space-between; padding: 7px 0; color: var(--fp-muted); font-size: 11px; }.aside-stat b { color: var(--fp-title); font-size: 12px; }
.back-catalog { display: flex; justify-content: space-between; margin-top: 15px; padding-top: 13px; border-top: 1px solid var(--fp-border); color: var(--fp-accent); font-size: 12px; text-decoration: none; }.back-catalog:hover { text-decoration: underline; }
.hint { margin: 10px 2px; color: var(--fp-muted); font-size: 11px; }.err { padding: 30px 18px; color: #e07a5f; font-size: 13px; }
@media (max-width:900px) { .column-page { padding-right: 12px; padding-left: 12px; }.column-body { grid-template-columns: 1fr; }.column-aside { display: none; } }
@media (max-width:560px) { .book-hero { grid-template-columns: 94px minmax(0,1fr); gap: 16px; padding: 18px 14px; }.hero-stamp { display: none; }.book-kicker { flex-wrap: wrap; gap: 7px; font-size: 10px; }.book-info h1 { margin-top: 8px; font-size: 20px; }.book-byline { font-size: 11px; }.synopsis { grid-column: 1/-1; margin: 12px 0; font-size: 12px; }.book-actions { flex-wrap: wrap; }.primary-action,.secondary-action { min-height: 34px; padding: 0 11px; font-size: 11px; }.book-facts { grid-column: 1/-1; gap: 11px; padding-top: 12px; font-size: 9px; }.book-facts b { font-size: 11px; }.chapter-heading { padding: 15px; }.chapters li { min-height: 45px; grid-template-columns: 24px minmax(0,1fr) auto 9px; gap: 7px; padding: 0 12px; }.chapters a { font-size: 12px; }.chapter-time { font-size: 9px; } }
</style>
