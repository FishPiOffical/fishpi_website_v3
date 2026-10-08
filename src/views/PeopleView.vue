<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchFollowers, fetchFollowingUsers, type SimpleUser } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const kind = computed(() => (route.meta.people === 'followers' ? 'followers' : 'following'))
const userName = computed(() => String(route.params.userName || ''))
const items = ref<SimpleUser[]>([])
const page = ref(1)
const loading = ref(false)
const error = ref('')
const usingMock = computed(() => items.value.some((u) => String(u.oId).startsWith('mock-')))

async function load() {
  if (!userName.value) return
  loading.value = true
  error.value = ''
  try {
    items.value =
      kind.value === 'followers'
        ? await fetchFollowers(userName.value, apiKey.value, page.value)
        : await fetchFollowingUsers(userName.value, apiKey.value, page.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
    items.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [userName.value, kind.value],
  () => {
    page.value = 1
  },
)

watch(
  () => [userName.value, kind.value, apiKey.value, page.value],
  () => void load(),
  { immediate: true },
)
</script>

<template>
  <section class="card">
    <h1>
      <RouterLink :to="`/member/${userName}`">{{ userName }}</RouterLink>
      的{{ kind === 'followers' ? '粉丝' : '关注' }}
    </h1>
    <p v-if="usingMock" class="hint">关注/粉丝接口返回异常数据。</p>
    <p v-else-if="!apiKey && !items.length && !loading" class="hint">
      <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
      后可查看完整名单（部分接口需登录）。
    </p>
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ul v-else>
      <li v-if="!items.length" class="hint">暂无名单</li>
      <li v-for="u in items" :key="u.oId">
        <img v-if="u.userAvatarURL" class="fp-avatar" :src="u.userAvatarURL" alt="" />
        <RouterLink :to="`/member/${u.userName}`">{{ u.userNickname || u.userName }}</RouterLink>
      </li>
    </ul>
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
h1 {
  margin: 0 0 12px;
  font-size: 18px;
}
h1 a {
  color: var(--fp-link);
  text-decoration: none;
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
  margin: 0;
  padding: 0;
}
li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--fp-border);
}
.fp-avatar {
  width: 32px;
  height: 32px;
}
a {
  color: var(--fp-text);
  text-decoration: none;
}
.pager {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  align-items: center;
}
.pager button {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 8px;
  padding: 4px 12px;
  cursor: pointer;
}
</style>
