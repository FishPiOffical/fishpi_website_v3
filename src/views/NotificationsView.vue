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
import { DEFAULT_AVATAR } from '@/utils/avatar'
import NoticeIcon from '@/components/notifications/NoticeIcon.vue'

const tabs: { id: NoticeType; label: string; hint: string; unreadKey: keyof UnreadCount }[] = [
  { id: 'commented', label: '回帖', hint: '你发布的帖子有了新的回帖', unreadKey: 'unreadCommentedNotificationCnt' },
  { id: 'reply', label: '回复', hint: '与你的评论相关的回复', unreadKey: 'unreadReplyNotificationCnt' },
  { id: 'at', label: '@我', hint: '帖子、评论与聊天室中的提及', unreadKey: 'unreadAtNotificationCnt' },
  { id: 'following', label: '关注', hint: '你关注的人与内容的新动态', unreadKey: 'unreadFollowingNotificationCnt' },
  { id: 'point', label: '积分', hint: '积分收支与奖励通知', unreadKey: 'unreadPointNotificationCnt' },
  { id: 'broadcast', label: '同城', hint: '来自同城鱼油的消息', unreadKey: 'unreadBroadcastNotificationCnt' },
  { id: 'sys-announce', label: '系统', hint: '站点公告与系统消息', unreadKey: 'unreadSysAnnounceNotificationCnt' },
]

const auth = useAuthStore()
const notices = useNoticeStore()
const { apiKey } = storeToRefs(auth)
const { unread } = storeToRefs(notices)

function firstUnread(u: UnreadCount): NoticeType {
  return tabs.find((tab) => Number(u[tab.unreadKey] || 0) > 0)?.id || 'commented'
}

const type = ref<NoticeType>(firstUnread(unread.value))
const items = ref<NoticeItem[]>([])
const page = ref(1)
const loading = ref(false)
const error = ref('')
const marking = ref(false)
const currentTab = computed(() => tabs.find((tab) => tab.id === type.value)!)
const currentUnread = computed(() => tabUnread(currentTab.value.unreadKey))
const canReadType = computed(() => currentUnread.value > 0 || items.value.some((n) => n.hasRead === false))

function tabUnread(key: keyof UnreadCount) {
  return Math.max(0, Number(unread.value[key] || 0))
}

function countLabel(count: number) {
  return count > 99 ? '99+' : String(count)
}

function selectType(next: NoticeType) {
  page.value = 1
  type.value = next
}
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
  return n.commentAuthorThumbnailURL || n.thumbnailURL || n.userAvatarURL || DEFAULT_AVATAR
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
  if (!apiKey.value || marking.value) return
  marking.value = true
  try {
    await markNoticeRead(apiKey.value, type.value)
    await notices.refresh()
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '标记已读失败'
  } finally {
    marking.value = false
  }
}

async function readAll() {
  if (!apiKey.value || marking.value) return
  marking.value = true
  try {
    await markAllNoticesRead(apiKey.value)
    await notices.refresh()
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '标记已读失败'
  } finally {
    marking.value = false
  }
}
</script>

