<script setup lang="ts">
import { articleTitle } from '@/utils/text'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchArticle,
  fetchArticleHeat,
  fetchArticleRevision,
  fetchArticleRevisions,
  fetchCommentContent,
  fetchRandomArticles,
  followArticle,
  postComment,
  previewMarkdown,
  removeComment,
  rewardArticle,
  thankArticle,
  thankComment,
  toggleReaction,
  unfollowArticle,
  unwatchArticle,
  updateComment,
  acceptComment,
  voteArticle,
  voteComment,
  watchArticle,
  applyReactionPayload,
  type ArticleComment,
  type ArticleDetail,
  type ArticleRevisionMeta,
  type ArticleSummary,
  type ReactionSummary,
} from '@/api/fishpi'
import ChatComposer from '@/components/ChatComposer.vue'
import MetalBadges from '@/components/MetalBadges.vue'
import ReactionBar from '@/components/ReactionBar.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeArticlePayload } from '@/seo/payload'
import { absoluteUrl, SITE_DEFAULT_DESC, stripHtml } from '@/seo/site'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'
import ArticleSkeleton from '@/components/ArticleSkeleton.vue'
import CommentItem from '@/components/CommentItem.vue'
import ImageLightbox from '@/components/ImageLightbox.vue'
import { readCache, writeCache } from '@/utils/swr'

const route = useRoute()
const auth = useAuthStore()
const { apiKey, isLoggedIn, account } = storeToRefs(auth)

const article = ref<ArticleDetail | null>(null)
const loading = ref(true)
const error = ref('')
const draft = ref('')
const sending = ref(false)
const sendError = ref('')
const actionMsg = ref('')
const rewarding = ref(false)
const rewardError = ref('')
const zoomed = ref('')
const replyId = ref('')
const commentPage = ref(1)
const heat = ref(0)
const editingId = ref('')
const editDraft = ref('')
const editSaving = ref(false)
const bodyEl = ref<HTMLElement | null>(null)
const toc = ref<{ id: string; text: string; level: number }[]>([])
const showRevisions = ref(false)
const revisions = ref<ArticleRevisionMeta[]>([])
const revisionLoading = ref(false)
const revisionError = ref('')
const activeRevisionId = ref('')
const revisionTitle = ref('')
const revisionHtml = ref('')
const revisionBusy = ref(false)
let heatWs: WebSocket | null = null

const id = computed(() => String(route.params.id || ''))
const tocReady = ref(false)
const hasToc = computed(() =>
  tocReady.value ? toc.value.length > 0 : /<h[1-3][\s>]/i.test(article.value?.articleContent || ''),
)

async function buildToc() {
  await nextTick()
  const root = bodyEl.value
  if (!root) {
    toc.value = []
    return
  }
  const nodes = [...root.querySelectorAll('h1, h2, h3')]
  toc.value = nodes.map((el, i) => {
    if (!el.id) el.id = `toc-${i}`
    return {
      id: el.id,
      text: (el.textContent || '').trim(),
      level: Number(el.tagName.slice(1)) || 2,
    }
  }).filter((item) => item.text)
  tocReady.value = true
}

