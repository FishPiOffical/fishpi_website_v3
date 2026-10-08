<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { adminNav, isAdminAccount } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { isLoggedIn, account } = storeToRefs(auth)

const isAdmin = computed(() => isAdminAccount(account.value))
const force = computed(() => route.query.force === '1')

onMounted(async () => {
  if (!isLoggedIn.value) {
    await router.replace({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  if (!account.value && auth.apiKey) await auth.restore()
})

function current(to: string, exact?: boolean) {
  if (exact) return route.path === to || route.path === `${to}/`
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <div class="admin">
    <aside class="side">
      <h1>管理后台</h1>
      <p class="hint">Vue 壳 + 假数据；现网无 /api/admin JSON。</p>
      <nav>
        <RouterLink
          v-for="item in adminNav"
          :key="item.to"
          :to="item.to"
          :class="{ current: current(item.to, 'exact' in item && item.exact) }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <RouterLink class="back" to="/">← 返回站点</RouterLink>
    </aside>
    <div class="main">
      <p v-if="isLoggedIn && !isAdmin" class="warn">
        当前账号角色不像管理员（roleId={{ account?.roleId || account?.userRole || '未知' }}）。
        可浏览假数据壳；写操作需 Rhythm 管理员会话。
        <template v-if="!force">
          <RouterLink :to="{ query: { ...route.query, force: '1' } }">标记已了解</RouterLink>
        </template>
      </p>
      <RouterView v-if="isLoggedIn" />
    </div>
  </div>
</template>

<style scoped>
.admin {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto;
  align-items: start;
}
.side {
  position: sticky;
  top: calc(var(--fp-nav-h) + 12px);
  background: var(--fp-card);
  border-radius: 8px;
  box-shadow: var(--fp-card-shadow);
  padding: 14px 12px;
}
h1 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--fp-title);
}
.hint {
  margin: 0 0 10px;
  font-size: 11px;
  color: var(--fp-muted);
  line-height: 1.4;
}
nav {
  display: flex;
  flex-direction: column;
}
nav a {
  padding: 8px 10px;
  color: var(--fp-text);
  text-decoration: none;
  font-size: 13px;
  border-radius: 6px;
}
nav a:hover {
  background: var(--fp-hover);
}
nav a.current {
  color: var(--fp-primary);
  font-weight: 600;
  background: var(--fp-hover);
}
.back {
  display: inline-block;
  margin-top: 12px;
  font-size: 12px;
  color: var(--fp-link);
}
.main {
  min-width: 0;
}
.warn {
  background: rgba(224, 122, 95, 0.12);
  border: 1px solid rgba(224, 122, 95, 0.35);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  margin: 0 0 12px;
}
.warn a {
  color: var(--fp-link);
}
@media (max-width: 800px) {
  .admin {
    grid-template-columns: 1fr;
  }
  .side {
    position: static;
  }
  nav {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
