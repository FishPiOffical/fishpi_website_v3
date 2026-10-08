<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import SideBar from '@/components/SideBar.vue'
import { usePageSeo } from '@/composables/usePageSeo'

type WatchTab = 'tags' | 'users' | 'breezemoons'

const TABS: { tab: WatchTab; to: string; label: string; api: string }[] = [
  { tab: 'tags', to: '/watch', label: '关注标签', api: 'GET /api/watch/tags/articles?p=&size=' },
  { tab: 'users', to: '/watch/users', label: '关注用户', api: 'GET /api/watch/users/articles?p=&size=' },
  { tab: 'breezemoons', to: '/watch/breezemoons', label: '清风明月', api: 'GET /api/watch/breezemoons?p=&size=' },
]

const route = useRoute()
const current = computed(() => TABS.find((t) => t.tab === route.meta.watchTab) || TABS[0])

usePageSeo(() => ({ title: `关注 · ${current.value.label}`, path: route.path, robots: 'noindex' }))
</script>

<template>
  <div class="wrapper watch-wrap">
    <div class="content">
      <div class="module">
        <div class="module-header watch-head">
          <h2>关注</h2>
          <nav class="watch-tabs">
            <RouterLink v-for="t in TABS" :key="t.tab" :to="t.to" :class="{ current: current.tab === t.tab }">
              {{ t.label }}
            </RouterLink>
          </nav>
        </div>
        <div class="pending">
          <p>「{{ current.label }}」动态现网只有服务端渲染页面，暂无 JSON 接口，等待后端开放。</p>
          <code>{{ current.api }}</code>
        </div>
      </div>
    </div>
    <div class="side">
      <SideBar />
    </div>
  </div>
</template>

<style scoped>
.watch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
}
.watch-head h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--fp-title);
}
.watch-tabs {
  display: flex;
  gap: 4px;
  font-size: 13px;
}
.watch-tabs a {
  color: var(--fp-muted);
  padding: 2px 6px;
}
.watch-tabs a + a::before {
  content: '/';
  margin-right: 8px;
  color: var(--fp-border);
}
.watch-tabs a.current {
  color: var(--fp-title);
  font-weight: 600;
}
.pending {
  padding: 40px 18px;
  text-align: center;
  color: var(--fp-muted);
  font-size: 14px;
}
.pending code {
  display: inline-block;
  margin-top: 8px;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 4px;
  background: var(--fp-hover);
}
</style>
