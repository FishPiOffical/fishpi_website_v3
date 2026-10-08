<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchAdminStat } from '@/api/admin'
import type { AdminStat } from '@/api/admin.mock'

const stat = ref<AdminStat | null>(null)
const loading = ref(true)

onMounted(async () => {
  loading.value = true
  try {
    stat.value = await fetchAdminStat()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="panel">
    <h2>仪表盘</h2>
    <p class="hint">数据来自假数据或未来的 <code>GET /api/admin/stats</code>。</p>
    <p v-if="loading" class="hint">加载中…</p>
    <ul v-else-if="stat" class="stats">
      <li>在线游客 {{ stat.onlineVisitorCnt }}</li>
      <li>在线会员 {{ stat.onlineMemberCnt }}</li>
      <li>历史最高在线 {{ stat.maxOnlineVisitorCount }}</li>
      <li>会员 {{ stat.memberCount }}</li>
      <li>帖子 {{ stat.articleCount }}</li>
      <li>评论 {{ stat.cmtCount }}</li>
      <li>领域 {{ stat.domainCount }}</li>
      <li>标签 {{ stat.tagCount }}</li>
    </ul>
  </section>
</template>

<style scoped>
.panel {
  background: var(--fp-card);
  border-radius: 8px;
  box-shadow: var(--fp-card-shadow);
  padding: 16px 18px;
}
h2 {
  margin: 0 0 8px;
  font-size: 18px;
  color: var(--fp-title);
}
.hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--fp-muted);
}
.stats {
  margin: 0;
  padding-left: 18px;
  line-height: 1.8;
  font-size: 14px;
  color: var(--fp-text);
}
</style>
