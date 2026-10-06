<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchArticle, postComment, type ArticleComment, type ArticleDetail } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)

const article = ref<ArticleDetail | null>(null)
const loading = ref(true)
const error = ref('')
const draft = ref('')
const sending = ref(false)
const sendError = ref('')
const commentPage = ref(1)

const id = computed(() => String(route.params.id || ''))

const comments = computed<ArticleComment[]>(() => article.value?.articleComments || [])
const nice = computed(() => article.value?.articleNiceComments || [])

async function load() {
  if (!id.value) return
  loading.value = true
  error.value = ''
  article.value = null
  if (!apiKey.value) {
    error.value = '帖子详情接口需要登录，本站已不再解析旧站 HTML。'
    loading.value = false
    return
  }
  try {
    article.value = await fetchArticle(id.value, apiKey.value, commentPage.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '帖子加载失败'
  } finally {
    loading.value = false
  }
}

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
    await postComment(apiKey.value, id.value, draft.value.trim())
    draft.value = ''
    await load()
  } catch (e) {
    sendError.value = e instanceof Error ? e.message : '评论失败'
  } finally {
    sending.value = false
  }
}

function who(c: ArticleComment) {
  return c.commentAuthorName || '匿名'
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
    <article class="card post">
      <h1>{{ article.articleTitleEmoj || article.articleTitle }}</h1>
      <p class="meta">
        <span>{{ article.articleAuthorName }}</span>
        <span>{{ article.articleCreateTimeStr || article.timeAgo }}</span>
        <span>{{ article.articleViewCntDisplayFormat || article.articleViewCount }} 浏览</span>
        <span>{{ article.articleCommentCount ?? comments.length }} 评</span>
      </p>
      <p v-if="article.articleTags" class="tags">{{ article.articleTags }}</p>
      <div class="body" v-html="article.articleContent || ''" />
    </article>

    <section v-if="nice.length" class="card">
      <h2>优质回帖</h2>
      <div v-for="c in nice" :key="'n' + c.oId" class="cmt">
        <b>{{ who(c) }}</b>
        <div class="cmt-body" v-html="c.commentContent || ''" />
      </div>
    </section>

    <section class="card">
      <h2>评论 {{ comments.length }}</h2>
      <div v-for="c in comments" :key="c.oId" class="cmt">
        <header>
          <b>{{ who(c) }}</b>
          <time>{{ c.commentCreateTimeStr || c.timeAgo }}</time>
        </header>
        <div class="cmt-body" v-html="c.commentContent || ''" />
      </div>
      <p v-if="!comments.length" class="hint">还没有评论。</p>
    </section>

    <form class="card composer" @submit.prevent="submit">
      <h2>参与讨论</h2>
      <template v-if="isLoggedIn">
        <textarea v-model="draft" rows="4" placeholder="支持 Markdown" />
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
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 20px;
}
h1 {
  margin: 0 0 8px;
  font-size: 22px;
  line-height: 1.4;
}
h2 {
  margin: 0 0 12px;
  font-size: 15px;
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
}
.err {
  color: #e07a5f;
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
  border-radius: 8px;
}
.body :deep(a),
.cmt-body :deep(a) {
  color: var(--fp-link);
}
.cmt {
  padding: 12px 0;
  border-bottom: 1px solid var(--fp-border);
}
.cmt header {
  display: flex;
  gap: 8px;
  color: var(--fp-muted);
  font-size: 12px;
  margin-bottom: 6px;
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
