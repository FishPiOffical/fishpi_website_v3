<script setup lang="ts">
import { articleTitle } from '@/utils/text'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchArticle,
  fetchRandomArticles,
  type ArticleComment,
  type ArticleDetail,
  type ArticleSummary,
} from '@/api/fishpi'
import ContentRelationButton from '@/components/articles/ContentRelationButton.vue'
import ArticleInteraction from '@/components/articles/ArticleInteraction.vue'
import RevisionHistory from '@/components/articles/RevisionHistory.vue'
import {articleHeat} from '@/api/v3-article-heat'
import {subscribeArticleChanges} from '@/api/v3-realtime'
import ArticleOwnerActions from '@/components/articles/ArticleOwnerActions.vue'
import { ApiError,getAuthContextVersion } from '@/api/http'
import CommentComposer from '@/components/articles/CommentComposer.vue'
import { useV3CommentsStore } from '@/stores/v3Comments'
import { clearCache } from '@/utils/swr'
import MedalList from '@/components/medal/MedalList.vue'
import V3ReactionBar from '@/components/V3ReactionBar.vue'
import { useV3ReactionsStore } from '@/stores/v3Reactions'
import ReportDialog from '@/components/ReportDialog.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeArticlePayload } from '@/seo/payload'
import { absoluteUrl, SITE_DEFAULT_DESC, stripHtml } from '@/seo/site'
import { useAuthStore } from '@/stores/auth'
import ArticleSkeleton from '@/components/ArticleSkeleton.vue'
import CommentItem from '@/components/CommentItem.vue'
import ImageLightbox from '@/components/ImageLightbox.vue'
import LongArticleReader from '@/components/articles/LongArticleReader.vue'
import { useLayoutStore } from '@/stores/layout'
import { createReusableTemplate } from '@/utils/reusableTemplate'
import { readCache, writeCache } from '@/utils/swr'

const reactionEvents=useV3ReactionsStore()
const route = useRoute(), router = useRouter()
const auth = useAuthStore()
const commentWrites=useV3CommentsStore(),commandOrigin=Symbol('article-comment-delete'),commentRefreshError=ref('')
const { apiKey, accessToken, isLoggedIn, account } = storeToRefs(auth)

const article = ref<ArticleDetail | null>(null)
const loading = ref(true)
const error = ref('')
const actionMsg = ref('')
const ownerRefreshError=ref(''),ownerDeletedId=ref('')
const zoomed = ref('')
const replyId = ref('')
const replyComment = ref<ArticleComment | null>(null)
const paragraphIdForReply = ref('')
const commentPage = ref(1)
const heat = ref<number|null>(null),heatError=ref(''),articleChanged=ref(false),realtimeReadError=ref(''),realtimeReading=ref(false)
const editingId = ref('')
const bodyEl = ref<HTMLElement | null>(null)
const toc = ref<{ id: string; text: string; level: number }[]>([])
const showRevisions = ref(false)
const historyRef=ref<InstanceType<typeof RevisionHistory>|null>(null)
const viewerIdentity=computed(()=>`${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId||''}`)
let stopArticle:(()=>void)|null=null,subscriptionKey='',heatRequest:AbortController|null=null,heatSequence=0,changeRevision=0,liveReadVersion=0
let readVersion = 0

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

function toggleRevisions(){historyRef.value?.toggle()}

const comments = computed<ArticleComment[]>(() => article.value?.articleComments || [])
const replyAuthor = computed(() => replyComment.value?.commentAuthorName || comments.value.find((c) => c.oId === replyId.value)?.commentAuthorName || replyId.value)
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
  () => !!isLoggedIn.value && !!account.value?.oId && !!article.value?.articleAuthorId && article.value.articleAuthorId === account.value.oId,
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
const composerRef = ref<InstanceType<typeof CommentComposer> | null>(null)
const readerRef = ref<InstanceType<typeof LongArticleReader> | null>(null)
const [DefineOwnerActions, ReuseOwnerActions] = createReusableTemplate()
const [DefineLiveStatus,ReuseLiveStatus]=createReusableTemplate()
const [DefineReward, ReuseReward] = createReusableTemplate()
const [DefineRevisions, ReuseRevisions] = createReusableTemplate()
const [DefineComments, ReuseComments] = createReusableTemplate()
const [DefineComposer, ReuseComposer] = createReusableTemplate()
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
  if (isLong.value) readerRef.value?.scrollCommentsTop()
  else document.getElementById('articleCommentsPanel')?.scrollIntoView({ block: 'start' })
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
  return Boolean(account.value && c.commentAuthorId && c.commentAuthorId === account.value.oId)
}