<template>
  <section class="notifications-page" aria-labelledby="notifications-title">
    <header class="page-heading">
      <div>
        <h1 id="notifications-title">通知</h1>
        <p class="page-summary" role="status">
          <template v-if="notices.total > 0">你有 <strong>{{ notices.total }}</strong> 条未读通知</template>
          <template v-else>暂时没有未读通知</template>
        </p>
      </div>
      <button type="button" class="action-button" :disabled="marking || notices.total <= 0" @click="readAll">
        <NoticeIcon name="check" />全部标为已读
      </button>
    </header>

    <div class="notification-layout">
      <aside class="category-panel">
        <p class="category-heading">消息分类</p>
        <nav class="categories" aria-label="通知分类">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="category"
            :class="{ selected: type === tab.id }"
            :aria-pressed="type === tab.id"
            aria-controls="notification-list"
            @click="selectType(tab.id)"
          >
            <NoticeIcon :name="tab.id" />
            <span>{{ tab.label }}</span>
            <span v-if="tabUnread(tab.unreadKey) > 0" class="count" :aria-label="`${tabUnread(tab.unreadKey)} 条未读`">{{ countLabel(tabUnread(tab.unreadKey)) }}</span>
          </button>
        </nav>
      </aside>

      <div id="notification-list" class="list-panel" :aria-busy="loading">
        <header class="list-heading">
          <div class="list-heading-copy">
            <div class="list-title"><h2>{{ currentTab.label }}</h2><span v-if="currentUnread > 0" class="unread-label">{{ currentUnread }} 条未读</span></div>
            <p>{{ currentTab.hint }}</p>
          </div>
          <div class="list-actions">
            <button type="button" class="read-button" :disabled="marking || !canReadType || loading" @click="readType">本类已读</button>
            <button type="button" class="refresh-button" aria-label="刷新通知" title="刷新通知" :disabled="loading || marking" @click="load"><NoticeIcon name="refresh" /></button>
          </div>
        </header>
        <p v-if="usingMock" class="hint data-hint">通知数据异常，请刷新重试。</p>
        <FpLoading v-if="loading" :rows="5" />
        <div v-else-if="error" class="empty-state error-state" role="alert">
          <span class="empty-icon"><NoticeIcon name="inbox" /></span>
          <h3>通知加载遇到问题</h3><p>{{ error }}</p>
          <button type="button" class="action-button" @click="load">重新加载</button>
        </div>
        <div v-else-if="!items.length" class="empty-state">
          <span class="empty-icon"><NoticeIcon :name="type" /></span>
          <h3>暂无{{ currentTab.label }}通知</h3><p>有新的消息时，会显示在这里</p>
        </div>
        <ol v-else class="notice-list">
          <li v-for="(n, i) in items" :key="n.oId || i" class="notice" :class="{ unread: n.hasRead === false }">
            <RouterLink v-if="noticeAuthor(n)" :to="`/member/${noticeAuthor(n)}`" class="avatar" :data-user-card="noticeAuthor(n)" :aria-label="`查看 ${noticeAuthor(n)} 的主页`">
              <img :src="noticeAvatar(n)" alt="" loading="lazy" @error="($event.target as HTMLImageElement).src = DEFAULT_AVATAR" />
            </RouterLink>
            <span v-else class="notice-symbol"><NoticeIcon :name="type" /></span>
            <div class="notice-content">
              <div class="notice-meta">
                <RouterLink v-if="noticeAuthor(n)" :to="`/member/${noticeAuthor(n)}`" class="author">{{ noticeAuthor(n) }}</RouterLink>
                <span v-else class="author">{{ currentTab.label }}消息</span>
                <span v-if="String(n.dataType) === '38'" class="source-label">聊天室</span>
                <span v-if="n.hasRead === false" class="unread-dot" aria-label="未读" />
                <time>{{ noticeTime(n) }}</time>
              </div>
              <RouterLink v-if="noticeHref(n) && noticeTitle(n)" :to="noticeHref(n)" class="notice-title">{{ noticeTitle(n) }}</RouterLink>
              <div v-if="isPlain(n)" class="notice-body plain">{{ plainText(n) }}</div>
              <div v-else class="notice-body" @click="onBodyClick" v-html="noticeHtml(n)" />
              <RouterLink v-if="String(n.dataType) === '38'" to="/cr" class="context-link">前往聊天室<NoticeIcon name="chevron" /></RouterLink>
            </div>
          </li>
        </ol>
        <footer v-if="!loading && !error && (items.length || page > 1)" class="pager" aria-label="通知分页">
          <span class="page-number">第 {{ page }} 页</span>
          <div class="page-buttons">
            <button type="button" :disabled="page <= 1 || marking" @click="page -= 1">上一页</button>
            <button type="button" :disabled="items.length < 10 || marking" @click="page += 1">下一页</button>
          </div>
        </footer>
      </div>
    </div>
  </section>
</template>

