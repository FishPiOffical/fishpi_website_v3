<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

defineProps<{ compact?: boolean }>()
const { isLoggedIn } = storeToRefs(useAuthStore())
const { connected, connecting } = storeToRefs(useChatStore())
</script>

<template>
  <span class="chat-connection-status" :class="{ 'is-connected': connected, 'is-compact': compact }" role="status" :title="connected ? '实时连接' : connecting ? '连接中' : isLoggedIn ? '未连接' : '游客模式'">
    <span class="status-dot" aria-hidden="true" />
    <span :class="{ 'sr-only': compact }">{{ connected ? '实时连接' : connecting ? '连接中' : isLoggedIn ? '未连接' : '游客模式' }}</span>
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
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.is-compact { margin-inline-start: 2px; padding: 8px 4px; }
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fp-muted);
}
.is-connected { color: var(--fp-primary-ink, var(--fp-primary)); }
.is-connected .status-dot { background: var(--fp-primary); }
</style>