function disconnectHeat() {
 stopArticle?.();stopArticle=null;subscriptionKey='';heatSequence++;heatRequest?.abort();heatRequest=null;heat.value=null;heatError.value='';articleChanged.value=false;liveReadVersion++;realtimeReading.value=false
}
function connectHeat() {
 if(import.meta.env.SSR||!accessToken.value||!article.value||article.value.oId!==id.value)return
 const target=id.value,reader=viewerIdentity.value,key=JSON.stringify([target,reader,accessToken.value])
 if(subscriptionKey===key)return
 stopArticle?.();subscriptionKey=key
 stopArticle=subscribeArticleChanges(target,()=>{
  if(subscriptionKey!==key||reader!==viewerIdentity.value||target!==id.value)return
  changeRevision++;articleChanged.value=true
  reactionEvents.invalidate('article',target)
  for(const comment of article.value?.articleComments||[])reactionEvents.invalidate('comment',comment.oId)
  if(!heatRequest)void refreshHeat()
 })
}
async function readArticleChanges(){
 if(realtimeReading.value)return
 const target=id.value,reader=viewerIdentity.value,revision=changeRevision,run=++liveReadVersion
 realtimeReading.value=true
 try{await load(true,'realtime')
  if(run===liveReadVersion&&target===id.value&&reader===viewerIdentity.value&&revision===changeRevision&&!realtimeReadError.value)articleChanged.value=false
 }finally{if(run===liveReadVersion)realtimeReading.value=false}
}
async function ownerChanged(target:string){if(target===id.value)await load(true,'owner')}
async function ownerDeleted(target:string){
 if(target!==id.value)return
 ++readVersion;disconnectHeat();clearCache();article.value=null;loading.value=false;ownerDeletedId.value=target;error.value='文章已删除'
 try{await router.replace('/')}catch{if(id.value===target)error.value='文章已删除，返回首页失败，请点击返回首页。'}
}
async function refreshHeat() {
 heatRequest?.abort();const run=++heatSequence,reader=viewerIdentity.value,target=id.value
 heat.value=null;heatError.value=''
 if(import.meta.env.SSR||!accessToken.value||!article.value||article.value.oId!==target)return
 const abort=new AbortController();heatRequest=abort
 const valid=()=>run===heatSequence&&reader===viewerIdentity.value&&target===id.value&&!abort.signal.aborted
 try{const value=await articleHeat(target,abort.signal);if(valid())heat.value=value}
 catch{if(valid())heatError.value='热度暂不可用'}
 finally{if(valid())heatRequest=null}
}

async function load(force=false,reason:'comments'|'owner'|'realtime'='comments') {
  if (!id.value) return
  const version = ++readVersion
  const viewer = viewerIdentity.value
  const cached = !force && commentPage.value === 1 ? consumeArticlePayload(id.value) : null
  if (cached) {
    article.value = cached
    loading.value = false
    error.value = ''
    heat.value = null
    void buildToc()
    // SSR is anonymous; authenticated readers must refresh their viewer-dependent content.
    if (import.meta.env.SSR || !accessToken.value) {
      writeCache(`article:${id.value}:1`, cached)
      if (!import.meta.env.SSR) {
        void refreshHeat()
        connectHeat()
      }
      return
    }
  }
  const reqId = id.value
  const cacheKey = `article:${reqId}:${commentPage.value}`
  const paging = article.value?.oId === reqId
  const hit = force ? null : cached || readCache<ArticleDetail>(cacheKey)
  if (hit) {
    article.value = hit
    heat.value = null
    loading.value = false
    void buildToc()
  } else if (!paging) {
    loading.value = true
    article.value = null
  }
  error.value = ''
  if(force){if(reason==='owner')ownerRefreshError.value='';else if(reason==='realtime')realtimeReadError.value='';else commentRefreshError.value=''}
  try {
    const data = await fetchArticle(reqId, apiKey.value, commentPage.value)
    if (reqId !== id.value || version !== readVersion || viewer !== viewerIdentity.value) return
    writeCache(cacheKey, data)
    article.value = data
    heat.value = null
    loading.value = false
    void buildToc()
    void refreshHeat()
    connectHeat()
  } catch (e) {
    if (reqId !== id.value || version !== readVersion || viewer !== viewerIdentity.value) return
    if(reason==='realtime'&&e instanceof ApiError&&[401,403,404].includes(e.status)){article.value=null;error.value='文章不存在或当前已无权阅读';clearCache();disconnectHeat();return}
    if(force){if(reason==='owner')ownerRefreshError.value='置顶已确认，文章状态重新读取失败，请重试读取。';else if(reason==='realtime')realtimeReadError.value='文章变更读取失败，请重试。';else commentRefreshError.value='操作已确认，评论重新读取失败：'+(e instanceof Error?e.message:'请重试');return}
    if(hit)return
    error.value = e instanceof Error ? e.message : '帖子加载失败'
    disconnectHeat()
    toc.value = []
  } finally {
    if (reqId === id.value && version === readVersion && viewer === viewerIdentity.value) loading.value = false
  }
}