function jumpToc(anchor: string) {
  document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function toggleRevisions() {
  showRevisions.value = !showRevisions.value
  if (!showRevisions.value || !apiKey.value || !id.value) return
  if (revisions.value.length) return
  revisionLoading.value = true
  revisionError.value = ''
  try {
    revisions.value = await fetchArticleRevisions(apiKey.value, id.value)
  } catch (e) {
    revisionError.value = e instanceof Error ? e.message : '修订历史加载失败'
  } finally {
    revisionLoading.value = false
  }
}

async function openRevision(revisionId: string) {
  if (!apiKey.value || !id.value) return
  revisionBusy.value = true
  revisionError.value = ''
  activeRevisionId.value = revisionId
  try {
    const rev = await fetchArticleRevision(apiKey.value, id.value, revisionId)
    revisionTitle.value = rev.revisionData?.articleTitle || ''
    const md = rev.revisionData?.articleContent || ''
    revisionHtml.value = md ? await previewMarkdown(md) : '<p>（无正文）</p>'
  } catch (e) {
    revisionError.value = e instanceof Error ? e.message : '修订内容加载失败'
    revisionHtml.value = ''
  } finally {
    revisionBusy.value = false
  }
}

const comments = computed<ArticleComment[]>(() => article.value?.articleComments || [])
const nice = computed(() => article.value?.articleNiceComments || [])
/** 一级评论 + 其下全部回复（多级回复拍平到根评论下，按原顺序）。 */
const threads = computed(() => {
  const list = comments.value
  const byId = new Map(list.map((c) => [c.oId, c]))
  const rootOf = (c: ArticleComment) => {
    let cur = c
    const seen = new Set<string>()
    while (cur.commentOriginalCommentId && byId.has(cur.commentOriginalCommentId) && !seen.has(cur.oId)) {
      seen.add(cur.oId)
      cur = byId.get(cur.commentOriginalCommentId)!
    }
    return cur
  }
  const replies = new Map<string, ArticleComment[]>()
  const roots: ArticleComment[] = []
  for (const c of list) {
    const root = rootOf(c)
    if (root === c) roots.push(c)
    else replies.set(root.oId, [...(replies.get(root.oId) || []), c])
  }
  return roots.map((c) => ({ c, replies: replies.get(c.oId) || [] }))
})
const commentPages = computed(() => Number(article.value?.pagination?.paginationPageCount || 1))
const tagList = computed(() =>
  String(article.value?.articleTags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean),
)
const metals = computed(() => article.value?.sysMetal || article.value?.articleAuthor?.sysMetal || [])
const canEdit = computed(
  () => article.value?.isMyArticle || article.value?.articleAuthorName === account.value?.userName,
)
const isQnA = computed(() => Number(article.value?.articleType) === 5)
const isLong = computed(() => Number(article.value?.articleType) === 6)
const column = computed(() => article.value?.longArticleColumnView || null)
const commentTotal = computed(() => Number(article.value?.articleCommentCount ?? comments.value.length))

const TYPE_BADGES: Record<number, string> = { 1: '🔒 机要', 2: '📢 同城广播', 3: '💭 思绪', 5: '❓ 问答', 6: '📖 长文章' }
const STATEMENT_LABELS: Record<number, string> = {
  1: '包含 AI 辅助创作',
  2: '包含剧透',
  3: '虚构演绎，仅供娱乐',
}
const typeBadge = computed(() => TYPE_BADGES[Number(article.value?.articleType)] || '')
const statementLabel = computed(() => STATEMENT_LABELS[Number(article.value?.articleStatement)] || '')

const randomArticles = ref<ArticleSummary[]>([])
const composerRef = ref<InstanceType<typeof ChatComposer> | null>(null)
const shareCopied = ref(false)
const shareUrl = computed(() => {
  const base = absoluteUrl(`/article/${id.value}`)
  return account.value?.userName ? `${base}?r=${encodeURIComponent(account.value.userName)}` : base
})
const weiboShareUrl = computed(
  () =>
    `https://service.weibo.com/share/share.php?title=${encodeURIComponent(article.value?.articleTitle || '')}&url=${encodeURIComponent(shareUrl.value)}`,
)
const twitterShareUrl = computed(
  () =>
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.value?.articleTitle || '')}&url=${encodeURIComponent(shareUrl.value)}`,
)

async function copyShare() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    shareCopied.value = true
    setTimeout(() => (shareCopied.value = false), 2000)
  } catch {
    actionMsg.value = '复制失败，请手动复制地址栏链接'
  }
}

function gotoCommentPage(page: number) {
  commentPage.value = page
  document.getElementById('articleCommentsPanel')?.scrollIntoView({ block: 'start' })
}

async function loadRandom() {
  if (import.meta.env.SSR) return
  randomArticles.value = (await fetchRandomArticles(10, apiKey.value)).filter((a) => a.oId !== id.value)
}

const articleDesc = computed(() => {
  const raw = article.value?.articleContent || article.value?.articleOriginalContent || ''
  return stripHtml(raw) || SITE_DEFAULT_DESC
})

usePageSeo(() => {
  const a = article.value
  if (!a) {
    return { title: '帖子', path: route.fullPath, robots: 'index,follow' }
  }
  const author = a.articleAuthorName || a.articleAuthor?.userName || ''
  return {
    title: articleTitle(a),
    description: articleDesc.value,
    path: `/article/${a.oId}`,
    image: a.articleAuthorThumbnailURL48,
    type: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: articleTitle(a),
      description: articleDesc.value,
      author: author
        ? { '@type': 'Person', name: author, url: absoluteUrl(`/member/${author}`) }
        : undefined,
      datePublished: a.articleCreateTimeStr || undefined,
      mainEntityOfPage: absoluteUrl(`/article/${a.oId}`),
      image: a.articleAuthorThumbnailURL48 || absoluteUrl('/favicon.svg'),
    },
  }
})

function isOwnComment(c: ArticleComment) {
  return Boolean(account.value && (c.commentAuthorName === account.value.userName || c.commentAuthorId === account.value.oId))
}

function disconnectHeat() {
  heatWs?.close()
  heatWs = null
}

function commentFromWs(msg: Record<string, unknown>): ArticleComment | null {
  const oId = String(msg.oId || msg.commentId || '')
  if (!oId) return null
  return {
    oId,
    commentAuthorName: String(msg.commentAuthorName || ''),
    commentAuthorThumbnailURL: String(msg.commentAuthorThumbnailURL || ''),
    commentContent: String(msg.commentContent || ''),
    commentCreateTimeStr: String(msg.commentCreateTimeStr || ''),
    timeAgo: String(msg.timeAgo || ''),
    commentThankCnt: Number(msg.commentThankCnt || 0),
    commentOriginalCommentId: String(msg.commentOriginalCommentId || ''),
    commentGoodCnt: Number(msg.commentGoodCnt || 0),
    commentVote: Number(msg.commentVote ?? -1),
    rewarded: Boolean(msg.rewarded),
    commentAuthorId: String(msg.commentAuthorId || ''),
  }
}

function connectHeat() {
  disconnectHeat()
  if (import.meta.env.SSR || typeof WebSocket === 'undefined') return
  if (!id.value || String(id.value).startsWith('mock-')) return
  const params = new URLSearchParams({
    articleId: id.value,
    articleType: String(article.value?.articleType ?? 0),
  })
  if (apiKey.value) params.set('apiKey', apiKey.value)
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  heatWs = new WebSocket(`${proto}//${location.host}/article-channel?${params}`)
  heatWs.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data) as Record<string, unknown>
      const type = String(msg.type || '')
      if (type === 'articleHeat') {
        if (typeof msg.articleHeat === 'number') heat.value = msg.articleHeat
        else if (msg.operation === '+') heat.value += 1
        else if (msg.operation === '-' && heat.value > 0) heat.value -= 1
      } else if (type === 'comment' && article.value) {
        const c = commentFromWs(msg)
        if (!c || article.value.articleComments?.some((x) => x.oId === c.oId)) return
        article.value.articleComments = [...(article.value.articleComments || []), c]
        article.value.articleCommentCount = Number(article.value.articleCommentCount || 0) + 1
      } else if ((type === 'articleReaction' || type === 'commentReaction') && article.value) {
        const summary = (msg.summary || msg.reactionSummary) as ReactionSummary[] | undefined
        const current = String(msg.actorReaction ?? msg.currentUserReaction ?? '')
        if (type === 'articleReaction') {
          applyReactionPayload(article.value, { summary, currentUserReaction: current })
        } else {
          const cid = String(msg.targetId || msg.commentId || '')
          const c = article.value.articleComments?.find((x) => x.oId === cid)
          if (c) applyReactionPayload(c, { summary, currentUserReaction: current })
        }
      }
    } catch {
      /* ignore */
    }
  }
}

