<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchNotifications,
  markAllNoticesRead,
  markNoticeRead,
  type NoticeItem,
  type NoticeType,
  type UnreadCount,
} from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import { useNoticeStore } from '@/stores/notices'
import FpLoading from '@/components/FpLoading.vue'
import { createSwrLoader } from '@/utils/swr'

const tabs: { id: NoticeType; label: string }[] = [
  { id: 'commented', label: '回帖' },
  { id: 'reply', label: '回复' },
  { id: 'at', label: '@我' },
  { id: 'following', label: '关注' },
  { id: 'point', label: '积分' },
  { id: 'broadcast', label: '同城' },
  { id: 'sys-announce', label: '系统' },
]

const auth = useAuthStore()
const notices = useNoticeStore()
const { apiKey } = storeToRefs(auth)
const { unread } = storeToRefs(notices)

function firstUnread(u: UnreadCount): NoticeType {
  const order: [NoticeType, keyof UnreadCount][] = [
    ['commented', 'unreadCommentedNotificationCnt'],
    ['reply', 'unreadReplyNotificationCnt'],
    ['at', 'unreadAtNotificationCnt'],
    ['following', 'unreadFollowingNotificationCnt'],
    ['point', 'unreadPointNotificationCnt'],
    ['broadcast', 'unreadBroadcastNotificationCnt'],
    ['sys-announce', 'unreadSysAnnounceNotificationCnt'],
  ]
  return order.find(([_, key]) => Number(u[key] || 0) > 0)?.[0] || 'commented'
}

const type = ref<NoticeType>(firstUnread(unread.value))
const items = ref<NoticeItem[]>([])
const page = ref(1)
const loading = ref(false)
const error = ref('')
const usingMock = computed(() => items.value.some((n) => String(n.commentSharpURL || n.url || '').includes('mock-')))

const swr = createSwrLoader({ loading, error })

async function load() {
  const key = apiKey.value
  if (!key) return
  await swr(
    `notices:${type.value}:${page.value}`,
    () => fetchNotifications(key, type.value, page.value),
    (data) => (items.value = data),
    '通知加载失败',
  )
}

watch(
  () => type.value,
  () => {
    page.value = 1
  },
)

watch(
  () => [apiKey.value, type.value, page.value],
  () => void load(),
  { immediate: true },
)

const router = useRouter()
const SITE = /^https?:\/\/fishpi\.cn(?=\/|$)/

function localize(url: string) {
  return url.replace(SITE, '') || '/'
}

function noticeHref(n: NoticeItem) {
  const url = n.commentSharpURL || n.url || ''
  return url ? localize(url) : ''
}

function noticeTitle(n: NoticeItem) {
  return n.commentArticleTitle || n.articleTitle || ''
}

function noticeAuthor(n: NoticeItem) {
  return n.commentAuthorName || n.authorName || n.userName || ''
}

function noticeAvatar(n: NoticeItem) {
  return n.commentAuthorThumbnailURL || n.thumbnailURL || n.userAvatarURL || ''
}

/** 聊天室 @（dataType 38）的 content 是原始 Markdown，其余为服务端渲染好的 HTML。 */
function isPlain(n: NoticeItem) {
  return !n.commentContent && !n.description && Boolean(n.content)
}

function plainText(n: NoticeItem) {
  return (n.content || '').replace(/<[^>]*>/g, '').trim()
}

function noticeHtml(n: NoticeItem) {
  const html = n.commentContent || n.description || n.content || ''
  return html.replace(/href="https?:\/\/fishpi\.cn(?=[/"])/g, 'href="')
}

function onBodyClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
  const a = (e.target as HTMLElement).closest('a')
  const href = a?.getAttribute('href') || ''
  if (!href.startsWith('/') || href.startsWith('//') || a?.target === '_blank') return
  e.preventDefault()
  void router.push(href)
}

