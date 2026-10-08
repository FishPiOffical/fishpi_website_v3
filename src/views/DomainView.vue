<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchDomains, type DomainItem } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeDomainsPayload } from '@/seo/payload'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'
import { createSwrLoader } from '@/utils/swr'

usePageSeo(() => ({ title: '领域', path: '/domains', description: '摸鱼派领域列表' }))

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const domains = ref<DomainItem[]>([])
const error = ref('')
const loading = ref(true)

const swr = createSwrLoader({ loading, error })

async function load() {
  await swr(
    'domains',
    async () => consumeDomainsPayload() || fetchDomains(apiKey.value),
    (data) => {
      domains.value = data
      error.value = data.length ? '' : '暂无领域'
    },
    '领域加载失败',
  )
}

watch(apiKey, () => void load(), { immediate: true })
</script>

<template>
  <section class="board">
    <h1>领域</h1>
    <FpLoading v-if="loading" />
    <p v-else-if="error" class="err">{{ error }}</p>
    <ul v-else>
      <li v-for="item in domains" :key="item.uri">
        <RouterLink :to="`/domain/${item.uri}`">
          <img v-if="item.domainIconPath" :src="item.domainIconPath" alt="" />
          <div>
            <strong>{{ item.domainTitle }}</strong>
            <span>{{ item.domainDescription }}</span>
          </div>
          <em>{{ item.domainArticleCount ?? 0 }} 帖</em>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.board {
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border-radius: 10px;
  padding: 15px;
}
h1 {
  margin: 0 0 12px;
  font-size: 16px;
  color: var(--fp-head);
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.err {
  color: #e07a5f;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}
a {
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  text-decoration: none;
  padding: 12px;
  border-radius: 8px;
  background: var(--fp-hover);
}
img {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}
div {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
strong {
  color: var(--fp-link);
}
span,
em {
  color: var(--fp-muted);
  font-size: 13px;
  font-style: normal;
}
</style>
