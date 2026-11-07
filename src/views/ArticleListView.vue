<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { ArticleFeedKind } from '@/api/fishpi'
import type { ColumnOrder } from '@/api/v3-article-list'
import ContentRelationButton from '@/components/articles/ContentRelationButton.vue'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import SideBar from '@/components/SideBar.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { useArticleListing } from '@/composables/useArticleListing'
import { consumeArticleListingPayload } from '@/seo/payload'
import { SITE_DEFAULT_DESC } from '@/seo/site'
import FpLoading from '@/components/FpLoading.vue'
import { formatDate } from '@/utils/time'
import { decodeEntities } from '@/utils/text'
const route = useRoute()
const kind = computed(() => (route.meta.list as ArticleFeedKind) || 'recent')
const title = computed(() => String(route.meta.title || '帖子'))
const keyword = computed(() => typeof route.query.q === 'string' ? route.query.q : '')
// Vue Router already decoded path parameters. API resolution performs its own single encoding.
const extra = computed(() => kind.value === 'domain' ? String(route.params.uri || '') : kind.value === 'tag' ? String(route.params.tag || '') : kind.value === 'search' ? keyword.value : '')
const columnShelf = ref<ColumnOrder>('recent')
const { value, p, loading, error, read } = useArticleListing(kind, extra, columnShelf, consumeArticleListingPayload(kind.value, extra.value, columnShelf.value))
const items = computed(() => value.value?.resource === 'articles' ? value.value.list : [])
const columns = computed(() => value.value?.resource === 'columns' ? value.value.list : [])
const listingNote=computed(()=>kind.value==='hot'?'按近月回帖排序，发布时间较早的文章也可能上榜。':kind.value==='perfect'?'这里汇集站点收录的优选文章，按发布时间展示；热门反映讨论，优选用于内容精选。':'')
const isColumnPage = computed(() => kind.value === 'long')
const heading = computed(() => kind.value === 'tag' ? `#${extra.value}` : title.value)
const RECENT_TABS = [{ to: '/recent', label: '默认' }, { to: '/recent/hot', label: '热议' }, { to: '/recent/good', label: '👍 好评' }, { to: '/recent/reply', label: '最近回帖' }]
const showRecentTabs = computed(() => RECENT_TABS.some(tab => tab.to === route.path))
const failedCovers = ref(new Set<string>()), panel = ref<HTMLElement | null>(null)
let lastPage = 1
watch(value, data => {
  failedCovers.value = new Set()
  if (!data) return
  const moved = lastPage !== data.p; lastPage = data.p
  if (moved) void nextTick(() => { if (value.value === data) panel.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) })
})
watch(error, message => { if (message) void nextTick(() => { if (error.value === message) panel.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) }) })
usePageSeo(() => ({ title: heading.value, description: kind.value === 'search' && keyword.value ? `搜索「${keyword.value}」相关帖子` : `${heading.value} · ${SITE_DEFAULT_DESC}`, path: route.path, robots: String(route.meta.robots || 'index,follow') }))
</script>

