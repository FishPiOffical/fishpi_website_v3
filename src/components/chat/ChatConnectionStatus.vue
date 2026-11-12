<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

const { isLoggedIn } = storeToRefs(useAuthStore())
const { connected, connecting } = storeToRefs(useChatStore())
</script>

<template>
  <span class="chat-connection-status" :class="{ 'is-connected': connected }" role="status">
    <span class="status-dot" aria-hidden="true" />
    {{ connected ? '实时连接' : connecting ? '连接中' : isLoggedIn ? '未连接' : '游客模式' }}
  </span>
</template>

<style scoped>
.chat-connection-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-inline-start: 6px;
  color: var(--fp-muted);
  font-size: 11px;
  white-space: nowrap;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fp-muted);
}
.is-connected { color: var(--fp-primary-ink, var(--fp-primary)); }
.is-connected .status-dot { background: var(--fp-primary); }
</style>