async function refreshHeat() {
  if (import.meta.env.SSR) return
  if (!id.value || String(id.value).startsWith('mock-')) return
  try {
    heat.value = await fetchArticleHeat(id.value, apiKey.value)
  } catch {
    heat.value = Number(article.value?.articleHeat || 0)
  }
}

async function load() {
  if (!id.value) return
  const cached = commentPage.value === 1 ? consumeArticlePayload(id.value) : null
  if (cached) {
    article.value = cached
    loading.value = false
    error.value = ''
    heat.value = Number(cached.articleHeat || 0)
    void buildToc()
    // SSR 不带登录态，rewarded / thanked / isFollowing 等需要用 apiKey 再取一次
    if (import.meta.env.SSR || !apiKey.value) {
      writeCache(`article:${id.value}:1`, cached)
      if (!import.meta.env.SSR) {
        await refreshHeat()
        connectHeat()
      }
      return
    }
  }
  const reqId = id.value
  const cacheKey = `article:${reqId}:${commentPage.value}`
  const paging = article.value?.oId === reqId
  const hit = cached || readCache<ArticleDetail>(cacheKey)
  if (hit) {
    article.value = hit
    heat.value = Number(hit.articleHeat || 0)
    loading.value = false
    void buildToc()
  } else if (!paging) {
    loading.value = true
    article.value = null
  }
  error.value = ''
  try {
    const data = await fetchArticle(reqId, apiKey.value, commentPage.value)
    if (reqId !== id.value) return
    writeCache(cacheKey, data)
    article.value = data
    heat.value = Number(data.articleHeat || 0)
    loading.value = false
    void buildToc()
    await refreshHeat()
    connectHeat()
  } catch (e) {
    if (reqId !== id.value || hit) return
    error.value = e instanceof Error ? e.message : '帖子加载失败'
    disconnectHeat()
    toc.value = []
  } finally {
    if (reqId === id.value) loading.value = false
  }
}

onUnmounted(() => disconnectHeat())

watch(
  () => id.value,
  () => {
    commentPage.value = 1
    void loadRandom()
  },
  { immediate: true },
)

watch(
  () => [id.value, apiKey.value, commentPage.value],
  () => {
    void load()
  },
  { immediate: true },
)

async function submit() {
  if (!apiKey.value || !draft.value.trim()) return
  sending.value = true
  sendError.value = ''
  try {
    await postComment(apiKey.value, id.value, draft.value.trim(), replyId.value)
    draft.value = ''
    replyId.value = ''
    await load()
  } catch (e) {
    sendError.value = e instanceof Error ? e.message : '评论失败'
  } finally {
    sending.value = false
  }
}

async function vote() {
  if (!apiKey.value) return
  try {
    const type = await voteArticle(apiKey.value, id.value)
    actionMsg.value = type === 0 ? '已取消点赞' : '点赞成功'
    await load()
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '点赞失败'
  }
}

async function thank() {
  if (!apiKey.value) return
  try {
    await thankArticle(apiKey.value, id.value)
    actionMsg.value = '已感谢作者'
    await load()
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '感谢失败'
  }
}

async function toggleCollect() {
  if (!apiKey.value || !article.value) return
  try {
    if (article.value.isFollowing) await unfollowArticle(apiKey.value, id.value)
    else await followArticle(apiKey.value, id.value)
    await load()
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '收藏失败'
  }
}

async function toggleWatch() {
  if (!apiKey.value || !article.value) return
  try {
    if (article.value.isWatching) await unwatchArticle(apiKey.value, id.value)
    else await watchArticle(apiKey.value, id.value)
    await load()
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '关注失败'
  }
}

async function reward() {
  const a = article.value
  if (!apiKey.value || !a || rewarding.value) return
  if (!window.confirm(`确定打赏 ${a.articleRewardPoint} 积分查看打赏区内容？`)) return
  rewarding.value = true
  rewardError.value = ''
  try {
    const html = await rewardArticle(apiKey.value, id.value)
    a.rewarded = true
    a.rewardedCnt = Number(a.rewardedCnt || 0) + 1
    if (html) a.articleRewardContent = html
    void load()
  } catch (e) {
    rewardError.value = e instanceof Error ? e.message : '打赏失败'
  } finally {
    rewarding.value = false
  }
}

