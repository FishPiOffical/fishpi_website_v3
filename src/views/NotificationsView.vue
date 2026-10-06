<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
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

async function load() {
  if (!apiKey.value) return
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchNotifications(apiKey.value, type.value, page.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '通知加载失败'
    items.value = []
  } finally {
    loading.value = false
  }
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

function noticeHref(n: NoticeItem) {
  return (n.commentSharpURL || n.url || '').replace('https://fishpi.cn', '')
}

function noticeTitle(n: NoticeItem) {
  return n.commentArticleTitle || n.articleTitle || n.userName || '通知'
}

function noticeHtml(n: NoticeItem) {
  return n.commentContent || n.content || n.description || ''
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
    <p v-if="usingMock" class="hint">GET /api/getNotifications 未返回数据时展示约定字段 mock。</p>
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
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ol v-else>
      <li v-if="!items.length" class="hint">暂无通知</li>
      <li v-for="(n, i) in items" :key="i" :class="{ unread: n.hasRead === false }">
        <RouterLink v-if="n.commentAuthorName" :to="`/member/${n.commentAuthorName}`">{{ n.commentAuthorName }}</RouterLink>
        <RouterLink v-else-if="n.authorName" :to="`/member/${n.authorName}`">{{ n.authorName }}</RouterLink>
        <RouterLink v-else-if="n.userName" :to="`/member/${n.userName}`">{{ n.userName }}</RouterLink>
        <RouterLink v-if="noticeHref(n)" :to="noticeHref(n)">{{ noticeTitle(n) }}</RouterLink>
        <span v-if="!noticeHref(n)">{{ noticeTitle(n) }}</span>
        <div class="body" v-html="noticeHtml(n)" />
        <time>{{ n.commentCreateTime || n.createTime }}</time>
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
  padding: 10px 0;
  border-bottom: 1px solid var(--fp-border);
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
  margin: 6px 0;
  font-size: 14px;
}
.pager {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  align-items: center;
}
</style>
