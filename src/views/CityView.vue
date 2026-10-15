<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchBreezemoons, type Breezemoon } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'
import SideBar from '@/components/SideBar.vue'
import { createSwrLoader } from '@/utils/swr'

const route = useRoute()
const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)
const cityName = computed(() => {
  try {
    return decodeURIComponent(String(route.params.cityName || ''))
  } catch {
    return String(route.params.cityName || '')
  }
})

usePageSeo(() => ({
  title: cityName.value ? `${cityName.value} · 同城` : '同城',
  path: `/city/${encodeURIComponent(cityName.value)}`,
  description: `${cityName.value} 同城摸鱼`,
  robots: 'noindex',
}))

const items = ref<Breezemoon[]>([])
const loading = ref(false)
const error = ref('')
const swr = createSwrLoader({ loading, error })

async function load() {
  if (!cityName.value || !apiKey.value) {
    items.value = []
    return
  }
  const city = cityName.value.trim()
  // 现网 /city/:name 为登录 HTML；JSON 城市场景暂用清风明月按城市过滤近似。
  await swr(
    `city:${city}`,
    async () => (await fetchBreezemoons(1, 50)).filter((m) => String(m.breezemoonCity || '').includes(city)),
    (data) => (items.value = data),
    '同城加载失败',
  )
}

watch(
  () => [cityName.value, apiKey.value],
  () => void load(),
  { immediate: true },
)
</script>

<template>
  <div class="wrapper list-page-wrap">
    <div class="content">
      <div class="module">
        <div class="module-header list-page-head">
          <div class="head-left">
            <h2>📍 {{ cityName || '同城' }}</h2>
            <span class="sub-tag">同城鱼油动态</span>
          </div>
          <div class="head-right">
            <span v-if="isLoggedIn" class="total-count">共 {{ items.length }} 条动态</span>
          </div>
        </div>

        <p class="mock-hint">
          同城页在现网需登录访问，此处展示清风明月中标注了「{{ cityName || '该城市' }}」的同城动态。
        </p>

        <p v-if="!isLoggedIn" class="empty-hint">
          <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
          后可查看同城动态。
        </p>
        <FpLoading v-else-if="loading" :rows="6" />
        <p v-else-if="error" class="err">{{ error }}</p>
        <p v-else-if="!items.length" class="empty-hint">暂无来自「{{ cityName }}」的清风明月动态</p>
        <ul v-else class="city-list">
          <li v-for="m in items" :key="m.oId" class="city-item">
            <RouterLink
              v-if="m.breezemoonAuthorName"
              :to="`/member/${m.breezemoonAuthorName}`"
              class="city-avatar-link"
            >
              <img
                v-if="m.breezemoonAuthorThumbnailURL48"
                class="city-avatar"
                :data-user-card="m.breezemoonAuthorName"
                :src="m.breezemoonAuthorThumbnailURL48"
                alt=""
              />
              <span v-else class="city-avatar fallback">{{ m.breezemoonAuthorName.slice(0, 1) }}</span>
            </RouterLink>
            <div class="city-main">
              <header class="city-meta">
                <b>
                  <RouterLink v-if="m.breezemoonAuthorName" :to="`/member/${m.breezemoonAuthorName}`">
                    {{ m.breezemoonAuthorName }}
                  </RouterLink>
                </b>
                <time>{{ m.timeAgo }}</time>
                <span v-if="m.breezemoonCity" class="city-pill">📍 {{ m.breezemoonCity }}</span>
              </header>
              <div class="body" v-html="m.breezemoonContent || ''" />
            </div>
          </li>
        </ul>
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
  gap: 12px;
}

.total-count {
  font-size: 12px;
  color: var(--fp-muted);
}

.mock-hint {
  padding: 10px 18px;
  margin: 0;
  background: var(--fp-hover);
  color: var(--fp-muted);
  font-size: 12px;
  border-bottom: 1px solid var(--fp-border);
}

.empty-hint,
.err {
  padding: 36px 18px;
  margin: 0;
  text-align: center;
  color: var(--fp-muted);
  font-size: 14px;
}

.err {
  color: var(--fp-danger, #e07a5f);
}

.city-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.city-item {
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--fp-border);
  transition: background-color 0.15s ease;
}

.city-item:last-child {
  border-bottom: 0;
}

.city-item:hover {
  background: var(--fp-hover);
}

.city-avatar-link {
  flex-shrink: 0;
  text-decoration: none;
}

.city-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.city-avatar.fallback {
  display: grid;
  place-items: center;
  background: var(--fp-hover);
  color: var(--fp-title);
  font-weight: 600;
  font-size: 14px;
}

.city-main {
  flex: 1;
  min-width: 0;
}

.city-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
}

.city-meta a {
  color: var(--fp-title);
  text-decoration: none;
}

.city-meta a:hover {
  color: var(--fp-link);
}

.city-meta time {
  color: var(--fp-muted);
  font-size: 12px;
}

.city-pill {
  font-size: 11px;
  color: var(--fp-muted);
  background: var(--fp-hover);
  padding: 1px 7px;
  border-radius: 999px;
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
</style>
