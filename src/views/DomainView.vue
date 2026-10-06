<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchRecentArticles } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)
const tags = ref<string[]>([])
const error = ref('')

onMounted(async () => {
  if (!apiKey.value) return
  try {
    const arts = await fetchRecentArticles(apiKey.value, 1, 40)
    const set = new Set<string>()
    for (const a of arts) {
      for (const t of (a.articleTags || '').split(',').map((s) => s.trim()).filter(Boolean)) set.add(t)
    }
    tags.value = [...set]
  } catch (e) {
    error.value = e instanceof Error ? e.message : '领域加载失败'
  }
})

const emptyLogin = computed(() => !isLoggedIn.value)
</script>

<template>
  <section class="card">
    <h1>领域</h1>
    <p v-if="emptyLogin" class="hint">
      领域列表需要登录。
      <RouterLink to="/login">去登录</RouterLink>
    </p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <p v-else class="hint">P1 先用最近帖子标签近似领域，完整领域接口后续再接。</p>
    <ul>
      <li v-for="tag in tags" :key="tag">
        <RouterLink :to="{ path: '/search', query: { q: tag } }">{{ tag }}</RouterLink>
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
ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  padding: 0;
}
a {
  color: var(--fp-link);
  text-decoration: none;
  border: 1px solid var(--fp-border);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 13px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.err {
  color: #e07a5f;
}
</style>
