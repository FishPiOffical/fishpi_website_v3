<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { fetchBreezemoons, postBreezemoon, removeBreezemoon, type Breezemoon } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { fpConfirm } from '@/composables/useDialog'
import { consumeBreezemoonsPayload } from '@/seo/payload'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'
import SideBar from '@/components/SideBar.vue'
import { createSwrLoader, writeCache } from '@/utils/swr'

usePageSeo(() => ({ title: '清风明月', path: '/breezemoons', description: '摸鱼派清风明月' }))

const auth = useAuthStore()
const { apiKey, isLoggedIn, account } = storeToRefs(auth)
const PAGE_SIZE = 30
const page = ref(1)
const myName = computed(() => account.value?.userName || '')
const items = ref<Breezemoon[]>([])
const error = ref('')
const loading = ref(true)
const draft = ref('')
const sending = ref(false)

const swr = createSwrLoader({ loading, error })

async function load() {
  await swr(
    `breezemoons:${page.value}`,
    async () => (page.value === 1 && consumeBreezemoonsPayload()) || fetchBreezemoons(page.value, PAGE_SIZE),
    (data) => (items.value = data),
  )
}

watch([apiKey, page], () => void load(), { immediate: true })

function scrollToTop() {
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
}

function prevPage() {
  if (page.value > 1) {
    page.value -= 1
    scrollToTop()
  }
}

function nextPage() {
  page.value += 1
  scrollToTop()
}

