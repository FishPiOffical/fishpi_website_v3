<script setup lang="ts">
import {readChapterProgress} from '@/utils/readingProgress'
import { timeISO } from '@/utils/time'

import { formatDateTime } from '@/utils/time'

import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { usePublicColumn } from '@/composables/usePublicColumn'
import { usePageSeo } from '@/composables/usePageSeo'
const route = useRoute(), columnId = computed(() => String(route.params.columnId || ''))
const { meta, page, p, metaError, pageError, metaLoading, pageLoading, readMeta, readPage } = usePublicColumn(columnId)
const title = computed(() => meta.value?.column.title || `专栏 ${columnId.value}`), panel = ref<HTMLElement | null>(null), coverFailed = ref(false)
watch(() => meta.value?.column.coverURL, () => { coverFailed.value = false })
let lastPage = 1
watch(page, data => { if (!data) return; const moved = lastPage !== data.p; lastPage = data.p; if (moved) void nextTick(() => { if (page.value === data) panel.value?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }) }) })
const progress=ref('')
onMounted(()=>{progress.value=readChapterProgress(columnId.value)})
watch(columnId,()=>{progress.value=readChapterProgress(columnId.value)})
const date = formatDateTime
usePageSeo(() => ({ title: title.value, path: `/column/${encodeURIComponent(columnId.value)}`, description: `${title.value} · 摸鱼派长篇专栏` }))
</script>
<template>
  <main :data-public-content="meta ? 'ready' : undefined" class="column-page fp-page fp-page--wide fp-ui fp-special-page">
    <p class="crumb"><RouterLink to="/column">长篇专栏</RouterLink><span>/</span>{{ title }}</p>
    <p v-if="metaLoading && !meta" class="column-meta-loading" role="status">正在读取专栏资料…</p>
    <div v-if="metaError" role="alert"><p>{{ metaError }}</p><button class="fp-control" type="button" @click="readMeta">重试专栏资料</button></div>
    <section v-if="meta" class="book-hero">
      <div class="cover-wrap"><img v-if="meta.column.coverURL && !coverFailed" :src="meta.column.coverURL" alt="" class="book-cover" @error="coverFailed = true" /><div v-else class="cover-placeholder" role="img" aria-label="未设置专栏封面">专栏</div><span class="cover-shine" /></div>
      <div class="book-info">
        <div class="book-kicker"><span>摸鱼派 · 长篇专栏</span></div>
        <h1 class="fp-page-title">{{ title }}</h1><p class="synopsis">按章节序号查看当前公开目录。</p>
        <div class="book-actions"><RouterLink v-if="progress && meta" class="primary-action" :to="`/article/${progress}`">继续阅读</RouterLink><RouterLink v-if="meta.first" class="primary-action" :to="`/article/${meta.first.id}`">开始阅读 <span>→</span></RouterLink><RouterLink v-if="meta.latest && meta.latest.id !== meta.first?.id" class="secondary-action" :to="`/article/${meta.latest.id}`">阅读最新章</RouterLink></div>
        <div class="book-facts"><span><b>{{ meta.column.articleCount }}</b> 可见章节</span><span v-if="meta.column.updatedAt">最近更新 {{ date(meta.column.updatedAt) }}</span></div>
      </div>
    </section>
    <section ref="panel" class="chapter-panel">
      <header class="chapter-heading"><h2>章节目录</h2><button class="fp-control" type="button" :disabled="pageLoading" @click="readPage()">刷新章节目录</button></header>
      <p v-if="pageLoading && !page" class="column-page-loading" role="status">正在读取章节目录…</p>
      <div v-if="pageError" role="alert"><p>{{ pageError }}</p><button class="fp-control" type="button" @click="readPage()">重试章节目录</button><button class="fp-control" v-if="p > 1" type="button" @click="readPage(1)">返回目录首页</button></div>
      <template v-if="page">
        <p class="hint">当前目录共 {{ page.total }} 条</p>
        <ol class="chapters"><li v-for="item in page.list" :key="item.id" :class="{'last-read':progress===item.id}"><span class="chapter-index">{{ item.chapterNo }}</span><RouterLink :to="`/article/${item.id}`">{{ item.title }}<small v-if="progress===item.id"> 上次读到</small></RouterLink><time class="chapter-time" :datetime="item.createdAt ? timeISO(item.createdAt) : undefined">{{ date(item.createdAt) }}</time><span class="chapter-arrow" aria-hidden="true">›</span></li></ol>
        <p v-if="!page.list.length" class="hint">本页没有可见章节。</p>
        <div class="column-pager fp-pagination"><button class="fp-control" type="button" :disabled="p <= 1" @click="readPage(p - 1)">上一页章节</button><span>第 {{ p }} 页 / 共 {{ page.pageCount }} 页</span><button class="fp-control" type="button" :disabled="p >= page.pageCount" @click="readPage(p + 1)">下一页章节</button><button class="fp-control" v-if="p > page.pageCount" type="button" @click="readPage(1)">返回目录首页</button></div>
      </template>
      <p v-else-if="!pageLoading && !pageError" role="status">章节目录尚未读取。</p>
    </section>
  </main>