async function onThankComment(c: ArticleComment) {
  if (!apiKey.value) return
  try {
    await thankComment(apiKey.value, c.oId)
    await load()
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '感谢评论失败'
  }
}

async function onVoteComment(c: ArticleComment) {
  if (!apiKey.value) return
  try {
    await voteComment(apiKey.value, c.oId)
    await load()
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '点赞评论失败'
  }
}

async function onRemoveComment(c: ArticleComment) {
  if (!apiKey.value) return
  try {
    await removeComment(apiKey.value, c.oId)
    await load()
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '删除失败'
  }
}

async function startEdit(c: ArticleComment) {
  if (!apiKey.value) return
  try {
    editDraft.value = await fetchCommentContent(apiKey.value, c.oId)
    editingId.value = c.oId
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '无法读取评论原文'
  }
}

async function saveEdit() {
  if (!apiKey.value || !editingId.value || !editDraft.value.trim()) return
  editSaving.value = true
  try {
    await updateComment(apiKey.value, editingId.value, editDraft.value.trim())
    editingId.value = ''
    editDraft.value = ''
    await load()
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '更新评论失败'
  } finally {
    editSaving.value = false
  }
}

async function onAccept(c: ArticleComment) {
  if (!apiKey.value) return
  try {
    await acceptComment(apiKey.value, c.oId)
    await load()
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '采纳失败'
  }
}

function who(c: ArticleComment) {
  return c.commentAuthorName || '匿名'
}

function parentAuthor(c: ArticleComment) {
  const parent = comments.value.find((x) => x.oId === c.commentOriginalCommentId)
  return parent ? who(parent) : ''
}