<template>
  <div :data-public-content="value ? 'ready' : undefined" class="wrapper list-page-wrap fp-page fp-page--wide fp-ui fp-list-page">
    <div class="content">
      <div ref="panel" class="list-content">
        <section v-if="isColumnPage" class="column-intro">
          <div class="column-intro-copy"><div class="eyebrow"><span class="eyebrow-dot"></span> FISHPI · STORIES</div><h1>长篇专栏</h1><p>把故事慢慢写完，也把喜欢的章节一页页读下去。</p></div>
          <div class="column-intro-mark" aria-hidden="true"><span>卷</span><i></i><b></b></div>
          <div class="column-intro-footer"><span v-if="value">共 {{ value.total }} 部可见作品</span><span v-else>专栏目录</span><span>每一次更新，都是故事的新一页</span></div>
        </section>
        <div v-else class="module-header list-page-head">
          <div class="head-left"><h1 class="fp-page-title">{{ heading }}</h1><ContentRelationButton v-if="kind === 'tag'" kind="tag" :target="extra" /><span v-if="kind === 'search' && keyword" class="search-tag">关键词：{{ keyword }}</span></div>
          <div class="head-right"><nav v-if="showRecentTabs" class="sort-tabs"><RouterLink v-for="tab in RECENT_TABS" :key="tab.to" :to="tab.to" :class="{ current: route.path === tab.to }">{{ tab.label }}</RouterLink></nav><span v-if="value" class="total-count">共 {{ value.total }} 篇</span></div>
        </div>
        <p v-if="listingNote" class="listing-note">{{ listingNote }}</p>
        <div v-if="isColumnPage" class="column-shelf-head">
          <div><strong>专栏目录</strong><span>按当前可见章节统计</span></div>
          <div class="column-switch" role="tablist" aria-label="专栏排序"><button class="fp-control" type="button" role="tab" :aria-selected="columnShelf === 'recent'" :class="{ selected: columnShelf === 'recent' }" @click="columnShelf = 'recent'">最近更新</button><button class="fp-control" type="button" role="tab" :aria-selected="columnShelf === 'hot'" :class="{ selected: columnShelf === 'hot' }" @click="columnShelf = 'hot'">热门作品</button></div>
        </div>
        <button type="button" class="btn refresh-list fp-control" :disabled="loading" @click="read()">刷新列表</button>
        <FpLoading v-if="loading && !value" :rows="8" />
        <div v-if="error" class="err fp-state" role="alert"><p>{{ error }}</p><button type="button" class="btn fp-control" @click="read()">重试当前页</button><button class="fp-control btn" v-if="p > 1" type="button"  @click="read(1)">返回第一页</button></div>
        <template v-if="value">
          <div v-if="value.resource === 'columns'" class="column-grid">
            <article v-for="column in columns" :key="column.id" class="column-card">
              <RouterLink class="column-cover-link" :to="`/column/${column.id}`" :aria-label="`阅读《${decodeEntities(column.title)}》`">
                <img v-if="column.coverURL && !failedCovers.has(column.id)" :src="column.coverURL" alt="" loading="lazy" @error="failedCovers.add(column.id)"><span v-else class="cover-placeholder" aria-hidden="true" :style="{background:`hsl(${Number.parseInt(column.id.slice(-5),36)%360} 24% 38%)`}">{{ decodeEntities(column.title).slice(0,1) || '卷' }}</span>
              </RouterLink>
              <div class="column-card-copy">
                <RouterLink class="column-title" :to="`/column/${column.id}`">{{ decodeEntities(column.title) }}</RouterLink>
                <p v-if="column.chapters[0]?.preview" class="column-preview">{{ decodeEntities(column.chapters[0]!.preview || '') }}</p>
                <div class="column-author-row"><span class="chapter-count">{{ column.articleCount }} 章</span><time v-if="column.updatedAt">{{ formatDate(column.updatedAt) }} 更新</time></div>
                <div v-if="column.chapters[0]" class="latest-chapter"><span>最近更新</span><RouterLink :title="decodeEntities(column.chapters[0]!.title)" :to="`/article/${column.chapters[0]!.id}`">第 {{ column.chapters[0]!.chapterNo }} 章 · {{ decodeEntities(column.chapters[0]!.title) }}</RouterLink></div>
                <div class="column-links"><RouterLink class="read-column" :to="`/column/${column.id}`">章节目录 →</RouterLink><RouterLink v-if="column.chapters.length" class="read-column" :to="`/article/${column.chapters[column.chapters.length-1]!.id}`">试读 ↗</RouterLink></div>
              </div>
            </article>
            <p v-if="!columns.length" class="column-empty">本页暂无可见专栏。</p>
          </div>
          <template v-else><ArticleFeed :items="items" :empty="kind==='search' ? '没有找到相关帖子，试试缩短关键词或更换说法。' : '该分类下暂无内容'" /><nav v-if="kind==='search' && !items.length" class="search-empty-links" aria-label="继续探索"><RouterLink to="/recent">浏览最新</RouterLink><RouterLink to="/tags">按标签查找</RouterLink></nav></template>
          <nav class="pagination-bar fp-pagination" aria-label="列表分页"><button type="button" class="btn page-btn fp-control" :disabled="p <= 1" @click="read(p - 1)">‹ 上一页</button><span v-if="value.pageCount" class="current-page-num">第 {{ p }} 页 / 共 {{ value.pageCount }} 页</span><span v-else>暂无分页</span><button type="button" class="btn page-btn fp-control" :disabled="p >= value.pageCount" @click="read(p + 1)">下一页 ›</button><button class="fp-control btn" v-if="p > value.pageCount && p > 1" type="button"  @click="read(1)">返回第一页</button></nav>
        </template>
        <p v-else-if="!loading && !error" role="status">列表尚未读取。</p>
      </div>
    </div>
    <div class="side"><SideBar /></div>
  </div>