</template>
<style scoped lang="scss">
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
.chapter-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 19px 22px 15px; border-bottom: 1px solid var(--fp-border); > button { display: none; } }
.section-kicker { color: var(--fp-accent); font-size: 9px; font-weight: 700; letter-spacing: .18em; }.chapter-heading h2 { margin: 4px 0 0; color: var(--fp-title); font-size: 17px; }.chapter-heading>span { color: var(--fp-muted); font-size: 11px; }
.chapters { list-style: none; padding: 0; margin: 0; }.chapters li { min-height: 49px; display: grid; grid-template-columns: 35px minmax(0,1fr) auto 16px; align-items: center; gap: 12px; padding: 0 20px; border-bottom: 1px solid color-mix(in srgb,var(--fp-border) 70%,transparent); }.chapters li:last-child { border-bottom: 0; }
.chapter-index { color: #b9a88f; font-family: Georgia,serif; font-size: 11px; }.chapters a { min-width: 0; overflow: hidden; color: var(--fp-title); text-decoration: none; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }.chapters a:hover { text-decoration: underline; }
.chapter-time { color: var(--fp-muted); font-size: 10px; white-space: nowrap; }.chapter-arrow { color: var(--fp-border); font-size: 20px; }.chapters .empty { display: block; padding: 35px; color: var(--fp-muted); text-align: center; }
.aside-card { padding: 20px; }.aside-card h3 { margin: 7px 0 8px; color: var(--fp-title); font-size: 16px; }.aside-card p { margin: 0; color: var(--fp-muted); font-size: 12px; line-height: 1.7; }
.aside-rule { margin: 16px 0 12px; border-top: 1px solid var(--fp-border); }.aside-stat { display: flex; justify-content: space-between; padding: 7px 0; color: var(--fp-muted); font-size: 11px; }.aside-stat b { color: var(--fp-title); font-size: 12px; }
.back-catalog { display: flex; justify-content: space-between; margin-top: 15px; padding-top: 13px; border-top: 1px solid var(--fp-border); color: var(--fp-accent); font-size: 12px; text-decoration: none; }.back-catalog:hover { text-decoration: underline; }
.hint { margin: 10px 2px; color: var(--fp-muted); font-size: 11px; }.err { padding: 30px 18px; color: var(--fp-danger); font-size: 13px; }
@media (max-width:900px) { .column-page { padding-right: 12px; padding-left: 12px; }.column-body { grid-template-columns: 1fr; }.column-aside { display: none; } }
@media (max-width:560px) { .book-hero { grid-template-columns: 94px minmax(0,1fr); gap: 16px; padding: 18px 14px; }.hero-stamp { display: none; }.book-kicker { flex-wrap: wrap; gap: 7px; font-size: 10px; }.book-info h1 { margin-top: 8px; font-size: 20px; }.book-byline { font-size: 11px; }.synopsis { grid-column: 1/-1; margin: 12px 0; font-size: 12px; }.book-actions { flex-wrap: wrap; }.primary-action,.secondary-action { min-height: 34px; padding: 0 11px; font-size: 11px; }.book-facts { grid-column: 1/-1; gap: 11px; padding-top: 12px; font-size: 9px; }.book-facts b { font-size: 11px; }.chapter-heading { padding: 15px; }.chapters li { min-height: 45px; grid-template-columns: 24px minmax(0,1fr) auto 9px; gap: 7px; padding: 0 12px; }.chapters a { font-size: 12px; }.chapter-time { font-size: 9px; } }
.cover-placeholder { display: grid; place-items: center; width: 100%; height: 100%; min-height: 150px; color: #58452f; font-size: 28px; letter-spacing: 5px; background: linear-gradient(120deg, #d9c19a, #bba076); }
.chapter-panel { margin-top: 24px; scroll-margin-top: 88px; } .column-pager { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 16px; } button { border: 1px solid var(--fp-border); background: var(--fp-card); color: var(--fp-text); border-radius: 6px; padding: 7px 10px; cursor: pointer; &:disabled { opacity: .5; cursor: default; } } [role=alert] { padding: 16px; color: var(--fp-danger); }
.chapters .last-read{background:var(--fp-primary-soft)}.chapters small{color:var(--fp-primary);font-size:10px}
.column-meta-loading,.column-page-loading{display:grid;place-items:center;margin:0;color:var(--fp-muted);font-size:13px;background:var(--fp-hover);border-radius:12px}.column-meta-loading{min-height:285px;margin-bottom:18px}.column-page-loading{min-height:240px}
</style>