function startReply(c: ArticleComment) {
  replyId.value = c.oId
  if (composerRef.value) composerRef.value.reveal()
  else document.querySelector('.composer-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function onContentClick(e: MouseEvent) {
  const img = (e.target as HTMLElement | null)?.closest('img')
  if (!img || img.classList.contains('emoji') || img.closest('a')) return
  zoomed.value = img.currentSrc || img.src
}

function itemProps(c: ArticleComment) {
  const own = isLoggedIn.value && isOwnComment(c)
  return {
    comment: c,
    loggedIn: isLoggedIn.value,
    own,
    canAccept: isLoggedIn.value && canEdit.value && isQnA.value && !c.commentQnAOffered && !own,
    editing: editingId.value === c.oId,
    apiKey: apiKey.value,
  }
}

function itemHandlers(c: ArticleComment) {
  return {
    reply: () => startReply(c),
    vote: () => onVoteComment(c),
    thank: () => onThankComment(c),
    edit: () => startEdit(c),
    remove: () => onRemoveComment(c),
    accept: () => onAccept(c),
    react: (v: string) => onReactComment(c, v),
  }
}

async function onReactArticle(value: string) {
  if (!apiKey.value || !article.value) return
  try {
    const data = await toggleReaction(apiKey.value, 'article', id.value, value)
    applyReactionPayload(article.value, data)
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '表情失败'
  }
}

async function onReactComment(c: ArticleComment, value: string) {
  if (!apiKey.value) return
  try {
    const data = await toggleReaction(apiKey.value, 'comment', c.oId, value)
    applyReactionPayload(c, data)
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '表情失败'
  }
}
</script>

<template>
  <ArticleSkeleton v-if="loading" />
  <article v-else-if="error" class="card load-error">
    <p class="err">{{ error }}</p>
    <p class="retry"><button type="button" class="btn" @click="load()">重新加载</button></p>
    <p v-if="!isLoggedIn" class="hint">
      <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
      后可查看需要权限的帖子。
    </p>
  </article>
  <div v-else-if="article" class="wrap" :class="{ 'has-toc': hasToc }">
    <aside v-if="toc.length" class="toc">
      <b>目录</b>
      <a
        v-for="item in toc"
        :key="item.id"
        :class="'lv' + item.level"
        href="#"
        @click.prevent="jumpToc(item.id)"
      >{{ item.text }}</a>
    </aside>
    <article class="card post">
      <div class="article-title-row">
        <span v-if="article.articlePerfect" class="icon-perfect" title="优选">🌟</span>
        <h1>{{ articleTitle(article) }}</h1>
      </div>

      <div v-if="typeBadge || Number(article.articleStickRemains) > 0 || column" class="badges">
        <span v-if="typeBadge" class="badge">{{ typeBadge }}</span>
        <span v-if="isQnA && Number(article.articleQnAOfferPoint) > 0" class="badge offer">
          {{ article.offered ? '已采纳' : `悬赏 ${article.articleQnAOfferPoint} 积分` }}
        </span>
        <span v-if="Number(article.articleStickRemains) > 0" class="badge stick">
          📌 置顶中 · 剩余 {{ article.articleStickRemains }} 分钟
        </span>
        <RouterLink v-if="column" :to="`/column/${column.column.oId}`" class="badge column-link">
          《{{ column.column.columnTitle }}》第 {{ column.chapterNo }} 章 / 共 {{ column.chapters.length }} 章
        </RouterLink>
      </div>

      <div class="meta">
        <RouterLink
          v-if="article.articleAuthorName"
          :to="`/member/${article.articleAuthorName}`"
          class="meta-author"
        >
          <span
            class="avatar-small"
            :style="article.articleAuthorThumbnailURL48 ? { backgroundImage: `url('${article.articleAuthorThumbnailURL48}')` } : undefined"
          />
          <b>{{ article.articleAuthorName }}</b>
        </RouterLink>
        <span v-else class="meta-author">匿名用户</span>
        <span>•</span>
        <time>{{ article.articleCreateTimeStr || article.timeAgo }}</time>
        <span>•</span>
        <span>{{ article.articleViewCntDisplayFormat || article.articleViewCount }} 浏览</span>
        <span>•</span>
        <span>{{ commentTotal }} 评论</span>
        <span v-if="heat">（{{ heat }} 在看）</span>
      </div>

      <div v-if="tagList.length" class="tags">
        <RouterLink v-for="t in tagList" :key="t" :to="`/tags/${encodeURIComponent(t)}`" class="tag-pill">
          # {{ t }}
        </RouterLink>
      </div>

      <div v-if="metals.length" class="article-metals">
        <MetalBadges :items="metals" />
      </div>

      <p v-if="String(article.oId).startsWith('mock-')" class="hint">
        匿名详情接口未开放，当前为 mock 正文。
      </p>

      <p v-if="statementLabel" class="statement">创作声明：{{ statementLabel }}</p>

      <audio v-if="article.articleAudioURL" class="article-audio" :src="article.articleAudioURL" controls preload="none" />

      <div ref="bodyEl" class="body" @click="onContentClick" v-html="article.articleContent || ''" />

      <section v-if="Number(article.articleRewardPoint) > 0" class="reward-box" :class="{ unlocked: article.rewarded }">
        <header class="reward-head">
          <span class="reward-title">🎁 打赏区</span>
          <span class="reward-meta">
            {{ article.articleRewardPoint }} 积分<template v-if="Number(article.rewardedCnt) > 0"> · {{ article.rewardedCnt }} 人已打赏</template>
          </span>
        </header>
        <div
          v-if="article.rewarded"
          class="body reward-body"
          @click="onContentClick"
          v-html="article.articleRewardContent || '<p>打赏区暂无内容</p>'"
        />
        <div v-else class="reward-locked">
          <p>作者设置了打赏区，打赏 <b>{{ article.articleRewardPoint }}</b> 积分后可见</p>
          <button v-if="isLoggedIn" type="button" class="btn orange small" :disabled="rewarding" @click="reward">
            {{ rewarding ? '打赏中…' : `打赏 ${article.articleRewardPoint} 积分` }}
          </button>
          <RouterLink v-else :to="{ path: '/login', query: { redirect: route.fullPath } }" class="btn orange small">
            登录后打赏
          </RouterLink>
          <p v-if="rewardError" class="err-tip">{{ rewardError }}</p>
        </div>
      </section>

      <nav v-if="column && (column.previous || column.next)" class="chapter-nav">
        <RouterLink v-if="column.previous" :to="column.previous.articlePermalink" class="chapter-link">
          ← 第 {{ column.previous.chapterNo }} 章 {{ articleTitle(column.previous) }}
        </RouterLink>
        <span v-else />
        <RouterLink v-if="column.next" :to="column.next.articlePermalink" class="chapter-link next">
          第 {{ column.next.chapterNo }} 章 {{ articleTitle(column.next) }} →
        </RouterLink>
      </nav>

      <!-- 文章底部互动操作栏 -->
      <div class="article-tail-bar">
        <div v-if="isLoggedIn" class="actions">
          <button type="button" class="btn small" @click="vote">👍 点赞</button>
          <button type="button" class="btn small" :disabled="article.thanked" @click="thank">
            {{ article.thanked ? '❤️ 已感谢' : '❤️ 感谢' }}
          </button>
          <button type="button" class="btn small" @click="toggleCollect">
            {{ article.isFollowing ? '★ 取消收藏' : '☆ 收藏' }}
          </button>
          <button type="button" class="btn small" @click="toggleWatch">
            {{ article.isWatching ? '取消关注' : '+ 关注帖子' }}
          </button>
          <RouterLink v-if="canEdit" class="btn small edit-btn" :to="`/post/${article.oId}`">编辑</RouterLink>
          <button v-if="Number(article.articleRevisionCount ?? 2) > 1" type="button" class="btn small" @click="toggleRevisions">
            {{ showRevisions ? '收起历史' : '修订历史' }}
          </button>
          <ReportDialog :api-key="apiKey" :data-id="article.oId" :data-type="0" />
        </div>
        <div class="share-row">
          <span class="share-label">分享</span>
          <button type="button" class="btn-text" @click="copyShare">{{ shareCopied ? '✅ 已复制' : '🔗 复制链接' }}</button>
          <a class="btn-text" :href="weiboShareUrl" target="_blank" rel="noopener noreferrer">微博</a>
          <a class="btn-text" :href="twitterShareUrl" target="_blank" rel="noopener noreferrer">Twitter</a>
        </div>
        <p v-if="actionMsg" class="action-alert">{{ actionMsg }}</p>
      </div>

      <!-- 修订历史展开卡片 -->
      <section v-if="showRevisions" class="revisions">
        <h3>修订历史</h3>
        <FpLoading v-if="revisionLoading" />
        <p v-else-if="revisionError" class="err">{{ revisionError }}</p>
        <ol v-else class="rev-list">
          <li v-for="rev in revisions" :key="rev.revisionId">
            <button
              type="button"
              class="btn small"
              :class="{ on: activeRevisionId === rev.revisionId }"
              :disabled="revisionBusy"
              @click="openRevision(rev.revisionId)"
            >
              #{{ rev.revisionIndex ?? '' }}
              {{ rev.revisionTimeStr || rev.revisionId }}
              <em v-if="rev.current">当前</em>
            </button>
          </li>
        </ol>
        <div v-if="activeRevisionId" class="rev-preview">
          <h4>{{ revisionTitle || '修订预览' }}</h4>
          <p v-if="revisionBusy" class="hint">渲染中…</p>
          <div v-else class="body" v-html="revisionHtml" />
        </div>
      </section>

      <!-- 表情回应栏 -->
      <div class="reaction-wrap">
        <ReactionBar
          :summary="article.reactionSummary"
          :current="article.currentUserReaction"
          :disabled="!isLoggedIn"
          @toggle="onReactArticle"
        />
      </div>

      <!-- 作者信息卡片 (对齐现网 Rhythm .article__meta) -->
      <div v-if="article.articleAuthorName" class="author-summary-card">
        <RouterLink :to="`/member/${article.articleAuthorName}`" class="summary-avatar-link">
          <span
            class="summary-avatar"
            :style="article.articleAuthorThumbnailURL48 ? { backgroundImage: `url('${article.articleAuthorThumbnailURL48}')` } : undefined"
          />
        </RouterLink>
        <div class="summary-meta">
          <div class="summary-name-row">
            <RouterLink :to="`/member/${article.articleAuthorName}`" class="summary-name">
              {{ article.articleAuthorName }}
            </RouterLink>
            <span v-if="article.articleCity" class="summary-city">
              📍 {{ article.articleCity }}
            </span>
          </div>
          <div class="summary-counts">
            <span>获赞 {{ article.articleGoodCnt ?? 0 }}</span>
            <span>•</span>
            <span>被收藏 {{ article.articleCollectCnt ?? 0 }}</span>
            <span>•</span>
            <span>回帖 {{ commentTotal }}</span>
          </div>
        </div>
      </div>
    </article>

    <section v-if="nice.length" class="card nice-comments-card">
      <div class="module-header">
        <span><b>✨ 优质回帖</b></span>
      </div>
      <div class="comments-list">
        <CommentItem v-for="c in nice" :key="'n' + c.oId" class="cmt-root" :comment="c" readonly />
      </div>
    </section>

    <section id="articleCommentsPanel" class="card comments-card">
      <div class="module-header comments-header">
        <span><b>💬 全部回帖 ({{ commentTotal }})</b></span>
      </div>

      <div class="comments-list">
        <CommentItem
          v-for="t in threads"
          :key="t.c.oId"
          v-bind="itemProps(t.c)"
          class="cmt-root"
          v-on="itemHandlers(t.c)"
        >
          <template #editor>
            <div class="edit-box">
              <textarea v-model="editDraft" rows="3" />
              <div class="edit-box-btns">
                <button type="button" class="btn small" :disabled="editSaving || !editDraft.trim()" @click="saveEdit">保存</button>
                <button type="button" class="btn small ghost" @click="editingId = ''">取消</button>
              </div>
            </div>
          </template>
          <template v-if="t.replies.length" #default>
            <CommentItem
              v-for="r in t.replies"
              :key="r.oId"
              v-bind="itemProps(r)"
              reply
              :reply-to="parentAuthor(r)"
              v-on="itemHandlers(r)"
            >
              <template #editor>
                <div class="edit-box">
                  <textarea v-model="editDraft" rows="3" />
                  <div class="edit-box-btns">
                    <button type="button" class="btn small" :disabled="editSaving || !editDraft.trim()" @click="saveEdit">保存</button>
                    <button type="button" class="btn small ghost" @click="editingId = ''">取消</button>
                  </div>
                </div>
              </template>
            </CommentItem>
          </template>
        </CommentItem>
      </div>

      <p v-if="!comments.length" class="empty-hint">暂无回帖，快来抢沙发吧～</p>
      <footer v-if="commentPages > 1" class="pager">
        <button type="button" class="btn small" :disabled="commentPage <= 1" @click="gotoCommentPage(commentPage - 1)">上一页</button>
        <span class="pager-info">{{ commentPage }} / {{ commentPages }}</span>
        <button type="button" class="btn small" :disabled="commentPage >= commentPages" @click="gotoCommentPage(commentPage + 1)">下一页</button>
      </footer>
    </section>

    <!-- 底部发表回帖区域 -->
    <section class="card composer-card">
      <div class="module-header">
        <span><b>参与讨论</b></span>
      </div>
      <div class="composer-inner">
        <p v-if="article.articleCommentable === false" class="hint-login">作者已关闭回帖。</p>
        <template v-else-if="isLoggedIn">
          <p v-if="replyId" class="reply-target-tip">
            回复 <b>@{{ comments.find((c) => c.oId === replyId)?.commentAuthorName || replyId }}</b>
            <button type="button" class="btn-text cancel-reply" @click="replyId = ''">取消回复</button>
          </p>
          <ChatComposer
            ref="composerRef"
            v-model="draft"
            :api-key="apiKey"
            :height="180"
            :sending="sending"
            submit-text="发表评论"
            placeholder="请友善发言，支持 Markdown、@用户、拖拽上传图片…Ctrl+Enter 发送"
            @submit="submit"
          >
            <template #actions>
              <span v-if="sendError" class="err-tip">{{ sendError }}</span>
            </template>
          </ChatComposer>
        </template>
        <p v-else class="hint-login">
          <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }" class="login-link">登录</RouterLink>
          后即可参与讨论。
        </p>
      </div>
    </section>

    <section v-if="!isLong && randomArticles.length" class="card random-card">
      <div class="module-header">
        <span><b>随便看看</b></span>
        <button type="button" class="btn-text" @click="loadRandom">换一批</button>
      </div>
      <ul class="random-list">
        <li v-for="a in randomArticles" :key="a.oId">
          <span
            class="avatar-mini"
            :style="a.articleAuthorThumbnailURL48 ? { backgroundImage: `url('${a.articleAuthorThumbnailURL48}')` } : undefined"
          />
          <RouterLink :to="`/article/${a.oId}`">{{ articleTitle(a) }}</RouterLink>
        </li>
      </ul>
    </section>
    <ImageLightbox v-model="zoomed" />
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1300px;
  margin: 0 auto;
}
.toc {
  position: sticky;
  top: calc(var(--fp-nav-h) + 16px);
  z-index: 5;
  align-self: flex-start;
  max-height: calc(100vh - var(--fp-nav-h) - 40px);
  overflow-y: auto;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.toc b {
  font-size: 13px;
  color: var(--fp-head);
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--fp-border);
}
.toc a {
  color: var(--fp-muted);
  text-decoration: none;
  font-size: 13px;
  line-height: 1.5;
  padding: 3px 0;
  transition: color 0.15s ease;
}
.toc a:hover {
  color: var(--fp-accent);
}
.toc a.lv2 {
  padding-left: 10px;
}
.toc a.lv3 {
  padding-left: 20px;
  font-size: 12px;
}