function noticeTime(n: NoticeItem) {
  const raw = n.commentCreateTime || n.createTime || ''
  const m = raw.match(/^\w{3} (\w{3}) (\d{2}) (\d{2}:\d{2}):\d{2} \w+ (\d{4})$/)
  if (!m) return raw
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mm = String(months.indexOf(m[1]!) + 1).padStart(2, '0')
  return `${m[4]}-${mm}-${m[2]} ${m[3]}`
}

async function readType() {
  if (!apiKey.value) return
  try {
    await markNoticeRead(apiKey.value, type.value)
    await notices.refresh()
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '标记已读失败'
  }
}

async function readAll() {
  if (!apiKey.value) return
  try {
    await markAllNoticesRead(apiKey.value)
    await notices.refresh()
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '标记已读失败'
  }
}
</script>

<template>
  <section class="card">
    <header>
      <h1>通知</h1>
      <div class="ops">
        <button type="button" @click="readType">本类已读</button>
        <button type="button" @click="readAll">全部已读</button>
      </div>
    </header>
    <p v-if="usingMock" class="hint">通知数据异常，请刷新重试。</p>
    <nav>
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        :class="{ on: type === tab.id }"
        @click="type = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>
    <FpLoading v-if="loading" :rows="6" />
    <p v-else-if="error" class="err">{{ error }}</p>
    <ol v-else>
      <li v-if="!items.length" class="hint">暂无通知</li>
      <li v-for="(n, i) in items" :key="n.oId || i" :class="{ unread: n.hasRead === false }">
        <RouterLink v-if="noticeAuthor(n)" :to="`/member/${noticeAuthor(n)}`" class="avatar">
          <img v-if="noticeAvatar(n)" :src="noticeAvatar(n)" alt="" loading="lazy" />
        </RouterLink>
        <div class="col">
          <div class="meta">
            <RouterLink v-if="noticeAuthor(n) && !n.description" :to="`/member/${noticeAuthor(n)}`">{{
              noticeAuthor(n)
            }}</RouterLink>
            <RouterLink v-if="noticeHref(n) && noticeTitle(n)" :to="noticeHref(n)" class="title">{{
              noticeTitle(n)
            }}</RouterLink>
            <RouterLink v-else-if="String(n.dataType) === '38'" to="/cr" class="title">聊天室</RouterLink>
            <time>{{ noticeTime(n) }}</time>
          </div>
          <div v-if="isPlain(n)" class="body plain">{{ plainText(n) }}</div>
          <div v-else class="body" @click="onBodyClick" v-html="noticeHtml(n)" />
        </div>
      </li>
    </ol>
    <footer class="pager">
      <button type="button" :disabled="page <= 1" @click="page -= 1">上一页</button>
      <span>{{ page }}</span>
      <button type="button" :disabled="items.length < 10" @click="page += 1">下一页</button>
    </footer>
  </section>
</template>

<style scoped>
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 18px 20px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
h1 {
  margin: 0;
  font-size: 18px;
}
nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0;
}
nav button,
.ops button {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
}
nav button.on {
  border-color: var(--fp-primary);
  color: var(--fp-link);
}
.hint,
time {
  color: var(--fp-muted);
  font-size: 12px;
}
.err {
  color: #e07a5f;
}
ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--fp-border);
}
.avatar {
  flex: none;
  margin: 0;
}
.avatar img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}
.col {
  flex: 1;
  min-width: 0;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
}
.meta a {
  margin: 0;
}
.meta time {
  margin-left: auto;
}
li.unread {
  background: var(--fp-hover);
  margin: 0 -8px;
  padding: 10px 8px;
  border-radius: 8px;
}
a {
  color: var(--fp-link);
  text-decoration: none;
  margin-right: 8px;
}
.body {
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.body.plain {
  white-space: pre-wrap;
}
.body :deep(img) {
  max-width: 100%;
  height: auto;
}
.body :deep(a) {
  color: var(--fp-link);
  text-decoration: none;
}
.body :deep(p) {
  margin: 0;
}
.pager {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  align-items: center;
}
</style>