const layout = useLayoutStore()
if (!import.meta.env.SSR) {
  watch(isLong, (v) => (layout.immersive = v), { immediate: true })
}
onUnmounted(() => {
  commentWrites.cancelConfirmation(commandOrigin)
  disconnectHeat()
  layout.immersive = false
})

watch(
  () => id.value,
  () => {
    disconnectHeat()
    commentPage.value = 1
    ownerRefreshError.value='';ownerDeletedId.value='';realtimeReadError.value=''
    editingId.value='';replyId.value='';replyComment.value=null;paragraphIdForReply.value='';commentRefreshError.value=''
    commentWrites.cancelConfirmation(commandOrigin)
    void loadRandom()
  },
  { immediate: true },
)

watch(accessToken,()=>{if(!import.meta.env.SSR){stopArticle?.();stopArticle=null;subscriptionKey='';connectHeat();void refreshHeat()}},{flush:'post'})

watch(viewerIdentity, () => {
  ownerRefreshError.value='';ownerDeletedId.value='';realtimeReadError.value=''
  ++readVersion
  article.value = null
  editingId.value='';replyId.value='';replyComment.value=null;paragraphIdForReply.value='';commentRefreshError.value=''
  showRevisions.value=false
  commentPage.value = 1
  disconnectHeat()
}, { flush: 'sync' })

watch(
  () => [id.value, viewerIdentity.value, commentPage.value],
  () => {
    void load()
  },
  { immediate: true },
)

function onParagraphReply(paragraphId: string, commentId: string, comment?: ArticleComment) {
  paragraphIdForReply.value = paragraphId
  replyId.value = commentId
  replyComment.value = comment || (commentId ? comments.value.find((c) => c.oId === commentId) || null : null)
}

function cancelReply(){replyId.value='';replyComment.value=null}
function clearReplyTarget() {
  replyId.value = ''
  replyComment.value = null
  paragraphIdForReply.value = ''
}

watch(()=>commentWrites.revision,()=>{
  const command=commentWrites.completed
  if(!command||command.articleId!==id.value||!accessToken.value)return
  clearCache();editingId.value=''
  if(command.operation==='create'&&(command.input.parentId||'')===replyId.value&&(command.input.paragraphId||'')===paragraphIdForReply.value)cancelReply()
  void load(true)
  readerRef.value?.refreshParagraphComments()
},{flush:'sync'})

async function onRemoveComment(c: ArticleComment) {
  if(!isOwnComment(c)||!accessToken.value)return
  await commentWrites.remove(id.value,c.oId,commandOrigin)
}
function startEdit(c:ArticleComment){if(isOwnComment(c)&&accessToken.value&&!commentWrites.pending&&!commentWrites.busy&&!commentWrites.confirming)editingId.value=c.oId}
function who(c: ArticleComment) {
  return c.commentAuthorName || '匿名'
}

function parentAuthor(c: ArticleComment) {
  const parent = comments.value.find((x) => x.oId === c.commentOriginalCommentId)
  return parent ? who(parent) : ''
}

function startReply(c: ArticleComment) {
  replyId.value = c.oId
  replyComment.value = c
  if (isLong.value) {
    readerRef.value?.openComposer()
    void nextTick(() => composerRef.value?.reveal())
    return
  }
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
    editing: editingId.value === c.oId,
    apiKey: apiKey.value,
    hideMedals: isLong.value,
  }
}

function itemHandlers(c: ArticleComment) {
  return {
    reply: () => startReply(c),
    edit: () => startEdit(c),
    remove: () => onRemoveComment(c),
  }
}

</script>