.card {
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  overflow: hidden;
}
.card.post {
  padding: 24px 28px;
}

@media (max-width: 1099px) {
  .toc {
    position: static;
    align-self: stretch;
  }
}
@media (max-width: 768px) {
  .toc {
    display: none;
  }
  .card.post {
    padding: 16px;
  }
}

@media (min-width: 1100px) {
  .wrap:not(.has-toc) {
    max-width: 1060px;
  }
  .wrap.has-toc {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }
  .toc {
    grid-row: 1 / span 20;
  }
  .card.post {
    grid-column: 2;
  }
  .wrap > .card:not(.post),
  .wrap > form {
    grid-column: 2;
  }
}

.article-title-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}
.icon-perfect {
  font-size: 24px;
  line-height: 1.3;
}
h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.4;
  color: var(--fp-title);
  font-weight: 600;
  letter-spacing: 0.01em;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--fp-muted);
  font-size: 13px;
  margin-bottom: 12px;
}
.meta-author {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--fp-title);
  text-decoration: none;
  font-weight: 500;
}
.meta-author:hover {
  color: var(--fp-accent);
}
.avatar-small {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background-size: cover;
  background-position: center;
  background-color: var(--fp-border);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.tag-pill {
  display: inline-block;
  padding: 2px 10px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  font-size: 12px;
  color: var(--fp-muted);
  text-decoration: none;
  transition: all 0.15s ease;
}
.tag-pill:hover {
  background: rgba(229, 146, 48, 0.1);
  border-color: var(--fp-accent);
  color: var(--fp-accent);
}

.article-metals {
  margin-bottom: 14px;
}

.body {
  margin-top: 20px;
  margin-bottom: 24px;
  line-height: 1.8;
  font-size: 15px;
  color: var(--fp-text);
  word-break: break-word;
}
.body :deep(h1),
.body :deep(h2),
.body :deep(h3) {
  margin: 1.5em 0 0.8em;
  color: var(--fp-title);
  scroll-margin-top: calc(var(--fp-nav-h) + 16px);
  font-weight: 600;
}
.body :deep(h1) { font-size: 20px; border-bottom: 1px solid var(--fp-border); padding-bottom: 6px; }
.body :deep(h2) { font-size: 18px; }
.body :deep(h3) { font-size: 16px; }
.body :deep(p) {
  margin: 0 0 1.2em;
}
.body :deep(blockquote) {
  margin: 1.2em 0;
  padding: 10px 16px;
  border-left: 4px solid var(--fp-accent);
  background: var(--fp-bg);
  color: var(--fp-muted);
  border-radius: 0 4px 4px 0;
}
.body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  cursor: zoom-in;
}
.body :deep(img.emoji) {
  width: 20px;
  height: 20px;
  margin: 0 1px;
  vertical-align: -4px;
  cursor: default;
}
.body :deep(a img) {
  cursor: pointer;
}
.reward-body :deep(img) {
  max-width: min(480px, 100%);
  max-height: 320px;
  width: auto;
  height: auto;
  object-fit: contain;
  vertical-align: middle;
}
.reward-body :deep(img[alt='图片表情']) {
  max-height: 120px;
  border-radius: 0;
}
.body :deep(pre) {
  overflow-x: auto;
  background: var(--fp-bg);
  padding: 14px;
  border-radius: 6px;
  border: 1px solid var(--fp-border);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13.5px;
  line-height: 1.6;
}
.body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1.2em 0;
  font-size: 14px;
}
.body :deep(th),
.body :deep(td) {
  border: 1px solid var(--fp-border);
  padding: 8px 12px;
  text-align: left;
}
.body :deep(th) {
  background: var(--fp-bg);
  font-weight: 500;
}
.body :deep(a) {
  color: var(--fp-link);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.body :deep(a:hover) {
  color: var(--fp-accent);
}

.article-tail-bar {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--fp-border);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.actions a.edit-btn {
  text-decoration: none;
}
.action-alert {
  font-size: 13px;
  color: var(--fp-accent);
  margin-top: 8px;
}

.revisions {
  margin-top: 16px;
  padding: 14px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  border-radius: 6px;
}
.revisions h3 {
  margin: 0 0 10px;
  font-size: 14px;
  color: var(--fp-head);
}
.rev-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}
.rev-list .btn.on {
  border-color: var(--fp-accent);
  color: var(--fp-accent);
}
.rev-list em {
  font-style: normal;
  margin-left: 4px;
  color: var(--fp-green);
  font-size: 11px;
}
.rev-preview {
  border-top: 1px dashed var(--fp-border);
  padding-top: 10px;
}
.rev-preview h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--fp-title);
}

