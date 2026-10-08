<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => String(route.meta.adminTitle || '管理'))
</script>

<template>
  <section class="panel">
    <h2>{{ title }}</h2>
    <p>
      现网对应 FTL 页 <code>{{ route.path }}</code>，尚无公开 JSON。本站只接了仪表盘与用户/帖/评/举报只读列表；完整写操作请继续用 Rhythm
      <code>/admin</code>，或等后端开放 <code>/api/admin/*</code>。
    </p>
    <p class="hint">见 docs/MISSING_APIS.md「管理后台」。</p>
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
p {
  margin: 0 0 10px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fp-text);
}
.hint {
  color: var(--fp-muted);
  font-size: 12px;
}
code {
  font-size: 12px;
}
</style>
