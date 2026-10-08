<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchBreezemoons, type Breezemoon } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'

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

async function load() {
  if (!cityName.value || !apiKey.value) {
    items.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    // 现网 /city/:name 为登录 HTML；JSON 城市场景暂用清风明月按城市过滤近似。
    const all = await fetchBreezemoons(1, 50)
    const key = cityName.value.trim()
    items.value = all.filter((m) => String(m.breezemoonCity || '').includes(key))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '同城加载失败'
    items.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [cityName.value, apiKey.value],
  () => void load(),
  { immediate: true },
)
</script>

<template>
  <section class="card">
    <h1>{{ cityName || '同城' }}</h1>
    <p class="hint">
      同城页在现网需登录。此处展示清风明月中标注了该城市的动态（近似实现）。
    </p>
    <p v-if="!isLoggedIn" class="hint">
      <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
      后可查看。
    </p>
    <p v-else-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ul v-else class="list">
      <li v-if="!items.length" class="hint">暂无来自「{{ cityName }}」的清风明月</li>
      <li v-for="m in items" :key="m.oId">
        <header>
          <RouterLink v-if="m.breezemoonAuthorName" :to="`/member/${m.breezemoonAuthorName}`">
            {{ m.breezemoonAuthorName }}
          </RouterLink>
          <time>{{ m.timeAgo || m.breezemoonCity }}</time>
        </header>
        <div class="body" v-html="m.breezemoonContent || ''" />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 18px 20px;
}
h1 {
  margin: 0 0 8px;
  font-size: 18px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.err {
  color: #e07a5f;
}
.list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}
li {
  padding: 12px 0;
  border-bottom: 1px solid var(--fp-border);
}
header {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 6px;
  font-size: 13px;
}
time {
  color: var(--fp-muted);
  font-size: 12px;
}
.body {
  font-size: 14px;
  line-height: 1.5;
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
a {
  color: var(--fp-link);
  text-decoration: none;
}
</style>