.reaction-wrap {
  margin-top: 16px;
}

.author-summary-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 24px;
  padding: 14px 18px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
}
.summary-avatar-link {
  flex-shrink: 0;
}
.summary-avatar {
  display: block;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  background-size: cover;
  background-position: center;
  background-color: var(--fp-border);
}
.summary-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.summary-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.summary-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--fp-title);
  text-decoration: none;
}
.summary-name:hover {
  color: var(--fp-accent);
}
.summary-city {
  font-size: 12px;
  color: var(--fp-muted);
}
.summary-counts {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--fp-muted);
}

.module-header {
  padding: 12px 18px;
  border-bottom: 1px solid var(--fp-border);
  font-size: 14px;
  color: var(--fp-head);
  background: var(--fp-card);
}

.comments-list {
  padding: 0 18px;
}
.cmt-root {
  padding: 12px 0;
  border-bottom: 1px solid var(--fp-border);
}
.cmt-root:last-child {
  border-bottom: none;
}
.btn-text {
  background: none;
  border: none;
  padding: 0;
  font-size: 12px;
  color: var(--fp-muted);
  cursor: pointer;
  transition: color 0.15s ease;
}
.btn-text:hover {
  color: var(--fp-accent);
}
.btn-text.danger:hover {
  color: #cf222e;
}
.btn-text.accept {
  color: var(--fp-green);
  font-weight: 500;
}

