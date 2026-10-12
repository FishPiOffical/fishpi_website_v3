<script setup lang="ts">
import { storeToRefs } from 'pinia'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import { useAuthStore } from '@/stores/auth'

const { isLoggedIn } = storeToRefs(useAuthStore())
</script>

<template>
  <div class="activity">
    <CheckinPanel v-if="isLoggedIn" />
    <p v-else class="guest-hint">登录后查看今日活跃情况</p>
  </div>
</template>

<style scoped>
.guest-hint {
  margin: 0;
  color: var(--fp-muted);
  font-size: 12px;
}
.activity :deep(.checkin-card) {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  margin-bottom: 0;
}
.activity :deep(.checkin-head .title) {
  display: none;
}
.activity :deep(.checkin-head) { margin-bottom: 10px; }
.activity :deep(.liveness-badge) { padding: 0; border-radius: 0; background: transparent; color: var(--fp-primary); font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.activity :deep(.progress-bar) { height: 4px; margin-bottom: 12px; }
.activity :deep(.progress-fill) { background: var(--fp-primary); }
.activity :deep(.checkin-footer) { flex-wrap: wrap; gap: 10px; }
.activity :deep(.auto-status) { line-height: 1.5; }
.activity :deep(.auto-status.ok) { color: var(--fp-primary); }
.activity :deep(.status-dot) { background: var(--fp-muted); width: 5px; height: 5px; }
.activity :deep(.auto-status.ok .status-dot) { background: var(--fp-primary); }
.activity :deep(.collect-btn) { border: 1px solid var(--fp-border); border-radius: 5px; background: transparent; color: var(--fp-text); padding: 4px 8px; font-size: 11px; }
.activity :deep(.collect-btn:hover) { background: var(--fp-hover); border-color: var(--fp-primary); }
.activity :deep(.collect-btn:focus-visible) { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
</style>
