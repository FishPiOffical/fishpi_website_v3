<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchUserMedals, fetchUserProfile, type MetalItem, type UserProfile } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'
import { createSwrLoader } from '@/utils/swr'

const route = useRoute()
const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const userName = computed(() => String(route.params.userName || ''))
const profile = ref<UserProfile | null>(null)
const medals = ref<MetalItem[]>([])
const loading = ref(true)
const error = ref('')

usePageSeo(() => ({
  title: `${userName.value || '用户'} 的徽章`,
  path: `/member/${userName.value}/medals`,
  description: `${userName.value} 在摸鱼派获得的徽章`,
}))

function metalSrc(m: MetalItem) {
  const attr = String(m.attr || '').trim()
  if (!attr) return ''
  if (/^https?:\/\//i.test(attr)) return attr
  if (attr.includes('=')) return `https://fishpi.cn/gen?${attr.replace(/^\?/, '')}`
  return `https://fishpi.cn/gen?id=${encodeURIComponent(attr)}`
}

const swr = createSwrLoader({ loading, error })

async function load() {
  const name = userName.value
  if (!name) return
  await swr(
    `medals:${name}`,
    async () => {
      const p = await fetchUserProfile(name, apiKey.value)
      const extra = apiKey.value ? await fetchUserMedals(apiKey.value, name) : []
      const map = new Map<string, MetalItem>()
      for (const m of [...(p.sysMetal || []), ...extra]) {
        const key = `${m.name || ''}|${m.attr || ''}`
        if (!map.has(key)) map.set(key, m)
      }
      return { profile: p, medals: [...map.values()] }
    },
    (data) => {
      profile.value = data.profile
      medals.value = data.medals
    },
    '徽章加载失败',
  )
}

watch(
  () => [userName.value, apiKey.value],
  () => void load(),
  { immediate: true },
)
</script>

<template>
  <section class="card">
    <h1>
      <RouterLink :to="`/member/${userName}`">{{ profile?.userNickname || userName }}</RouterLink>
      的徽章
    </h1>
    <FpLoading v-if="loading" />
    <p v-else-if="error" class="err">{{ error }}</p>
    <ul v-else class="grid">
      <li v-if="!medals.length" class="hint">还没有徽章</li>
      <li v-for="(m, i) in medals" :key="(m.name || '') + i">
        <img v-if="metalSrc(m)" :src="metalSrc(m)" :alt="m.name || '徽章'" />
        <div>
          <b>{{ m.name || '徽章' }}</b>
          <p>{{ m.description || '—' }}</p>
        </div>
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
  margin: 0 0 14px;
  font-size: 18px;
}
.hint {
  color: var(--fp-muted);
}
.err {
  color: #e07a5f;
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.grid li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  padding: 10px;
}
img {
  width: 56px;
  height: 56px;
  object-fit: contain;
  flex-shrink: 0;
}
b {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
}
p {
  margin: 0;
  font-size: 12px;
  color: var(--fp-muted);
  line-height: 1.4;
}
a {
  color: var(--fp-link);
  text-decoration: none;
}
</style>
