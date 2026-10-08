<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchArticle,
  fetchArticleHeat,
  fetchArticleRevision,
  fetchArticleRevisions,
  fetchCommentContent,
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
  type ReactionSummary,
} from '@/api/fishpi'
import EmojiPicker from '@/components/EmojiPicker.vue'
import MetalBadges from '@/components/MetalBadges.vue'
import ReactionBar from '@/components/ReactionBar.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeArticlePayload } from '@/seo/payload'
import { absoluteUrl, SITE_DEFAULT_DESC, stripHtml } from '@/seo/site'
import { useAuthStore } from '@/stores/auth'

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
const threaded = computed(() => {
  const list = comments.value
  const ids = new Set(list.map((c) => c.oId))
  const byParent = new Map<string, ArticleComment[]>()
  for (const c of list) {
    const parent = String(c.commentOriginalCommentId || '')
    if (parent && ids.has(parent)) {
      const kids = byParent.get(parent) || []
      kids.push(c)
      byParent.set(parent, kids)
    }
  }
  return list
    .filter((c) => {
      const parent = String(c.commentOriginalCommentId || '')
      return !parent || !ids.has(parent)
    })
    .flatMap((c) => [{ c, nested: false }, ...(byParent.get(c.oId) || []).map((r) => ({ c: r, nested: true }))])
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
    title: a.articleTitle,
    description: articleDesc.value,
    path: `/article/${a.oId}`,
    image: a.articleAuthorThumbnailURL48,
    type: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.articleTitle,
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
    if (!import.meta.env.SSR) {
      await refreshHeat()
      connectHeat()
    }
    void buildToc()
    return
  }
  loading.value = true
  error.value = ''
  article.value = null
  try {
    article.value = await fetchArticle(id.value, apiKey.value, commentPage.value)
    heat.value = Number(article.value.articleHeat || 0)
    await refreshHeat()
    connectHeat()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '帖子加载失败'
    disconnectHeat()
    toc.value = []
  } finally {
    loading.value = false
    if (article.value) void buildToc()
  }
}

onUnmounted(() => disconnectHeat())

