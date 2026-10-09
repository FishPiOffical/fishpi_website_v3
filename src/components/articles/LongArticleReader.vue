<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { ArticleDetail, LongArticleChapter, LongArticleColumnView } from '@/api/fishpi'
import ReactionBar from '@/components/ReactionBar.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import { useAppearanceStore } from '@/stores/appearance'
import { articleTitle } from '@/utils/text'

const props = defineProps<{
  article: ArticleDetail
  column: LongArticleColumnView | null
  commentTotal: number
  loggedIn: boolean
  canEdit: boolean
  apiKey?: string | null
  statement?: string
  actionMsg?: string
}>()

const emit = defineEmits<{
  vote: []
  thank: []
  collect: []
  watch: []
  revisions: []
  react: [value: string]
  contentClick: [e: MouseEvent]
  reply: []
}>()

/** 与现网 js/long-article.js 共用同一 localStorage 键 */
const STORAGE_KEY = 'longArticleSettings'
const WIDTHS = ['auto', '600', '800', '1000', '1200'] as const
type Width = (typeof WIDTHS)[number]

const appearance = useAppearanceStore()

const settings = reactive<{ width: Width; desktopFontSize: number; mobileFontSize: number }>({
  width: '800',
  desktopFontSize: 18,
  mobileFontSize: 16,
})

const catalogOpen = ref(false)
const commentsOpen = ref(false)
const moreOpen = ref(false)
const layoutOpen = ref(false)
const composerOpen = ref(false)
const showTop = ref(false)
const viewport = ref(1280)
const contentEl = ref<HTMLElement | null>(null)
const drawerScrollEl = ref<HTMLElement | null>(null)
const catalogEl = ref<HTMLElement | null>(null)
const moreEl = ref<HTMLElement | null>(null)
const layoutEl = ref<HTMLElement | null>(null)

const chapters = computed(() => props.column?.chapters || [])
const currentChapterId = computed(() => props.article.oId)
const authorLabel = computed(
  () => props.article.articleAuthor?.userNickname || props.article.articleAuthorName || '匿名用户',
)

function clampFont(size: unknown, min: number, max: number, fallback: number) {
  const n = Number.parseInt(String(size), 10)
  return Number.isNaN(n) ? fallback : Math.max(min, Math.min(max, n))
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, unknown>
    const w = String(saved.width || '800')
    settings.width = (WIDTHS as readonly string[]).includes(w) ? (w as Width) : '800'
    settings.desktopFontSize = clampFont(saved.desktopFontSize ?? saved.fontSize, 12, 32, 18)
    settings.mobileFontSize = clampFont(saved.mobileFontSize, 16, 24, 16)
  } catch {
    /* 使用默认值 */
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* 存储不可用时忽略 */
  }
}

function setFont(delta: number) {
  settings.desktopFontSize = clampFont(settings.desktopFontSize + delta, 12, 32, 18)
  saveSettings()
}

function setWidth(w: Width) {
  settings.width = w
  saveSettings()
  layoutOpen.value = false
}

/** 与现网 updateLayoutMetrics 同一套算法：评论抽屉在宽屏下与正文并排，窄屏下覆盖。 */
const metrics = computed(() => {
  const vw = viewport.value
  const selected = settings.width === 'auto' ? Math.min(vw * 0.8, 1200) : Number(settings.width)
  const closedArticle = Math.min(selected, Math.max(320, vw - 28))
  const drawer = vw <= 768 ? Math.max(280, vw - 20) : 320
  const toolbarW = vw <= 768 ? 54 : 64
  const gap = 14
  let inline = vw >= 960
  let openArticle = closedArticle
  if (inline) {
    const maxStage = vw - (toolbarW + gap + gap) * 2
    openArticle = Math.min(closedArticle, Math.max(480, maxStage - drawer))
    inline = openArticle >= 480
  }
  const sideBySide = commentsOpen.value && inline
  const articleWidth = sideBySide ? openArticle : closedArticle
  const stageWidth = sideBySide ? openArticle + drawer : closedArticle
  const stageLeft = Math.max(gap, (vw - stageWidth) / 2)
  const drawerLeft = inline ? stageLeft + openArticle : vw - drawer
  const closedToolbarLeft = Math.min(vw - toolbarW - gap, (vw - closedArticle) / 2 + closedArticle + gap)
  const toolbarLeft = sideBySide ? stageLeft + stageWidth + gap : closedToolbarLeft
  return {
    articleWidth,
    stageLeft,
    stageWidth,
    drawer,
    drawerLeft,
    toolbarLeft,
    catalogWidth: closedArticle,
    hideToolbar: commentsOpen.value && !inline,
  }
})

const rootStyle = computed(() => {
  const m = metrics.value
  const mobile = viewport.value <= 768
  return {
    '--la-font-size': `${mobile ? settings.mobileFontSize : settings.desktopFontSize}px`,
    '--la-article-left': `${m.stageLeft}px`,
    '--la-article-width': `${m.articleWidth}px`,
    '--la-stage-width': `${m.stageWidth}px`,
    '--la-drawer-width': `${m.drawer}px`,
    '--la-drawer-left': `${m.drawerLeft}px`,
    '--la-toolbar-left': `${m.toolbarLeft}px`,
    '--la-catalog-width': `${m.catalogWidth}px`,
  }
})

