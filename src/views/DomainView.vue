<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchDomains, type DomainItem } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeDomainsPayload } from '@/seo/payload'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'
import SideBar from '@/components/SideBar.vue'
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
  <div class="wrapper list-page-wrap">
    <div class="content">
      <div class="module">
        <div class="module-header list-page-head">
          <div class="head-left">
            <h2>领域</h2>
            <span class="sub-tag">探索感兴趣的社区专题</span>
          </div>
          <div class="head-right">
            <span v-if="domains.length" class="total-count">共 {{ domains.length }} 个领域</span>
          </div>
        </div>

        <FpLoading v-if="loading" :rows="6" />
        <p v-else-if="error" class="err">{{ error }}</p>
        <ul v-else class="domain-list">
          <li v-for="item in domains" :key="item.uri">
            <RouterLink :to="`/domain/${item.uri}`" class="domain-item">
              <img v-if="item.domainIconPath" :src="item.domainIconPath" alt="" />
              <span v-else class="domain-fallback">{{ (item.domainTitle || '域').slice(0, 1) }}</span>
              <div class="domain-info">
                <strong>{{ item.domainTitle }}</strong>
                <span v-if="item.domainDescription">{{ item.domainDescription }}</span>
              </div>
              <em class="domain-count">{{ item.domainArticleCount ?? 0 }} 帖</em>
            </RouterLink>
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

.err {
  padding: 36px 18px;
  margin: 0;
  text-align: center;
  color: var(--fp-danger, #e07a5f);
  font-size: 14px;
}

.domain-list {
  list-style: none;
  padding: 16px 18px;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.domain-item {
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  text-decoration: none;
  padding: 12px 14px;
  border-radius: var(--fp-radius-md, 8px);
  border: 1px solid var(--fp-border);
  background: var(--fp-bg);
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.domain-item:hover {
  border-color: var(--fp-border-strong, var(--fp-border));
  background: var(--fp-hover);
  text-decoration: none;
}

.domain-item img,
.domain-fallback {
  width: 40px;
  height: 40px;
  border-radius: var(--fp-radius-sm, 6px);
  object-fit: cover;
  flex-shrink: 0;
}

.domain-fallback {
  display: grid;
  place-items: center;
  background: var(--fp-hover);
  color: var(--fp-primary);
  font-weight: 600;
  font-size: 16px;
}

.domain-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.domain-info strong {
  color: var(--fp-title);
  font-size: 14px;
}

.domain-info span {
  color: var(--fp-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.domain-count {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--fp-hover);
  color: var(--fp-muted);
  font-size: 11px;
  font-style: normal;
}

@media (max-width: 700px) {
  .domain-list {
    grid-template-columns: 1fr;
  }
}
</style>