watch(
  () => id.value,
  () => {
    commentPage.value = 1
  },
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
  if (!apiKey.value) return
  try {
    await rewardArticle(apiKey.value, id.value)
    actionMsg.value = '打赏成功'
    await load()
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '打赏失败'
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
  <article v-if="loading" class="card hint">加载帖子…</article>
  <article v-else-if="error" class="card">
    <p class="err">{{ error }}</p>
    <p v-if="!isLoggedIn" class="hint">
      <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
      后可查看需要权限的帖子。
    </p>
  </article>
  <div v-else-if="article" class="wrap">
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
      <h1>{{ article.articleTitleEmoj || article.articleTitle }}</h1>
      <p class="meta">
        <RouterLink v-if="article.articleAuthorName" :to="`/member/${article.articleAuthorName}`">{{
          article.articleAuthorName
        }}</RouterLink>
        <span v-else>匿名</span>
        <span>{{ article.articleCreateTimeStr || article.timeAgo }}</span>
        <span>{{ article.articleViewCntDisplayFormat || article.articleViewCount }} 浏览</span>
        <span>{{ article.articleCommentCount ?? comments.length }} 评</span>
        <span>在看 {{ heat }}</span>
      </p>
      <p v-if="tagList.length" class="tags">
        <RouterLink v-for="t in tagList" :key="t" :to="`/tags/${encodeURIComponent(t)}`">{{ t }}</RouterLink>
      </p>
      <MetalBadges :items="metals" />
      <p v-if="String(article.oId).startsWith('mock-')" class="hint">
        匿名详情接口未开放，当前为 mock 正文。
      </p>
      <div v-if="isLoggedIn" class="actions">
        <button type="button" @click="vote">点赞</button>
        <button type="button" :disabled="article.thanked" @click="thank">
          {{ article.thanked ? '已感谢' : '感谢' }}
        </button>
        <button type="button" @click="toggleCollect">
          {{ article.isFollowing ? '取消收藏' : '收藏' }}
        </button>
        <button type="button" @click="toggleWatch">
          {{ article.isWatching ? '取消关注' : '关注帖子' }}
        </button>
        <button
          v-if="Number(article.articleRewardPoint) > 0"
          type="button"
          :disabled="article.rewarded"
          @click="reward"
        >
          {{ article.rewarded ? '已打赏' : `打赏 ${article.articleRewardPoint}` }}
        </button>
        <RouterLink v-if="canEdit" class="edit" :to="`/post/${article.oId}`">编辑</RouterLink>
        <button v-if="isLoggedIn" type="button" @click="toggleRevisions">
          {{ showRevisions ? '收起历史' : '修订历史' }}
        </button>
        <ReportDialog v-if="isLoggedIn" :api-key="apiKey" :data-id="article.oId" :data-type="0" />
        <span v-if="actionMsg">{{ actionMsg }}</span>
      </div>
      <section v-if="showRevisions" class="revisions">
        <h2>修订历史</h2>
        <p v-if="revisionLoading" class="hint">加载修订列表…</p>
        <p v-else-if="revisionError" class="err">{{ revisionError }}</p>
        <ol v-else class="rev-list">
          <li v-for="rev in revisions" :key="rev.revisionId">
            <button
              type="button"
              class="ghost"
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
          <h3>{{ revisionTitle || '修订预览' }}</h3>
          <p v-if="revisionBusy" class="hint">渲染中…</p>
          <div v-else class="body" v-html="revisionHtml" />
        </div>
      </section>
      <ReactionBar
        :summary="article.reactionSummary"
        :current="article.currentUserReaction"
        :disabled="!isLoggedIn"
        @toggle="onReactArticle"
      />
      <div ref="bodyEl" class="body" v-html="article.articleContent || ''" />
    </article>

    <section v-if="nice.length" class="card">
      <h2>优质回帖</h2>
      <div v-for="c in nice" :key="'n' + c.oId" class="cmt">
        <b><RouterLink :to="`/member/${who(c)}`">{{ who(c) }}</RouterLink></b>
        <div class="cmt-body" v-html="c.commentContent || ''" />
      </div>
    </section>

    <section class="card">
      <h2>评论 {{ comments.length }}</h2>
      <div v-for="row in threaded" :key="row.c.oId" class="cmt" :class="{ nested: row.nested }">
        <header>
          <b><RouterLink :to="`/member/${who(row.c)}`">{{ who(row.c) }}</RouterLink></b>
          <time>{{ row.c.commentCreateTimeStr || row.c.timeAgo }}</time>
          <em v-if="parentAuthor(row.c)" class="reply-to">回复 {{ parentAuthor(row.c) }}</em>
          <button v-if="isLoggedIn" type="button" class="ghost" @click="replyId = row.c.oId">回复</button>
          <button v-if="isLoggedIn" type="button" class="ghost" @click="onVoteComment(row.c)">点赞</button>
          <button v-if="isLoggedIn" type="button" class="ghost" :disabled="row.c.rewarded" @click="onThankComment(row.c)">
            {{ row.c.rewarded ? '已感谢' : '感谢' }}
          </button>
          <button v-if="isLoggedIn && isOwnComment(row.c)" type="button" class="ghost" @click="startEdit(row.c)">
            编辑
          </button>
          <button v-if="isLoggedIn && isOwnComment(row.c)" type="button" class="ghost" @click="onRemoveComment(row.c)">
            删除
          </button>
          <button
            v-if="isLoggedIn && canEdit && isQnA && !row.c.commentQnAOffered && !isOwnComment(row.c)"
            type="button"
            class="ghost"
            @click="onAccept(row.c)"
          >
            采纳
          </button>
          <ReportDialog v-if="isLoggedIn && !isOwnComment(row.c)" :api-key="apiKey" :data-id="row.c.oId" :data-type="1" />
        </header>
        <div v-if="editingId === row.c.oId" class="edit-box">
          <textarea v-model="editDraft" rows="3" />
          <button type="button" :disabled="editSaving || !editDraft.trim()" @click="saveEdit">保存</button>
          <button type="button" class="ghost" @click="editingId = ''">取消</button>
        </div>
        <div v-else class="cmt-body" v-html="row.c.commentContent || ''" />
        <ReactionBar
          :summary="row.c.reactionSummary"
          :current="row.c.currentUserReaction"
          :disabled="!isLoggedIn"
          @toggle="(v) => onReactComment(row.c, v)"
        />
      </div>
      <p v-if="!comments.length" class="hint">还没有评论。</p>
      <footer v-if="commentPages > 1" class="pager">
        <button type="button" :disabled="commentPage <= 1" @click="commentPage -= 1">上一页</button>
        <span>{{ commentPage }} / {{ commentPages }}</span>
        <button type="button" :disabled="commentPage >= commentPages" @click="commentPage += 1">下一页</button>
      </footer>
    </section>

    <form class="card composer" @submit.prevent="submit">
      <h2>参与讨论</h2>
      <template v-if="isLoggedIn">
        <p v-if="replyId" class="hint">
          回复 {{ comments.find((c) => c.oId === replyId)?.commentAuthorName || replyId }}
          <button type="button" class="ghost" @click="replyId = ''">取消</button>
        </p>
        <textarea v-model="draft" rows="4" placeholder="支持 Markdown" />
        <EmojiPicker @insert="(md) => (draft += md)" />
        <p v-if="sendError" class="err">{{ sendError }}</p>
        <button type="submit" :disabled="sending || !draft.trim()">
          {{ sending ? '发送中…' : '发表评论' }}
        </button>
      </template>
      <p v-else class="hint">
        <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
        后可以评论。
      </p>
    </form>
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.toc {
  position: sticky;
  top: calc(var(--fp-nav-h) + 12px);
  z-index: 5;
  align-self: flex-start;
  max-height: 40vh;
  overflow: auto;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.toc b {
  font-size: 13px;
  color: var(--fp-head);
  margin-bottom: 4px;
}
.toc a {
  color: var(--fp-title);
  text-decoration: none;
  font-size: 13px;
  line-height: 1.4;
  padding: 2px 0;
}
.toc a:hover {
  color: var(--fp-link);
}
.toc a.lv2 {
  padding-left: 10px;
}
.toc a.lv3 {
  padding-left: 20px;
  font-size: 12px;
  color: var(--fp-muted);
}
.card {
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border-radius: 8px;
  padding: 15px;
}
@media (min-width: 1100px) {
  .wrap {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }
  .toc {
    grid-row: 1 / span 20;
    max-height: calc(100vh - var(--fp-nav-h) - 40px);
  }
  .card.post {
    grid-column: 2;
  }
  .wrap > .card:not(.post),
  .wrap > form {
    grid-column: 2;
  }
}
h1 {
  margin: 0 0 8px;
  font-size: 20px;
  line-height: 1.4;
  color: var(--fp-title);
  font-weight: 600;
}
h2 {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--fp-head);
  font-weight: 600;
}
.meta,
.tags,
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
}
.meta a {
  color: var(--fp-link);
  text-decoration: none;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 10px 0 12px;
}
.actions button,
.ghost {
  border: 1px solid var(--fp-border);
  background: var(--fp-card);
  color: var(--fp-text);
  border-radius: 3px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 13px;
}
.actions button:hover,
.ghost:hover {
  color: var(--fp-accent);
  border-color: var(--fp-accent);
}
.revisions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--fp-border);
}
.rev-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 160px;
  overflow: auto;
}
.rev-list .ghost.on {
  color: var(--fp-accent);
  border-color: var(--fp-accent);
}
.rev-list em {
  font-style: normal;
  margin-left: 4px;
  color: var(--fp-green);
  font-size: 12px;
}
.rev-preview {
  border-top: 1px dashed var(--fp-border);
  padding-top: 10px;
}
.rev-preview h3 {
  margin: 0 0 8px;
  font-size: 15px;
  color: var(--fp-title);
}
.actions a.edit {
  color: var(--fp-link);
  text-decoration: none;
  font-size: 13px;
}
.tags a {
  color: var(--fp-link);
  text-decoration: none;
  margin-right: 8px;
}
.pager {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 12px;
}
.pager button {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 8px;
  padding: 4px 12px;
  cursor: pointer;
}
.body {
  margin-top: 12px;
  line-height: 1.7;
  font-size: 15px;
  color: var(--fp-text);
  word-break: break-word;
}
.body :deep(h1),
.body :deep(h2),
.body :deep(h3) {
  margin: 1.2em 0 0.6em;
  color: var(--fp-title);
  scroll-margin-top: calc(var(--fp-nav-h) + 12px);
}
.body :deep(p) {
  margin: 0 0 1em;
}
.body :deep(img),
.cmt-body :deep(img) {
  max-width: 100%;
}
.body :deep(pre),
.cmt-body :deep(pre) {
  overflow: auto;
  background: var(--fp-bg);
  padding: 12px;
  border-radius: 3px;
  border: 1px solid var(--fp-border);
}
.body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 1em;
  font-size: 14px;
}
.body :deep(th),
.body :deep(td) {
  border: 1px solid var(--fp-border);
  padding: 6px 10px;
  text-align: left;
}
.body :deep(a),
.cmt-body :deep(a) {
  color: var(--fp-link);
}
.cmt {
  padding: 12px 0;
  border-bottom: 1px solid var(--fp-border);
}
.cmt.nested {
  margin-left: 28px;
  border-left: 2px solid var(--fp-border);
  padding-left: 12px;
}
.reply-to {
  font-style: normal;
  color: var(--fp-link);
}
.cmt header {
  display: flex;
  gap: 8px;
  color: var(--fp-muted);
  font-size: 12px;
  margin-bottom: 6px;
}
.cmt header a {
  color: inherit;
  text-decoration: none;
}
.edit-box textarea {
  width: 100%;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 8px;
  margin: 6px 0;
}
.edit-box button {
  margin-right: 8px;
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
}
.composer textarea {
  width: 100%;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 8px;
}
.composer button {
  margin-top: 8px;
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
}
</style>