function closeFloating() {
  moreOpen.value = false
  layoutOpen.value = false
}

function toggleCatalog() {
  if (catalogOpen.value) {
    catalogOpen.value = false
    return
  }
  commentsOpen.value = false
  closeFloating()
  catalogOpen.value = true
  void nextTick(() => {
    catalogEl.value?.querySelector('.la-chapter.active')?.scrollIntoView({ block: 'center' })
  })
}

function openComments() {
  catalogOpen.value = false
  closeFloating()
  commentsOpen.value = true
}

function closeComments() {
  commentsOpen.value = false
  composerOpen.value = false
}

function toggleComments() {
  if (commentsOpen.value) closeComments()
  else openComments()
}

function openComposer() {
  if (!commentsOpen.value) openComments()
  composerOpen.value = true
}

function scrollCommentsTop() {
  drawerScrollEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

function toTop() {
  catalogOpen.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function onReplyTrigger() {
  composerOpen.value = true
  emit('reply')
}

function moreAction(name: 'vote' | 'thank' | 'collect' | 'watch' | 'revisions') {
  moreOpen.value = false
  if (name === 'vote') emit('vote')
  else if (name === 'thank') emit('thank')
  else if (name === 'collect') emit('collect')
  else if (name === 'watch') emit('watch')
  else emit('revisions')
}

/** 现网 formatParagraphIndentation：段内 <br> 拆成独立缩进行 */
function formatParagraphs() {
  const root = contentEl.value
  if (!root) return
  root.querySelectorAll<HTMLParagraphElement>(':scope > p').forEach((p) => {
    if (p.classList.contains('la-lines')) return
    const hasBr = [...p.childNodes].some((n) => n.nodeType === 1 && (n as Element).tagName === 'BR')
    if (!hasBr || p.querySelector('img, picture, video, iframe')) return
    const frag = document.createDocumentFragment()
    let line = document.createElement('span')
    line.className = 'la-line'
    for (const node of [...p.childNodes]) {
      if (node.nodeType === 1 && (node as Element).tagName === 'BR') {
        frag.appendChild(line)
        line = document.createElement('span')
        line.className = 'la-line'
      } else {
        line.appendChild(node)
      }
    }
    frag.appendChild(line)
    p.textContent = ''
    p.classList.add('la-lines')
    p.appendChild(frag)
  })
}

function onResize() {
  viewport.value = document.documentElement.clientWidth || window.innerWidth
}

function onScroll() {
  showTop.value = (window.scrollY || document.documentElement.scrollTop || 0) > 320
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (catalogOpen.value) catalogOpen.value = false
  else if (composerOpen.value) composerOpen.value = false
  else if (commentsOpen.value) closeComments()
  else closeFloating()
}

function onDocClick(e: MouseEvent) {
  const t = e.target as Node | null
  if (moreOpen.value && moreEl.value && t && !moreEl.value.contains(t)) moreOpen.value = false
  if (layoutOpen.value && layoutEl.value && t && !layoutEl.value.contains(t)) layoutOpen.value = false
}

watch(
  () => props.article.articleContent,
  () => void nextTick(formatParagraphs),
)

watch(
  () => props.article.oId,
  () => {
    catalogOpen.value = false
    composerOpen.value = false
    closeFloating()
  },
)

onMounted(() => {
  loadSettings()
  onResize()
  onScroll()
  formatParagraphs()
  window.addEventListener('resize', onResize)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', onKey)
  document.addEventListener('click', onDocClick)
  if (/(?:^|&)(?:p|m|sort|author)=/.test(location.search.slice(1)) || location.hash.startsWith('#comments')) {
    openComments()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('click', onDocClick)
})

defineExpose({ openComments, openComposer, scrollCommentsTop })

function chapterTitle(c: LongArticleChapter) {
  return articleTitle(c)
}
</script>

<template>
  <div
    class="la"
    :class="{ 'la--comments': commentsOpen, 'la--catalog': catalogOpen }"
    :style="rootStyle"
  >
    <div class="la-page-bg" aria-hidden="true" />

    <article class="la-article">
      <div class="la-wrapper">
        <RouterLink to="/" class="la-home" aria-label="返回鱼排首页" title="返回鱼排首页">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20z" />
          </svg>
          <span>首页</span>
        </RouterLink>

        <h1 class="la-title">
          <span v-if="article.articlePerfect" class="la-perfect" title="优选">🌟</span>
          {{ articleTitle(article) }}
        </h1>

        <div class="la-meta">
          <RouterLink v-if="article.articleAuthorName" :to="`/member/${article.articleAuthorName}`" class="la-author">
            {{ authorLabel }}
          </RouterLink>
          <span v-else class="la-author">{{ authorLabel }}</span>
          <span>{{ article.timeAgo || article.articleCreateTimeStr }}</span>
          <template v-if="column">
            <span class="la-sep">·</span>
            <RouterLink :to="`/column/${column.column.oId}`">
              《{{ column.column.columnTitle }}》第 {{ column.chapterNo }} 章
            </RouterLink>
          </template>
        </div>

        <p v-if="statement" class="la-statement">创作声明：{{ statement }}</p>

        <audio v-if="article.articleAudioURL" class="la-audio" :src="article.articleAudioURL" controls preload="none" />

        <div
          ref="contentEl"
          class="la-content"
          @click="emit('contentClick', $event)"
          v-html="article.articleContent || ''"
        />

        <slot name="reward" />

        <nav v-if="column && (column.previous || column.next)" class="la-adjacent" aria-label="章节导航">
          <div class="la-adjacent-item">
            <RouterLink v-if="column.previous" :to="column.previous.articlePermalink" class="la-adjacent-link">
              <div class="la-adjacent-label">上一章</div>
              <div class="la-adjacent-title">{{ chapterTitle(column.previous) }}</div>
              <div v-if="column.previous.articlePreviewContent" class="la-adjacent-preview">
                {{ column.previous.articlePreviewContent }}
              </div>
            </RouterLink>
            <div v-else class="la-adjacent-link disabled">
              <div class="la-adjacent-label">上一章</div>
              <div class="la-adjacent-title">已是首章</div>
            </div>
          </div>
          <div class="la-adjacent-item right">
            <RouterLink v-if="column.next" :to="column.next.articlePermalink" class="la-adjacent-link">
              <div class="la-adjacent-label">下一章</div>
              <div class="la-adjacent-title">{{ chapterTitle(column.next) }}</div>
              <div v-if="column.next.articlePreviewContent" class="la-adjacent-preview">
                {{ column.next.articlePreviewContent }}
              </div>
            </RouterLink>
            <div v-else class="la-adjacent-link disabled">
              <div class="la-adjacent-label">下一章</div>
              <div class="la-adjacent-title">已是末章</div>
            </div>
          </div>
        </nav>

        <section v-if="canEdit && article.longArticleReadStat" class="la-read-stat" aria-label="长文阅读激励">
          <div class="la-read-stat-title">阅读激励</div>
          <div class="la-read-stat-items">
            <div>
              <span>未结算</span>
              <strong>
                用户 {{ article.longArticleReadStat.registeredUnsettledCnt ?? 0 }} · 访客
                {{ article.longArticleReadStat.anonymousUnsettledCnt ?? 0 }}
              </strong>
            </div>
            <div>
              <span>总计</span>
              <strong>
                用户 {{ article.longArticleReadStat.registeredTotalCnt ?? 0 }} · 访客
                {{ article.longArticleReadStat.anonymousTotalCnt ?? 0 }}
              </strong>
            </div>
          </div>
          <div class="la-read-stat-note">访客去重，周期上限 100 次</div>
        </section>

        <div class="la-reaction">
          <ReactionBar
            :summary="article.reactionSummary"
            :current="article.currentUserReaction"
            :disabled="!loggedIn"
            @toggle="emit('react', $event)"
          />
        </div>

        <p v-if="actionMsg" class="la-action-msg">{{ actionMsg }}</p>

        <slot name="extra" />
      </div>
    </article>

    <!-- 评论抽屉 -->
    <aside id="articleCommentsPanel" class="la-drawer" :aria-hidden="!commentsOpen">
      <header class="la-drawer-head">
        <span class="la-drawer-title">评论 <em>{{ commentTotal }} 条</em></span>
        <button type="button" class="la-round-btn" aria-label="关闭评论" title="关闭评论" @click="closeComments">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3z"
            />
          </svg>
        </button>
      </header>
      <div ref="drawerScrollEl" class="la-drawer-scroll">
        <slot name="comments" />
      </div>
      <div class="la-drawer-reply">
        <button v-if="loggedIn" type="button" class="la-reply-trigger" @click="onReplyTrigger">请输入回帖内容 ...</button>
        <RouterLink v-else :to="{ path: '/login', query: { redirect: $route.fullPath } }" class="la-reply-trigger">
          登录参与讨论 ...
        </RouterLink>
      </div>
    </aside>

    <!-- 回帖编辑面板，横跨阅读舞台 -->
    <div v-if="composerOpen" class="la-composer">
      <div class="la-composer-head">
        <span>发表回帖</span>
        <button type="button" class="la-round-btn" aria-label="收起" title="收起" @click="composerOpen = false">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
      </div>
      <slot name="composer" />
    </div>

    <!-- 目录 -->
    <section
      v-if="column && chapters.length"
      ref="catalogEl"
      class="la-catalog"
      :aria-hidden="!catalogOpen"
      aria-labelledby="laCatalogTitle"
    >
      <div class="la-catalog-inner">
        <header class="la-catalog-head">
          <div>
            <h2 id="laCatalogTitle">{{ column.column.columnTitle }}</h2>
            <span>共 {{ chapters.length }} 章</span>
          </div>
          <button type="button" class="la-icon-btn" title="关闭目录" aria-label="关闭目录" @click="catalogOpen = false">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3z"
              />
            </svg>
          </button>
        </header>
        <nav class="la-chapters" aria-label="目录">
          <RouterLink
            v-for="c in chapters"
            :key="c.articleId"
            :to="c.articlePermalink"
            class="la-chapter"
            :class="{ active: c.articleId === currentChapterId }"
            :aria-current="c.articleId === currentChapterId ? 'page' : undefined"
            @click="catalogOpen = false"
          >
            <span class="la-chapter-no">第 {{ c.chapterNo }} 章</span>
            <span class="la-chapter-title">{{ chapterTitle(c) }}</span>
          </RouterLink>
        </nav>
      </div>
    </section>

    <!-- 右侧悬浮工具栏 -->
    <div v-show="!metrics.hideToolbar" class="la-toolbar">
      <button type="button" class="la-btn la-btn--top" :class="{ visible: showTop }" title="回到顶部" @click="toTop">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 15h4v6h6v-6h4l-7-8zM4 3h16v2H4z" /></svg>
        <span>顶部</span>
      </button>

      <div v-if="column && chapters.length" class="la-chapter-actions" aria-label="章节切换">
        <RouterLink v-if="column.previous" :to="column.previous.articlePermalink" class="la-btn la-btn--chapter" title="上一章">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m15.4 16.6-4.6-4.6 4.6-4.6L14 6l-6 6 6 6z" /></svg>
          <span>上一章</span>
        </RouterLink>
        <span v-else class="la-btn la-btn--chapter disabled" aria-disabled="true" title="已是首章">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m15.4 16.6-4.6-4.6 4.6-4.6L14 6l-6 6 6 6z" /></svg>
          <span>上一章</span>
        </span>
        <RouterLink v-if="column.next" :to="column.next.articlePermalink" class="la-btn la-btn--chapter" title="下一章">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m8.6 16.6 4.6-4.6-4.6-4.6L10 6l6 6-6 6z" /></svg>
          <span>下一章</span>
        </RouterLink>
        <span v-else class="la-btn la-btn--chapter disabled" aria-disabled="true" title="已是末章">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m8.6 16.6 4.6-4.6-4.6-4.6L10 6l6 6-6 6z" /></svg>
          <span>下一章</span>
        </span>
      </div>

      <button
        v-if="column && chapters.length"
        type="button"
        class="la-btn"
        :class="{ active: catalogOpen }"
        title="目录"
        :aria-expanded="catalogOpen"
        @click="toggleCatalog"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2M6 4h5v8l-2.5-1.5L6 12z"
          />
        </svg>
        <span>目录</span>
      </button>

      <button type="button" class="la-btn" title="切换模式" @click="appearance.toggleTheme()">
        <svg class="la-ico-sun" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10M2 13h2a1 1 0 0 0 0-2H2a1 1 0 0 0 0 2m18 0h2a1 1 0 0 0 0-2h-2a1 1 0 0 0 0 2M11 2v2a1 1 0 0 0 2 0V2a1 1 0 0 0-2 0m0 18v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-2 0M5.99 4.58a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41zm12.37 12.37a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41zm1.06-10.96a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41zM7.05 18.36a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41z"
          />
        </svg>
        <svg class="la-ico-moon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-4.4 2.26 5.4 5.4 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1"
          />
        </svg>
        <span>日夜</span>
      </button>

      <button
        type="button"
        class="la-btn"
        :class="{ active: commentsOpen }"
        :title="`评论 ${commentTotal}`"
        :aria-expanded="commentsOpen"
        @click="toggleComments"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
        <span>评论</span>
        <span v-if="commentTotal > 0" class="la-count">{{ commentTotal > 99 ? '99+' : commentTotal }}</span>
      </button>

      <div ref="moreEl" class="la-pop-wrap">
        <button
          type="button"
          class="la-btn"
          :class="{ active: moreOpen }"
          title="更多操作"
          :aria-expanded="moreOpen"
          @click="moreOpen = !moreOpen; layoutOpen = false"
        >
          <span class="la-dots" aria-hidden="true">···</span>
          <span>更多</span>
        </button>
        <div class="la-more" :class="{ open: moreOpen }" :aria-hidden="!moreOpen">
          <template v-if="loggedIn">
            <button type="button" class="la-more-item" :class="{ on: article.thanked }" :disabled="article.thanked" @click="moreAction('thank')">
              ❤️ <span>{{ article.thankedCnt ?? 0 }} 感谢</span>
            </button>
            <button type="button" class="la-more-item" :class="{ on: article.articleVote === 0 }" @click="moreAction('vote')">
              👍 <span>{{ article.articleGoodCnt ?? 0 }} 赞同</span>
            </button>
            <button type="button" class="la-more-item" :class="{ on: article.isFollowing }" @click="moreAction('collect')">
              ⭐ <span>{{ article.articleCollectCnt ?? 0 }} {{ article.isFollowing ? '取消收藏' : '收藏' }}</span>
            </button>
            <button type="button" class="la-more-item" :class="{ on: article.isWatching }" @click="moreAction('watch')">
              👀 <span>{{ article.articleWatchCnt ?? 0 }} {{ article.isWatching ? '取消关注' : '关注' }}</span>
            </button>
            <button
              v-if="Number(article.articleRevisionCount ?? 2) > 1"
              type="button"
              class="la-more-item"
              @click="moreAction('revisions')"
            >
              🕘 <span>历史</span>
            </button>
            <RouterLink v-if="canEdit" :to="`/post/${article.oId}`" class="la-more-item">✏️ <span>编辑</span></RouterLink>
            <span class="la-more-item la-more-report">
              🚩 <ReportDialog :api-key="apiKey" :data-id="article.oId" :data-type="0" />
            </span>
          </template>
          <RouterLink v-else :to="{ path: '/login', query: { redirect: $route.fullPath } }" class="la-more-item wide">
            登录后可感谢、收藏
          </RouterLink>
        </div>
      </div>

      <div ref="layoutEl" class="la-pop-wrap">
        <button
          type="button"
          class="la-btn"
          :class="{ active: layoutOpen }"
          title="阅读设置"
          :aria-expanded="layoutOpen"
          @click="layoutOpen = !layoutOpen; moreOpen = false"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M14.82 1H9.18l-.647 3.237a8.5 8.5 0 0 0-1.52.88l-3.13-1.059l-2.819 4.884l2.481 2.18a8.6 8.6 0 0 0 0 1.756l-2.481 2.18l2.82 4.884l3.129-1.058c.472.342.98.638 1.52.879L9.18 23h5.64l.647-3.237a8.5 8.5 0 0 0 1.52-.88l3.13 1.059l2.82-4.884l-2.482-2.18a8.6 8.6 0 0 0 0-1.756l2.481-2.18l-2.82-4.884l-3.128 1.058a8.5 8.5 0 0 0-1.52-.879zM12 16a4 4 0 1 1 0-8a4 4 0 0 1 0 8"
            />
          </svg>
          <span>设置</span>
        </button>
        <div class="la-layout" :class="{ open: layoutOpen }" :aria-hidden="!layoutOpen">
          <div class="la-layout-title">阅读设置</div>
          <div class="la-layout-row">
            <span>字号</span>
            <div class="la-font">
              <button type="button" title="减小字号" @click="setFont(-2)">A-</button>
              <output>{{ settings.desktopFontSize }}px</output>
              <button type="button" title="增大字号" @click="setFont(2)">A+</button>
            </div>
          </div>
          <div class="la-layout-row">
            <span>版式</span>
            <div class="la-widths">
              <button
                v-for="w in WIDTHS"
                :key="w"
                type="button"
                :class="{ active: settings.width === w }"
                @click="setWidth(w)"
              >
                {{ w === 'auto' ? '自动' : w }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.la {
  --la-page: #c7dcc8;
  --la-surface: #dcebdd;
  --la-soft: #edf5ed;
  --la-text: #25332a;
  --la-title: #1d2b21;
  --la-muted: #718078;
  --la-link: #526c5a;
  --la-strong: #2f4937;
  --la-btn-text: #52685a;
  --la-btn-hover-bg: #fff;
  --la-btn-hover-text: #2f6a43;
  --la-active: #3e7250;
  --la-line: rgba(65, 94, 71, 0.14);
  --la-hover: rgba(95, 126, 104, 0.12);
  --la-panel: #ebfaeb;
  --la-shadow: 0 4px 14px rgba(48, 73, 55, 0.12);
  --la-pop-shadow: 0 12px 32px rgba(38, 61, 44, 0.18);
  --la-badge: #c94e4e;

  /* 让插槽里的评论、回帖框、打赏区跟随阅读配色 */
  --fp-card: var(--la-surface);
  --fp-bg: var(--la-soft);
  --fp-text: var(--la-text);
  --fp-title: var(--la-title);
  --fp-head: var(--la-muted);
  --fp-muted: var(--la-muted);
  --fp-border: var(--la-line);
  --fp-hover: var(--la-hover);
  --fp-primary: var(--la-active);
  --fp-link: var(--la-link);
  --fp-card-shadow: none;

  position: relative;
  isolation: isolate;
  min-height: 100vh;
  color: var(--la-text);
}
html:not([data-theme='classic-light']) .la {
  --la-page: #0a0a0a;
  --la-surface: #111111;
  --la-soft: #191919;
  --la-text: #989898;
  --la-title: #eef4ef;
  --la-muted: #858f88;
  --la-link: #8fc9a0;
  --la-strong: #a9c7b1;
  --la-btn-text: #989898;
  --la-btn-hover-bg: #222;
  --la-btn-hover-text: #d9e3db;
  --la-line: rgba(255, 255, 255, 0.08);
  --la-hover: rgba(255, 255, 255, 0.06);
  --la-panel: #1f1f1f;
  --la-shadow: none;
  --la-pop-shadow: 0 12px 32px rgba(0, 0, 0, 0.32);
}

.la-page-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: var(--la-page);
}

/* ---------- 正文 ---------- */
.la-article {
  box-sizing: border-box;
  width: var(--la-article-width);
  min-height: 100vh;
  margin-left: var(--la-article-left);
  background: var(--la-surface);
  transition:
    width 0.32s ease,
    margin-left 0.32s ease;
}
.la-wrapper {
  box-sizing: border-box;
  padding: 80px clamp(32px, 6vw, 64px) 64px;
}
.la-home {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  margin: 0 0 24px;
  padding: 0 10px 0 8px;
  border-radius: 5px;
  color: var(--la-link);
  font-size: 13px;
  text-decoration: none;
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.2s;
}
.la-home svg {
  width: 17px;
  height: 17px;
}
.la-home:hover {
  background: var(--la-hover);
  color: var(--la-strong);
  transform: translateX(-2px);
}
.la-title {
  margin: 0;
  color: var(--la-title);
  font-size: 32px;
  font-weight: 650;
  line-height: 1.35;
  word-break: break-word;
}
.la-perfect {
  margin-right: 4px;
}
.la-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-top: 14px;
  color: var(--la-muted);
  font-size: 14px;
  line-height: 1.6;
}
.la-meta a {
  color: var(--la-link);
  text-decoration: none;
}
.la-meta a:hover {
  color: var(--la-btn-hover-text);
}
.la-meta .la-author {
  color: var(--la-strong);
  font-weight: 600;
}
.la-sep {
  opacity: 0.6;
}
.la-statement {
  display: inline-block;
  margin: 16px 0 0;
  padding: 4px 10px;
  border-radius: 12px;
  background: var(--la-soft);
  color: var(--la-link);
  font-size: 13px;
  font-weight: 600;
}
.la-audio {
  display: block;
  width: 100%;
  margin-top: 20px;
}

.la-content {
  margin-top: 36px;
  color: var(--la-text);
  font-size: var(--la-font-size, 18px);
  line-height: 1.9;
  overflow-wrap: anywhere;
}
.la-content :deep(> p) {
  margin: 1.15em 0;
  text-indent: 2em;
}
.la-content :deep(> p.la-lines) {
  text-indent: 0;
}
.la-content :deep(.la-line) {
  display: block;
  text-indent: 2em;
}
.la-content :deep(> p:has(> img)),
.la-content :deep(> p:has(> picture)),
.la-content :deep(> p:has(> video)),
.la-content :deep(> p:has(> iframe)) {
  text-indent: 0;
}
.la-content :deep(> h1),
.la-content :deep(> h2),
.la-content :deep(> h3),
.la-content :deep(> h4),
.la-content :deep(> h5),
.la-content :deep(> h6) {
  margin: 1.8em 0 0.75em;
  color: var(--la-title);
  line-height: 1.45;
  text-indent: 0;
}
.la-content :deep(> ul),
.la-content :deep(> ol),
.la-content :deep(> blockquote),
.la-content :deep(> pre),
.la-content :deep(> table),
.la-content :deep(> figure) {
  margin-top: 1.35em;
  margin-bottom: 1.35em;
  text-indent: 0;
}
.la-content :deep(blockquote) {
  margin-inline: 0;
  padding: 0.15em 0 0.15em 0.9em;
  border-left: 3px solid color-mix(in srgb, var(--la-active) 45%, transparent);
  color: var(--la-muted);
  font-size: 0.94em;
  line-height: 1.8;
}
.la-content :deep(blockquote > *),
.la-content :deep(blockquote .la-line) {
  margin: 0;
  text-indent: 0;
}
.la-content :deep(blockquote > * + *) {
  margin-top: 0.5em;
}
.la-content :deep(a) {
  color: var(--la-link);
  text-underline-offset: 3px;
}
.la-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  cursor: zoom-in;
}
.la-content :deep(img.emoji) {
  width: 1.2em;
  height: 1.2em;
  vertical-align: -0.2em;
  cursor: default;
}
.la-content :deep(pre) {
  overflow-x: auto;
  padding: 14px;
  border-radius: 6px;
  background: var(--la-soft);
  font-size: 0.8em;
  line-height: 1.6;
}
.la-content :deep(:not(pre) > code) {
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: var(--la-soft);
  font-size: 0.88em;
}
.la-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85em;
}
.la-content :deep(th),
.la-content :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--la-line);
  text-align: left;
}
.la-content :deep(hr) {
  margin: 2em 0;
  border: 0;
  border-top: 1px solid var(--la-line);
}