</template>

<style scoped lang="scss">
.list-content { min-width: 0; scroll-margin-top: 80px; }
.refresh-list { display: none; margin: 8px 16px 16px; }
.list-page-wrap {
  padding-top: 4px;
}

.list-page-head {
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 18px;
}

.head-left {
  min-width: 0;
  flex-wrap: wrap;
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-left h1 {
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

.hint {
  padding: 30px 18px;
  text-align: center;
  color: var(--fp-muted);
  font-size: 14px;
}

.err {
  padding: 30px 18px;
  text-align: center;
  color: var(--fp-danger);
  font-size: 14px;
}

.pagination-bar {
  flex-wrap: wrap;
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
.column-card { min-width: 0; display: grid; grid-template-columns: 88px minmax(0,1fr); gap: 12px; padding: 12px; border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius); background: var(--fp-card); transition: border-color .18s ease, transform .18s ease, box-shadow .18s ease; }
.column-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--fp-accent) 40%, var(--fp-border)); box-shadow: 0 8px 24px rgba(60,45,30,.08); }
.column-cover-link { position: relative; display: block; aspect-ratio: 3 / 4; overflow: hidden; border-radius: 7px; background: linear-gradient(145deg,#ead6b6,#b38c61); box-shadow: 0 5px 14px rgba(50,35,20,.17); }
.column-cover-link::after { content: ''; position: absolute; inset: 0; border: 1px solid rgba(255,255,255,.22); border-radius: inherit; }
.cover-placeholder { display: grid; place-items: center; width: 100%; height: 100%; color: #fff8ec; font-size: 36px; background: repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,.08) 10px 11px); }
.column-cover-link img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .25s ease; }
.column-card:hover .cover-placeholder { display: grid; place-items: center; width: 100%; height: 100%; color: #fff8ec; font-size: 36px; background: repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,.08) 10px 11px); }
.column-cover-link img { transform: scale(1.035); }
.cover-label { position: absolute; z-index: 1; left: 6px; bottom: 6px; padding: 3px 6px; border-radius: 4px; color: #fff; background: rgba(43,35,29,.72); font-size: 9px; }
.column-card-copy { min-width: 0; display: flex; flex-direction: column; }
.column-title { color: var(--fp-title); font-size: 15px; font-weight: 600; line-height: 1.4; text-decoration: none; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.column-title:hover,.latest-chapter a:hover { text-decoration: underline; }
.column-preview { margin: 8px 0 10px; min-height: 36px; color: var(--fp-muted); font-size: 12px; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.column-author-row { flex-wrap:wrap; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--fp-border); color: var(--fp-muted); font-size: 11px; }
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
.listing-note{margin:0 16px 16px;color:var(--fp-muted);font-size:12px;line-height:1.7}.column-links{display:flex;justify-content:space-between;gap:12px;margin-top:auto}.column-author-row time{font-size:10px}.search-empty-links{display:flex;justify-content:center;gap:18px;padding:0 16px 24px;font-size:13px}
@media(min-width:1600px){.column-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
</style>