<style scoped>
.notifications-page { max-width: 1080px; margin: 0 auto; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin: 4px 0 24px; }
h1 { margin: 0; color: var(--fp-title); font-size: 24px; font-weight: 600; letter-spacing: .02em; }
.page-summary { margin: 7px 0 0; color: var(--fp-muted); font-size: 13px; }
.page-summary strong { color: var(--fp-accent); font-weight: 600; font-variant-numeric: tabular-nums; }
button { cursor: pointer; color: var(--fp-text); }
button:disabled { opacity: .45; cursor: default; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
.action-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 13px; border: 1px solid var(--fp-border); border-radius: 8px; background: var(--fp-card); font-size: 12px; white-space: nowrap; }
.action-button svg { width: 16px; height: 16px; }
.action-button:not(:disabled):hover { background: var(--fp-hover); }
.notification-layout { display: grid; grid-template-columns: 188px minmax(0, 1fr); gap: 22px; align-items: start; }
.category-panel { position: sticky; top: calc(var(--fp-nav-h) + 20px); padding: 16px 10px 10px; border: 1px solid var(--fp-border); border-radius: 12px; background: var(--fp-card); }
.category-heading { margin: 0 12px 12px; font-size: 11px; color: var(--fp-muted); letter-spacing: .1em; }
.categories { display: flex; flex-direction: column; gap: 4px; }
.category { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 43px; padding: 10px 12px; border: 0; border-radius: 8px; background: transparent; text-align: left; font-size: 13px; transition: background-color 160ms ease; }
.category svg { width: 18px; height: 18px; color: var(--fp-muted); flex: none; }
.category:hover { background: var(--fp-hover); }
.category.selected { color: var(--fp-accent); background: color-mix(in srgb, var(--fp-accent) 9%, var(--fp-card)); font-weight: 500; }
.category.selected svg { color: inherit; }
.count { display: grid; place-items: center; min-width: 19px; height: 19px; padding: 0 5px; margin-left: auto; border-radius: 6px; color: #fff; background: var(--fp-accent); font-size: 10px; font-weight: 500; font-variant-numeric: tabular-nums; }
.list-panel { min-width: 0; min-height: 470px; border: 1px solid var(--fp-border); border-radius: 12px; background: var(--fp-card); overflow: hidden; }
.list-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 22px 24px; border-bottom: 1px solid var(--fp-border); }
.list-heading-copy { min-width: 0; }
.list-title { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
h2 { margin: 0; color: var(--fp-title); font-size: 17px; font-weight: 500; }
.unread-label { color: var(--fp-accent); font-size: 11px; }
.list-heading p { margin: 6px 0 0; color: var(--fp-muted); font-size: 12px; line-height: 1.5; }
.list-actions { display: flex; gap: 8px; align-items: center; flex: none; }
.read-button, .refresh-button { padding: 6px 8px; border: 0; border-radius: 6px; background: transparent; color: var(--fp-muted); font-size: 12px; white-space: nowrap; }
.refresh-button { display: grid; place-items: center; width: 30px; height: 30px; }
.refresh-button svg { width: 16px; height: 16px; }
.read-button:not(:disabled):hover, .refresh-button:not(:disabled):hover { background: var(--fp-hover); }
.hint, time { color: var(--fp-muted); font-size: 11px; }
.data-hint { margin: 16px 24px; }
.notice-list { list-style: none; margin: 0; padding: 0 24px; }
.notice { position: relative; display: flex; align-items: flex-start; gap: 14px; padding: 22px 0; border-bottom: 1px solid var(--fp-border); }
.notice:last-child { border-bottom: 0; }
.notice.unread { background: color-mix(in srgb, var(--fp-accent) 4%, var(--fp-card)); margin: 0 -24px; padding: 22px 24px; }
.notice.unread::before { content: ''; position: absolute; top: 22px; bottom: 22px; left: 0; width: 3px; background: var(--fp-accent); border-radius: 0 3px 3px 0; }
.avatar, .notice-symbol { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 50%; overflow: hidden; }
.avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
.notice-symbol { color: var(--fp-muted); background: var(--fp-hover); border: 1px solid var(--fp-border); }
.notice-symbol svg { width: 19px; height: 19px; }
.notice-content { min-width: 0; flex: 1; }
.notice-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 9px; min-height: 20px; }
.author { color: var(--fp-text); font-size: 13px; font-weight: 500; overflow-wrap: anywhere; }
.source-label { color: var(--fp-muted); font-size: 10px; background: var(--fp-hover); padding: 2px 5px; border-radius: 4px; }
.unread-dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--fp-accent); }
time { margin-left: auto; font-variant-numeric: tabular-nums; }
a { text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 3px; }
.notice-title { display: inline-block; margin-top: 7px; color: var(--fp-title); font-size: 15px; font-weight: 500; line-height: 1.6; overflow-wrap: anywhere; }
.notice-body { margin-top: 7px; color: var(--fp-text); font-size: 13px; line-height: 1.8; overflow-wrap: anywhere; }
.notice-body.plain { white-space: pre-wrap; }
.notice-body :deep(img) { max-width: 100%; max-height: 240px; height: auto; object-fit: contain; border-radius: 6px; }
.notice-body :deep(img.emoji) { max-height: 24px; vertical-align: middle; }
.notice-body :deep(a) { color: var(--fp-link); text-decoration: none; }
.notice-body :deep(a:hover) { text-decoration: underline; text-underline-offset: 3px; }
.notice-body :deep(p) { margin: 0 0 5px; }
.notice-body :deep(p:last-child) { margin-bottom: 0; }
.notice-body :deep(blockquote) { margin: 8px 0; padding: 3px 12px; border-left: 2px solid var(--fp-border); color: var(--fp-muted); }
.context-link { display: inline-flex; align-items: center; gap: 3px; margin-top: 10px; color: var(--fp-muted); font-size: 11px; }
.context-link svg { width: 12px; height: 12px; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 360px; padding: 40px 24px; text-align: center; }
.empty-icon { display: grid; place-items: center; width: 62px; height: 62px; margin-bottom: 18px; border-radius: 20px; background: var(--fp-hover); color: var(--fp-muted); }
.empty-icon svg { width: 28px; height: 28px; }
.empty-state h3 { margin: 0; font-size: 15px; font-weight: 500; }
.empty-state p { margin: 8px 0 0; font-size: 12px; color: var(--fp-muted); line-height: 1.7; overflow-wrap: anywhere; }
.error-state .action-button { margin-top: 18px; }
.pager { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 24px; border-top: 1px solid var(--fp-border); }
.page-number { font-size: 12px; color: var(--fp-muted); font-variant-numeric: tabular-nums; }
.page-buttons { display: flex; gap: 8px; }
.page-buttons button { padding: 6px 11px; border: 1px solid var(--fp-border); border-radius: 6px; background: transparent; font-size: 12px; }
.page-buttons button:not(:disabled):hover { background: var(--fp-hover); }
@media (max-width: 760px) {
  .page-heading { margin-bottom: 18px; gap: 12px; }
  h1 { font-size: 21px; }
  .action-button { padding: 8px 10px; }
  .notification-layout { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .category-panel { position: static; padding: 7px; border-radius: 10px; }
  .category-heading { display: none; }
  .categories { flex-direction: row; overflow-x: auto; scrollbar-width: thin; }
  .category { flex: none; width: auto; min-height: 36px; padding: 8px 11px; gap: 6px; white-space: nowrap; }
  .category svg { display: none; }
  .count { height: 17px; min-width: 17px; font-size: 9px; }
  .list-heading { padding: 18px; gap: 8px; }
  .list-actions { gap: 2px; }
  .notice-list { padding: 0 18px; }
  .notice { gap: 10px; padding: 18px 0; }
  .notice.unread { margin: 0 -18px; padding: 18px; }
  .notice.unread::before { top: 18px; bottom: 18px; }
  .avatar, .notice-symbol { width: 32px; height: 32px; }
  .notice-meta time { width: 100%; margin-left: 0; font-size: 10px; }
  .notice-title { font-size: 14px; }
  .pager { padding: 16px 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .category { transition: none; }
}
</style>