.la-adjacent {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 28px 0 0;
  padding: 16px 0;
  border-top: 1px solid var(--la-line);
  border-bottom: 1px solid var(--la-line);
}
.la-adjacent-item {
  flex: 1 1 260px;
  min-width: 0;
}
.la-adjacent-item.right {
  text-align: right;
}
.la-adjacent-link {
  display: block;
  min-height: 64px;
  padding: 12px 14px;
  border: 1px solid var(--la-line);
  border-radius: 8px;
  background: var(--la-soft);
  color: var(--la-text);
  text-decoration: none;
  transition:
    background 0.2s,
    border-color 0.2s;
}
a.la-adjacent-link:hover {
  border-color: var(--la-active);
  background: var(--la-btn-hover-bg);
}
.la-adjacent-link.disabled {
  opacity: 0.55;
}
.la-adjacent-label {
  margin-bottom: 6px;
  color: var(--la-muted);
  font-size: 12px;
}
.la-adjacent-title {
  color: var(--la-title);
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.la-adjacent-preview {
  display: -webkit-box;
  margin-top: 6px;
  overflow: hidden;
  color: var(--la-muted);
  font-size: 13px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.la-ico-sun,
html[data-theme='classic-light'] .la-ico-moon {
  display: block;
}
.la-ico-moon,
html[data-theme='classic-light'] .la-ico-sun {
  display: none;
}
.la-read-stat {
  margin-top: 20px;
  padding: 14px 16px;
  border: 1px solid var(--la-line);
  border-radius: 8px;
  background: var(--la-soft);
  font-size: 13px;
}
.la-read-stat-title {
  margin-bottom: 10px;
  color: var(--la-title);
  font-weight: 600;
}
.la-read-stat-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}
.la-read-stat-items > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.la-read-stat-items span,
.la-read-stat-note {
  color: var(--la-muted);
}
.la-read-stat-items strong {
  color: var(--la-strong);
  font-weight: 600;
}
.la-read-stat-note {
  margin-top: 10px;
  font-size: 12px;
}
.la-reaction {
  margin-top: 24px;
}
.la-action-msg {
  margin: 12px 0 0;
  color: var(--la-muted);
  font-size: 13px;
}

/* ---------- 评论抽屉 ---------- */
.la-drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: var(--la-drawer-left);
  z-index: 115;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: var(--la-drawer-width);
  padding: 0 20px;
  overflow: hidden;
  overscroll-behavior: contain;
  border-left: 1px solid var(--la-line);
  background: var(--la-surface);
  opacity: 0;
  pointer-events: none;
  transform: translateX(24px);
  visibility: hidden;
  transition:
    left 0.32s ease,
    opacity 0.24s ease,
    transform 0.32s ease,
    visibility 0s linear 0.32s;
}
.la--comments .la-drawer {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
  visibility: visible;
  transition-delay: 0s;
}
.la-drawer-head {
  display: flex;
  align-items: center;
  margin: 0 -20px;
  padding: 22px 20px 16px;
  border-bottom: 1px solid var(--la-line);
}
.la-drawer-title {
  flex: 1;
  color: var(--la-title);
  font-size: 22px;
  font-weight: 650;
}
.la-drawer-title em {
  margin-left: 4px;
  color: var(--la-muted);
  font-size: 13px;
  font-style: normal;
  font-weight: 400;
}
.la-drawer-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 12px;
}
.la-drawer-reply {
  margin: 0 -20px;
  padding: 14px 20px;
  border-top: 1px solid var(--la-line);
}
.la-reply-trigger {
  display: block;
  width: 100%;
  min-height: 38px;
  box-sizing: border-box;
  padding: 0 12px;
  border: 1px solid var(--la-line);
  border-radius: 8px;
  background: var(--la-soft);
  color: var(--la-muted);
  font-size: 13px;
  line-height: 36px;
  text-align: left;
  text-decoration: none;
  cursor: text;
}
.la-round-btn {
  display: inline-flex;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--la-hover);
  color: var(--la-muted);
  cursor: pointer;
}
.la-round-btn:hover {
  color: var(--la-strong);
}
.la-round-btn svg {
  width: 18px;
  height: 18px;
}