.edit-box textarea {
  width: 100%;
  box-sizing: border-box;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  margin: 6px 0;
}
.edit-box-btns {
  display: flex;
  gap: 8px;
}

.empty-hint {
  padding: 32px 18px;
  text-align: center;
  color: var(--fp-muted);
  font-size: 14px;
}

.pager {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-top: 1px solid var(--fp-border);
}
.pager-info {
  font-size: 13px;
  color: var(--fp-muted);
}

.composer-inner {
  padding: 18px;
}
.reply-target-tip {
  font-size: 13px;
  color: var(--fp-muted);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.cancel-reply {
  color: var(--fp-accent);
}
.card.load-error {
  max-width: 1060px;
  margin: 0 auto;
  padding: 40px 20px;
  text-align: center;
  color: var(--fp-muted);
}
.load-error .err {
  color: #e07a5f;
  font-size: 15px;
}
.load-error .retry {
  margin: 16px 0 10px;
}
.err-tip {
  color: #cf222e;
  font-size: 13px;
}
.hint-login {
  color: var(--fp-muted);
  font-size: 14px;
}
.login-link {
  color: var(--fp-accent);
  font-weight: 500;
  text-decoration: underline;
}
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 4px 0 10px;
}
.badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-muted);
}
.badge.offer {
  color: #d4380d;
  border-color: #ffbb96;
}
.badge.stick {
  color: var(--fp-accent);
  border-color: var(--fp-accent);
}
.column-link {
  color: var(--fp-accent);
}
.statement {
  margin: 12px auto;
  width: fit-content;
  padding: 4px 14px;
  font-size: 13px;
  color: var(--fp-muted);
  background: var(--fp-bg);
  border-radius: 4px;
}
.article-audio {
  display: block;
  width: 100%;
  margin: 12px 0;
}
.reward-box {
  margin: 0 0 24px;
  border: 1px dashed color-mix(in srgb, var(--fp-accent) 45%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--fp-accent) 5%, transparent);
  overflow: hidden;
}
.reward-box.unlocked {
  border-style: solid;
  border-color: color-mix(in srgb, var(--fp-primary) 40%, transparent);
  background: color-mix(in srgb, var(--fp-primary) 4%, transparent);
}
.reward-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px dashed var(--fp-border);
}
.reward-title {
  font-weight: 600;
  color: var(--fp-title);
}
.reward-meta {
  font-size: 12px;
  color: var(--fp-muted);
}
.reward-body {
  margin: 0;
  padding: 12px 16px;
}
.reward-locked {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 22px 16px;
  font-size: 14px;
  color: var(--fp-muted);
  text-align: center;
}
.reward-locked p {
  margin: 0;
}
.reward-locked b {
  color: var(--fp-accent);
}
.chapter-nav {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 24px 0 8px;
  padding-top: 12px;
  border-top: 1px dashed var(--fp-border);
}
.chapter-link {
  color: var(--fp-accent);
  font-size: 14px;
}
.chapter-link.next {
  text-align: right;
}
.share-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  font-size: 13px;
}
.share-label {
  color: var(--fp-muted);
}
#articleCommentsPanel {
  scroll-margin-top: calc(var(--fp-nav-h) + 12px);
}
.random-card .module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.random-list {
  list-style: none;
  margin: 0;
  padding: 8px 16px 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px 24px;
}
.random-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.random-list a {
  color: var(--fp-text);
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.avatar-mini {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--fp-border) center / cover;
}
</style>