<template>
  <ArticleSkeleton v-if="loading" />
  <article v-else-if="error" class="card load-error">
    <p class="err">{{ error }}</p>
    <p class="retry"><RouterLink v-if="ownerDeletedId" to="/">返回首页</RouterLink><button v-else type="button" class="btn" @click="load()">重新加载</button></p>
    <p v-if="!isLoggedIn" class="hint">
      <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
      后可查看需要权限的帖子。
    </p>
  </article>
  <template v-else-if="article">
    <DefineLiveStatus>
      <p v-if="articleChanged" role="status">文章或评论有更新 <button type="button"  :disabled="realtimeReading" @click="readArticleChanges">读取最新内容</button></p>
      <p v-if="realtimeReadError" role="alert">{{ realtimeReadError }}</p>
    </DefineLiveStatus>
    <ReuseLiveStatus v-if="!isLong" />
    <DefineOwnerActions>
      <ArticleOwnerActions :article-id="article.oId" :author-id="article.articleAuthorId||''" :anonymous="Number(article.articleAnonymous)===1" :permanent="article.stick?.permanent||false" @changed="ownerChanged" @deleted="ownerDeleted" />
      <p v-if="ownerRefreshError" role="alert">{{ ownerRefreshError }} <button type="button" @click="load(true,'owner')">重读文章状态</button></p>
    </DefineOwnerActions>
    <DefineReward>
      <ArticleInteraction kind="reward" :article-id="article.oId" :initial-price="Number(article.articleRewardPoint || 0)" @content-click="onContentClick" />
    </DefineReward>
    <DefineRevisions>
      <RevisionHistory ref="historyRef" kind="article" :target-id="article.oId" :trigger="false" @open-change="showRevisions=$event" />
    </DefineRevisions>
    <DefineComments>
      <p v-if="commentRefreshError" role="alert">{{ commentRefreshError }}<button type="button" @click="load(true)">重读评论</button></p>
      <p v-if="commentWrites.error" role="alert">{{ commentWrites.error }}</p>
      <p v-if="commentWrites.message" role="status">{{ commentWrites.message }}</p>
      <div class="comments-list">
        <CommentItem
          v-for="t in threads"
          :key="t.c.oId"
          v-bind="itemProps(t.c)"
          class="cmt-root"
          v-on="itemHandlers(t.c)"
        >
          <template #editor>
            <CommentComposer :article-id="article.oId" :edit-id="editingId" @cancel="editingId=''" @saved="editingId=''" />
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
                <CommentComposer :article-id="article.oId" :edit-id="editingId" @cancel="editingId=''" @saved="editingId=''" />
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
    </DefineComments>
    <DefineComposer>
      <div class="composer-inner">
        <p v-if="article.articleCommentable === false" class="hint-login">作者已关闭回帖。</p>
        <template v-else-if="isLoggedIn">
          <CommentComposer ref="composerRef" :article-id="article.oId" :parent-id="replyId" :paragraph-id="paragraphIdForReply" :reply-label="replyAuthor" @clear-reply="cancelReply" />
        </template>
        <p v-else class="hint-login">
          <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }" class="login-link">登录</RouterLink>
          后即可参与讨论。
        </p>
      </div>
    </DefineComposer>
    <LongArticleReader
      v-if="isLong"
      ref="readerRef"
      :article="article"
      :column="column"
      :comment-total="commentTotal"
      :logged-in="isLoggedIn"
      :can-edit="canEdit"
      :api-key="apiKey"
      :statement="statementLabel"
      :action-msg="actionMsg"
      @revisions="toggleRevisions"
      @content-click="onContentClick"
      @reply="clearReplyTarget"
      @paragraph-reply="onParagraphReply"
    >
      <template #owner-actions><ReuseOwnerActions /></template>
      <template #live-status><ReuseLiveStatus /><span v-if="heat!==null">本节点约 {{ heat }} 个连接</span><span v-if="heatError">{{ heatError }} <button type="button" @click="refreshHeat">重读热度</button></span></template>
      <template #reward><ReuseReward /></template>
      <template #extra><ReuseRevisions /></template>
      <template #comments><ReuseComments /></template>
      <template #composer><ReuseComposer /></template>
    </LongArticleReader>
    <div v-else class="wrap" :class="{ 'has-toc': hasToc }">
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
          <span v-if="article.stick?.active">{{ article.stick.permanent ? '永久置顶' : '置顶' }} •</span>
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
          <span v-if="heat!==null">（本节点约 {{ heat }} 个连接）</span>
          <span v-if="heatError">{{ heatError }} <button type="button" @click="refreshHeat">重读热度</button></span>
        </div>

        <div v-if="tagList.length" class="tags">
          <RouterLink v-for="t in tagList" :key="t" :to="`/tag/${encodeURIComponent(t)}`" class="tag-pill">
            # {{ t }}
          </RouterLink>
        </div>

        <div v-if="metals.length" class="article-metals">
          <span class="article-metals-label">作者勋章</span>
          <MedalList :items="metals" />
        </div>


        <p v-if="statementLabel" class="statement">创作声明：{{ statementLabel }}</p>

        <audio v-if="article.articleAudioURL" class="article-audio" :src="article.articleAudioURL" controls preload="none" />

        <div ref="bodyEl" class="body" @click="onContentClick" v-html="article.articleContent || ''" />

        <ReuseReward />

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
          <ContentRelationButton kind="collection" :target="article.oId" />
          <ContentRelationButton kind="subscription" :target="article.oId" />
          <div v-if="isLoggedIn" class="actions">
            <ArticleInteraction kind="vote" :article-id="article.oId" />
            <ArticleInteraction kind="thanks" :article-id="article.oId" />
            <ReuseOwnerActions />
            <RouterLink v-if="canEdit" class="btn small edit-btn" :to="`/post/${article.oId}`">编辑</RouterLink>
            <button type="button" class="btn small" @click="toggleRevisions">
              {{ showRevisions ? '收起历史' : '修订历史' }}
            </button>
            <ReportDialog :data-id="article.oId" :data-type="0" />
          </div>
          <div class="share-row">
            <span class="share-label">分享</span>
            <button type="button" class="btn-text" @click="copyShare">{{ shareCopied ? '✅ 已复制' : '🔗 复制链接' }}</button>
            <a class="btn-text" :href="weiboShareUrl" target="_blank" rel="noopener noreferrer">微博</a>
            <a class="btn-text" :href="twitterShareUrl" target="_blank" rel="noopener noreferrer">Twitter</a>
          </div>
          <p v-if="actionMsg" class="action-alert">{{ actionMsg }}</p>
        </div>

        <ReuseRevisions />

        <!-- 表情回应栏 -->
        <div class="reaction-wrap">
          <V3ReactionBar kind="article" :target-id="article.oId" />
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
              <span v-if="typeof article.articleGoodCnt === 'number'">获赞 {{ article.articleGoodCnt }}</span>
              <span v-if="typeof article.articleGoodCnt === 'number'">•</span>
              <span v-if="typeof article.articleCollectCnt === 'number'">被收藏 {{ article.articleCollectCnt }}</span>
              <span v-if="typeof article.articleCollectCnt === 'number'">•</span>
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

        <ReuseComments />
      </section>

      <!-- 底部发表回帖区域 -->
      <section class="card composer-card">
        <div class="module-header">
          <span><b>参与讨论</b></span>
        </div>
        <ReuseComposer />
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
              :data-user-card="a.articleAuthorName"
              :style="a.articleAuthorThumbnailURL48 ? { backgroundImage: `url('${a.articleAuthorThumbnailURL48}')` } : undefined"
            />
            <RouterLink :to="`/article/${a.oId}`">{{ articleTitle(a) }}</RouterLink>
          </li>
        </ul>
      </section>
    </div>
    <ImageLightbox v-model="zoomed" />
  </template>
</template>

<style scoped lang="scss">
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
  text-decoration: underline;
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
  text-decoration: underline;
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.article-metals-label {
  color: var(--fp-muted);
  font-size: 12px;
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
  text-decoration: underline;
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
  text-decoration: underline;
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
.reply-quote-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  padding: 7px 10px;
  border-left: 3px solid var(--fp-accent);
  border-radius: 4px;
  background: var(--fp-hover);
  font-size: 12px;
}
.reply-quote-info {
  flex: 1;
  min-width: 0;
}
.reply-quote-label {
  color: var(--fp-accent);
  font-weight: 600;
}
.reply-quote-text {
  max-height: 40px;
  overflow: hidden;
  margin-top: 2px;
  color: var(--fp-muted);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.reply-quote-cancel {
  flex: none;
  border: 0;
  padding: 3px 5px;
  color: var(--fp-muted);
  background: transparent;
  cursor: pointer;
}
.reply-quote-cancel:hover {
  color: #e74c3c;
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