.la-composer {
  position: fixed;
  bottom: 0;
  left: var(--la-article-left);
  z-index: 118;
  box-sizing: border-box;
  width: var(--la-stage-width);
  max-width: calc(100vw - 28px);
  padding: 12px 20px 18px;
  border-top: 1px solid var(--la-line);
  background: var(--la-surface);
  box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.16);
  transition:
    left 0.32s ease,
    width 0.32s ease;
}
.la-composer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--la-title);
  font-weight: 600;
}

/* ---------- 目录 ---------- */
.la-catalog {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 50%;
  z-index: 100;
  display: none;
  box-sizing: border-box;
  width: var(--la-catalog-width);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--la-surface);
  transform: translateX(-50%);
}
.la--catalog .la-catalog {
  display: block;
}
.la-catalog-inner {
  box-sizing: border-box;
  min-height: 100%;
  padding: 64px clamp(32px, 6vw, 64px);
}
.la-catalog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--la-line);
}
.la-catalog-head h2 {
  margin: 0;
  color: var(--la-title);
  font-size: 28px;
  font-weight: 650;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.la-catalog-head span {
  display: block;
  margin-top: 6px;
  color: var(--la-muted);
  font-size: 13px;
}
.la-icon-btn {
  display: inline-flex;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--la-muted);
  cursor: pointer;
}
.la-icon-btn svg {
  width: 20px;
  height: 20px;
}
.la-icon-btn:hover {
  background: var(--la-hover);
  color: var(--la-btn-hover-text);
}
.la-chapters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
  margin-top: 12px;
}
.la-chapter {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  min-height: 58px;
  box-sizing: border-box;
  padding: 8px 12px;
  border-bottom: 1px solid var(--la-line);
  color: var(--la-text);
  text-decoration: none;
}
.la-chapter:hover {
  background: var(--la-hover);
  color: var(--la-btn-hover-text);
}
.la-chapter.active {
  background: var(--la-hover);
  box-shadow: inset 3px 0 var(--la-active);
  color: var(--la-strong);
  font-weight: 600;
}
.la-chapter-no {
  color: var(--la-muted);
  font-size: 13px;
  white-space: nowrap;
}
.la-chapter-title {
  min-width: 0;
  font-size: 16px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

/* ---------- 工具栏 ---------- */
.la-toolbar {
  position: fixed;
  top: max(14px, min(40vh, calc(100vh - 550px)));
  left: var(--la-toolbar-left);
  z-index: 121;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: left 0.32s ease;
}
.la-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 64px;
  height: 64px;
  box-sizing: border-box;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: var(--la-surface);
  box-shadow: var(--la-shadow);
  color: var(--la-btn-text);
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.2s;
}
.la-btn:hover {
  background: var(--la-btn-hover-bg);
  color: var(--la-btn-hover-text);
  transform: translateX(2px);
}
.la-btn.active {
  background: var(--la-active);
  color: #fff;
}
.la-btn svg {
  width: 18px;
  height: 18px;
}
.la-btn.disabled {
  box-shadow: none;
  cursor: default;
  opacity: 0.38;
  pointer-events: none;
}
.la-dots {
  font-size: 18px;
  line-height: 1;
}
.la-btn--top {
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translateY(10px) scale(0.94);
  visibility: hidden;
  transition:
    height 0.24s ease,
    opacity 0.2s ease,
    transform 0.24s ease,
    visibility 0s linear 0.24s;
}
.la-btn--top.visible {
  height: 64px;
  opacity: 1;
  pointer-events: auto;
  transform: none;
  visibility: visible;
  transition-delay: 0s;
}
.la-chapter-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.la-btn--chapter {
  flex-direction: row;
  gap: 2px;
  height: 44px;
  font-size: 11px;
}
.la-btn--chapter svg {
  width: 14px;
  height: 14px;
}
.la-count {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  box-sizing: border-box;
  padding: 1px 5px;
  border-radius: 10px;
  background: var(--la-badge);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}