const removing = ref('')
async function remove(item: Breezemoon) {
  if (!apiKey.value) return
  const ok = await fpConfirm({
    title: '删除清风明月',
    message: '确定删除这条清风明月？删除后不可恢复。',
    confirmText: '删除',
    tone: 'danger',
  })
  if (!ok) return
  removing.value = item.oId
  try {
    await removeBreezemoon(apiKey.value, item.oId)
    items.value = items.value.filter((x) => x.oId !== item.oId)
    writeCache(`breezemoons:${page.value}`, items.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  } finally {
    removing.value = ''
  }
}

async function submit() {
  if (!apiKey.value || !draft.value.trim()) return
  sending.value = true
  try {
    await postBreezemoon(apiKey.value, draft.value.trim())
    draft.value = ''
    if (page.value === 1) await load()
    else page.value = 1
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发布失败'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="wrapper list-page-wrap">
    <div class="content">
      <div class="module">
        <div class="module-header list-page-head">
          <div class="head-left">
            <h2>清风明月</h2>
            <span class="sub-tag">记录当下的生活与思绪</span>
          </div>
          <div class="head-right">
            <span class="total-count">第 {{ page }} 页</span>
          </div>
        </div>

        <form v-if="isLoggedIn" class="composer" @submit.prevent="submit">
          <textarea
            v-model="draft"
            class="fp-input"
            rows="2"
            placeholder="与清风明月为伴，写一条动态…"
            @keydown.ctrl.enter.prevent="submit"
            @keydown.meta.enter.prevent="submit"
          />
          <button type="submit" class="fp-btn fp-btn--primary" :disabled="sending || !draft.trim()">
            {{ sending ? '发布中…' : '发布' }}
          </button>
        </form>

        <FpLoading v-if="loading" :rows="8" />
        <p v-else-if="error" class="err">{{ error }}</p>
        <p v-else-if="!items.length" class="empty-hint">暂无清风明月动态</p>
        <ol v-else class="bm-list">
          <li v-for="item in items" :key="item.oId" class="bm-item">
            <RouterLink
              v-if="item.breezemoonAuthorName"
              :to="`/member/${item.breezemoonAuthorName}`"
              class="bm-avatar-link"
            >
              <img
                v-if="item.breezemoonAuthorThumbnailURL48"
                class="bm-avatar"
                :data-user-card="item.breezemoonAuthorName"
                :src="item.breezemoonAuthorThumbnailURL48"
                alt=""
              />
              <span v-else class="bm-avatar fallback">{{ item.breezemoonAuthorName.slice(0, 1) }}</span>
            </RouterLink>
            <div class="bm-main">
              <header class="bm-meta">
                <b>
                  <RouterLink v-if="item.breezemoonAuthorName" :to="`/member/${item.breezemoonAuthorName}`">
                    {{ item.breezemoonAuthorName }}
                  </RouterLink>
                </b>
                <time>{{ item.timeAgo }}</time>
                <RouterLink
                  v-if="item.breezemoonCity"
                  :to="`/city/${encodeURIComponent(item.breezemoonCity)}`"
                  class="city-pill"
                >
                  📍 {{ item.breezemoonCity }}
                </RouterLink>
                <button
                  v-if="myName && item.breezemoonAuthorName === myName"
                  type="button"
                  class="del"
                  :disabled="removing === item.oId"
                  @click="remove(item)"
                >
                  删除
                </button>
              </header>
              <div class="body" v-html="item.breezemoonContent || ''" />
            </div>
          </li>
        </ol>

        <div v-if="!loading && (page > 1 || items.length >= PAGE_SIZE)" class="pagination-bar">
          <button type="button" class="btn page-btn" :disabled="page <= 1" @click="prevPage">
            ‹ 上一页
          </button>
          <span class="current-page-num">{{ page }}</span>
          <button type="button" class="btn page-btn" :disabled="items.length < PAGE_SIZE" @click="nextPage">
            下一页 ›
          </button>
        </div>
      </div>
    </div>

    <div class="side">
      <SideBar />
    </div>
  </div>
</template>

<style scoped>
.list-page-wrap {
  padding-top: 4px;
}

.list-page-head {
  padding: 12px 18px;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-left h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--fp-title);
}

.sub-tag {
  font-size: 12px;
  color: var(--fp-muted);
}

.head-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.total-count {
  font-size: 12px;
  color: var(--fp-muted);
}

.composer {
  display: flex;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--fp-border);
  background: color-mix(in srgb, var(--fp-hover) 50%, transparent);
  align-items: stretch;
}

.composer textarea {
  flex: 1;
}

.err,
.empty-hint {
  padding: 36px 18px;
  margin: 0;
  text-align: center;
  color: var(--fp-muted);
  font-size: 14px;
}

.err {
  color: var(--fp-danger, #e07a5f);
}

.bm-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.bm-item {
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--fp-border);
  transition: background-color 0.15s ease;
}

.bm-item:last-child {
  border-bottom: 0;
}

.bm-item:hover {
  background: var(--fp-hover);
}

.bm-avatar-link {
  flex-shrink: 0;
  text-decoration: none;
}

.bm-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.bm-avatar.fallback {
  display: grid;
  place-items: center;
  background: var(--fp-hover);
  color: var(--fp-title);
  font-weight: 600;
  font-size: 14px;
}

.bm-main {
  flex: 1;
  min-width: 0;
}

.bm-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
}

.bm-meta a {
  color: var(--fp-title);
  text-decoration: none;
}

.bm-meta a:hover {
  color: var(--fp-link);
}

.bm-meta time {
  color: var(--fp-muted);
  font-size: 12px;
}

.city-pill {
  font-size: 11px;
  color: var(--fp-muted) !important;
  background: var(--fp-hover);
  padding: 1px 7px;
  border-radius: 999px;
}

.city-pill:hover {
  color: var(--fp-link) !important;
}

.body {
  font-size: 14px;
  line-height: 1.6;
  color: var(--fp-text);
  word-break: break-all;
  overflow-wrap: anywhere;
}

.body :deep(a) {
  word-break: break-all;
  overflow-wrap: anywhere;
}

.body :deep(p) {
  margin: 0;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.del {
  margin-left: auto;
  border: 0;
  background: none;
  color: var(--fp-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.del:hover {
  color: var(--fp-danger, #e07a5f);
}

.pagination-bar {
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

.current-page-num {
  font-size: 14px;
  font-weight: 600;
  color: var(--fp-title);
  min-width: 24px;
  text-align: center;
}
</style>
