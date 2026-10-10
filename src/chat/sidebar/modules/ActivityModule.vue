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
</style>