.la-pop-wrap {
  position: relative;
}
.la-more {
  position: absolute;
  right: 74px;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  width: 196px;
  padding: 8px;
  border: 1px solid var(--la-line);
  border-radius: 8px;
  background: var(--la-surface);
  box-shadow: var(--la-pop-shadow);
  opacity: 0;
  pointer-events: none;
  transform: translateX(8px);
  visibility: hidden;
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.la-more.open {
  opacity: 1;
  pointer-events: auto;
  transform: none;
  visibility: visible;
}
.la-more-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  height: 34px;
  padding: 0 7px;
  border: 0;
  border-radius: 6px;
  background: var(--la-soft);
  color: var(--la-btn-text);
  font-size: 12px;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}
.la-more-item:hover:not(:disabled) {
  background: var(--la-btn-hover-bg);
  color: var(--la-btn-hover-text);
}
.la-more-item.on {
  color: var(--la-badge);
}
.la-more-item:disabled {
  cursor: default;
}
.la-more-item.wide {
  grid-column: 1 / -1;
}
.la-more-report :deep(.ghost) {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 12px;
}

.la-layout {
  position: absolute;
  right: 80px;
  bottom: 0;
  display: none;
  box-sizing: border-box;
  width: 360px;
  padding: 24px;
  border: 1px solid var(--la-line);
  border-radius: 10px;
  background: var(--la-panel);
  box-shadow: var(--la-pop-shadow);
}
.la-layout.open {
  display: block;
}
.la-layout-title {
  margin-bottom: 20px;
  color: var(--la-btn-text);
  font-size: 18px;
  font-weight: 600;
}
.la-layout-row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  color: var(--la-btn-text);
  font-size: 13px;
}
.la-font {
  display: grid;
  grid-template-columns: 44px minmax(64px, 1fr) 44px;
  align-items: center;
  gap: 7px;
}
.la-font output {
  text-align: center;
}
.la-widths {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}
.la-font button,
.la-widths button {
  height: 34px;
  padding: 0 8px;
  border: 1px solid var(--la-line);
  border-radius: 5px;
  background: var(--la-soft);
  color: var(--la-btn-text);
  font-size: 12px;
  cursor: pointer;
}
.la-font button:hover,
.la-widths button:hover,
.la-widths button.active {
  border-color: var(--la-active);
  color: var(--la-btn-hover-text);
}
.la-widths button.active {
  font-weight: 600;
}

@media (max-width: 768px) {
  .la-wrapper {
    padding: 36px 24px;
  }
  .la-title {
    font-size: 26px;
  }
  .la-content {
    margin-top: 28px;
  }
  .la-toolbar {
    right: 8px;
    left: auto;
  }
  .la-btn {
    width: 54px;
    height: 54px;
  }
  .la-btn--top.visible {
    height: 54px;
  }
  .la-layout {
    right: 64px;
    width: min(340px, calc(100vw - 90px));
  }
  .la-more {
    right: 64px;
  }
  .la-catalog-inner {
    padding: 36px 24px;
  }
  .la-catalog-head h2 {
    font-size: 24px;
  }
  .la-chapters {
    grid-template-columns: 1fr;
  }
  .la-chapter {
    grid-template-columns: 78px minmax(0, 1fr);
    gap: 10px;
    padding-right: 8px;
    padding-left: 8px;
  }
  .la-drawer {
    padding: 0 18px;
  }
}
</style>
