<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchDomains, type DomainItem } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const domains = ref<DomainItem[]>([])
const error = ref('')
const loading = ref(true)
const mocked = ref(false)

onMounted(async () => {
  try {
    const list = await fetchDomains(apiKey.value)
    domains.value = list
    mocked.value = list.every((d) => ['programmer', 'life', 'community'].includes(d.uri)) && list.length <= 3
  } catch (e) {
    error.value = e instanceof Error ? e.message : '领域加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="card">
    <h1>领域</h1>
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <p v-else-if="mocked" class="hint">
      <code>GET /api/domains</code> 尚未提供，展示约定字段 mock。正式接口就绪后自动切换。
    </p>
    <ul>
      <li v-for="item in domains" :key="item.uri">
        <RouterLink :to="`/domain/${item.uri}`">
          <strong>{{ item.domainTitle }}</strong>
          <span>{{ item.domainDescription }}</span>
          <em>{{ item.domainArticleCount ?? 0 }} 帖</em>
        </RouterLink>
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
  display: grid;
  gap: 10px;
}
a {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: inherit;
  text-decoration: none;
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  padding: 12px;
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
